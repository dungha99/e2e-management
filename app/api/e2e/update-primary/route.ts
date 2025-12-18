import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { car_id, is_primary } = body

    if (!car_id || is_primary === undefined) {
      return NextResponse.json({ error: "car_id and is_primary are required" }, { status: 400 })
    }

    // Call external VuCar API to update is_hot_lead in sale_status
    const apiResponse = await fetch("https://api.vucar.vn/sale-status/upsert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": process.env.VUCAR_API_SECRET || "",
      },
      body: JSON.stringify({
        carId: car_id,
        isHotLead: is_primary,
      }),
    })

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      console.error("[E2E Update Primary] API error:", apiResponse.status, errorText)
      throw new Error(`VuCar API error: ${apiResponse.status}`)
    }

    const apiData = await apiResponse.json()

    return NextResponse.json({
      success: true,
      car_id,
      is_primary,
      apiResponse: apiData,
    })
  } catch (error) {
    console.error("[E2E Update Primary] Error updating primary status:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to update primary status",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}
