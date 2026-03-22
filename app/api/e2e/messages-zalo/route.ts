import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { car_id } = body

    if (!car_id) {
      return NextResponse.json({ error: "car_id is required" }, { status: 400 })
    }

    console.log(`[E2E Messages Zalo API] Fetching messages for car_id: ${car_id}`)

    // Query messages_zalo directly from sale_status table (same source as lead-details)
    const result = await vucarV2Query(
      `SELECT ss.messages_zalo FROM sale_status ss WHERE ss.car_id = $1 LIMIT 1`,
      [car_id]
    )

    if (result.rows.length === 0) {
      console.log(`[E2E Messages Zalo API] No sale_status record found for car_id: ${car_id}`)
      return NextResponse.json({ messages_zalo: [], debug: "No sale_status record found" })
    }

    const messages_zalo = result.rows[0].messages_zalo || []
    console.log(`[E2E Messages Zalo API] Found ${messages_zalo.length} messages for car_id: ${car_id}`)

    return NextResponse.json({ messages_zalo })
  } catch (error) {
    console.error("[E2E Messages Zalo API] Error fetching messages:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({
      messages_zalo: [],
      error: "Failed to fetch messages",
      details: errorMessage
    }, { status: 500 })
  }
}

