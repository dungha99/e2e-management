import { NextResponse } from "next/server"

// Valid shop_ids for decoy accounts
const VALID_SHOP_IDS = [
  "68ff3282-a3cd-ba1d-a71a-1b7100000000", // Hùng Taxi
  "68c11ae4-b7f5-3ee3-7614-5cc200000000", // Huy Hồ
  "68f5f0f9-0703-9cf6-ae45-81e800000000", // Minh Anh
]

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone, shop_id } = body

    if (!phone || !shop_id) {
      return NextResponse.json(
        { error: "phone and shop_id are required" },
        { status: 400 }
      )
    }

    if (!VALID_SHOP_IDS.includes(shop_id)) {
      return NextResponse.json(
        { error: "Invalid shop_id" },
        { status: 400 }
      )
    }

    console.log("[Get Chat History API] Fetching chat history:", { phone, shop_id })

    const response = await fetch("https://crm-vucar-api.vucar.vn/api/v1/akabiz/get-chat-history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({ phone, shop_id }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Get Chat History API] CRM API error:", response.status, errorText)
      throw new Error(`CRM API returned ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    console.log("[Get Chat History API] Success:", {
      is_successful: data.is_successful,
      phone: data.phone,
      shop_id: data.shop_id,
      message_count: data.chat_history?.length || 0
    })
    
    return NextResponse.json(data)
  } catch (error) {
    console.error("[Get Chat History API] Error:", error)
    return NextResponse.json(
      { error: "Failed to get chat history" },
      { status: 500 }
    )
  }
}

