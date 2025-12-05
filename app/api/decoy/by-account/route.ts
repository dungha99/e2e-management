import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { account } = body

    if (!account) {
      return NextResponse.json({ error: "Account key is required" }, { status: 400 })
    }

    const response = await fetch("https://crm-vucar-api.vucar.vn/api/v1/decoy/by-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ account }),
    })

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error fetching account jobs:", error)
    return NextResponse.json({ error: "Failed to fetch account jobs" }, { status: 500 })
  }
}
