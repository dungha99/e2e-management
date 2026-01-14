import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { brand, model, variant, type = 'sales' } = body

        if (!brand || !model) {
            return NextResponse.json({ error: "Brand and model are required" }, { status: 400 })
        }

        console.log(`[Win History API] Fetching ${type} for: ${brand} ${model} ${variant || ''}`)

        let sqlQuery = ''
        let params: any[] = [brand, model]

        if (type === 'bids') {
            // Query specifically for dealer biddings history
            sqlQuery = `SELECT 
        db.id,
        db.price as price_sold, -- Reuse price_sold field for consistency
        db.created_at as sold_date, -- Reuse sold_date field for consistency
        'BID' as negotiation_ability, -- Placeholder
        d.name as dealer_name,
        c.brand,
        c.model,
        c.variant,
        c.year,
        c.mileage
       FROM dealer_biddings db
       INNER JOIN sale_status ss ON db.sale_status_id = ss.id
       INNER JOIN cars c ON ss.car_id = c.id
       LEFT JOIN dealers d ON db.dealer_id = d.id
       WHERE LOWER(c.brand) = LOWER($1)
         AND LOWER(c.model) = LOWER($2)`
        } else {
            // Default: Win history (completed sales)
            sqlQuery = `SELECT 
      ss.id,
      ss.car_id,
      ss.dealer_id,
      ss.closed_date as sold_date,
      ss.price_sold,
      ss.negotiation_ability,
      c.condition_grade,
      d.name as dealer_name,
      c.brand,
      c.model,
      c.variant,
      c.year,
      c.mileage
     FROM sale_status ss
     INNER JOIN cars c ON ss.car_id = c.id
     LEFT JOIN dealers d ON ss.dealer_id = d.id
     WHERE ss.stage = 'COMPLETED'
       AND ss.closed_date IS NOT NULL
       AND LOWER(c.brand) = LOWER($1)
       AND LOWER(c.model) = LOWER($2)`
        }

        if (variant) {
            sqlQuery += ` AND LOWER(c.variant) = LOWER($3)`
            params.push(variant)
        }

        if (type === 'bids') {
            sqlQuery += ` ORDER BY db.created_at DESC LIMIT 20`
        } else {
            sqlQuery += ` ORDER BY ss.closed_date DESC LIMIT 20`
        }

        console.log('[Win History API] Executing query with params:', params)
        const result = await vucarV2Query(sqlQuery, params)

        // Calculate stats (only for sales view for now, or adapted for bids if needed)
        interface Stats {
            completedCount: number;
            totalCount: number;
            avgPrice: number | null;
            winRate: string | null;
        }

        let stats: Stats = { completedCount: 0, totalCount: 0, avgPrice: null, winRate: null }

        if (type === 'sales') {
            // ... existing stats logic ...
            let statsQuery = `SELECT 
          COUNT(*) FILTER (WHERE ss.stage = 'COMPLETED' AND ss.closed_date IS NOT NULL) as completed_count,
          COUNT(*) as total_count,
          AVG(ss.price_sold) FILTER (WHERE ss.stage = 'COMPLETED' AND ss.closed_date IS NOT NULL AND ss.price_sold > 0) as avg_price
         FROM sale_status ss
         INNER JOIN cars c ON ss.car_id = c.id
         WHERE LOWER(c.brand) = LOWER($1)
           AND LOWER(c.model) = LOWER($2)`

            const statsParams: any[] = [brand, model]
            if (variant) {
                statsQuery += ` AND LOWER(c.variant) = LOWER($3)`
                statsParams.push(variant)
            }

            const statsResult = await vucarV2Query(statsQuery, statsParams)
            const statsRow = statsResult.rows[0]
            if (statsRow) {
                stats = {
                    completedCount: parseInt(statsRow.completed_count) || 0,
                    totalCount: parseInt(statsRow.total_count) || 0,
                    avgPrice: statsRow.avg_price ? parseFloat(statsRow.avg_price) : null,
                    winRate: statsRow.total_count > 0 ? (parseInt(statsRow.completed_count) / parseInt(statsRow.total_count) * 100).toFixed(0) : null
                }
            }
        } else {
            // Stats for Bids: Average Bid Price
            let statsQuery = `SELECT AVG(db.price) as avg_price
         FROM dealer_biddings db
         INNER JOIN sale_status ss ON db.sale_status_id = ss.id
         INNER JOIN cars c ON ss.car_id = c.id
         WHERE LOWER(c.brand) = LOWER($1)
           AND LOWER(c.model) = LOWER($2)`

            const statsParams: any[] = [brand, model]
            if (variant) {
                statsQuery += ` AND LOWER(c.variant) = LOWER($3)`
                statsParams.push(variant)
            }

            const statsResult = await vucarV2Query(statsQuery, statsParams)
            const statsRow = statsResult.rows[0]
            stats.avgPrice = statsRow?.avg_price ? parseFloat(statsRow.avg_price) : null
        }

        console.log(`[Win History API] Found ${result.rows.length} records`)

        return NextResponse.json({
            success: true,
            count: result.rows.length,
            stats: stats,
            data: result.rows.map(row => ({
                id: row.id,
                car_id: row.car_id || 'N/A',
                dealer_id: row.dealer_id,
                dealer_name: row.dealer_name || (row.bidder_name ? row.bidder_name : "Unknown Dealer"),
                sold_date: row.sold_date,
                price_sold: row.price_sold, // This will be bid price for 'bids' type
                negotiation_ability: row.negotiation_ability,
                car_condition: row.condition_grade || null,
                car_info: {
                    brand: row.brand,
                    model: row.model,
                    variant: row.variant,
                    year: row.year,
                    mileage: row.mileage
                }
            }))
        })
    } catch (error) {
        console.error("[Win History API] Error fetching win history:", error)
        console.error("[Win History API] Error stack:", error instanceof Error ? error.stack : 'No stack trace')
        return NextResponse.json({
            error: "Failed to fetch win history",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}
