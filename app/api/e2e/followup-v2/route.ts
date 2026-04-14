import { NextResponse } from "next/server"
import { vucarV2Query, e2eQuery } from "@/lib/db"

export const dynamic = "force-dynamic"

const N8N_FOLLOWUP_WEBHOOK = "https://n8nai.vucar.vn/webhook/follow-up"
// Connector that holds the bearer token for zl.vucar.vn
const VUCAR_FRIENDS_CONNECTOR_ID = "a1b8debd-7e9d-45d4-8804-cb817d5504f5"

async function getBearerToken(): Promise<string> {
  const result = await e2eQuery(
    `SELECT auth_config FROM api_connectors WHERE id = $1 LIMIT 1`,
    [VUCAR_FRIENDS_CONNECTOR_ID]
  )

  if (!result.rows.length) {
    throw new Error(`Connector ${VUCAR_FRIENDS_CONNECTOR_ID} not found`)
  }

  let { auth_config } = result.rows[0]
  if (typeof auth_config === "string") {
    try { auth_config = JSON.parse(auth_config) } catch { /* keep raw */ }
  }

  if (auth_config?.type === "bearer" && auth_config?.token) return auth_config.token
  if (auth_config?.Authorization) return (auth_config.Authorization as string).replace(/^Bearer\s+/i, "")
  if (auth_config?.authorization) return (auth_config.authorization as string).replace(/^Bearer\s+/i, "")

  throw new Error("No bearer token in connector config")
}

/**
 * POST /api/e2e/followup-v2
 *
 * Streaming endpoint (heartbeat-based) to prevent connection drops during long AI processing.
 *
 * Flow:
 * 1. Resolve zalo_account from leads DB using phone → split into ownId:threadId
 * 2. GET chat history from zl.vucar.vn/api/accounts/{ownId}/messages/conversations/{threadId}/messages
 * 3. POST to n8n follow-up webhook with { phone, contact_name, chat_history }
 * 4. Return webhook response
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  const encoder = new TextEncoder()

  let phone: string
  let contactName: string

  try {
    const body = await request.json()
    phone = body.phone
    contactName = body.contactName || ""

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Missing phone" },
        { status: 400 }
      )
    }
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const stream = new ReadableStream({
    async start(controller) {
      const heartbeatInterval = setInterval(() => {
        try { controller.enqueue(encoder.encode("\n")) } catch { clearInterval(heartbeatInterval) }
      }, 10_000)

      try {
        // --- 1. Resolve zalo_account from leads DB ---
        console.log(`[FollowupV2] Resolving zalo_account for phone=${phone}...`)
        const leadResult = await vucarV2Query(
          `SELECT zalo_account
           FROM leads
           WHERE (phone = $1 OR additional_phone = $1)
           ORDER BY created_at DESC
           LIMIT 1`,
          [phone]
        )

        if (!leadResult.rows.length) {
          controller.enqueue(encoder.encode(JSON.stringify({ success: false, error: "No lead found for phone" })))
          return
        }

        const zaloAccount: string | null = leadResult.rows[0].zalo_account
        if (!zaloAccount) {
          controller.enqueue(encoder.encode(JSON.stringify({ success: false, error: "No zalo_account linked to this lead" })))
          return
        }

        const [ownId, threadId] = zaloAccount.split(":")
        if (!ownId || !threadId) {
          controller.enqueue(encoder.encode(JSON.stringify({ success: false, error: `Invalid zalo_account format: "${zaloAccount}"` })))
          return
        }

        console.log(`[FollowupV2] zalo_account resolved: ownId=${ownId}, threadId=${threadId}`)

        // --- 2. Fetch bearer token ---
        let bearerToken: string
        try {
          bearerToken = await getBearerToken()
        } catch (err) {
          controller.enqueue(encoder.encode(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) })))
          return
        }

        // --- 3. Fetch chat history from zl.vucar.vn ---
        const chatHistoryUrl = `https://zl.vucar.vn/api/accounts/${ownId}/messages/conversations/${threadId}/messages?limit=50`
        console.log(`[FollowupV2] Fetching chat history from: ${chatHistoryUrl}`)

        const chatRes = await fetch(chatHistoryUrl, {
          method: "GET",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${bearerToken}`,
          },
        })

        if (!chatRes.ok) {
          const errText = await chatRes.text()
          controller.enqueue(encoder.encode(JSON.stringify({
            success: false,
            error: `Failed to fetch chat history: ${chatRes.status}`,
            details: errText.substring(0, 500),
          })))
          return
        }

        const chatData = await chatRes.json().catch(() => ({}))
        const chatHistory = chatData?.data ?? chatData

        console.log(`[FollowupV2] Chat history fetched (${Array.isArray(chatHistory) ? chatHistory.length : "?"} messages)`)

        // --- 4. Call n8n follow-up webhook ---
        console.log(`[FollowupV2] Calling n8n follow-up webhook...`)
        const webhookRes = await fetch(N8N_FOLLOWUP_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            contact_name: contactName,
            chat_history: chatHistory,
          }),
        })

        if (!webhookRes.ok) {
          const errText = await webhookRes.text()
          controller.enqueue(encoder.encode(JSON.stringify({
            success: false,
            error: `n8n follow-up webhook failed: ${webhookRes.status}`,
            details: errText.substring(0, 500),
          })))
          return
        }

        const text = await webhookRes.text()
        let webhookData: any = null
        if (text.trim()) {
          try { webhookData = JSON.parse(text) } catch { webhookData = { raw: text } }
        }

        console.log(`[FollowupV2] Webhook responded successfully`)

        controller.enqueue(encoder.encode(JSON.stringify({
          success: true,
          data: webhookData,
          durationMs: Date.now() - startTime,
        })))
      } catch (error) {
        console.error("[FollowupV2] Fatal error:", error)
        controller.enqueue(encoder.encode(JSON.stringify({
          success: false,
          error: "Failed to process follow-up",
          details: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        })))
      } finally {
        clearInterval(heartbeatInterval)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    },
  })
}
