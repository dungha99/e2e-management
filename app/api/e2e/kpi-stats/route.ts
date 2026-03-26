import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"

export const dynamic = "force-dynamic"

// ── Zalo error categorization (shared logic) ────────────────────────────────
type ZaloErrorCategory =
  | "BLOCKED_STRANGER"
  | "DECLINED_MESSAGES"
  | "NO_UID_FOUND"
  | "CONTACT_NOT_FOUND"
  | "TIMEOUT"
  | "SEARCH_FAILED"
  | "OTHER"

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

/**
 * GET /api/e2e/kpi-stats?pic_id=xxx[&search=...&sources=zalo,facebook&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD]
 *
 * Returns:
 * - undefinedQualifiedCount: number of leads with ss.qualified = 'UNDEFINED_QUALIFIED'
 * - zaloReasonBreakdown: Record<string, number> - category → #leads
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const picId = searchParams.get("pic_id")
    const search = searchParams.get("search") || ""
    const sources = searchParams.get("sources")?.split(",").filter(Boolean) || []
    const dateFrom = searchParams.get("dateFrom") || ""
    const dateTo = searchParams.get("dateTo") || ""

    if (!picId) {
      return NextResponse.json({ error: "pic_id is required" }, { status: 400 })
    }

    // ── Build dynamic WHERE clauses for filters ─────────────────────────────
    const baseConditions = [`l.pic_id = $1`]
    const baseParams: any[] = [picId]
    let paramIdx = 2

    if (search) {
      baseConditions.push(`(l.name ILIKE $${paramIdx} OR l.phone ILIKE $${paramIdx} OR l.additional_phone ILIKE $${paramIdx})`)
      baseParams.push(`%${search}%`)
      paramIdx++
    }

    if (sources.length > 0) {
      baseConditions.push(`l.source = ANY($${paramIdx}::text[])`)
      baseParams.push(sources)
      paramIdx++
    }

    if (dateFrom) {
      baseConditions.push(`c.created_at >= $${paramIdx}::timestamp`)
      baseParams.push(`${dateFrom}T00:00:00`)
      paramIdx++
    }

    if (dateTo) {
      baseConditions.push(`c.created_at <= $${paramIdx}::timestamp`)
      baseParams.push(`${dateTo}T23:59:59`)
      paramIdx++
    }

    const filterWhere = baseConditions.join(" AND ")

    // ── 1. Count UNDEFINED_QUALIFIED leads for this PIC ─────────────────────
    const undefinedResult = await vucarV2Query(`
      SELECT COUNT(DISTINCT c.id) AS cnt
      FROM cars c
      LEFT JOIN leads l ON l.id = c.lead_id
      LEFT JOIN sale_status ss ON ss.car_id = c.id
      WHERE ${filterWhere}
        AND ss.qualified = 'UNDEFINED_QUALIFIED'
        AND (ss.stage IS NULL OR ss.stage NOT IN ('FAILED', 'DEPOSIT_PAID', 'COMPLETED'))
    `, baseParams)

    const undefinedQualifiedCount = parseInt(undefinedResult.rows[0]?.cnt ?? "0")

    // ── 2. Zalo error reason breakdown ──────────────────────────────────────
    // Get zalo_connect SLA car_ids
    const zaloSlaResult = await e2eQuery(`
      SELECT DISTINCT ON (sl.car_id) sl.car_id
      FROM sla_logging sl
      JOIN sla_rules sr ON sr.id = sl.sla_id
      WHERE sl.status IN ('ongoing', 'failed')
        AND sr.step_key = 'zalo_connect'
      ORDER BY sl.car_id, sl.started_at DESC
    `)
    const allZaloCarIds = zaloSlaResult.rows.map((r: any) => r.car_id as string)

    let zaloReasonBreakdown: Record<string, number> = {}

    if (allZaloCarIds.length > 0) {
      // Filter to this PIC's cars with additional filters applied
      const picCarsResult = await vucarV2Query(`
        SELECT c.id AS car_id
        FROM cars c
        LEFT JOIN leads l ON l.id = c.lead_id
        LEFT JOIN sale_status ss ON ss.car_id = c.id
        WHERE c.id = ANY($${paramIdx}::uuid[])
          AND ${filterWhere}
          AND (ss.stage IS NULL OR ss.stage NOT IN ('FAILED', 'DEPOSIT_PAID', 'COMPLETED'))
          AND (ss.qualified IS NULL OR ss.qualified NOT IN ('NON_QUALIFIED', 'TEST'))
      `, [...baseParams, allZaloCarIds])

      // Note: allZaloCarIds is at position $paramIdx in the query above
      // but we need to prepend baseParams — let's restructure

      const picZaloCarIds = picCarsResult.rows.map((r: any) => r.car_id as string)

      if (picZaloCarIds.length > 0) {
        // Fetch failed zalo actions
        const zaloErrorResult = await e2eQuery(`
          SELECT za.payload, zac.car_id
          FROM zalo_action za
          JOIN zalo_account zac ON zac.id = za.zalo_account_id
          WHERE zac.car_id = ANY($1::uuid[]) AND za.status = 'failed'
        `, [picZaloCarIds])

        // Count unique car_ids per category
        const categoryCarIds = new Map<string, Set<string>>()

        for (const row of zaloErrorResult.rows) {
          const carId = row.car_id as string
          const category = categorizeZaloError(row.payload)

          if (!categoryCarIds.has(category)) categoryCarIds.set(category, new Set())
          categoryCarIds.get(category)!.add(carId)
        }

        categoryCarIds.forEach((carIds, category) => {
          zaloReasonBreakdown[category] = carIds.size
        })
      }
    }

    // ── 3. Count leads with NO zalo_action record at all ────────────────────
    // These are leads in zalo_connect SLA step but with zero zalo_action rows
    let noZaloActionCount = 0

    if (allZaloCarIds.length > 0) {
      // Re-use picZaloCarIds if available, otherwise re-query
      const picCarsForNoAction = await vucarV2Query(`
        SELECT c.id AS car_id
        FROM cars c
        LEFT JOIN leads l ON l.id = c.lead_id
        LEFT JOIN sale_status ss ON ss.car_id = c.id
        WHERE c.id = ANY($${paramIdx}::uuid[])
          AND ${filterWhere}
          AND (ss.stage IS NULL OR ss.stage NOT IN ('FAILED', 'DEPOSIT_PAID', 'COMPLETED'))
          AND (ss.qualified IS NULL OR ss.qualified NOT IN ('NON_QUALIFIED', 'TEST'))
      `, [...baseParams, allZaloCarIds])

      const picCarIdsForCheck = picCarsForNoAction.rows.map((r: any) => r.car_id as string)

      if (picCarIdsForCheck.length > 0) {
        // Find car_ids that have NO zalo_action at all (via zalo_account)
        const noActionResult = await e2eQuery(`
          SELECT COUNT(DISTINCT input_car_id) AS cnt
          FROM (
            SELECT unnest($1::uuid[]) AS input_car_id
          ) AS inputs
          WHERE NOT EXISTS (
            SELECT 1
            FROM zalo_account zac
            JOIN zalo_action za ON za.zalo_account_id = zac.id
            WHERE zac.car_id = inputs.input_car_id
          )
        `, [picCarIdsForCheck])

        noZaloActionCount = parseInt(noActionResult.rows[0]?.cnt ?? "0")
      }
    }

    return NextResponse.json({
      undefinedQualifiedCount,
      zaloReasonBreakdown,
      noZaloActionCount,
    })
  } catch (error) {
    console.error("[E2E] Error fetching KPI stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch KPI stats", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
