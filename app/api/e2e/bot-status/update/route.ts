import { NextResponse } from "next/server"

const BOT_STATUS_UPDATE_API_URL = "https://crm-vucar-api.vucar.vn/api/v1/leads/update-bot-status-by-phone"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone, bot_status } = body

    if (!phone || bot_status === undefined) {
      return NextResponse.json({ error: "Phone and bot_status are required" }, { status: 400 })
    }

    console.log("[E2E Bot Status UPDATE] Updating bot status for phone:", phone, "to:", bot_status)

    const response = await fetch(BOT_STATUS_UPDATE_API_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bot_status, phone }),
    })

    if (!response.ok) {
      console.error("[E2E Bot Status UPDATE] Failed to update bot status. Status:", response.status)
      return NextResponse.json({ success: false, error: "Failed to update bot status" }, { status: response.status })
    }

    const data = await response.json()
    console.log("[E2E Bot Status UPDATE] Successfully updated bot status")

    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    console.error("[E2E Bot Status UPDATE] Error updating bot status:", error)
    return NextResponse.json({ success: false, error: "Failed to update bot status" }, { status: 500 })
  }
}
