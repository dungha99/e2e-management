import { NextResponse } from "next/server"
import { upsertZaloAction } from "@/lib/akabiz/upsertZaloAction"

export async function POST(request: Request) {
  // Khai báo ngoài try để catch block luôn truy cập được
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

    if (!car_id) {
      console.warn("[Send First Message] car_id missing — zalo_action sẽ không được ghi.")
    }

    // ── Gọi CRM API ──────────────────────────────────────────────────────────
    const response = await fetch(
      "https://crm-vucar-api.vucar.vn/api/v1/akabiz/send-customer-message",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_phone, messages, picId }),
      }
    )

    // ── HTTP error (4xx / 5xx) ────────────────────────────────────────────────
    if (!response.ok) {
      console.error("[Send First Message] CRM HTTP error:", response.status)
      if (car_id) {
        await upsertZaloAction(car_id, customer_phone, "firstMessage", "failed", {
          phone: customer_phone,
          reason: `CRM API returned ${response.status}`,
        })
        actionRecorded = true
      }
      throw new Error(`CRM API returned ${response.status}`)
    }

    const data = await response.json()
    console.log("[Send First Message] CRM response:", JSON.stringify(data))

    // ── Kết quả từ response body (is_successful) ─────────────────────────────
    if (car_id) {
      const status = data.is_successful === false ? "failed" : "success"
      await upsertZaloAction(car_id, customer_phone, "firstMessage", status, {
        phone: customer_phone,
        reason: status === "success" ? "Gửi tin nhắn thành công" : "CRM trả về is_successful: false",
        messages,
      })
      actionRecorded = true
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("[Send First Message] Caught error:", error)

    // ── Lỗi network / system chưa được ghi ───────────────────────────────────
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
