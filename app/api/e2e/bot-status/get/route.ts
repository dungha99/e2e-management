import { NextResponse } from "next/server"

const BOT_STATUS_API_URL = "https://crm-vucar-api.vucar.vn/api/v1/leads/get-bot-status-by-phone"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone } = body

    if (!phone) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 })
    }

    console.log("[E2E Bot Status GET] Fetching bot status for phone:", phone)

    const response = await fetch(BOT_STATUS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone }),
    })

    if (!response.ok) {
      console.error("[E2E Bot Status GET] Failed to fetch bot status. Status:", response.status)
      return NextResponse.json({ bot_active: false })
    }

    const data = await response.json()
    console.log("[E2E Bot Status GET] Successfully fetched bot status")

    return NextResponse.json(data)
  } catch (error) {
    console.error("[E2E Bot Status GET] Error fetching bot status:", error)
    return NextResponse.json({ bot_active: false })
  }
}
