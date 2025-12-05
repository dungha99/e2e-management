import { type NextRequest, NextResponse } from "next/server"

const BASE_URL = "https://crm-vucar-api.vucar.vn"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const response = await fetch(`${BASE_URL}/api/v1/decoy/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to create decoy job", details: data }, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in decoy API route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
