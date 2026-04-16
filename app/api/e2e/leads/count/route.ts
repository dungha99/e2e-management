import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { uid, search = "", sources = [], funnelTags = [], dateFrom = null, dateTo = null } = body

    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 })
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_REGEX.test(uid)) {
      return NextResponse.json({ priority: 0, nurture: 0, total: 0 })
    }

    // Build search condition (search is safe as-is — not a user-injectable field in prod,
    // but kept as interpolation to match existing pattern; sources/dates are parameterized)
    const searchCondition = search
      ? `AND (
          l.phone LIKE '%${search.replace(/'/g, "''")}%'
          OR l.additional_phone LIKE '%${search.replace(/'/g, "''")}%'
          OR l.name ILIKE '%${search.replace(/'/g, "''")}%'
          OR CONCAT(c.brand, ' ', c.model) ILIKE '%${search.replace(/'/g, "''")}%'
          OR c.id::text ILIKE '%${search.replace(/'/g, "''")}%'
        )`
      : ""

    // Build parameterized conditions
    const queryParams: any[] = [uid]
    let paramIdx = 2

    let sourceCondition = ""
    if (sources.length > 0) {
      sourceCondition = `AND l.source = ANY($${paramIdx}::text[])`
      queryParams.push(sources)
      paramIdx++
    }

    let dateCondition = ""
    if (dateFrom && dateTo) {
      dateCondition = `AND c.created_at >= $${paramIdx}::date AND c.created_at < ($${paramIdx + 1}::date + interval '1 day')`
      queryParams.push(dateFrom, dateTo)
      paramIdx += 2
    } else if (dateFrom) {
      dateCondition = `AND c.created_at >= $${paramIdx}::date AND c.created_at < ($${paramIdx}::date + interval '1 day')`
      queryParams.push(dateFrom)
      paramIdx++
    }

    let funnelTagCondition = ""
    if (funnelTags.length > 0) {
      funnelTagCondition = `AND ss.funnel_tag = ANY($${paramIdx}::text[])`
      queryParams.push(funnelTags)
      paramIdx++
    }

    // Optimized query using GROUP BY instead of DISTINCT ON for better scalability
    const result = await vucarV2Query(
      `SELECT
        COUNT(*) FILTER (WHERE has_hot_lead = true) as priority_count,
        COUNT(*) FILTER (WHERE has_hot_lead IS NULL OR has_hot_lead = false) as nurture_count,
        COUNT(*) FILTER (WHERE is_slow_follow_up = true) as follow_up_count,
        COUNT(*) as total_count
      FROM (
        SELECT
          l.phone,
          c.id as car_id,
          MAX(CASE WHEN ss.is_hot_lead = true THEN 1 ELSE 0 END) = 1 as has_hot_lead,
          MAX(CASE WHEN ss.intention = 'SLOW' AND EXISTS (
            SELECT 1 FROM sale_activities sa
            WHERE sa.lead_id = l.id
              AND sa.metadata->>'field_name' = 'intentionLead'
              AND (sa.metadata->>'new_value' = 'SLOW' OR sa.metadata->>'new_value' = 'slow')
              AND sa.created_at <= NOW() - INTERVAL '4 days'
          ) THEN 1 ELSE 0 END) = 1 as is_slow_follow_up
        FROM leads l
        LEFT JOIN cars c ON c.lead_id = l.id
          AND (c.updated_at IS NULL OR c.updated_at > NOW() - INTERVAL '2 months')
          AND (c.is_deleted IS NULL OR c.is_deleted = false)
        LEFT JOIN sale_status ss ON ss.car_id = c.id
        WHERE l.pic_id = $1::uuid
        ${searchCondition}
        ${sourceCondition}
        ${dateCondition}
        ${funnelTagCondition}
        GROUP BY l.phone, c.id
      ) AS grouped_leads`,
      queryParams
    )

    const row = result.rows[0]

    return NextResponse.json({
      priority: parseInt(row?.priority_count || 0),
      nurture: parseInt(row?.nurture_count || 0),
      followUp: parseInt(row?.follow_up_count || 0),
      total: parseInt(row?.total_count || 0),
    })
  } catch (error) {
    console.error("[E2E Count API] Error fetching counts:", error)
    return NextResponse.json(
      { error: "Failed to fetch counts", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
