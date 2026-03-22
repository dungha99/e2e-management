import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const picId = searchParams.get("pic_id")
        const dateFrom = searchParams.get("dateFrom") // e.g. 2026-03-01
        const dateTo = searchParams.get("dateTo")     // e.g. 2026-03-31

        if (!picId) {
            return NextResponse.json({ error: "pic_id is required" }, { status: 400 })
        }

        // --- Build base conditions for CRM Db ---
        const crmConditions = [`l.pic_id = $1`]
        const crmParams: any[] = [picId]
        let paramIdx = 2

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

        // 1. Tổng leads
        const totalLeadsRes = await vucarV2Query(`
      SELECT COUNT(DISTINCT l.id) AS cnt
      FROM leads l
      WHERE ${crmWhere}
    `, crmParams)
        const totalLeads = parseInt(totalLeadsRes.rows[0]?.cnt || "0", 10)

        // 2a. Đã có hình (STRONG_QUALIFIED)
        const hasImageRes = await vucarV2Query(`
      SELECT COUNT(DISTINCT l.id) AS cnt
      FROM leads l
      LEFT JOIN cars c ON c.lead_id = l.id
      LEFT JOIN sale_status ss ON ss.car_id = c.id
      WHERE ${crmWhere}
        AND ss.qualified = 'STRONG_QUALIFIED'
    `, crmParams)
        const hasImageCount = parseInt(hasImageRes.rows[0]?.cnt || "0", 10)

        // 2b. Chưa có hình (or NULL) -> We also need their phones for cross-checking
        const noImagePhonesRes = await vucarV2Query(`
      SELECT DISTINCT l.phone
      FROM leads l
      LEFT JOIN cars c ON c.lead_id = l.id
      LEFT JOIN sale_status ss ON ss.car_id = c.id
      WHERE ${crmWhere}
        AND (ss.qualified != 'STRONG_QUALIFIED' OR ss.qualified IS NULL)
        AND l.phone IS NOT NULL
    `, crmParams)

        // Some leads might not have a phone, but the count of leads without image is:
        // Actually, to perfectly match the UI count:
        const noImageCountRes = await vucarV2Query(`
      SELECT COUNT(DISTINCT l.id) AS cnt
      FROM leads l
      LEFT JOIN cars c ON c.lead_id = l.id
      LEFT JOIN sale_status ss ON ss.car_id = c.id
      WHERE ${crmWhere}
        AND (ss.qualified != 'STRONG_QUALIFIED' OR ss.qualified IS NULL)
    `, crmParams)
        const noImageCount = parseInt(noImageCountRes.rows[0]?.cnt || "0", 10)

        const chuaCoHinhPhones = noImagePhonesRes.rows.map((r: any) => r.phone).filter(Boolean)

        // 3. Zalo Action logic (Cross-DB)
        let zaloSuccessCount = 0
        let zaloNeverCount = 0
        let zaloFailedCount = 0
        let zaloNoUidCount = 0
        let zaloTimeoutCount = 0

        if (chuaCoHinhPhones.length > 0) {
            // Build conditions for E2E Db
            const e2eConditions = [`action_type = 'firstMessage'`]
            const e2eParams: any[] = []
            let e2eParamIdx = 1

            if (dateFrom) {
                e2eConditions.push(`created_at >= $${e2eParamIdx}::timestamp`)
                e2eParams.push(`${dateFrom} 00:00:00`)
                e2eParamIdx++
            }
            if (dateTo) {
                e2eConditions.push(`created_at <= $${e2eParamIdx}::timestamp`)
                e2eParams.push(`${dateTo} 23:59:59`)
                e2eParamIdx++
            }

            e2eConditions.push(`COALESCE(payload->>'phone', payload->>'customer_phone') = ANY($${e2eParamIdx}::text[])`)
            e2eParams.push(chuaCoHinhPhones)

            const e2eWhere = e2eConditions.join(" AND ")

            const zaloStatusRes = await e2eQuery(`
        SELECT
          COALESCE(payload->>'phone', payload->>'customer_phone') AS phone,
          MAX(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS has_success,
          MAX(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END) AS has_failed,
          STRING_AGG(
            DISTINCT CASE WHEN status = 'failed'
              THEN COALESCE(payload->>'akabiz_error', payload->>'reason', payload->>'error')
            END,
            ' | '
          ) AS fail_reasons
        FROM zalo_action
        WHERE ${e2eWhere}
        GROUP BY COALESCE(payload->>'phone', payload->>'customer_phone')
      `, e2eParams)

            const phoneToStatus = new Map(zaloStatusRes.rows.map((r: any) => [r.phone, r]))

            for (const phone of chuaCoHinhPhones) {
                const status = phoneToStatus.get(phone)
                if (!status) {
                    zaloNeverCount++
                } else if (status.has_success === 1) {
                    zaloSuccessCount++
                } else if (status.has_failed === 1 && status.has_success === 0) {
                    zaloFailedCount++

                    // Sub-reasons breakdown exactly like requirement
                    const reasons = (status.fail_reasons || "").toLowerCase()
                    if (reasons.includes("bạn chưa thể gửi") || reasons.includes("xin lỗi! hiện tại")) {
                        // Lỗi 1: Chặn tin nhắn
                        zaloNoUidCount++ // Repurposing this variable for Lỗi 1: Chặn tin nhắn to minimize frontend prop changes initially, or better yet, we rename them. Let's return the new properties too.
                    } else if (reasons.includes("no uid found") || reasons.includes("request timed out") || reasons.includes("connection reset") || reasons.includes("no staff found")) {
                        // Lỗi 2: No uid / lỗi hệ thống
                        zaloTimeoutCount++ // Repurposing this for Lỗi 2
                    } else {
                        // Default fallback to lỗi hệ thống
                        zaloTimeoutCount++
                    }
                } else {
                    zaloNeverCount++
                }
            }
        } else {
            zaloNeverCount = noImageCount // if no phones at all, they all never connected
        }

        return NextResponse.json({
            totalLeads,
            hasImageCount,
            noImageCount,
            zaloSuccessCount,      // 3a. firstMessage success
            zaloFailedCount,       // 3b. firstMessage failed
            zaloNeverCount,        // 3c. Chưa gửi firstMessage
            zaloBlockedCount: zaloNoUidCount,       // Lỗi 1: Chặn tin nhắn
            zaloSystemErrorCount: zaloTimeoutCount, // Lỗi 2: No uid / lỗi hệ thống
            // Keep the old ones backward compatible during rollout
            zaloNoUidCount,
            zaloTimeoutCount,
        })
    } catch (error) {
        console.error("[Funnel Stats API] Error:", error)
        return NextResponse.json(
            { error: "Failed to fetch funnel stats", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        )
    }
}
