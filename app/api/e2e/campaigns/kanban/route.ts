import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export const dynamic = 'force-dynamic'

export interface CampaignForKanban {
    id: string
    car_auction_id: string
    created_at: string
    duration: number | null
    is_active: boolean
    // Car info
    car_brand: string | null
    car_model: string | null
    car_year: number | null
    car_plate: string | null
    // Lead info
    lead_name: string | null
    lead_phone: string | null
    // Workflow order (1 = first campaign, 2 = second, etc.)
    workflow_order: number
}

export interface KanbanWorkflow {
    order: number
    name: string
    campaigns: CampaignForKanban[]
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { pic_id } = body

        if (!pic_id) {
            return NextResponse.json({ error: "pic_id is required" }, { status: 400 })
        }

        console.log("[Campaigns Kanban API] Fetching campaigns for pic_id:", pic_id)

        // Query campaigns with car and lead info
        // Use ROW_NUMBER partitioned by lead to get campaign order PER LEAD
        // Workflow 1 = 1st campaign of each lead, Workflow 2 = 2nd campaign of each lead, etc.
        // Only get campaigns where created_by IS NULL (system/bot created)
        const result = await vucarV2Query(
            `WITH ordered_campaigns AS (
                SELECT 
                    cp.id,
                    cp.car_auction_id,
                    cp.published_at,
                    cp.is_active,
                    cp.duration,
                    cp.min_bid,
                    COALESCE(c.brand, '') as car_brand,
                    COALESCE(c.model, '') as car_model,
                    c.year as car_year,
                    c.plate as car_plate,
                    l.id as lead_id,
                    COALESCE(l.name, '') as lead_name,
                    l.phone as lead_phone,
                    ROW_NUMBER() OVER (PARTITION BY l.id ORDER BY cp.published_at ASC) as campaign_order
                FROM campaigns cp
                LEFT JOIN cars c ON c.id = cp.car_auction_id
                LEFT JOIN leads l ON l.id = c.lead_id
                WHERE l.pic_id = $1::uuid
                  AND cp.created_by IS NULL
            )
            SELECT * FROM ordered_campaigns
            ORDER BY campaign_order ASC, published_at ASC`,
            [pic_id]
        )

        console.log("[Campaigns Kanban API] Query returned", result.rows.length, "campaigns")

        const campaigns: CampaignForKanban[] = result.rows.map(row => ({
            id: row.id,
            car_auction_id: row.car_auction_id,
            created_at: row.published_at, // Map published_at to created_at for frontend compatibility
            duration: row.duration ? parseFloat(row.duration) : null,
            is_active: row.is_active || false,
            car_brand: row.car_brand || null,
            car_model: row.car_model || null,
            car_year: row.car_year ? parseInt(row.car_year) : null,
            car_plate: row.car_plate || null,
            lead_name: row.lead_name || null,
            lead_phone: row.lead_phone || null,
            workflow_order: parseInt(row.campaign_order) // campaign_order per lead becomes workflow grouping
        }))

        // Group campaigns by workflow order
        const workflowMap = new Map<number, KanbanWorkflow>()

        campaigns.forEach(campaign => {
            if (!workflowMap.has(campaign.workflow_order)) {
                workflowMap.set(campaign.workflow_order, {
                    order: campaign.workflow_order,
                    name: `Workflow ${campaign.workflow_order}`,
                    campaigns: []
                })
            }
            workflowMap.get(campaign.workflow_order)!.campaigns.push(campaign)
        })

        // Convert map to array and sort by order
        const workflows = Array.from(workflowMap.values()).sort((a, b) => a.order - b.order)

        console.log("[Campaigns Kanban API] Grouped into", workflows.length, "workflows")

        return NextResponse.json({
            workflows,
            totalCampaigns: campaigns.length
        })
    } catch (error) {
        console.error("[Campaigns Kanban API] Error:", error)
        return NextResponse.json(
            {
                error: "Failed to fetch campaigns for kanban",
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        )
    }
}

