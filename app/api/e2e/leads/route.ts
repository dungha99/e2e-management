import { NextResponse } from "next/server"

const WEBHOOK_BASE_URL = "https://n8n.vucar.vn/webhook/b7d47641-60a1-4825-befb-00b9be93e4af/b7d47641-60a1-4825-befb-00b9be93e4af"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { uid } = body

    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 })
    }

    console.log("[E2E API] Fetching leads for UID:", uid)

    const response = await fetch(`${WEBHOOK_BASE_URL}/${uid}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      console.error("[E2E API] Failed to fetch leads. Status:", response.status)
      throw new Error(`Failed to fetch leads: ${response.status}`)
    }

    const data = await response.json()
    console.log("[E2E API] Successfully fetched", data.length || 0, "leads")

    return NextResponse.json(data)
  } catch (error) {
    console.error("[E2E API] Error fetching leads:", error)
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 })
  }
}
