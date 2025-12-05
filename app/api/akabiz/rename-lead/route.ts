import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone_number, pic_id } = body

    if (!phone_number || !pic_id) {
      return NextResponse.json(
        { error: "phone_number and pic_id are required" },
        { status: 400 }
      )
    }

    const response = await fetch("https://crm-vucar-api.vucar.vn/api/v1/akabiz/rename", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone_number, pic_id }),
    })

    if (!response.ok) {
      throw new Error(`CRM API returned ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[Rename Lead API] Error:", error)
    return NextResponse.json(
      { error: "Failed to rename lead" },
      { status: 500 }
    )
  }
}
