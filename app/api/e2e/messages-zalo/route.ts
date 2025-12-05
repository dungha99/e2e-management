import { NextResponse } from "next/server"

const MESSAGES_ZALO_WEBHOOK_BASE = "https://n8n.vucar.vn/webhook/b7d47641-60a1-4825-befb-00b9be93e4af/salestatus"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { car_id } = body

    if (!car_id) {
      return NextResponse.json({ error: "car_id is required" }, { status: 400 })
    }

    const response = await fetch(`${MESSAGES_ZALO_WEBHOOK_BASE}/${car_id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      console.error("[E2E Messages Zalo API] Failed to fetch messages. Status:", response.status)
      // Return empty messages instead of error to allow graceful handling
      return NextResponse.json({ messages_zalo: [] })
    }

    const data = await response.json()

    // Handle both array response and object with messages_zalo field
    let messages_zalo = []
    if (Array.isArray(data)) {
      // If data is array, get first item's messages_zalo
      messages_zalo = data[0]?.messages_zalo || []
    } else if (data.messages_zalo) {
      messages_zalo = data.messages_zalo
    }

    return NextResponse.json({ messages_zalo })
  } catch (error) {
    console.error("[E2E Messages Zalo API] Error fetching messages:", error)
    // Return empty messages instead of error to allow graceful handling
    return NextResponse.json({ messages_zalo: [] })
  }
}
