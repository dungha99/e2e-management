import { NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

const INSPECTION_BASE_URL = "https://inspectionv2.vucar.vn"
const ADMIN_KEY = process.env.INSPECTION_ADMIN_KEY || ""

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { car_id } = body

    if (!car_id) {
      return NextResponse.json(
        { error: "car_id is required" },
        { status: 400 }
      )
    }

    if (!ADMIN_KEY) {
      console.error("[car-reports] INSPECTION_ADMIN_KEY not configured")
      return NextResponse.json(
        { error: "Server configuration error: missing admin key" },
        { status: 500 }
      )
    }

    const res = await fetch(
      `${INSPECTION_BASE_URL}/api/bookings/car-reports/${car_id}`,
      {
        method: "GET",
        headers: {
          "x-admin-key": ADMIN_KEY,
          "Content-Type": "application/json",
        },
      }
    )

    if (!res.ok) {
      const text = await res.text()
      console.error(`[car-reports] Upstream error ${res.status}:`, text)
      return NextResponse.json(
        { error: `Upstream error: ${res.status}`, details: text },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[car-reports] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch car reports",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
