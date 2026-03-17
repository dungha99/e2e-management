import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"
import { KPISummary } from "@/components/lead-monitor/types"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // ── 1. Aggregate blocker counts from E2E DB ─────────────────────────────
    const blockersResult = await e2eQuery(`
      SELECT
        COUNT(DISTINCT cbs.car_id)                                             AS total_alerts,
        COUNT(DISTINCT CASE WHEN sr.severity >= 3 THEN cbs.car_id END)        AS critical_alerts,
        COUNT(DISTINCT CASE WHEN cbs.blocker_type = 'SLA_BREACH' THEN cbs.car_id END) AS sla_breach,
        COUNT(DISTINCT CASE WHEN cbs.blocker_type = 'ESCALATION' THEN cbs.car_id END) AS escalation
      FROM car_blocker_status cbs
      LEFT JOIN sla_logging sl
        ON sl.id = cbs.source_id AND cbs.source_type = 'sla_logging'
      LEFT JOIN sla_rules sr ON sr.id = sl.sla_id
      WHERE cbs.status IN ('OPEN', 'IN_PROGRESS')
    `)

    const row = blockersResult.rows[0] ?? {}

    // ── 2. Bot coverage stats from VucarV2 ──────────────────────────────────
    const botResult = await vucarV2Query(`
      SELECT
        COUNT(*)                                                        AS total_active,
        COUNT(*) FILTER (WHERE ss.bot_status = 'active')               AS bot_active
      FROM sale_status ss
      WHERE ss.stage NOT IN ('CLOSED', 'REJECTED', 'DONE')
    `)

    const botRow = botResult.rows[0] ?? {}
    const totalActive = parseInt(botRow.total_active ?? "0")
    const botActive = parseInt(botRow.bot_active ?? "0")

    const kpis: KPISummary = {
      critical_alerts: parseInt(row.critical_alerts ?? "0"),
      total_alerts: parseInt(row.total_alerts ?? "0"),
      sla_breach: parseInt(row.sla_breach ?? "0"),
      escalation: parseInt(row.escalation ?? "0"),
      bot_handled_percent: totalActive > 0 ? Math.round((botActive / totalActive) * 100) : 0,
      bot_handled_count: botActive,
      total_active_leads: totalActive,
    }

    return NextResponse.json(kpis)
  } catch (error) {
    console.error("[Lead Monitor] Error fetching KPIs:", error)
    return NextResponse.json(
      { error: "Failed to fetch KPIs", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
