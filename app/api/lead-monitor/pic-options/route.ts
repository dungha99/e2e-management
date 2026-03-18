import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"
import { PicOption } from "@/components/lead-monitor/types"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // ── 1. Get overdue SLA minutes per car_id ────────────────────────────────
    const slaResult = await e2eQuery(`
      SELECT DISTINCT ON (sl.car_id)
        sl.car_id,
        EXTRACT(EPOCH FROM (
          NOW() - (sl.started_at + sr.sla_duration_hours * INTERVAL '1 hour')
        )) / 60 AS time_overdue_minutes
      FROM sla_logging sl
      JOIN sla_rules sr ON sr.id = sl.sla_id
      WHERE sl.status IN ('ongoing', 'failed')
        AND NOW() > (sl.started_at + sr.sla_duration_hours * INTERVAL '1 hour')
      ORDER BY sl.car_id, sl.started_at DESC
    `)

    const overdueByCarId = new Map<string, number>()
    slaResult.rows.forEach((r: any) => {
      overdueByCarId.set(r.car_id, parseFloat(r.time_overdue_minutes))
    })

    // ── 2. Get escalation car_ids ────────────────────────────────────────────
    const escResult = await e2eQuery(`
      SELECT DISTINCT car_id FROM car_blocker_status
      WHERE blocker_type = 'ESCALATION' AND status IN ('OPEN', 'IN_PROGRESS')
    `)
    const escalationCarIds = new Set<string>(escResult.rows.map((r: any) => r.car_id))

    // ── 3. Get all relevant car_ids ──────────────────────────────────────────
    const allCarIds = [...new Set([...overdueByCarId.keys(), ...escalationCarIds])]
    if (allCarIds.length === 0) return NextResponse.json([])

    // ── 4. Map car_id → pic_id, pic_name, bot_status from VucarV2 ────────────
    const carResult = await vucarV2Query(`
      SELECT c.id AS car_id, l.pic_id, u.user_name AS pic_name, ss.bot_status
      FROM cars c
      JOIN leads l ON l.id = c.lead_id
      JOIN users u ON u.id = l.pic_id
      LEFT JOIN sale_status ss ON ss.car_id = c.id
      WHERE c.id = ANY($1::uuid[])
        AND (ss.stage IS NULL OR ss.stage NOT IN ('FAILED', 'DEPOSIT_PAID', 'COMPLETED'))
        AND (ss.qualified IS NULL OR ss.qualified NOT IN ('NON_QUALIFIED', 'TEST'))
    `, [allCarIds])

    // ── 5. Aggregate per PIC ──────────────────────────────────────────────────
    const nameMap = new Map<string, string>()
    const slaBreachCountMap = new Map<string, number>()
    const escalationMap = new Map<string, number>()
    const botActiveMap = new Map<string, number>()

    carResult.rows.forEach((r: any) => {
      const { car_id, pic_id, pic_name, bot_status } = r
      if (!pic_id) return
      if (!nameMap.has(pic_id)) nameMap.set(pic_id, pic_name || pic_id)
      if (overdueByCarId.has(car_id)) {
        slaBreachCountMap.set(pic_id, (slaBreachCountMap.get(pic_id) ?? 0) + 1)
      }
      if (escalationCarIds.has(car_id)) {
        escalationMap.set(pic_id, (escalationMap.get(pic_id) ?? 0) + 1)
      }
      if (bot_status === "active") {
        botActiveMap.set(pic_id, (botActiveMap.get(pic_id) ?? 0) + 1)
      }
    })

    const options: PicOption[] = Array.from(nameMap.entries())
      .map(([id, name]) => ({
        id,
        name,
        slaBreachCount: slaBreachCountMap.get(id) ?? 0,
        escalationCount: escalationMap.get(id) ?? 0,
        botActiveCount: botActiveMap.get(id) ?? 0,
      }))
      .sort((a, b) =>
        (b.slaBreachCount + b.escalationCount) - (a.slaBreachCount + a.escalationCount)
      )

    return NextResponse.json(options)
  } catch (error) {
    console.error("[Lead Monitor] Error fetching pic options:", error)
    return NextResponse.json(
      { error: "Failed to fetch pic options", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
