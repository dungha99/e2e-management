import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"
import { PicOption } from "@/components/lead-monitor/types"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // ── 1. Base list: ALL users ───────────────────────────────────────────────
    const usersResult = await vucarV2Query(
      `SELECT id, user_name FROM users ORDER BY user_name ASC`,
      []
    )

    const nameMap = new Map<string, string>()
    const slaBreachCountMap = new Map<string, number>()
    const escalationCountMap = new Map<string, number>()
    const botActiveCountMap = new Map<string, number>()

    usersResult.rows.forEach((r: any) => {
      nameMap.set(r.id, r.user_name || r.id)
      slaBreachCountMap.set(r.id, 0)
      escalationCountMap.set(r.id, 0)
      botActiveCountMap.set(r.id, 0)
    })

    // ── 2. Overdue SLA car_ids from E2E ──────────────────────────────────────
    const slaResult = await e2eQuery(`
      SELECT DISTINCT ON (sl.car_id) sl.car_id
      FROM sla_logging sl
      JOIN sla_rules sr ON sr.id = sl.sla_id
      WHERE sl.status IN ('ongoing', 'failed')
        AND NOW() > (sl.started_at + sr.sla_duration_hours * INTERVAL '1 hour')
      ORDER BY sl.car_id, sl.started_at DESC
    `)
    const overdueCarIds = new Set<string>(slaResult.rows.map((r: any) => r.car_id))

    // ── 3. Escalation car_ids from E2E ───────────────────────────────────────
    const escResult = await e2eQuery(`
      SELECT DISTINCT car_id FROM car_blocker_status
      WHERE blocker_type = 'ESCALATION' AND status IN ('OPEN', 'IN_PROGRESS')
    `)
    const escalationCarIds = new Set<string>(escResult.rows.map((r: any) => r.car_id))

    // ── 4. Map flagged car_ids → pic_id + bot_status ──────────────────────────
    const allFlaggedCarIds = [...new Set([...overdueCarIds, ...escalationCarIds])]

    if (allFlaggedCarIds.length > 0) {
      const carResult = await vucarV2Query(`
        SELECT c.id AS car_id, l.pic_id, ss.bot_status
        FROM cars c
        LEFT JOIN leads l ON l.id = c.lead_id
        LEFT JOIN sale_status ss ON ss.car_id = c.id
        WHERE c.id = ANY($1::uuid[])
      `, [allFlaggedCarIds])

      // ── 5. Accumulate counts onto base user list ───────────────────────────
      carResult.rows.forEach((r: any) => {
        const { car_id, pic_id, bot_status } = r
        if (!pic_id || !nameMap.has(pic_id)) return

        if (overdueCarIds.has(car_id)) {
          slaBreachCountMap.set(pic_id, (slaBreachCountMap.get(pic_id) ?? 0) + 1)
        }
        if (escalationCarIds.has(car_id)) {
          escalationCountMap.set(pic_id, (escalationCountMap.get(pic_id) ?? 0) + 1)
        }
        if (bot_status === "active") {
          botActiveCountMap.set(pic_id, (botActiveCountMap.get(pic_id) ?? 0) + 1)
        }
      })
    }

    // ── 6. Build result: users with alerts first, then alphabetical ───────────
    const options: PicOption[] = Array.from(nameMap.entries())
      .map(([id, name]) => ({
        id,
        name,
        slaBreachCount: slaBreachCountMap.get(id) ?? 0,
        escalationCount: escalationCountMap.get(id) ?? 0,
        botActiveCount: botActiveCountMap.get(id) ?? 0,
      }))
      .sort((a, b) => {
        const aAlert = a.slaBreachCount + a.escalationCount
        const bAlert = b.slaBreachCount + b.escalationCount
        if (aAlert !== bAlert) return bAlert - aAlert
        return a.name.localeCompare(b.name, "vi")
      })

    return NextResponse.json(options)
  } catch (error) {
    console.error("[Lead Monitor] Error fetching pic options:", error)
    return NextResponse.json(
      { error: "Failed to fetch pic options", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
