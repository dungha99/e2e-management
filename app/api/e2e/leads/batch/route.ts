import { NextResponse } from "next/server"
import { vucarV2Query, tempInspectionQuery, query } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { uid, page = 1, per_page = 10 } = body

    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 })
    }

    const offset = (page - 1) * per_page

    // Single optimized query to get all leads with related data
    const leadsResult = await vucarV2Query(
      `WITH lead_cars AS (
        SELECT DISTINCT ON (l.phone)
          l.id as lead_id,
          l.name,
          l.phone,
          l.additional_phone,
          l.identify_number,
          l.bank_account_number,
          l.otp_verified,
          l.created_at,
          l.pic_id,
          l.pic_og,
          l.source,
          l.url,
          l.qx_qc_scoring,
          l.customer_feedback,
          l.is_referral,
          c.id as car_id,
          c.plate,
          c.brand,
          c.model,
          c.variant,
          c.year,
          c.mileage,
          c.sku,
          c.location,
          c.additional_images
        FROM leads l
        LEFT JOIN cars c ON c.lead_id = l.id
        WHERE l.pic_id = $1::uuid
          AND (c.created_at IS NULL OR c.created_at > NOW() - INTERVAL '2 months')
        ORDER BY l.phone, l.created_at DESC, c.created_at DESC NULLS LAST
      ),
      total_count AS (
        SELECT COUNT(*) as total FROM lead_cars
      ),
      paginated_leads AS (
        SELECT * FROM lead_cars
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      )
      SELECT
        pl.*,
        u.user_name as pic_name,
        ss.id as sale_status_id,
        ss.price_customer,
        ss.bot_status,
        ss.price_highest_bid,
        ss.stage,
        ss.notes,
        ss.messages_zalo,
        (SELECT total FROM total_count) as total_count
      FROM paginated_leads pl
      LEFT JOIN users u ON pl.pic_id = u.id
      LEFT JOIN sale_status ss ON ss.car_id = pl.car_id
      ORDER BY pl.created_at DESC`,
      [uid, per_page, offset]
    )

    const leads = leadsResult.rows
    const totalCount = leads.length > 0 ? parseInt(leads[0].total_count) : 0
    const totalPages = Math.ceil(totalCount / per_page)

    // Extract car IDs and lead IDs for batch queries
    const carIds = leads.filter((l) => l.car_id).map((l) => l.car_id)
    const leadIds = leads.map((l) => l.lead_id)

    // Batch query for primary status (different database)
    let primaryStatuses: Record<string, boolean> = {}
    if (carIds.length > 0) {
      const primaryResult = await tempInspectionQuery(
        `SELECT car_id, is_primary FROM "primary" WHERE car_id = ANY($1::uuid[])`,
        [carIds]
      )
      primaryStatuses = Object.fromEntries(
        primaryResult.rows.map((row) => [row.car_id, row.is_primary])
      )
    }

    // Batch query for dealer biddings
    let dealerBiddings: Record<string, any[]> = {}
    if (carIds.length > 0) {
      const biddingsResult = await query(
        `SELECT
          db.car_id,
          json_agg(
            json_build_object(
              'id', db.id,
              'dealer_id', db.dealer_id,
              'price', db.price,
              'created_at', db.created_at,
              'comment', db.comment
            ) ORDER BY db.created_at DESC
          ) as biddings
        FROM dealer_biddings db
        WHERE db.car_id = ANY($1::uuid[])
        GROUP BY db.car_id`,
        [carIds]
      )
      dealerBiddings = Object.fromEntries(
        biddingsResult.rows.map((row) => [row.car_id, row.biddings || []])
      )
    }

    // Batch query for decoy thread counts
    let decoyThreadCounts: Record<string, number> = {}
    if (leadIds.length > 0) {
      const phones = leads.map((l) => l.phone).filter(Boolean)
      if (phones.length > 0) {
        const threadsResult = await vucarV2Query(
          `SELECT
            l.id as lead_id,
            COUNT(DISTINCT ct.id) as thread_count
          FROM leads l
          LEFT JOIN auth_user au ON au.name = l.phone
          LEFT JOIN chat_threads ct ON ct.user_id = au.id
          WHERE l.id = ANY($1::uuid[])
          GROUP BY l.id`,
          [leadIds]
        )
        decoyThreadCounts = Object.fromEntries(
          threadsResult.rows.map((row) => [row.lead_id, parseInt(row.thread_count) || 0])
        )
      }
    }

    // Batch query for bidding session counts and workflow2 status
    let biddingSessionCounts: Record<string, number> = {}
    let workflow2Status: Record<string, boolean | null> = {}
    if (carIds.length > 0) {
      const sessionsResult = await vucarV2Query(
        `SELECT
          car_auction_id as car_id,
          COUNT(*) as session_count,
          MAX(is_active::int) as is_active
        FROM campaigns
        WHERE car_auction_id = ANY($1::uuid[])
        GROUP BY car_auction_id`,
        [carIds]
      )
      biddingSessionCounts = Object.fromEntries(
        sessionsResult.rows.map((row) => [row.car_id, parseInt(row.session_count) || 0])
      )
      workflow2Status = Object.fromEntries(
        sessionsResult.rows.map((row) => [row.car_id, row.is_active === 1 ? true : false])
      )
    }

    // Transform and enrich leads data
    const enrichedLeads = leads.map((lead) => {
      // Parse additional_images and compute has_enough_images
      let additionalImages = lead.additional_images || {}
      if (typeof additionalImages === 'string') {
        try {
          additionalImages = JSON.parse(additionalImages)
        } catch (e) {
          console.error("[E2E Batch API] Error parsing additional_images:", e)
          additionalImages = {}
        }
      }

      // Check if has enough images (1 outside + 1 paper)
      const hasOutside = Array.isArray(additionalImages.outside) && additionalImages.outside.length > 0
      const hasPaper = Array.isArray(additionalImages.paper) && additionalImages.paper.length > 0
      const has_enough_images = hasOutside && hasPaper

      // Compute first_message_sent from messages_zalo (chat length > 3)
      const messagesZalo = lead.messages_zalo || []
      const first_message_sent = Array.isArray(messagesZalo) && messagesZalo.length > 3

      // Compute session_created from bidding session count
      const session_created = lead.car_id && (biddingSessionCounts[lead.car_id] || 0) > 0

      return {
        id: lead.lead_id,
        name: lead.name,
        phone: lead.phone,
        additional_phone: lead.additional_phone,
        identify_number: lead.identify_number,
        bank_account_number: lead.bank_account_number,
        otp_verified: lead.otp_verified,
        created_at: lead.created_at,
        pic_id: lead.pic_id,
        pic_og: lead.pic_og,
        pic_name: lead.pic_name,
        source: lead.source,
        url: lead.url,
        qx_qc_scoring: lead.qx_qc_scoring,
        customer_feedback: lead.customer_feedback,
        is_referral: lead.is_referral,
        car_id: lead.car_id,
        plate: lead.plate,
        brand: lead.brand,
        model: lead.model,
        variant: lead.variant,
        year: lead.year,
        mileage: lead.mileage,
        sku: lead.sku,
        location: lead.location,
        has_enough_images: has_enough_images,
        workflow2_is_active: lead.car_id ? (workflow2Status[lead.car_id] ?? null) : null,
        additional_images: additionalImages,
        is_primary: lead.car_id ? primaryStatuses[lead.car_id] || false : false,
        sale_status: lead.sale_status_id
          ? {
              id: lead.sale_status_id,
              price_customer: lead.price_customer,
              bot_status: lead.bot_status,
              price_highest_bid: lead.price_highest_bid,
              stage: lead.stage,
              notes: lead.notes,
              first_message_sent: first_message_sent,
              session_created: session_created,
            }
          : null,
        dealer_bidding: lead.car_id ? dealerBiddings[lead.car_id] || [] : [],
        decoy_thread_count: decoyThreadCounts[lead.lead_id] || 0,
        bidding_session_count: lead.car_id ? biddingSessionCounts[lead.car_id] || 0 : 0,
      }
    })

    return NextResponse.json({
      leads: enrichedLeads,
      pagination: {
        current_page: page,
        per_page: per_page,
        total_pages: totalPages,
        total_leads: totalCount,
      },
    })
  } catch (error) {
    console.error("[E2E Batch API] Error fetching batch data:", error)
    return NextResponse.json(
      { error: "Failed to fetch batch data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
