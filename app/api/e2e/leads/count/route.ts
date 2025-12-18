import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { uid, search = "", sources = [] } = body

    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 })
    }

    // Build search condition for phone
    const searchCondition = search
      ? `AND (l.phone LIKE '%${search}%' OR l.additional_phone LIKE '%${search}%')`
      : ""

    // Build source filter condition
    const sourceCondition = sources.length > 0
      ? `AND l.source = ANY(ARRAY[${sources.map((s: string) => `'${s}'`).join(",")}])`
      : ""

    // Optimized query using GROUP BY instead of DISTINCT ON for better scalability
    const result = await vucarV2Query(
      `SELECT
        COUNT(*) FILTER (WHERE has_hot_lead = true) as priority_count,
        COUNT(*) FILTER (WHERE has_hot_lead IS NULL OR has_hot_lead = false) as nurture_count,
        COUNT(*) as total_count
      FROM (
        SELECT
          l.phone,
          MAX(CASE WHEN ss.is_hot_lead = true THEN 1 ELSE 0 END) = 1 as has_hot_lead
        FROM leads l
        LEFT JOIN cars c ON c.lead_id = l.id
          AND (c.updated_at IS NULL OR c.updated_at > NOW() - INTERVAL '2 months')
        LEFT JOIN sale_status ss ON ss.car_id = c.id
        WHERE l.pic_id = $1::uuid
        ${searchCondition}
        ${sourceCondition}
        GROUP BY l.phone
      ) AS grouped_leads`,
      [uid]
    )

    const row = result.rows[0]

    return NextResponse.json({
      priority: parseInt(row?.priority_count || 0),
      nurture: parseInt(row?.nurture_count || 0),
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
