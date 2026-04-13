import { NextResponse } from "next/server"
import { vucarV2Query, e2eQuery } from "@/lib/db"
import { upsertZaloAction } from "@/lib/akabiz/upsertZaloAction"

// Same connector as rename-lead — holds base_url + bearer token for zl.vucar.vn
const VUCAR_FRIENDS_CONNECTOR_ID = "a1b8debd-7e9d-45d4-8804-cb817d5504f5"

export async function POST(request: Request) {
  let car_id: string | undefined
  let customer_phone: string | undefined
  let actionRecorded = false

  try {
    const body = await request.json()
    const { messages, picId } = body
    car_id = body.car_id
    customer_phone = body.customer_phone

    console.log("[Send First Message] car_id:", car_id, "| customer_phone:", customer_phone)

    if (!customer_phone || !messages || !picId) {
      return NextResponse.json(
        { error: "customer_phone, messages, and picId are required" },
        { status: 400 }
      )
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages must be a non-empty array" },
        { status: 400 }
      )
    }

    // ── Look up zalo_account from CRM DB ─────────────────────────────────────
    const leadResult = await vucarV2Query(
      `SELECT l.id AS lead_id, l.zalo_account, c.id AS car_id_db
       FROM leads l
       LEFT JOIN cars c ON c.lead_id = l.id AND c.is_deleted = false
       WHERE (l.phone = $1 OR l.additional_phone = $1)
       ORDER BY l.created_at DESC, c.created_at DESC
       LIMIT 1`,
      [customer_phone]
    )

    if (!leadResult.rows.length) {
      return NextResponse.json({ error: "No lead found for phone" }, { status: 404 })
    }

    const row = leadResult.rows[0]
    const zalo_account: string | null = row.zalo_account

    if (!car_id) car_id = row.car_id_db

    if (!zalo_account) {
      return NextResponse.json(
        { error: "No zalo_account linked to this lead" },
        { status: 422 }
      )
    }

    // ── Parse owner_id and thread_id from "ownId:threadId" ───────────────────
    const [owner_id, thread_id] = zalo_account.split(":")

    if (!owner_id || !thread_id) {
      return NextResponse.json(
        { error: `Invalid zalo_account format: "${zalo_account}"` },
        { status: 422 }
      )
    }

    // ── Fetch bearer token from connector ────────────────────────────────────
    const connectorResult = await e2eQuery(
      `SELECT auth_config FROM api_connectors WHERE id = $1 LIMIT 1`,
      [VUCAR_FRIENDS_CONNECTOR_ID]
    )

    if (!connectorResult.rows.length) {
      return NextResponse.json(
        { error: `Connector ${VUCAR_FRIENDS_CONNECTOR_ID} not found` },
        { status: 500 }
      )
    }

    let { auth_config } = connectorResult.rows[0]
    if (typeof auth_config === "string") {
      try { auth_config = JSON.parse(auth_config) } catch { /* keep raw */ }
    }

    let bearerToken: string | null = null
    if (auth_config?.type === "bearer" && auth_config?.token) {
      bearerToken = auth_config.token
    } else if (auth_config?.Authorization) {
      bearerToken = (auth_config.Authorization as string).replace(/^Bearer\s+/i, "")
    } else if (auth_config?.authorization) {
      bearerToken = (auth_config.authorization as string).replace(/^Bearer\s+/i, "")
    }

    if (!bearerToken) {
      return NextResponse.json(
        { error: "No bearer token in connector config" },
        { status: 500 }
      )
    }

    const url = `https://zl.vucar.vn/api/accounts/${owner_id}/friends/send-message`

    // ── Send each message separately ─────────────────────────────────────────
    const results: Array<{ message: string; ok: boolean; status: number; data: unknown }> = []
    let allOk = true

    for (const message of messages) {
      console.log("[Send First Message] POST", url, "| userId:", thread_id)

      const zaloRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify({
          userId: thread_id,
          messages: [message],
        }),
      })

      const data = await zaloRes.json().catch(() => ({}))
      results.push({ message, ok: zaloRes.ok, status: zaloRes.status, data })

      if (!zaloRes.ok) {
        allOk = false
        console.error("[Send First Message] Zalo API error:", zaloRes.status, data)
      }
    }

    // ── Record action ─────────────────────────────────────────────────────────
    if (car_id) {
      const status = allOk ? "success" : "failed"
      await upsertZaloAction(car_id, customer_phone, "firstMessage", status, {
        phone: customer_phone,
        owner_id,
        thread_id,
        reason: status === "success" ? "Gửi tin nhắn thành công" : "Một hoặc nhiều tin nhắn gửi thất bại",
        messages,
        results,
      })
      actionRecorded = true
    }

    if (!allOk) {
      return NextResponse.json(
        { error: "One or more messages failed to send", results },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, owner_id, thread_id, results })
  } catch (error) {
    console.error("[Send First Message] Caught error:", error)

    if (car_id && customer_phone && !actionRecorded) {
      await upsertZaloAction(car_id, customer_phone, "firstMessage", "failed", {
        phone: customer_phone,
        reason: String(error),
      })
    }

    if (!car_id) {
      console.warn("[Send First Message] Không thể ghi DB — car_id missing. phone:", customer_phone)
    }

    return NextResponse.json(
      { error: "Failed to send customer message" },
      { status: 500 }
    )
  }
}
