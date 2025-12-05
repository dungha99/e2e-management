import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { car_id } = body

    if (!car_id) {
      return NextResponse.json({ error: "car_id is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("dealer_biddings")
      .select("id, dealer_id, car_id, price, created_at, comment")
      .eq("car_id", car_id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[E2E Dealer Bidding DB] Error fetching dealer bidding:", error)
      return NextResponse.json([])
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[E2E Dealer Bidding DB] Error fetching dealer bidding:", error)
    // Return empty array instead of error to allow graceful handling
    return NextResponse.json([])
  }
}
