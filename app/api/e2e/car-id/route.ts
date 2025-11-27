import { NextResponse } from "next/server"

const CAR_ID_API_URL = "https://crm-vucar-api.vucar.vn/api/v1/leads/car-id-by-phone"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone } = body

    if (!phone) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 })
    }

    console.log("[E2E Car ID API] Fetching car_id for phone:", phone)

    const response = await fetch(CAR_ID_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date_within: 60,
        phone: phone,
      }),
    })

    if (!response.ok) {
      console.error("[E2E Car ID API] Failed to fetch car_id. Status:", response.status)
      // Return null instead of error to allow graceful handling
      return NextResponse.json({ car_id: null })
    }

    const data = await response.json()
    console.log("[E2E Car ID API] Successfully fetched car_id:", data.car_id)

    return NextResponse.json(data)
  } catch (error) {
    console.error("[E2E Car ID API] Error fetching car_id:", error)
    // Return null instead of error to allow graceful handling
    return NextResponse.json({ car_id: null })
  }
}
