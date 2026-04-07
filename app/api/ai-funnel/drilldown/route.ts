import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { carIds } = await request.json()

    if (!carIds || !Array.isArray(carIds) || carIds.length === 0) {
      return NextResponse.json({ leads: [] })
    }

    // SQL provided by user spec
    // Note: sp.result->-1 gets the last element of the array
    const query = `
      SELECT DISTINCT ON (c.id)
        l.phone,
        l.name,
        c.id              AS car_id,
        COALESCE(
          c.display_name, 
          NULLIF(TRIM(CONCAT_WS(' ', sp.result->-1->>'brand', sp.result->-1->>'model', sp.result->-1->>'year')), ''),
          'Chưa có thông tin xe'
        ) AS car_display_name,
        c.created_at      AS car_created_at,
        u.user_name       AS pic_name,
        sp.result->-1->>'stage'            AS ai_stage,
        sp.result->-1->>'seller_sentiment' AS seller_sentiment,
        ss.stage          AS crm_stage,
        ss.qualified      AS crm_qualified,
        ss.messages_zalo
      FROM cars c
      JOIN leads l             ON l.id = c.lead_id
      LEFT JOIN users u        ON u.id = l.pic_id
      LEFT JOIN chat_summary cs ON cs.lead_id = l.id
      LEFT JOIN summary_properties sp ON sp.summary_id = cs.id
      LEFT JOIN sale_status ss ON ss.car_id = c.id
      WHERE c.id = ANY($1::uuid[])
      ORDER BY c.id, sp.updated_at DESC NULLS LAST
    `

    const res = await vucarV2Query(query, [carIds])

    return NextResponse.json({
      leads: res.rows.map(row => ({
        phone: row.phone,
        name: row.name,
        carId: row.car_id,
        carDisplayName: row.car_display_name,
        carCreatedAt: row.car_created_at,
        picName: row.pic_name,
        aiStage: row.ai_stage,
        sellerSentiment: row.seller_sentiment,
        crmStage: row.crm_stage,
        crmQualified: row.crm_qualified,
        messagesZalo: row.messages_zalo
      }))
    })
  } catch (error: any) {
    console.error("[AI Funnel Drilldown API] Error:", error)
    return NextResponse.json({ error: "Failed to fetch drilldown data", details: error?.message }, { status: 500 })
  }
}
