import { NextResponse } from "next/server"

const VUCAR_API_URL = "https://api.vucar.vn"

/**
 * GET /api/vucar/bidding?carId=xxx
 * Proxies to https://api.vucar.vn/bidding with x-api-secret auth
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const carId = searchParams.get("carId")

  if (!carId) {
    return NextResponse.json({ error: "carId is required" }, { status: 400 })
  }

  const apiSecret = process.env.VUCAR_API_SECRET
  if (!apiSecret) {
    return NextResponse.json({ error: "VUCAR_API_SECRET not configured" }, { status: 500 })
  }

  const res = await fetch(`${VUCAR_API_URL}/bidding?carId=${encodeURIComponent(carId)}`, {
    method: "GET",
    headers: {
      "x-api-secret": apiSecret,
      "Content-Type": "application/json",
    },
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

/**
 * POST /api/vucar/bidding
 * Creates a new bidding session for a car
 * Body: { carId, duration?, minPrice?, shouldGenerateMetadata? }
 */
export async function POST(request: Request) {
  const body = await request.json()
  const { carId, duration = 6, minPrice = 0, shouldGenerateMetadata } = body

  if (!carId) {
    return NextResponse.json({ error: "carId is required" }, { status: 400 })
  }

  const apiSecret = process.env.VUCAR_API_SECRET
  if (!apiSecret) {
    return NextResponse.json({ error: "VUCAR_API_SECRET not configured" }, { status: 500 })
  }

  const res = await fetch(`${VUCAR_API_URL}/bidding`, {
    method: "POST",
    headers: {
      "x-api-secret": apiSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      carId,
      duration,
      minPrice,
      shouldGenerateMetadata: shouldGenerateMetadata ?? {
        comment: false,
        numberOfComments: 0,
        bid: false,
      },
    }),
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}

/**
 * PUT /api/vucar/bidding/min-bid
 * Proxies to https://api.vucar.vn/bidding/min-bid with x-api-secret auth
 * Body: { carId, minBid }
 */
export async function PUT(request: Request) {
  const body = await request.json()
  const { carId, minBid } = body

  if (!carId || minBid === undefined) {
    return NextResponse.json({ error: "carId and minBid are required" }, { status: 400 })
  }

  const apiSecret = process.env.VUCAR_API_SECRET
  if (!apiSecret) {
    return NextResponse.json({ error: "VUCAR_API_SECRET not configured" }, { status: 500 })
  }

  const res = await fetch(`${VUCAR_API_URL}/bidding/min-bid`, {
    method: "PUT",
    headers: {
      "x-api-secret": apiSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ carId, minBid }),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
