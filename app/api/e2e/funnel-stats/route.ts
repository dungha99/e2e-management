import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const picId = searchParams.get("pic_id")
        const dateFrom = searchParams.get("dateFrom") || ""
        const dateTo = searchParams.get("dateTo") || ""

        const startTs = dateFrom ? `${dateFrom} 00:00:00` : "2000-01-01 00:00:00"
        const endTs = dateTo ? `${dateTo} 23:59:59` : "2100-01-01 23:59:59"

        // --- Build base conditions for qualification distribution (ignoring qFilter) ---
        const baseCrmConditions: string[] = []
        const baseCrmParams: any[] = []
        let baseParamIdx = 1

        if (picId && picId !== 'all') {
            baseCrmConditions.push(`l.pic_id = $${baseParamIdx}`)
            baseCrmParams.push(picId)
            baseParamIdx++
        }
        if (dateFrom) {
            baseCrmConditions.push(`l.created_at >= $${baseParamIdx}::timestamp`)
            baseCrmParams.push(`${dateFrom} 00:00:00`)
            baseParamIdx++
        }
        if (dateTo) {
            baseCrmConditions.push(`l.created_at <= $${baseParamIdx}::timestamp`)
            baseCrmParams.push(`${dateTo} 23:59:59`)
            baseParamIdx++
        }
        const baseCrmWhere = baseCrmConditions.length > 0 ? baseCrmConditions.join(" AND ") : "1=1"

        const qDistributionRes = await vucarV2Query(`
            SELECT 
                COUNT(DISTINCT l.phone) as total,
                COUNT(DISTINCT l.phone) FILTER (WHERE ss.qualified::text IN ('STRONG_QUALIFIED', 'WEAK_QUALIFIED', 'QUALIFIED', 'SLOW', 'WEAK')) as qualified,
                COUNT(DISTINCT l.phone) FILTER (WHERE ss.qualified::text = 'NON_QUALIFIED') as non_qualified,
                COUNT(DISTINCT l.phone) FILTER (WHERE ss.qualified::text = 'UNDEFINED_QUALIFIED' OR ss.qualified IS NULL) as undefined_qualified
            FROM leads l
            LEFT JOIN cars c ON c.lead_id = l.id
            LEFT JOIN sale_status ss ON ss.car_id = c.id
            WHERE ${baseCrmWhere}
        `, baseCrmParams)
        const qualificationBreakdown = qDistributionRes.rows[0]

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
        const qFilter = searchParams.get("qualified")
        if (qFilter) {
            crmConditions.push(`ss.qualified::text = ANY($${paramIdx}::text[])`)
            crmParams.push(qFilter.split(","))
            paramIdx++
        }

        const crmWhere = crmConditions.length > 0 ? crmConditions.join(" AND ") : "1=1"

        // 1. Tổng leads
        const totalLeadsRes = await vucarV2Query(`
            SELECT COUNT(DISTINCT l.phone) AS cnt
            FROM leads l
            LEFT JOIN cars c ON c.lead_id = l.id
            LEFT JOIN sale_status ss ON ss.car_id = c.id
            WHERE ${crmWhere}
        `, crmParams)
        const totalLeads = parseInt(totalLeadsRes.rows[0]?.cnt || "0", 10)

        // 2a. Đã có hình (STRONG_QUALIFIED)
        const hasImageRes = await vucarV2Query(`
            WITH phone_images AS (
              SELECT l.phone,
                MAX(CASE 
                  WHEN c.additional_images IS NOT NULL 
                    AND c.additional_images::text != 'null' 
                    AND c.additional_images::text != '{}' 
                    AND c.additional_images::text != ''
                  THEN 1 ELSE 0 
                END) AS has_additional
              FROM leads l
              LEFT JOIN cars c ON c.lead_id = l.id
              LEFT JOIN sale_status ss ON ss.car_id = c.id
              WHERE ${crmWhere}
                AND ss.qualified::text = 'STRONG_QUALIFIED'
              GROUP BY l.phone
            )
            SELECT 
              COUNT(*) AS cnt,
              COUNT(*) FILTER (WHERE has_additional = 1) AS with_additional,
              COUNT(*) FILTER (WHERE has_additional = 0) AS without_additional
            FROM phone_images
        `, crmParams)
        const hasImageCount = parseInt(hasImageRes.rows[0]?.cnt || "0", 10)
        const hasImageWithAdditional = parseInt(hasImageRes.rows[0]?.with_additional || "0", 10)
        const hasImageWithoutAdditional = parseInt(hasImageRes.rows[0]?.without_additional || "0", 10)

        // 2b. Chưa có hình (or NULL) -> Get their phones and message stats
        const noImagePhonesRes = await vucarV2Query(`
            SELECT DISTINCT l.phone,
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
                   COALESCE(
                     MAX(CASE WHEN ss.messages_zalo IS NOT NULL AND jsonb_array_length(ss.messages_zalo) > 0
                       THEN (
                         SELECT MAX((m->>'dateAction')::timestamptz)
                         FROM jsonb_array_elements(ss.messages_zalo) m
                         WHERE m->>'dateAction' IS NOT NULL AND m->>'dateAction' != ''
                       )
                     END),
                     MAX(l.created_at)
                   ) AS last_msg_at,
                   COALESCE(
                     MAX(CASE WHEN ss.messages_zalo IS NOT NULL AND jsonb_array_length(ss.messages_zalo) > 0
                       THEN (
                         SELECT MAX((m->>'dateAction')::timestamptz)
                         FROM jsonb_array_elements(ss.messages_zalo) m
                         WHERE m->>'uidFrom' = '0'
                           AND m->>'dateAction' IS NOT NULL AND m->>'dateAction' != ''
                       )
                     END),
                     MAX(l.created_at)
                   ) AS last_sale_msg_at
            FROM leads l
            LEFT JOIN cars c ON c.lead_id = l.id
            LEFT JOIN sale_status ss ON ss.car_id = c.id
            WHERE ${crmWhere}
              AND (ss.qualified::text != 'STRONG_QUALIFIED' OR ss.qualified IS NULL)
              AND l.phone IS NOT NULL
            GROUP BY l.phone
        `, crmParams)

        const noImageCountRes = await vucarV2Query(`
            SELECT COUNT(DISTINCT l.phone) AS cnt
            FROM leads l
            LEFT JOIN cars c ON c.lead_id = l.id
            LEFT JOIN sale_status ss ON ss.car_id = c.id
            WHERE ${crmWhere}
              AND (ss.qualified != 'STRONG_QUALIFIED' OR ss.qualified IS NULL)
        `, crmParams)
        const noImageCount = parseInt(noImageCountRes.rows[0]?.cnt || "0", 10)

        const chuaCoHinhPhoneRows = noImagePhonesRes.rows
        const chuaCoHinhPhones = chuaCoHinhPhoneRows.map((r: any) => r.phone).filter(Boolean)

        // 3. Zalo Action logic (Cross-DB)
        let zaloSuccessAutoCount = 0
        let zaloSuccessAutoHot = 0
        let zaloSuccessAutoWarn = 0
        let zaloSuccessAutoMedium = 0
        let zaloSuccessAutoFresh = 0
        let zaloSuccessAutoHotRename = 0
        let zaloSuccessAutoWarnRename = 0
        let zaloSuccessAutoMediumRename = 0
        let zaloSuccessAutoFreshRename = 0

        let zaloSuccessManualCount = 0
        let zaloSuccessManualHot = 0
        let zaloSuccessManualWarn = 0
        let zaloSuccessManualMedium = 0
        let zaloSuccessManualFresh = 0
        let zaloSuccessManualHotRename = 0
        let zaloSuccessManualWarnRename = 0
        let zaloSuccessManualMediumRename = 0
        let zaloSuccessManualFreshRename = 0

        let zaloFailedCount = 0
        let zaloNoUidCount = 0
        let zaloTimeoutCount = 0
        
        let zaloNeverCount = 0
        let zaloNeverSaleOnly = 0
        let zaloNeverNoInteraction = 0
        let zaloNeverRenameSuccess = 0
        let zaloNeverRenameFailed = 0
        let zaloNeverRenameNone = 0
        
        let maxDaysWaitingReply = 0
        let maxDaysSinceActivity = 0

        if (chuaCoHinhPhones.length > 0) {
            // 3a. firstMessage actions
            const fmActionsRes = await e2eQuery(`
                SELECT
                  COALESCE(payload->>'phone', payload->>'customer_phone') AS phone,
                  MAX(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS has_success,
                  MIN(CASE WHEN status = 'success' THEN created_at END) AS first_success_at,
                  MAX(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END) AS has_failed,
                  STRING_AGG(
                    DISTINCT CASE WHEN status = 'failed'
                      THEN COALESCE(payload->>'akabiz_error', payload->>'reason', payload->>'error')
                    END,
                    ' | '
                  ) AS fail_reasons
                FROM zalo_action
                WHERE action_type = 'firstMessage'
                  AND created_at >= $1::timestamp AND created_at <= $2::timestamp
                  AND COALESCE(payload->>'phone', payload->>'customer_phone') = ANY($3::text[])
                GROUP BY COALESCE(payload->>'phone', payload->>'customer_phone')
            `, [startTs, endTs, chuaCoHinhPhones])

            const fmStatusMap = new Map(fmActionsRes.rows.map((r: any) => [r.phone, r]))

            // 3b. rename actions
            const renameActionsRes = await e2eQuery(`
                SELECT
                  COALESCE(payload->>'phone', payload->>'customer_phone') AS phone,
                  MAX(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS has_success,
                  MAX(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END) AS has_failed
                FROM zalo_action
                WHERE action_type = 'rename'
                  AND created_at >= $1::timestamp AND created_at <= $2::timestamp
                  AND COALESCE(payload->>'phone', payload->>'customer_phone') = ANY($3::text[])
                GROUP BY COALESCE(payload->>'phone', payload->>'customer_phone')
            `, [startTs, endTs, chuaCoHinhPhones])

            const renameStatusMap = new Map(renameActionsRes.rows.map((r: any) => [r.phone, r]))

            // 4. Calculate metrics
            for (const row of chuaCoHinhPhoneRows) {
                const phone = row.phone
                const hasMZ = row.has_messages_zalo === 1
                const nSale = parseInt(row.msgs_from_sale || "0", 10)
                const nCust = parseInt(row.msgs_from_customer || "0", 10)
                const lastMsgAt = row.last_msg_at ? new Date(row.last_msg_at).getTime() : 0
                const lastSaleMsgAt = row.last_sale_msg_at ? new Date(row.last_sale_msg_at).getTime() : 0
                
                const fmStatus = fmStatusMap.get(phone) as any

                // SUCCESS: Auto Success OR Manual Two-way
                const isAutoSuccess = fmStatus?.has_success === 1
                const isManualTwoWay = hasMZ && nSale > 0 && nCust > 0

                if (isAutoSuccess || isManualTwoWay) {
                    const isRenameSuccess = renameStatusMap.get(phone)?.has_success === 1
                    let establishedAt = 0
                    if (isAutoSuccess && fmStatus.first_success_at) {
                        establishedAt = new Date(fmStatus.first_success_at).getTime()
                    } else if (isManualTwoWay && lastMsgAt) {
                        establishedAt = lastMsgAt
                    }

                    if (isAutoSuccess) {
                        zaloSuccessAutoCount++
                        if (establishedAt) {
                            const days = (Date.now() - establishedAt) / 86400000
                            if (days > 7) {
                                zaloSuccessAutoHot++
                                if (isRenameSuccess) zaloSuccessAutoHotRename++
                            } else if (days > 4) {
                                zaloSuccessAutoWarn++
                                if (isRenameSuccess) zaloSuccessAutoWarnRename++
                            } else if (days > 2) {
                                zaloSuccessAutoMedium++
                                if (isRenameSuccess) zaloSuccessAutoMediumRename++
                            } else {
                                zaloSuccessAutoFresh++
                                if (isRenameSuccess) zaloSuccessAutoFreshRename++
                            }
                        }
                    } else {
                        zaloSuccessManualCount++
                        if (establishedAt) {
                            const days = (Date.now() - establishedAt) / 86400000
                            if (days > 7) {
                                zaloSuccessManualHot++
                                if (isRenameSuccess) zaloSuccessManualHotRename++
                            } else if (days > 4) {
                                zaloSuccessManualWarn++
                                if (isRenameSuccess) zaloSuccessManualWarnRename++
                            } else if (days > 2) {
                                zaloSuccessManualMedium++
                                if (isRenameSuccess) zaloSuccessManualMediumRename++
                            } else {
                                zaloSuccessManualFresh++
                                if (isRenameSuccess) zaloSuccessManualFreshRename++
                            }
                        }
                    }
                }
 else if (fmStatus?.has_failed === 1) {
                    zaloFailedCount++
                    const reasons = (fmStatus.fail_reasons || "").toLowerCase()
                    if (reasons.includes("bạn chưa thể gửi") || reasons.includes("xin lỗi! hiện tại")) {
                        zaloNoUidCount++
                    } else {
                        zaloTimeoutCount++
                    }
                } else {
                    zaloNeverCount++
                    if (nSale > 0) {
                        // 3c-iii: Sale nhắn, khách chưa reply
                        zaloNeverSaleOnly++
                        if (lastSaleMsgAt) {
                            const days = (Date.now() - lastSaleMsgAt) / 86400000
                            if (days > maxDaysWaitingReply) maxDaysWaitingReply = days
                        }
                    } else {
                        // 3c-iv: Chưa có tương tác
                        zaloNeverNoInteraction++
                        if (lastMsgAt) {
                            const days = (Date.now() - lastMsgAt) / 86400000
                            if (days > maxDaysSinceActivity) maxDaysSinceActivity = days
                        }

                        // Rename pins
                        const renStatus = renameStatusMap.get(phone) as any
                        if (!renStatus) {
                            zaloNeverRenameNone++
                        } else if (renStatus.has_success === 1) {
                            zaloNeverRenameSuccess++
                        } else {
                            zaloNeverRenameFailed++
                        }
                    }
                }
            }
        } else {
            zaloNeverCount = noImageCount
            zaloNeverNoInteraction = noImageCount
            zaloNeverRenameNone = noImageCount
        }

        // Get available qualification values
        const qValuesRes = await vucarV2Query(`
          SELECT DISTINCT qualified FROM sale_status WHERE qualified IS NOT NULL ORDER BY qualified
        `, [])
        const qualifiedValues = qValuesRes.rows.map((r: any) => r.qualified)

        return NextResponse.json({
            qualificationBreakdown,
            qualifiedValues,
            totalLeads,
            hasImageCount,
            hasImageWithAdditional,
            hasImageWithoutAdditional,
            noImageCount,
            zaloSuccessCount: zaloSuccessAutoCount + zaloSuccessManualCount,
            
            zaloSuccessAutoCount,
            zaloSuccessAutoHot,
            zaloSuccessAutoWarn,
            zaloSuccessAutoMedium,
            zaloSuccessAutoFresh,
            zaloSuccessAutoHotRename,
            zaloSuccessAutoWarnRename,
            zaloSuccessAutoMediumRename,
            zaloSuccessAutoFreshRename,

            zaloSuccessManualCount,
            zaloSuccessManualHot,
            zaloSuccessManualWarn,
            zaloSuccessManualMedium,
            zaloSuccessManualFresh,
            zaloSuccessManualHotRename,
            zaloSuccessManualWarnRename,
            zaloSuccessManualMediumRename,
            zaloSuccessManualFreshRename,

            zaloFailedCount,
            zaloNeverCount,
            zaloNeverSaleOnly,
            zaloNeverNoInteraction,
            zaloNeverRenameSuccess,
            zaloNeverRenameFailed,
            zaloNeverRenameNone,
            zaloNeverRenameReserve: zaloNeverRenameFailed + zaloNeverRenameNone,
            maxDaysWaitingReply: Math.round(maxDaysWaitingReply * 10) / 10,
            maxDaysSinceActivity: Math.round(maxDaysSinceActivity * 10) / 10,
            zaloBlockedCount: zaloNoUidCount,
            zaloSystemErrorCount: zaloTimeoutCount
        })
    } catch (error) {
        console.error("[Funnel Stats API] Error:", error)
        return NextResponse.json({ error: "Failed to fetch funnel stats" }, { status: 500 })
    }
}
