import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const picId = searchParams.get("pic_id")
    const dateFrom = searchParams.get("dateFrom") || ""
    const dateTo = searchParams.get("dateTo") || ""

    // --- Build base conditions for CRM Db ---
    const crmConditions: string[] = []
    const crmParams: any[] = []
    let paramIdx = 1

    if (picId && picId !== 'all') {
      crmConditions.push(`l.pic_id = $${paramIdx}`)
      crmParams.push(picId)
      paramIdx++
    }

    if (dateFrom) {
      crmConditions.push(`l.created_at >= $${paramIdx}::timestamp`)
      crmParams.push(`${dateFrom} 00:00:00`)
      paramIdx++
    }
    if (dateTo) {
      crmConditions.push(`l.created_at <= $${paramIdx}::timestamp`)
      crmParams.push(`${dateTo} 23:59:59`)
      paramIdx++
    }
    const crmWhere = crmConditions.join(" AND ")

    // 1. Get leads in "2b. Chưa có hình" (No STRONG_QUALIFIED)
    const crmRes = await vucarV2Query(`
      SELECT DISTINCT ON (l.phone)
             l.id AS id, l.phone, l.additional_phone, l.name, c.id AS car_id,
             c.brand, c.model, c.year, c.created_at AS car_created_at,
             c.location, c.mileage, ss.notes, ss.qualified,
             MAX(CASE 
               WHEN ss.messages_zalo IS NOT NULL 
                AND ss.messages_zalo != 'null'::jsonb 
                AND jsonb_array_length(ss.messages_zalo) > 0 
               THEN 1 ELSE 0 
             END) AS has_messages_zalo,
             SUM(CASE WHEN ss.messages_zalo IS NOT NULL THEN (
               SELECT COUNT(*) FROM jsonb_array_elements(ss.messages_zalo) m
               WHERE m->>'uidFrom' = '0'
             ) ELSE 0 END) AS msgs_from_sale,
             SUM(CASE WHEN ss.messages_zalo IS NOT NULL THEN (
               SELECT COUNT(*) FROM jsonb_array_elements(ss.messages_zalo) m
               WHERE m->>'uidFrom' != '0'
             ) ELSE 0 END) AS msgs_from_customer,
             MAX(CASE WHEN ss.messages_zalo IS NOT NULL AND jsonb_array_length(ss.messages_zalo) > 0
               THEN (
                 SELECT MAX((m->>'dateAction')::timestamptz)
                 FROM jsonb_array_elements(ss.messages_zalo) m
                 WHERE m->>'dateAction' IS NOT NULL AND m->>'dateAction' != ''
               )
             END) AS last_msg_at,
             MAX(CASE WHEN ss.messages_zalo IS NOT NULL AND jsonb_array_length(ss.messages_zalo) > 0
               THEN (
                 SELECT MAX((m->>'dateAction')::timestamptz)
                 FROM jsonb_array_elements(ss.messages_zalo) m
                 WHERE m->>'uidFrom' = '0'
                   AND m->>'dateAction' IS NOT NULL AND m->>'dateAction' != ''
               )
             END) AS last_sale_msg_at
      FROM leads l
      LEFT JOIN cars c ON c.lead_id = l.id
      LEFT JOIN sale_status ss ON ss.car_id = c.id
      WHERE ${crmWhere || '1=1'} AND (ss.qualified != 'STRONG_QUALIFIED' OR ss.qualified IS NULL)
        AND l.phone IS NOT NULL
      GROUP BY l.phone, l.id, l.additional_phone, l.name, c.id, c.brand, c.model, c.year, c.created_at, c.location, c.mileage, ss.notes, ss.qualified
      ORDER BY l.phone, l.created_at DESC
      LIMIT 200
    `, crmParams)

    const crmLeads = crmRes.rows
    const phones = [...new Set(crmLeads.map((r: any) => r.phone).filter(Boolean))]

    if (phones.length === 0) return NextResponse.json({ leads: [] })

    // 2. Fetch Zalo actions (firstMessage) from E2E Db
    const fmRes = await e2eQuery(`
      SELECT
        COALESCE(payload->>'phone', payload->>'customer_phone') AS phone,
        MAX(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS has_success,
        MIN(CASE WHEN status = 'success' THEN created_at END) AS first_success_at,
        MAX(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END) AS has_failed
      FROM zalo_action
      WHERE action_type = 'firstMessage'
        AND COALESCE(payload->>'phone', payload->>'customer_phone') = ANY($1::text[])
      GROUP BY 1
    `, [phones])

    const fmMap = new Map(fmRes.rows.map((r: any) => [r.phone, r]))

    // 3. Fetch sale_activities for BOT_FOLLOW_UP_SENT
    const saRes = await vucarV2Query(`
      SELECT lead_id, activity_type, created_at
      FROM sale_activities
      WHERE activity_type = 'BOT_FOLLOW_UP_SENT'
        AND lead_id = ANY($1::uuid[])
      ORDER BY created_at DESC
    `, [crmLeads.map(l => l.id)])

    const saMap = new Map()
    for (const sa of saRes.rows) {
      if (!saMap.has(sa.lead_id)) saMap.set(sa.lead_id, sa)
    }

    // 4. Map and Filter (3A / 3C + due for follow up)
    const processedLeads = crmLeads.map((r: any) => {
      const phone = r.phone
      const fm = fmMap.get(phone) as any
      const hasMZ = r.has_messages_zalo === 1
      const nSale = parseInt(r.msgs_from_sale || "0", 10)
      const nCust = parseInt(r.msgs_from_customer || "0", 10)
      const lastMsgAt = r.last_msg_at ? new Date(r.last_msg_at).getTime() : 0
      const lastSaleMsgAt = r.last_sale_msg_at ? new Date(r.last_sale_msg_at).getTime() : 0

      const is3A = fm?.has_success === 1 || (hasMZ && nSale > 0 && nCust > 0)
      const is3C = !is3A && fm?.has_failed !== 1
      
      // Basic funnel category
      let category = ""
      if (is3A) category = "3A (Success)"
      else if (is3C) category = "3C (Never)"
      else category = "3B (Failed)"

      // Follow up status
      const sa = saMap.get(r.id)
      const followUpSent = !!sa

      // Calculate days since last action/creation
      const referenceTime = is3A ? (lastMsgAt || new Date(r.car_created_at).getTime()) : (lastSaleMsgAt || new Date(r.car_created_at).getTime())
      const daysSince = Math.round((Date.now() - referenceTime) / 86400000 * 10) / 10

      return {
        ...r,
        phone: r.phone || r.additional_phone || "N/A",
        name: r.name || "—",
        category,
        followUpSent,
        lastFollowUpAt: sa ? sa.created_at : null,
        daysSince,
        is3A,
        is3C
      }
    }).filter(l => (l.is3A || l.is3C) && l.daysSince >= 1)

    // Calculate metrics
    const totalFollowed = processedLeads.filter(l => l.followUpSent).length
    const totalNotFollowed = processedLeads.filter(l => !l.followUpSent).length

    return NextResponse.json({ 
      leads: processedLeads,
      metrics: {
        totalFollowed,
        totalNotFollowed
      }
    })
  } catch (error) {
    console.error("[Funnel Follow-up Leads API] Error:", error)
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 })
  }
}
