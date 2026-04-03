import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { carIds, picId } = await request.json()

    if (!carIds || !Array.isArray(carIds) || carIds.length === 0) {
      return NextResponse.json({ leads: [] })
    }

    const hasPicFilter = picId && picId !== 'all'
    const picFilterClause = hasPicFilter ? `AND l.pic_id = $2::uuid` : ''
    const queryParams: any[] = hasPicFilter ? [carIds, picId] : [carIds]

    const query = `
      SELECT DISTINCT ON (c.id)
        l.phone,
        l.name,
        c.id                AS car_id,
        COALESCE(
          c.display_name, 
          'Chưa có thông tin xe'
        )                   AS car_display_name,
        c.created_at        AS car_created_at,
        u.user_name         AS pic_name,
        sp.result->-1->>'qualified'        AS qualified,
        sp.result->-1->>'seller_sentiment' AS seller_sentiment,
        ss.stage            AS crm_stage,
        ss.messages_zalo,
        -- Last customer message content
        (
          SELECT msg->>'content'
          FROM jsonb_array_elements(ss.messages_zalo) AS msg
          WHERE msg->>'uidFrom' != '0'
            AND (msg->>'timestamp')::bigint > 0
          ORDER BY (msg->>'timestamp')::bigint DESC
          LIMIT 1
        )                   AS last_customer_content,
        -- Thời gian chờ (phút)
        EXTRACT(EPOCH FROM (
          NOW() - TO_TIMESTAMP((
            SELECT MAX((msg->>'timestamp')::bigint)
            FROM jsonb_array_elements(ss.messages_zalo) AS msg
            WHERE msg->>'uidFrom' != '0'
              AND (msg->>'timestamp')::bigint > 0
          ) / 1000.0)
        )) / 60             AS mins_waiting
      FROM cars c
      JOIN leads l              ON l.id = c.lead_id
      LEFT JOIN users u         ON u.id = l.pic_id
      LEFT JOIN chat_summary cs ON cs.lead_id = l.id
      LEFT JOIN summary_properties sp ON sp.summary_id = cs.id
      LEFT JOIN sale_status ss  ON ss.car_id = c.id
      WHERE c.id = ANY($1::uuid[])
        ${picFilterClause}
      ORDER BY c.id, sp.updated_at DESC NULLS LAST
    `

    const res = await vucarV2Query(query, queryParams)

    // Sort by mins_waiting DESC at the application layer as well to ensure correctness after DISTINCT ON
    const leads = res.rows.map((row: any) => ({
      phone: row.phone,
      name: row.name,
      carId: row.car_id,
      carDisplayName: row.car_display_name,
      carCreatedAt: row.car_created_at,
      picName: row.pic_name,
      qualified: row.qualified,
      sellerSentiment: row.seller_sentiment,
      crmStage: row.crm_stage,
      messagesZalo: row.messages_zalo,
      lastCustomerContent: row.last_customer_content,
      minsWaiting: row.mins_waiting
    })).sort((a: any, b: any) => b.minsWaiting - a.minsWaiting)

    return NextResponse.json({ leads })
  } catch (error: any) {
    console.error("[Bot At-Risk Drilldown API] Error:", error)
    return NextResponse.json({ error: "Failed to fetch drilldown leads", details: error?.message }, { status: 500 })
  }
}
