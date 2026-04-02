import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"
import { fetchZaloChatHistory } from "@/lib/chat-history-service"

export const dynamic = "force-dynamic"

const AKABIZ_SEND_MESSAGE_URL = "https://crm-vucar-api.vucar.vn/api/v1/akabiz/send-customer-message"
const N8N_AUTO_CHAT_WEBHOOK = "https://n8nai.vucar.vn/webhook/e2e-chat-vucar"

async function parseJsonResponse(res: Response, label: string) {
  const text = await res.text()
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error(`${label}: empty response body (status ${res.status})`)
  }
  try {
    return JSON.parse(trimmed)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`${label}: invalid JSON (status ${res.status}): ${msg}. Body preview: ${trimmed.substring(0, 500)}`)
  }
}

/**
 * POST /api/e2e/retrigger
 *
 * Streaming endpoint (heartbeat-based) to prevent connection drops during long AI processing.
 *
 * Flow:
 * 1. Resolve picId from CRM DB
 * 2. Fetch chat history (3-source fallback: AkaBiz → Vucar Zalo API → DB)
 * 3. Send chat history to n8n auto-chat webhook (may take minutes for AI generation)
 * 4. Extract message_suggestions from response
 * 5. Send messages to customer via AkaBiz
 * 6. Return final JSON result in the stream
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  const encoder = new TextEncoder()

  let phone: string
  let carId: string

  try {
    const body = await request.json()
    phone = body.phone
    carId = body.carId

    if (!phone || !carId) {
      return NextResponse.json(
        { success: false, error: "Missing phone or carId" },
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
      // Heartbeat every 10s to keep the connection alive during long AI processing
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode("\n"))
        } catch {
          clearInterval(heartbeatInterval)
        }
      }, 10_000)

      try {
        // --- 1. Resolve picId from CRM DB ---
        const leadResult = await vucarV2Query(
          `SELECT l.pic_id
           FROM cars c
           JOIN leads l ON l.id = c.lead_id
           WHERE c.id = $1 LIMIT 1`,
          [carId]
        )

        const picId = leadResult.rows[0]?.pic_id
        if (!picId) {
          controller.enqueue(encoder.encode(JSON.stringify(
            { success: false, error: "Could not resolve picId for this car" }
          )))
          return
        }

        // --- 2. Fetch chat history (3-source fallback) ---
        console.log(`[Retrigger] Fetching chat history for phone=${phone}, carId=${carId}...`)
        const chatMessages = await fetchZaloChatHistory({ carId, phone, picId })

        if (!chatMessages || chatMessages.length === 0) {
          controller.enqueue(encoder.encode(JSON.stringify(
            { success: false, error: "Chat history is empty — all sources returned no messages" }
          )))
          return
        }

        console.log(`[Retrigger] Chat history fetched successfully (${chatMessages.length} messages)`)

        // Wrap in the format n8n auto-chat webhook expects (mirrors AkaBiz response shape)
        const chatHistoryData = { is_successful: true, phone, chat_history: chatMessages }

        // --- 4. Send raw chat history body to n8n auto-chat webhook ---
        // This step may take minutes while AI generates suggestions
        console.log(`[Retrigger] Calling n8n auto-chat webhook (this may take a while)...`)
        const autoChatRes = await fetch(N8N_AUTO_CHAT_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chatHistoryData),
        })

        if (!autoChatRes.ok) {
          const errText = await autoChatRes.text()
          controller.enqueue(encoder.encode(JSON.stringify(
            { success: false, error: `n8n auto-chat webhook failed: ${autoChatRes.status}`, details: errText.substring(0, 500) }
          )))
          return
        }

        let autoChatData: any
        try {
          autoChatData = await parseJsonResponse(autoChatRes, "n8n auto-chat webhook")
        } catch (e) {
          controller.enqueue(encoder.encode(JSON.stringify({
            success: false,
            error: "Failed to parse n8n auto-chat webhook response",
            details: e instanceof Error ? e.message : String(e),
          })))
          return
        }
        // n8n may return a single object or an array
        if (!Array.isArray(autoChatData)) autoChatData = [autoChatData]

        console.log(`[Retrigger] Received ${autoChatData.length} item(s) from auto-chat webhook`)

        // --- 5. Extract message_suggestions and send messages ---
        let totalMessagesSent = 0
        const sendResults: any[] = []

        for (const item of autoChatData) {
          const messages = item.output?.message_suggestions || item.message_suggestions || []
          const itemPhone = item.phone || phone

          if (!Array.isArray(messages) || messages.length === 0) {
            console.log(`[Retrigger] No message_suggestions for phone=${itemPhone}, skipping`)
            sendResults.push({ phone: itemPhone, sent: false, reason: "no_messages" })
            continue
          }

          console.log(`[Retrigger] Sending ${messages.length} message(s) to phone=${itemPhone}...`)

          try {
            const sendRes = await fetch(AKABIZ_SEND_MESSAGE_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customer_phone: itemPhone,
                messages,
                picId,
              }),
            })

            if (sendRes.ok) {
              let sendData: any = null
              try {
                sendData = await parseJsonResponse(sendRes, "AkaBiz send message")
              } catch (e) {
                // AkaBiz sometimes returns non-JSON even when status=200; keep going but capture details.
                sendData = { parseError: e instanceof Error ? e.message : String(e) }
              }
              totalMessagesSent += messages.length
              sendResults.push({ phone: itemPhone, sent: true, messageCount: messages.length, response: sendData })
              console.log(`[Retrigger] Successfully sent ${messages.length} message(s) to ${itemPhone}`)
            } else {
              const errText = await sendRes.text()
              console.error(`[Retrigger] Failed to send messages to ${itemPhone}: ${sendRes.status}`)
              sendResults.push({ phone: itemPhone, sent: false, reason: `send_failed: ${sendRes.status}`, error: errText.substring(0, 200) })
            }
          } catch (sendErr) {
            console.error(`[Retrigger] Error sending messages to ${itemPhone}:`, sendErr)
            sendResults.push({ phone: itemPhone, sent: false, reason: "send_error", error: sendErr instanceof Error ? sendErr.message : String(sendErr) })
          }
        }

        // --- 6. Send final result ---
        controller.enqueue(encoder.encode(JSON.stringify({
          success: true,
          totalMessagesSent,
          sendResults,
          durationMs: Date.now() - startTime,
        })))

      } catch (error) {
        console.error("[Retrigger] Fatal error:", error)
        controller.enqueue(encoder.encode(JSON.stringify({
          success: false,
          error: "Failed to process retrigger",
          details: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        })))
      } finally {
        clearInterval(heartbeatInterval)
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    },
  })
}
