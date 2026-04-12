import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const { blocker_id } = await req.json()

    if (!blocker_id) {
      return NextResponse.json({ error: "Blocker ID is required" }, { status: 400 })
    }

    // Try car_blocker_status first (escalation rows)
    const escalationResult = await e2eQuery(
      `UPDATE car_blocker_status
       SET status = 'RESOLVED', resolved_at = NOW()
       WHERE id = $1 AND status IN ('OPEN', 'IN_PROGRESS')
       RETURNING id`,
      [blocker_id]
    )

    if (escalationResult.rows.length > 0) {
      return NextResponse.json({ success: true, resolved: "car_blocker_status" })
    }

    // Fall back: SLA rows have id = sla_logging.id
    const slaResult = await e2eQuery(
      `UPDATE sla_logging
       SET status = 'success', ended_at = NOW()
       WHERE id = $1 AND status IN ('ongoing', 'failed')
       RETURNING id`,
      [blocker_id]
    )

    if (slaResult.rows.length > 0) {
      return NextResponse.json({ success: true, resolved: "sla_logging" })
    }

    // ID not found in either table — still return success so UI removes the card
    return NextResponse.json({ success: true, resolved: "not_found" })
  } catch (error) {
    console.error("[Lead Monitor] Error resolving blocker:", error)
    return NextResponse.json({ error: "Failed to resolve blocker" }, { status: 500 })
  }
}
