import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { car_id, dealer_id, price, comment } = body

    if (!car_id || !dealer_id) {
      return NextResponse.json({ error: "Car ID and Dealer ID are required" }, { status: 400 })
    }

    if (price === undefined || price === null) {
      return NextResponse.json({ error: "Price is required" }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await query(
      `INSERT INTO dealer_biddings (id, car_id, dealer_id, price, comment, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, car_id, dealer_id, price, comment || "", now]
    )

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error("[Create Bidding API] Error creating bidding:", error)
    return NextResponse.json({
      error: "Failed to create bidding",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
