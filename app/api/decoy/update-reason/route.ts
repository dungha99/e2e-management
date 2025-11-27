import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, reason } = body

    console.log("[v0] Updating reason for phone:", phone, "Reason:", reason)

    const response = await fetch("https://crm-vucar-api.vucar.vn/api/v1/decoy/update-reason", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone, reason }),
    })

    const data = await response.json()
    console.log("[v0] Update reason response:", data)

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error updating reason:", error)
    return NextResponse.json({ success: false, message: "Failed to update reason" }, { status: 500 })
  }
}
