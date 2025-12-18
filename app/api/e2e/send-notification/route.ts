import { NextRequest, NextResponse } from "next/server"

const VUCAR_API_SECRET = process.env.VUCAR_API_SECRET || ""

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, phoneNumbers } = body

    if (!code || !phoneNumbers || !Array.isArray(phoneNumbers)) {
      return NextResponse.json(
        { error: "code and phoneNumbers are required" },
        { status: 400 }
      )
    }

    const response = await fetch("https://api.vucar.vn/notifications/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": VUCAR_API_SECRET,
      },
      body: JSON.stringify({
        code,
        phoneNumbers,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Send Notification] API error:", response.status, errorText)
      return NextResponse.json(
        { error: "Failed to send notification", details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[Send Notification] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
