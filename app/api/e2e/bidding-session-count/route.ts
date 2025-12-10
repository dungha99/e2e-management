import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { car_id } = body

    if (!car_id) {
      return NextResponse.json({ error: "Car ID is required" }, { status: 400 })
    }

    // Query campaigns table to count bidding sessions and check for active campaigns
    const result = await vucarV2Query(
      `SELECT
        COUNT(*) as count,
        BOOL_OR(is_active = true) as has_active_campaigns
      FROM campaigns
      WHERE car_auction_id = $1`,
      [car_id]
    )

    const count = parseInt(result.rows[0]?.count || 0)
    const hasActiveCampaigns = result.rows[0]?.has_active_campaigns || false

    return NextResponse.json({
      bidding_session_count: count,
      has_active_campaigns: hasActiveCampaigns
    })
  } catch (error) {
    console.error("[Bidding Session Count API] Error fetching bidding session count:", error)
    return NextResponse.json({
      error: "Failed to fetch bidding session count",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
