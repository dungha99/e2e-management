import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { customer_phone, messages, picId } = body

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

    const response = await fetch("https://crm-vucar-api.vucar.vn/api/v1/akabiz/send-customer-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ customer_phone, messages, picId }),
    })

    if (!response.ok) {
      throw new Error(`CRM API returned ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[Send Customer Message API] Error:", error)
    return NextResponse.json(
      { error: "Failed to send customer message" },
      { status: 500 }
    )
  }
}
