import { NextResponse } from "next/server"

const DEALER_BIDDING_WEBHOOK_BASE = "https://n8n.vucar.vn/webhook/b7d47641-60a1-4825-befb-00b9be93e4af/dealer-bidding"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { car_id } = body

    if (!car_id) {
      return NextResponse.json({ error: "car_id is required" }, { status: 400 })
    }

    console.log("[E2E Dealer Bidding API] Fetching dealer bidding for car_id:", car_id)

    const response = await fetch(`${DEALER_BIDDING_WEBHOOK_BASE}/${car_id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      console.error("[E2E Dealer Bidding API] Failed to fetch dealer bidding. Status:", response.status)
      // Return empty array instead of error to allow graceful handling
      return NextResponse.json([])
    }

    const data = await response.json()
    console.log("[E2E Dealer Bidding API] Successfully fetched dealer bidding")

    // Ensure we return an array
    const biddingData = Array.isArray(data) ? data : []

    return NextResponse.json(biddingData)
  } catch (error) {
    console.error("[E2E Dealer Bidding API] Error fetching dealer bidding:", error)
    // Return empty array instead of error to allow graceful handling
    return NextResponse.json([])
  }
}
