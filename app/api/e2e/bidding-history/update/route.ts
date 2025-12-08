import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, price } = body

    if (!id) {
      return NextResponse.json({ error: "Bidding ID is required" }, { status: 400 })
    }

    if (price === undefined || price === null) {
      return NextResponse.json({ error: "Price is required" }, { status: 400 })
    }

    // Update the price
    await query(
      `UPDATE dealer_biddings SET price = $1 WHERE id = $2`,
      [price, id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Update Bidding API] Error updating bidding price:", error)
    return NextResponse.json({
      error: "Failed to update bidding price",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
