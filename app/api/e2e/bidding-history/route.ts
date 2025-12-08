import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { car_id } = body

    if (!car_id) {
      return NextResponse.json({ error: "Car ID is required" }, { status: 400 })
    }

    // Query dealer_biddings with dealer info
    // Only include bids where price > 1
    const result = await query(
      `SELECT DISTINCT ON (db.dealer_id)
        db.id,
        db.dealer_id,
        db.car_id,
        db.price,
        db.created_at,
        db.comment,
        d.name as dealer_name
       FROM dealer_biddings db
       LEFT JOIN dealers d ON db.dealer_id = d.id
       WHERE db.car_id = $1 AND db.price >= 1
       ORDER BY db.dealer_id, db.price DESC, db.created_at DESC`,
      [car_id]
    )

    // Sort by created_at DESC in memory since DISTINCT ON requires leading ORDER BY columns to match
    const sortedRows = result.rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({
      biddings: sortedRows.map(row => ({
        id: row.id,
        dealer_id: row.dealer_id,
        dealer_name: row.dealer_name || "Unknown Dealer",
        car_id: row.car_id,
        price: row.price,
        created_at: row.created_at,
        comment: row.comment
      }))
    })
  } catch (error) {
    console.error("[Bidding History API] Error fetching bidding history:", error)
    return NextResponse.json({
      error: "Failed to fetch bidding history",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
