import { NextResponse } from "next/server"
import { vucarV2Query, vucarZaloQuery } from "@/lib/db"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/e2e/sync-funnel-tags
 *
 * Cron-compatible endpoint that computes the V4 MECE funnel bucket for every
 * active car and writes it back to sale_status via the Vucar API upsert endpoint.
 *
 * Classification logic (same as funnel-mece-stats V4):
 *   SQ            → ss.qualified = 'STRONG_QUALIFIED'
 *   D2_has_bid    → non-SQ + price_highest_bid IS NOT NULL
 *   D2_no_zalo    → non-SQ + no record in Zalo leads_relation
 *   D1_pic_no_msg → non-SQ + Zalo exists + sale sent 0 messages
 *   D1_ghost      → non-SQ + Zalo exists + customer replied 0
 *   D1_two_way    → non-SQ + both sides have chatted
 */

const VUCAR_API_BASE_URL = "https://api.vucar.vn"
const ZALO_BATCH_SIZE = 500   // phones per Zalo query to avoid huge ANY() clauses
const API_CONCURRENCY = 10    // parallel upsert calls to Vucar API

export async function GET() {
  const startTime = Date.now()
  const apiSecret = process.env.VUCAR_API_SECRET

  if (!apiSecret) {
    return NextResponse.json({ success: false, error: "VUCAR_API_SECRET not configured" }, { status: 500 })
  }

  try {
    // --- 1. Fetch all active cars with CRM signals ---
    const crmResult = await vucarV2Query(
      `SELECT
         c.id AS car_id,
         ss.id AS sale_status_id,
         l.phone,
         MAX(CASE WHEN ss.qualified::text = 'STRONG_QUALIFIED' THEN 1 ELSE 0 END) AS is_sq,
         MAX(ss.price_highest_bid) AS price_highest_bid
       FROM cars c
       JOIN leads l ON l.id = c.lead_id
       JOIN sale_status ss ON ss.car_id = c.id
       WHERE (c.updated_at IS NULL OR c.updated_at > NOW() - INTERVAL '2 months')
         AND (c.is_deleted IS NULL OR c.is_deleted = false)
         AND l.phone IS NOT NULL
         AND (ss.stage IS NULL OR ss.stage NOT IN ('WIN', 'FAILED', 'DEPOSIT_PAID'))
       GROUP BY c.id, ss.id, l.phone`,
      []
    )

    const crmRows = crmResult.rows
    if (crmRows.length === 0) {
      return NextResponse.json({ success: true, updated: 0, durationMs: Date.now() - startTime })
    }

    const phones = [...new Set(crmRows.map((r: any) => r.phone as string))]

    // --- 2. Fetch Zalo stats in batches ---
    const zaloMap = new Map<string, { msgs_from_sale: number; msgs_from_customer: number }>()

    for (let i = 0; i < phones.length; i += ZALO_BATCH_SIZE) {
      const batch = phones.slice(i, i + ZALO_BATCH_SIZE)
      try {
        const zaloResult = await vucarZaloQuery(
          `SELECT
             lr.phone,
             COUNT(CASE WHEN m.is_self = true  THEN 1 END) AS msgs_from_sale,
             COUNT(CASE WHEN m.is_self = false THEN 1 END) AS msgs_from_customer
           FROM leads_relation lr
           LEFT JOIN messages m ON m.thread_id = lr.friend_id AND m.own_id = lr.account_id
           WHERE lr.phone = ANY($1::text[])
           GROUP BY lr.phone`,
          [batch]
        )
        for (const row of zaloResult.rows) {
          zaloMap.set(row.phone, {
            msgs_from_sale: parseInt(row.msgs_from_sale || "0", 10),
            msgs_from_customer: parseInt(row.msgs_from_customer || "0", 10),
          })
        }
      } catch (err) {
        console.warn(`[Sync Funnel Tags] Zalo batch ${i}–${i + ZALO_BATCH_SIZE} failed (non-blocking):`, err)
      }
    }

    // --- 3. Classify each car ---
    const tagsByCar: { car_id: string; sale_status_id: string; tag: string }[] = crmRows.map((row: any) => {
      let tag: string

      if (row.is_sq === 1) {
        tag = "SQ"
      } else if (row.price_highest_bid !== null && row.price_highest_bid !== undefined) {
        tag = "D2_has_bid"
      } else {
        const zalo = zaloMap.get(row.phone)
        if (!zalo) {
          tag = "D2_no_zalo"
        } else if (zalo.msgs_from_sale === 0) {
          tag = "D1_pic_no_msg"
        } else if (zalo.msgs_from_customer === 0) {
          tag = "D1_ghost"
        } else {
          tag = "D1_two_way"
        }
      }

      return { car_id: row.car_id, sale_status_id: row.sale_status_id, tag }
    })

    // --- 4. Upsert via Vucar API with bounded concurrency ---
    let totalUpdated = 0
    let totalFailed = 0

    const tasks = tagsByCar.map((item) => async () => {
      const response = await fetch(`${VUCAR_API_BASE_URL}/sale-status/${item.sale_status_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": apiSecret,
        },
        body: JSON.stringify({ funnelTag: item.tag }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`${response.status}: ${errText.slice(0, 100)}`)
      }
    })

    // Sliding window concurrency
    const executing = new Set<Promise<void>>()
    for (const task of tasks) {
      const p: Promise<void> = task()
        .then(() => { totalUpdated++ })
        .catch((err) => {
          totalFailed++
          console.warn("[Sync Funnel Tags] Upsert failed:", err.message)
        })
        .finally(() => executing.delete(p))

      executing.add(p)
      if (executing.size >= API_CONCURRENCY) await Promise.race(executing)
    }
    await Promise.all(executing)

    console.log(`[Sync Funnel Tags] updated=${totalUpdated} failed=${totalFailed} in ${Date.now() - startTime}ms`)

    return NextResponse.json({
      success: true,
      updated: totalUpdated,
      failed: totalFailed,
      durationMs: Date.now() - startTime,
    })
  } catch (error) {
    console.error("[Sync Funnel Tags] Fatal error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to sync funnel tags",
        details: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
