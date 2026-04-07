import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const threshold = parseInt(searchParams.get('threshold') || '15')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const picId = searchParams.get('picId')

    // Step 1: Get AI car IDs from E2E DB (DB9)
    let aiLeadsQuery = `
      SELECT DISTINCT car_id
      FROM ai_agent_outputs
      WHERE agent_id = 'd68a4392-c2d7-4311-8c0a-816a232014eb'
    `
    const aiLeadsParams: any[] = []
    if (startDate && endDate) {
      aiLeadsQuery += ` AND created_at >= $1 AND created_at <= $2`
      aiLeadsParams.push(startDate, endDate)
    }

    const aiLeadsRes = await e2eQuery(aiLeadsQuery, aiLeadsParams)
    const aiCarIds = aiLeadsRes.rows.map((r: any) => r.car_id).filter(Boolean)

    if (aiCarIds.length === 0) {
      return NextResponse.json({
        count: 0,
        carIds: [],
        lastUpdated: new Date().toISOString(),
        buckets: { lt15: 0, m15to30: 0, m30to60: 0, h1to2: 0, gt2h: 0 }
      })
    }

    // Step 2: Calculate at-risk from VucarV2 DB (DB2)
    // Build PIC filter conditionally to avoid type-casting issues with nullable uuid params
    const hasPicFilter = picId && picId !== 'all'
    const picFilterClause = hasPicFilter ? `AND l.pic_id = $2::uuid` : ''
    const db2Params: any[] = hasPicFilter ? [aiCarIds, picId] : [aiCarIds]

    const atRiskRes = await vucarV2Query(`
      WITH last_msgs AS (
        SELECT
          ss.car_id,
          MAX((msg->>'timestamp')::bigint) FILTER (
            WHERE msg->>'uidFrom' != '0' 
              AND (msg->>'timestamp')::bigint > 0
          ) AS last_customer_ts,
          MAX((msg->>'timestamp')::bigint) FILTER (
            WHERE msg->>'uidFrom' = '0' 
              AND (msg->>'timestamp')::bigint > 0
          ) AS last_bot_ts
        FROM sale_status ss
        JOIN cars c ON c.id = ss.car_id
        JOIN leads l ON l.id = c.lead_id
        CROSS JOIN LATERAL jsonb_array_elements(ss.messages_zalo) AS msg
        WHERE ss.car_id = ANY($1::uuid[])
          AND ss.messages_zalo IS NOT NULL
          AND ss.messages_zalo::text NOT IN ('null', '[]', '{}')
          AND ss.stage NOT IN ('COMPLETED', 'DEPOSIT_PAID', 'FAILED')
          ${picFilterClause}
        GROUP BY ss.car_id
      )
      SELECT
        car_id,
        EXTRACT(EPOCH FROM (NOW() - TO_TIMESTAMP(last_customer_ts / 1000.0))) / 60 AS mins_waiting
      FROM last_msgs
      WHERE last_customer_ts IS NOT NULL
        AND last_customer_ts > COALESCE(last_bot_ts, 0)
    `, db2Params)

    const allAtRiskLeads = atRiskRes.rows
    const filteredCarIds = allAtRiskLeads
      .filter(l => l.mins_waiting >= threshold)
      .map(l => l.car_id)

    // Calculate buckets (always based on all at-risk leads, not just filtered by threshold)
    // Actually, usually we show buckets for "all leads waiting for a reply"
    const buckets = {
      lt15: allAtRiskLeads.filter(l => l.mins_waiting < 15).length,
      m15to30: allAtRiskLeads.filter(l => l.mins_waiting >= 15 && l.mins_waiting < 30).length,
      m30to60: allAtRiskLeads.filter(l => l.mins_waiting >= 30 && l.mins_waiting < 60).length,
      h1to2: allAtRiskLeads.filter(l => l.mins_waiting >= 60 && l.mins_waiting < 120).length,
      gt2h: allAtRiskLeads.filter(l => l.mins_waiting >= 120).length,
    }

    return NextResponse.json({
      count: filteredCarIds.length,
      carIds: filteredCarIds,
      lastUpdated: new Date().toISOString(),
      buckets
    })
  } catch (error: any) {
    console.error("[Bot At-Risk API] Error:", error)
    return NextResponse.json({ error: "Failed to fetch bot at-risk data", details: error?.message }, { status: 500 })
  }
}
