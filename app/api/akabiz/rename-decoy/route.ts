import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone_number, shop_id } = body

    if (!phone_number || !shop_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const response = await fetch("https://crm-vucar-api.vucar.vn/api/v1/akabiz/rename-decoy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        phone_number,
        shop_id,
      }),
    })

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error calling rename-decoy API:", error)
    return NextResponse.json({ error: "Failed to rename decoy" }, { status: 500 })
  }
}
