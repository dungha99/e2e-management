import { NextResponse } from "next/server"
import { vucarV2Query, tempInspectionQuery } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone } = body

    if (!phone) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 })
    }

    // Query to get lead, user (PIC), sale_status, and car information
    const result = await vucarV2Query(
      `SELECT
        l.id,
        l.name,
        l.phone,
        l.additional_phone,
        l.created_at,
        l.pic_id,
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
        c.brand,
        c.model,
        c.variant,
        c.year,
        c.location,
        c.mileage,
        c.sku,
        c.created_at as car_created_at,
        c.additional_images
       FROM leads l
       LEFT JOIN users u ON l.pic_id = u.id
       LEFT JOIN cars c ON c.lead_id = l.id
       LEFT JOIN sale_status ss ON ss.car_id = c.id
       WHERE l.phone = $1 OR l.additional_phone = $1
       ORDER BY l.created_at DESC, c.created_at DESC
       LIMIT 1`,
      [phone]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    const leadData = result.rows[0]

    // Check if has enough images (1 outside + 1 paper)
    const additionalImages = leadData.additional_images || {}
    const hasOutside = Array.isArray(additionalImages.outside) && additionalImages.outside.length > 0
    const hasPaper = Array.isArray(additionalImages.paper) && additionalImages.paper.length > 0
    const has_enough_images = hasOutside && hasPaper

    // Check if first message sent (chat length > 3)
    const messagesZalo = leadData.messages_zalo || []
    const first_message_sent = Array.isArray(messagesZalo) && messagesZalo.length > 3

    // Check if session created (campaigns exist for this car)
    let session_created = false
    if (leadData.car_id) {
      const campaignResult = await vucarV2Query(
        `SELECT COUNT(*) as count FROM campaigns WHERE car_auction_id = $1`,
        [leadData.car_id]
      )
      session_created = campaignResult.rows[0]?.count > 0
    }

    // Check if car is primary
    let is_primary = false
    if (leadData.car_id) {
      try {
        const primaryResult = await tempInspectionQuery(
          `SELECT is_primary FROM "primary" WHERE car_id = $1 LIMIT 1`,
          [leadData.car_id]
        )
        is_primary = primaryResult.rows[0]?.is_primary || false
      } catch (error) {
        console.error("[E2E Lead Details] Error fetching primary status:", error)
        // Don't fail the whole request if primary check fails
        is_primary = false
      }
    }

    return NextResponse.json({
      lead: {
        id: leadData.id,
        name: leadData.name,
        phone: leadData.phone,
        additional_phone: leadData.additional_phone,
        created_at: leadData.created_at,
        pic_id: leadData.pic_id,
        pic_name: leadData.pic_name,
      },
      sale_status: {
        id: leadData.sale_status_id,
        car_id: leadData.car_id,
        price_customer: leadData.price_customer,
        bot_status: leadData.bot_status || false,
        price_highest_bid: leadData.price_highest_bid || null,
        stage: leadData.stage || "UNDEFINED",
        first_message_sent,
        session_created,
        notes: leadData.notes || null,
      },
      car_info: {
        brand: leadData.brand,
        model: leadData.model,
        variant: leadData.variant,
        year: leadData.year,
        plate: leadData.plate,
        location: leadData.location,
        mileage: leadData.mileage,
        sku: leadData.sku,
        created_at: leadData.car_created_at,
        additional_images: leadData.additional_images,
        has_enough_images,
        is_primary,
      },
    })
  } catch (error) {
    console.error("[E2E Lead Details DB] Error fetching lead details:", error)
    return NextResponse.json({ error: "Failed to fetch lead details" }, { status: 500 })
  }
}
