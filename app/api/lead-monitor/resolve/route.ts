import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { blocker_id } = await req.json()

    if (!blocker_id) {
      return NextResponse.json({ error: "Blocker ID is required" }, { status: 400 })
    }

    // In a real implementation we would update `car_blocker_status` in DB here:
    // UPDATE car_blocker_status SET status = 'RESOLVED', resolved_at = NOW() WHERE id = blocker_id
    
    return NextResponse.json({ success: true, message: `Resolved ${blocker_id}` })
  } catch (error) {
    console.error("[Lead Monitor] Error resolving blocker:", error)
    return NextResponse.json({ error: "Failed to resolve blocker" }, { status: 500 })
  }
}
