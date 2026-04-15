import { NextResponse } from "next/server"
import { filterDealers, DealerFilterParams } from "@/lib/dealer-filter"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { brand, city, price, car_age, mileage } = body

    const params: DealerFilterParams = {
      brand: brand ?? null,
      city: city ?? null,
      price: price ?? 0,
      car_age: car_age ?? -1,
      mileage: mileage ?? 0,
    }

    const { dealer_ids, is_default } = await filterDealers(params)

    // Enrich with dealer names from DRM
    const dealersResult = await query(
      `SELECT id, name, group_zalo_name FROM dealers WHERE id = ANY($1::uuid[])`,
      [dealer_ids]
    )

    const dealers = dealersResult.rows.map((d: any) => ({
      dealer_id: d.id,
      dealer_name: d.name,
      group_zalo_name: d.group_zalo_name ?? null,
    }))

    return NextResponse.json({ is_default, dealers })
  } catch (error) {
    console.error("[filter-dealers] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to filter dealers",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
