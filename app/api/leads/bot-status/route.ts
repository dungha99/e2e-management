import { NextResponse } from "next/server"

// GET bot status by phone
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone } = body

    if (!phone) {
      return NextResponse.json(
        { error: "phone is required" },
        { status: 400 }
      )
    }

    console.log("[Bot Status API] Getting bot status for phone:", phone)

    const response = await fetch("https://crm-vucar-api.vucar.vn/api/v1/leads/get-bot-status-by-phone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({ phone }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Bot Status API] CRM API error:", response.status, errorText)
      throw new Error(`CRM API returned ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    console.log("[Bot Status API] Success:", data)
    return NextResponse.json(data)
  } catch (error) {
    console.error("[Bot Status API] Error:", error)
    return NextResponse.json(
      { error: "Failed to get bot status" },
      { status: 500 }
    )
  }
}

// UPDATE bot status by phone
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { phone, bot_status } = body

    if (!phone || typeof bot_status !== "boolean") {
      return NextResponse.json(
        { error: "phone and bot_status (boolean) are required" },
        { status: 400 }
      )
    }

    console.log("[Bot Status API] Updating bot status:", { phone, bot_status })

    const response = await fetch("https://crm-vucar-api.vucar.vn/api/v1/leads/update-bot-status-by-phone", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({ phone, bot_status }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Bot Status API] CRM API error:", response.status, errorText)
      throw new Error(`CRM API returned ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    console.log("[Bot Status API] Update success:", data)
    return NextResponse.json(data)
  } catch (error) {
    console.error("[Bot Status API] Error:", error)
    return NextResponse.json(
      { error: "Failed to update bot status" },
      { status: 500 }
    )
  }
}

