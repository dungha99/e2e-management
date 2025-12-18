import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { car_ids } = body

    if (!car_ids || !Array.isArray(car_ids)) {
      return NextResponse.json({ error: "car_ids array is required" }, { status: 400 })
    }

    if (car_ids.length === 0) {
      return NextResponse.json({})
    }

    // Fetch dealer biddings for the given car IDs
    const result = await query(
      `SELECT
        db.car_id,
        json_agg(
          json_build_object(
            'id', db.id,
            'dealer_id', db.dealer_id,
            'price', db.price,
            'created_at', db.created_at,
            'comment', db.comment
          ) ORDER BY db.created_at DESC
        ) as biddings
      FROM dealer_biddings db
      WHERE db.car_id = ANY($1::uuid[])
      GROUP BY db.car_id`,
      [car_ids]
    )

    // Return as a map: { car_id: biddings[] }
    const biddingsMap = Object.fromEntries(
      result.rows.map((row) => [row.car_id, row.biddings || []])
    )

    return NextResponse.json(biddingsMap)
  } catch (error) {
    console.error("[E2E Dealer Biddings API] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch dealer biddings", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
