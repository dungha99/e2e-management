import { NextResponse } from "next/server"
import { vucarV2Query, vucarZaloQuery } from "@/lib/db"

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
            const picIds = picId.split(',').filter(Boolean)
            crmConditions.push(`l.pic_id::text = ANY($${paramIdx}::text[])`)
            crmParams.push(picIds)
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

        const crmWhere = crmConditions.length > 0 ? crmConditions.join(" AND ") : "1=1"

        // Step 1: Query CRM signals (is_sq, price_highest_bid)
        const crmRes = await vucarV2Query(`
            SELECT 
                l.phone,
                MAX(CASE WHEN ss.qualified = 'STRONG_QUALIFIED' THEN 1 ELSE 0 END) AS is_sq,
                MAX(ss.price_highest_bid) AS price_highest_bid
            FROM leads l
            LEFT JOIN cars c ON c.lead_id = l.id
            LEFT JOIN sale_status ss ON ss.car_id = c.id
            WHERE ${crmWhere}
            GROUP BY l.phone
        `, crmParams)

        const crmRows = crmRes.rows
        const phones = crmRows.map(r => r.phone).filter(Boolean)

        let zaloRows: any[] = []
        
        // Step 2: Query Zalo Data across subset of phones
        if (phones.length > 0) {
            const zaloRes = await vucarZaloQuery(`
                SELECT
                  lr.phone,
                  MAX(c.last_message_at) AS last_message_at,
                  COUNT(CASE WHEN m.is_self = true THEN 1 END) AS msgs_from_sale,
                  COUNT(CASE WHEN m.is_self = false THEN 1 END) AS msgs_from_customer,
                  COUNT(CASE WHEN m.is_self = true AND (
                    m.content ILIKE '%triệu%' OR m.content ILIKE '%tỷ%' OR m.content ILIKE '%trả giá%' 
                    OR m.content ILIKE '%báo giá%' OR m.content ILIKE '%định giá%' OR m.content ILIKE '%giá xe%' 
                    OR m.content ILIKE '%mức giá%' OR m.content ILIKE '%giá bán%' OR m.content ILIKE '%vnđ%' 
                    OR m.content ILIKE '%vnd%' OR m.content ~ '[0-9]+[,\.][0-9]+ *(triệu|tỷ|tr|ty)'
                  ) THEN 1 END) AS msgs_quoted_price
                FROM leads_relation lr
                LEFT JOIN conversations c ON c.thread_id = lr.friend_id AND c.own_id = lr.account_id
                LEFT JOIN messages m ON m.thread_id = lr.friend_id AND m.own_id = lr.account_id
                WHERE lr.phone = ANY($1::text[])
                GROUP BY lr.phone
            `, [phones])
            zaloRows = zaloRes.rows
        }

        const zaloPhonesMap = new Map(zaloRows.map(r => [r.phone, r]))

        // Step 3: Application Layer Classification
        const stats = {
            total: 0,
            hasZalo: 0,
            noZalo: 0,
            sq: { total: 0, dead: 0, active: 0, quoted: 0, notQuoted: 0 },
            nonSq: { total: 0 },
            d1: {
                total: 0,
                ghost: { total: 0, dead: 0, active: 0 },
                twoWay: { total: 0, dead: 0, active: 0 },
                picNoMsg: { total: 0, dead: 0, active: 0 }
            },
            d2: {
                total: 0,
                hasBid: { total: 0, dead: 0, active: 0 },
                noZalo: { total: 0, dead: 0, active: 0 }
            },
            // V4 sub-trees under hasZalo
            hasZaloSq: { total: 0, dead: 0, active: 0, quoted: 0, notQuoted: 0 },
            hasZaloNonSq: { total: 0 },
            hasZaloD1: {
                total: 0,
                ghost: { total: 0, dead: 0, active: 0 },
                twoWay: { total: 0, dead: 0, active: 0 },
                picNoMsg: { total: 0, dead: 0, active: 0 }
            },
            hasZaloD2: {
                total: 0,
                hasBid: { total: 0, dead: 0, active: 0 }
            }
        }

        for (const crm of crmRows) {
            if (!crm.phone) continue;
            stats.total++;

            const zalo = zaloPhonesMap.get(crm.phone)
            const hasZaloRecord = !!zalo

            // V4: top-level hasZalo / noZalo
            if (hasZaloRecord) stats.hasZalo++; else stats.noZalo++;

            let isDead = true
            if (zalo && zalo.last_message_at) {
                const days = (Date.now() - new Date(zalo.last_message_at).getTime()) / 86400000;
                isDead = days > 1;
            }

            if (crm.is_sq === 1) {
                const isQuoted = zalo && parseInt(zalo.msgs_quoted_price || '0', 10) > 0;
                
                stats.sq.total++;
                if (isDead) stats.sq.dead++; else stats.sq.active++;
                if (isQuoted) stats.sq.quoted++; else stats.sq.notQuoted++;
                
                // V4: hasZalo SQ
                if (hasZaloRecord) {
                    stats.hasZaloSq.total++;
                    if (isDead) stats.hasZaloSq.dead++; else stats.hasZaloSq.active++;
                    if (isQuoted) stats.hasZaloSq.quoted++; else stats.hasZaloSq.notQuoted++;
                }
                continue;
            }

            stats.nonSq.total++;
            
            let bucket = '';
            if (crm.price_highest_bid !== null) {
                bucket = 'D2_has_bid';
            } else if (!zalo) {
                bucket = 'D2_no_zalo';
            } else if (parseInt(zalo.msgs_from_sale || '0', 10) === 0) {
                bucket = 'D1_pic_no_msg';
            } else if (parseInt(zalo.msgs_from_customer || '0', 10) === 0) {
                bucket = 'D1_ghost';
            } else {
                bucket = 'D1_two_way';
            }

            // Explicit dead vs active overrides based on business logic feedback
            if (bucket === 'D2_no_zalo' || bucket === 'D1_pic_no_msg') {
                isDead = true; 
            }

            // V3 stats (unchanged)
            if (bucket === 'D2_has_bid') {
                stats.d2.total++;
                stats.d2.hasBid.total++;
                if (isDead) stats.d2.hasBid.dead++; else stats.d2.hasBid.active++;
            } else if (bucket === 'D2_no_zalo') {
                stats.d2.total++;
                stats.d2.noZalo.total++;
                if (isDead) stats.d2.noZalo.dead++; else stats.d2.noZalo.active++;
            } else if (bucket === 'D1_pic_no_msg') {
                stats.d1.total++;
                stats.d1.picNoMsg.total++;
                if (isDead) stats.d1.picNoMsg.dead++; else stats.d1.picNoMsg.active++;
            } else if (bucket === 'D1_ghost') {
                stats.d1.total++;
                stats.d1.ghost.total++;
                if (isDead) stats.d1.ghost.dead++; else stats.d1.ghost.active++;
            } else if (bucket === 'D1_two_way') {
                stats.d1.total++;
                stats.d1.twoWay.total++;
                if (isDead) stats.d1.twoWay.dead++; else stats.d1.twoWay.active++;
            }

            // V4: hasZalo sub-trees (only for leads with Zalo records, excluding D2_no_zalo)
            if (hasZaloRecord) {
                stats.hasZaloNonSq.total++;
                if (bucket === 'D2_has_bid') {
                    stats.hasZaloD2.total++;
                    stats.hasZaloD2.hasBid.total++;
                    if (isDead) stats.hasZaloD2.hasBid.dead++; else stats.hasZaloD2.hasBid.active++;
                } else if (bucket === 'D1_pic_no_msg') {
                    stats.hasZaloD1.total++;
                    stats.hasZaloD1.picNoMsg.total++;
                    if (isDead) stats.hasZaloD1.picNoMsg.dead++; else stats.hasZaloD1.picNoMsg.active++;
                } else if (bucket === 'D1_ghost') {
                    stats.hasZaloD1.total++;
                    stats.hasZaloD1.ghost.total++;
                    if (isDead) stats.hasZaloD1.ghost.dead++; else stats.hasZaloD1.ghost.active++;
                } else if (bucket === 'D1_two_way') {
                    stats.hasZaloD1.total++;
                    stats.hasZaloD1.twoWay.total++;
                    if (isDead) stats.hasZaloD1.twoWay.dead++; else stats.hasZaloD1.twoWay.active++;
                }
            }
        }

        return NextResponse.json({ stats })
    } catch (error) {
        console.error("[Funnel MECE Stats API] Error:", error)
        return NextResponse.json({ error: "Failed to fetch MECE stats" }, { status: 500 })
    }
}
