import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { car_id } = body

    if (!car_id) {
      return NextResponse.json({ error: "Car ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("dealer_biddings")
      .select(`
        id,
        dealer_id,
        car_id,
        price,
        created_at,
        comment,
        dealers(name)
      `)
      .eq("car_id", car_id)
      .gt("price", 1)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[Bidding History API] Error fetching bidding history:", error)
      return NextResponse.json(
        {
          error: "Failed to fetch bidding history",
          details: error.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      biddings: (data || []).map((row: any) => ({
        id: row.id,
        dealer_id: row.dealer_id,
        dealer_name: row.dealers?.name || "Unknown Dealer",
        car_id: row.car_id,
        price: row.price,
        created_at: row.created_at,
        comment: row.comment,
      })),
    })
  } catch (error) {
    console.error("[Bidding History API] Error fetching bidding history:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch bidding history",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
