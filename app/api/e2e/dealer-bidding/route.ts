import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { car_id } = body

    if (!car_id) {
      return NextResponse.json({ error: "car_id is required" }, { status: 400 })
    }

    // Query the database directly
    const result = await query(
      `SELECT id, dealer_id, car_id, price, created_at, comment
       FROM dealer_biddings
       WHERE car_id = $1
       ORDER BY created_at DESC`,
      [car_id]
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("[E2E Dealer Bidding DB] Error fetching dealer bidding:", error)
    // Return empty array instead of error to allow graceful handling
    return NextResponse.json([])
  }
}
