import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

export const dynamic = "force-dynamic"

const STEP_ORDER = ["zalo_connect", "thu_thap_thong_tin", "dat_lich_kiem_dinh", "dam_phan_1"]

function formatHours(hours: number | null): string {
  if (hours == null || isNaN(hours)) return "—"
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}p`
  if (m === 0) return `${h}h`
  return `${h}h ${m}p`
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") ?? "30", 10)
    const validDays = [7, 30, 90].includes(days) ? days : 30

    // ── Per-step stats ───────────────────────────────────────────────────────
    const statsResult = await e2eQuery(`
      SELECT
        sr.step_key,
        sr.label,
        sr.sla_duration_hours,
        COUNT(*)                                                     AS total,
        COUNT(*) FILTER (WHERE sl.status = 'ongoing')               AS ongoing,
        COUNT(*) FILTER (WHERE sl.status = 'failed')                AS failed_total,
        COUNT(*) FILTER (WHERE sl.status = 'success')               AS success_total,
        COUNT(*) FILTER (
          WHERE sl.status = 'ongoing'
            AND sl.started_at IS NOT NULL
            AND NOW() > (sl.started_at + sr.sla_duration_hours * INTERVAL '1 hour')
        )                                                            AS currently_breached,
        AVG(
          EXTRACT(EPOCH FROM (
            NOW() - (sl.started_at + sr.sla_duration_hours * INTERVAL '1 hour')
          )) / 3600
        ) FILTER (
          WHERE sl.status = 'ongoing'
            AND sl.started_at IS NOT NULL
            AND NOW() > (sl.started_at + sr.sla_duration_hours * INTERVAL '1 hour')
        )                                                            AS avg_overdue_hours
      FROM sla_logging sl
      JOIN sla_rules sr ON sr.id = sl.sla_id
      WHERE sl.created_at >= NOW() - ($1 * INTERVAL '1 day')
      GROUP BY sr.step_key, sr.label, sr.sla_duration_hours
    `, [validDays])

    // ── Daily trend — breach count per day ───────────────────────────────────
    const trendResult = await e2eQuery(`
      SELECT
        DATE_TRUNC('day', sl.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
        COUNT(*)                                                              AS total,
        COUNT(*) FILTER (
          WHERE sl.status = 'ongoing'
            AND sl.started_at IS NOT NULL
            AND NOW() > (sl.started_at + sr.sla_duration_hours * INTERVAL '1 hour')
        )                                                                     AS breached
      FROM sla_logging sl
      JOIN sla_rules sr ON sr.id = sl.sla_id
      WHERE sl.created_at >= NOW() - ($1 * INTERVAL '1 day')
      GROUP BY 1
      ORDER BY 1
    `, [validDays])

    // Sort steps by canonical order
    const steps = statsResult.rows
      .sort((a: any, b: any) => {
        const ai = STEP_ORDER.indexOf(a.step_key)
        const bi = STEP_ORDER.indexOf(b.step_key)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      .map((r: any) => {
        const total = parseInt(r.total)
        const ongoing = parseInt(r.ongoing)
        const breached = parseInt(r.currently_breached)
        const breachRate = ongoing > 0 ? breached / ongoing : 0
        return {
          step_key: r.step_key,
          label: r.label,
          sla_hours: parseFloat(r.sla_duration_hours),
          total,
          ongoing,
          failed: parseInt(r.failed_total),
          success: parseInt(r.success_total),
          currently_breached: breached,
          breach_rate: breachRate,
          avg_overdue_formatted: formatHours(r.avg_overdue_hours != null ? parseFloat(r.avg_overdue_hours) : null),
        }
      })

    // Summary across all steps
    const totalAll = steps.reduce((s: number, r: any) => s + r.total, 0)
    const breachedAll = steps.reduce((s: number, r: any) => s + r.currently_breached, 0)
    const ongoingAll = steps.reduce((s: number, r: any) => s + r.ongoing, 0)
    const successAll = steps.reduce((s: number, r: any) => s + r.success, 0)
    const failedAll = steps.reduce((s: number, r: any) => s + r.failed, 0)

    const trend = trendResult.rows.map((r: any) => ({
      day: r.day,
      total: parseInt(r.total),
      breached: parseInt(r.breached),
    }))

    return NextResponse.json({
      period_days: validDays,
      summary: {
        total: totalAll,
        ongoing: ongoingAll,
        currently_breached: breachedAll,
        success: successAll,
        failed: failedAll,
        breach_rate: ongoingAll > 0 ? breachedAll / ongoingAll : 0,
      },
      steps,
      trend,
    })
  } catch (error) {
    console.error("[Lead Monitor] Error fetching SLA stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch SLA stats", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
