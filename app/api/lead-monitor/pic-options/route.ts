import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"
import { PicOption, ZaloErrorCategory } from "@/components/lead-monitor/types"

export const dynamic = "force-dynamic"

// ── Zalo error categorization (mirrors queue/route.ts) ─────────────────────
function categorizeZaloError(payload: any): ZaloErrorCategory {
  const akabizError = payload?.akabiz_error ?? ""
  const reason = payload?.reason ?? ""
  const error = payload?.error ?? ""
  const raw = akabizError || reason || error || ""
  const lower = raw.toLowerCase()

  if (lower.includes("chặn không nhận tin nhắn từ người lạ")) return "BLOCKED_STRANGER"
  if (lower.includes("không muốn nhận tin nhắn")) return "DECLINED_MESSAGES"
  if (lower.includes("no uid found")) return "NO_UID_FOUND"
  if (lower.includes("contact not found")) return "CONTACT_NOT_FOUND"
  if (lower.includes("timed out") || lower.includes("timeout")) return "TIMEOUT"
  if (lower.includes("search failed") || lower.includes("error getting search")) return "SEARCH_FAILED"
  return "OTHER"
}

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
    const undefinedQualifiedCountMap = new Map<string, number>()
    const zaloReasonBreakdownMap = new Map<string, Record<string, number>>()
    const noZaloActionCountMap = new Map<string, number>()

    usersResult.rows.forEach((r: any) => {
      nameMap.set(r.id, r.user_name || r.id)
      slaBreachCountMap.set(r.id, 0)
      escalationCountMap.set(r.id, 0)
      botActiveCountMap.set(r.id, 0)
      undefinedQualifiedCountMap.set(r.id, 0)
      zaloReasonBreakdownMap.set(r.id, {})
      noZaloActionCountMap.set(r.id, 0)
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

    // ── 4. Map flagged car_ids → pic_id + bot_status + qualified ─────────────
    const allFlaggedCarIds = [...new Set([...overdueCarIds, ...escalationCarIds])]

    if (allFlaggedCarIds.length > 0) {
      const carResult = await vucarV2Query(`
        SELECT c.id AS car_id, l.pic_id, ss.bot_status, ss.qualified
        FROM cars c
        LEFT JOIN leads l ON l.id = c.lead_id
        LEFT JOIN sale_status ss ON ss.car_id = c.id
        WHERE c.id = ANY($1::uuid[])
      `, [allFlaggedCarIds])

      // ── 5. Accumulate counts onto base user list ───────────────────────────
      carResult.rows.forEach((r: any) => {
        const { car_id, pic_id, bot_status, qualified } = r
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
        if (qualified === "UNDEFINED_QUALIFIED") {
          undefinedQualifiedCountMap.set(pic_id, (undefinedQualifiedCountMap.get(pic_id) ?? 0) + 1)
        }
      })
    }

    // ── 5b. Zalo error reason breakdown for zalo_connect step ─────────────────
    // Get zalo_connect SLA car_ids that are in the monitoring queue
    const zaloSlaResult = await e2eQuery(`
      SELECT DISTINCT ON (sl.car_id) sl.car_id
      FROM sla_logging sl
      JOIN sla_rules sr ON sr.id = sl.sla_id
      WHERE sl.status IN ('ongoing', 'failed')
        AND sr.step_key = 'zalo_connect'
      ORDER BY sl.car_id, sl.started_at DESC
    `)
    const zaloCarIds = zaloSlaResult.rows.map((r: any) => r.car_id as string)

    if (zaloCarIds.length > 0) {
      // Find pic_id for each zalo car
      const zaloPicResult = await vucarV2Query(`
        SELECT c.id AS car_id, l.pic_id
        FROM cars c
        LEFT JOIN leads l ON l.id = c.lead_id
        LEFT JOIN sale_status ss ON ss.car_id = c.id
        WHERE c.id = ANY($1::uuid[])
          AND (ss.stage IS NULL OR ss.stage NOT IN ('FAILED', 'DEPOSIT_PAID', 'COMPLETED'))
          AND (ss.qualified IS NULL OR ss.qualified NOT IN ('NON_QUALIFIED', 'TEST'))
      `, [zaloCarIds])

      const carToPic = new Map<string, string>()
      zaloPicResult.rows.forEach((r: any) => {
        if (r.pic_id) carToPic.set(r.car_id, r.pic_id)
      })

      const validZaloCarIds = [...carToPic.keys()]

      if (validZaloCarIds.length > 0) {
        // Fetch failed zalo actions for these cars
        const zaloErrorResult = await e2eQuery(`
          SELECT za.payload, zac.car_id
          FROM zalo_action za
          JOIN zalo_account zac ON zac.id = za.zalo_account_id
          WHERE zac.car_id = ANY($1::uuid[]) AND za.status = 'failed'
        `, [validZaloCarIds])

        // Track unique car_id per category per PIC (each car counted once per category)
        const picCategoryCarIds = new Map<string, Map<string, Set<string>>>() // pic -> category -> Set<car_id>

        for (const row of zaloErrorResult.rows) {
          const carId = row.car_id as string
          const picId = carToPic.get(carId)
          if (!picId || !nameMap.has(picId)) continue

          const category = categorizeZaloError(row.payload)

          if (!picCategoryCarIds.has(picId)) picCategoryCarIds.set(picId, new Map())
          const categoryMap = picCategoryCarIds.get(picId)!
          if (!categoryMap.has(category)) categoryMap.set(category, new Set())
          categoryMap.get(category)!.add(carId)
        }

        // Convert Sets to counts
        picCategoryCarIds.forEach((categoryMap, picId) => {
          const breakdown: Record<string, number> = {}
          categoryMap.forEach((carIds, category) => {
            breakdown[category] = carIds.size
          })
          zaloReasonBreakdownMap.set(picId, breakdown)
        })
      }

      // ── 5c. Count leads with NO zalo_action at all ───────────────────────
      if (validZaloCarIds.length > 0) {
        const noActionResult = await e2eQuery(`
          SELECT unnest($1::uuid[]) AS input_car_id
          EXCEPT
          SELECT DISTINCT zac.car_id
          FROM zalo_account zac
          JOIN zalo_action za ON za.zalo_account_id = zac.id
          WHERE zac.car_id = ANY($1::uuid[])
        `, [validZaloCarIds])

        for (const row of noActionResult.rows) {
          const carId = row.input_car_id as string
          const picId = carToPic.get(carId)
          if (picId && nameMap.has(picId)) {
            noZaloActionCountMap.set(picId, (noZaloActionCountMap.get(picId) ?? 0) + 1)
          }
        }
      }
    }

    // ── 6. Build result: users with alerts first, then alphabetical ───────────
    const options: PicOption[] = Array.from(nameMap.entries())
      .map(([id, name]) => ({
        id,
        name,
        slaBreachCount: slaBreachCountMap.get(id) ?? 0,
        escalationCount: escalationCountMap.get(id) ?? 0,
        botActiveCount: botActiveCountMap.get(id) ?? 0,
        undefinedQualifiedCount: undefinedQualifiedCountMap.get(id) ?? 0,
        zaloReasonBreakdown: zaloReasonBreakdownMap.get(id) ?? {},
        noZaloActionCount: noZaloActionCountMap.get(id) ?? 0,
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
