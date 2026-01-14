import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export async function GET(
    request: Request,
    context: { params: Promise<{ leadId: string }> }
) {
    try {
        const { leadId } = await context.params

        if (!leadId) {
            return NextResponse.json({ error: "Lead ID is required" }, { status: 400 })
        }

        // Optimized query with subqueries to reduce separate DB calls
        const result = await vucarV2Query(
            `SELECT
        l.id,
        l.name,
        l.phone,
        l.additional_phone,
        l.created_at,
        l.pic_id,
        l.source,
        u.user_name as pic_name,
        c.id as car_id,
        c.plate,
        ss.id as sale_status_id,
        ss.price_customer,
        ss.bot_status,
        ss.price_highest_bid,
        ss.stage,
        ss.messages_zalo,
        ss.notes,
        ss.qualified,
        ss.intention as intention_lead,
        ss.negotiation_ability,
        ss.is_hot_lead,
        c.brand,
        c.model,
        c.variant,
        c.year,
        c.location,
        c.mileage,
        c.sku,
        c.created_at as car_created_at,
        c.additional_images,
        (SELECT COUNT(*) FROM campaigns WHERE car_auction_id = c.id) as campaign_count,
        (SELECT is_active FROM campaigns WHERE car_auction_id = c.id and is_active = true LIMIT 1) as workflow2_is_active
       FROM leads l
       LEFT JOIN users u ON l.pic_id = u.id
       LEFT JOIN cars c ON c.lead_id = l.id
       LEFT JOIN sale_status ss ON ss.car_id = c.id
       WHERE l.id = $1
       ORDER BY c.created_at DESC
       LIMIT 1`,
            [leadId]
        )

        if (result.rows.length === 0) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 })
        }

        const leadData = result.rows[0]

        // Parse additional_images if it's a string
        let additionalImages = leadData.additional_images || {}
        if (typeof additionalImages === 'string') {
            try {
                additionalImages = JSON.parse(additionalImages)
            } catch (e) {
                console.error("[E2E Lead Details] Error parsing additional_images:", e)
                additionalImages = {}
            }
        }

        // Check if has enough images (1 outside + 1 paper)
        const hasOutside = Array.isArray(additionalImages.outside) && additionalImages.outside.length > 0
        const hasPaper = Array.isArray(additionalImages.paper) && additionalImages.paper.length > 0
        const has_enough_images = hasOutside && hasPaper

        // Check if first message sent (chat length > 3)
        const messagesZalo = leadData.messages_zalo || []
        const first_message_sent = Array.isArray(messagesZalo) && messagesZalo.length > 3

        // Session created check - now from main query (no separate DB call)
        const session_created = leadData.car_id && parseInt(leadData.campaign_count) > 0

        // Use is_hot_lead from sale_status as is_primary (consistent with batch endpoint)
        const is_primary = leadData.is_hot_lead || false

        // Workflow2 is_active status - now from main query (no separate DB call)
        const workflow2_is_active = leadData.workflow2_is_active !== null ? leadData.workflow2_is_active : null

        // Return the lead in a format compatible with the Lead type
        return NextResponse.json({
            id: leadData.id,
            name: leadData.name,
            phone: leadData.phone,
            additional_phone: leadData.additional_phone,
            created_at: leadData.created_at,
            pic_id: leadData.pic_id,
            pic_name: leadData.pic_name,
            source: leadData.source,
            car_id: leadData.car_id,
            plate: leadData.plate,
            brand: leadData.brand,
            model: leadData.model,
            variant: leadData.variant,
            year: leadData.year,
            location: leadData.location,
            mileage: leadData.mileage,
            price_customer: leadData.price_customer,
            price_highest_bid: leadData.price_highest_bid,
            stage: leadData.stage || "UNDEFINED",
            notes: leadData.notes || null,
            qualified: leadData.qualified || null,
            intentionLead: leadData.intention_lead || null,
            negotiationAbility: leadData.negotiation_ability || null,
            has_enough_images,
            first_message_sent,
            session_created,
            is_primary,
            workflow2_is_active,
            additional_images: additionalImages,
            sku: leadData.sku,
            car_created_at: leadData.car_created_at,
        })
    } catch (error) {
        console.error("[E2E Lead by ID] Error fetching lead:", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return NextResponse.json({
            error: "Failed to fetch lead",
            details: errorMessage
        }, { status: 500 })
    }
}
