import { NextResponse } from "next/server"
import { upsertZaloAction } from "@/lib/akabiz/upsertZaloAction"

export async function POST(request: Request) {
  // Khai báo ngoài try để catch block luôn truy cập được
  let car_id: string | undefined
  let phone_number: string | undefined
  let actionRecorded = false

  try {
    const body = await request.json()
    const { pic_id } = body
    car_id = body.car_id
    phone_number = body.phone_number

    console.log("[Rename Lead] car_id:", car_id, "| phone_number:", phone_number)

    if (!phone_number || !pic_id) {
      return NextResponse.json(
        { error: "phone_number and pic_id are required" },
        { status: 400 }
      )
    }

    if (!car_id) {
      console.warn("[Rename Lead] car_id missing — zalo_action sẽ không được ghi.")
    }

    // ── Gọi CRM API ──────────────────────────────────────────────────────────
    const response = await fetch(
      "https://crm-vucar-api.vucar.vn/api/v1/akabiz/rename",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number, pic_id }),
      }
    )

    // ── HTTP error (4xx / 5xx) ────────────────────────────────────────────────
    if (!response.ok) {
      console.error("[Rename Lead] CRM HTTP error:", response.status)
      if (car_id) {
        await upsertZaloAction(car_id, phone_number, "rename", "failed", {
          phone: phone_number,
          reason: `CRM API returned ${response.status}`,
        })
        actionRecorded = true
      }
      throw new Error(`CRM API returned ${response.status}`)
    }

    const data = await response.json()
    console.log("[Rename Lead] CRM response:", JSON.stringify(data))

    // ── Kết quả từ response body (is_successful) ─────────────────────────────
    if (car_id) {
      const status = data.is_successful === false ? "failed" : "success"
      await upsertZaloAction(car_id, phone_number, "rename", status, {
        phone: phone_number,
        reason: status === "success" ? "Đổi tên lead thành công" : "CRM trả về is_successful: false",
      })
      actionRecorded = true
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("[Rename Lead] Caught error:", error)

    // ── Lỗi network / system chưa được ghi ───────────────────────────────────
    if (car_id && phone_number && !actionRecorded) {
      await upsertZaloAction(car_id, phone_number, "rename", "failed", {
        phone: phone_number,
        reason: String(error),
      })
    }

    if (!car_id) {
      console.warn("[Rename Lead] Không thể ghi DB — car_id missing. phone:", phone_number)
    }

    return NextResponse.json(
      { error: "Failed to rename lead" },
      { status: 500 }
    )
  }
}
