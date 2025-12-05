import { NextResponse } from "next/server"

export async function GET() {
  try {
    const response = await fetch("https://crm-vucar-api.vucar.vn/api/v1/decoy/all")
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching all jobs:", error)
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 })
  }
}
