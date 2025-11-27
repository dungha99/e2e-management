import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const response = await fetch("https://crm-vucar-api.vucar.vn/api/v1/leads/lead-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching lead context:", error)
    return NextResponse.json({ error: "Failed to fetch lead context" }, { status: 500 })
  }
}
