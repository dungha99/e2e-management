import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"
import { getCached } from "@/lib/cache"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { uid, page = 1, per_page = 10, tab = "priority", search = "", sources = [], refreshKey = 0 } = body

    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 })
    }

    // Validate tab parameter
    if (!["priority", "nurture"].includes(tab)) {
      return NextResponse.json({ error: "Invalid tab parameter. Must be 'priority' or 'nurture'" }, { status: 400 })
    }

    const offset = (page - 1) * per_page

    // Cache key includes uid, tab, pagination params, search, sources, AND refreshKey
    const sourcesKey = sources.length > 0 ? sources.sort().join(",") : "all"
    const searchKey = search ? `s:${search}` : "nosearch"
    const cacheKey = `leads-batch:${uid}:${tab}:p${page}:pp${per_page}:${searchKey}:src:${sourcesKey}:rk:${refreshKey}`

    const result = await getCached(
      cacheKey,
      async () => {
        return await fetchBatchData(uid, tab, page, per_page, offset, search, sources)
      },
      30 // Cache for 30 seconds - lead data changes frequently
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("[E2E Batch API] Error fetching batch data:", error)
    return NextResponse.json(
      { error: "Failed to fetch batch data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

async function fetchBatchData(
  uid: string,
  tab: string,
  page: number,
  per_page: number,
  offset: number,
  search: string,
  sources: string[]
) {
  // Build WHERE condition based on tab
  const tabCondition = tab === "priority"
    ? "AND ss.is_hot_lead = true"
    : "AND (ss.is_hot_lead IS NULL OR ss.is_hot_lead = false)"

  // Build search condition for phone
  const searchCondition = search
    ? `AND (l.phone LIKE '%${search}%' OR l.additional_phone LIKE '%${search}%')`
    : ""

  // Build source filter condition
  const sourceCondition = sources.length > 0
    ? `AND l.source = ANY(ARRAY[${sources.map(s => `'${s}'`).join(",")}])`
    : ""

  // Highly optimized query:
  // 1. Rank with minimal data
  // 2. Filter distinct phones (rn = 1)
  // 3. Sort and paginate once
  // 4. Enrich only the paginated subset
  const leadsResult = await vucarV2Query(
    `WITH rank_base AS (
        SELECT
          l.id as lead_id,
          l.phone,
          l.created_at,
          c.id as car_id,
          ROW_NUMBER() OVER (
            PARTITION BY l.phone
            ORDER BY l.created_at DESC, c.created_at DESC NULLS LAST
          ) as rn
        FROM leads l
        LEFT JOIN cars c ON c.lead_id = l.id
          AND (c.updated_at IS NULL OR c.updated_at > NOW() - INTERVAL '2 months')
        LEFT JOIN sale_status ss ON ss.car_id = c.id
        WHERE l.pic_id = $1::uuid
          ${tabCondition}
          ${searchCondition}
          ${sourceCondition}
      ),
      paginated_leads AS (
        SELECT lead_id, car_id, created_at, phone
        FROM rank_base
        WHERE rn = 1
        ORDER BY created_at DESC, phone
        LIMIT $2 OFFSET $3
      )
      SELECT
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
        c.additional_images,
        u.user_name as pic_name,
        ss.id as sale_status_id,
        ss.price_customer,
        ss.bot_status,
        ss.price_highest_bid,
        ss.stage,
        ss.notes,
        ss.messages_zalo,
        ss.is_hot_lead
      FROM paginated_leads pl
      JOIN leads l ON l.id = pl.lead_id
      LEFT JOIN cars c ON c.id = pl.car_id
      LEFT JOIN sale_status ss ON ss.car_id = pl.car_id
      LEFT JOIN users u ON l.pic_id = u.id
      ORDER BY pl.created_at DESC`,
    [uid, per_page, offset]
  )

  const leads = leadsResult.rows

  // Extract car IDs and lead IDs for batch queries
  const carIds = leads.filter((l) => l.car_id).map((l) => l.car_id)
  const leadIds = leads.map((l) => l.lead_id)
  const phones = leads.map((l) => l.phone).filter(Boolean)

  // Run CRM enrichment queries in parallel (fast queries only)
  // Dealer biddings moved to separate endpoint for progressive loading
  const [decoyThreadsResult, sessionsResult, latestCampaignsResult] = await Promise.all([
    // Query 1: Decoy thread counts (CRM - fast)
    leadIds.length > 0 && phones.length > 0
      ? vucarV2Query(
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
      : Promise.resolve({ rows: [] }),

    // Query 2: Bidding sessions & workflow2 (CRM - fast)
    carIds.length > 0
      ? vucarV2Query(
        `SELECT
            car_auction_id as car_id,
            COUNT(*) as session_count,
            MAX(is_active::int) as is_active
          FROM campaigns
          WHERE car_auction_id = ANY($1::uuid[])
          GROUP BY car_auction_id`,
        [carIds]
      )
      : Promise.resolve({ rows: [] }),

    // Query 3: Latest campaign per car (for workflow status)
    // Only get campaigns where created_by IS NULL (system/bot created)
    carIds.length > 0
      ? vucarV2Query(
        `WITH ordered_campaigns AS (
          SELECT 
            cp.id,
            cp.car_auction_id,
            cp.is_active,
            cp.duration,
            cp.published_at,
            cp.created_by,
            ROW_NUMBER() OVER (PARTITION BY cp.car_auction_id ORDER BY cp.published_at DESC) as rn,
            ROW_NUMBER() OVER (PARTITION BY c.lead_id ORDER BY cp.published_at ASC) as workflow_order
          FROM campaigns cp
          LEFT JOIN cars c ON c.id = cp.car_auction_id
          WHERE cp.car_auction_id = ANY($1::uuid[])
            AND cp.created_by IS NULL
        )
        SELECT 
          id,
          car_auction_id as car_id,
          is_active,
          duration,
          published_at,
          created_by,
          workflow_order
        FROM ordered_campaigns
        WHERE rn = 1`,
        [carIds]
      )
      : Promise.resolve({ rows: [] }),
  ])

  // Process results into lookup maps

  const decoyThreadCounts = Object.fromEntries(
    decoyThreadsResult.rows.map((row) => [row.lead_id, parseInt(row.thread_count) || 0])
  )

  const biddingSessionCounts = Object.fromEntries(
    sessionsResult.rows.map((row) => [row.car_id, parseInt(row.session_count) || 0])
  )

  const workflow2Status = Object.fromEntries(
    sessionsResult.rows.map((row) => [row.car_id, row.is_active === 1 ? true : false])
  )

  // Map latest campaign info by car_id
  const latestCampaigns = Object.fromEntries(
    latestCampaignsResult.rows.map((row) => [row.car_id, {
      id: row.id,
      is_active: row.is_active || false,
      duration: row.duration ? parseFloat(row.duration) : null,
      published_at: row.published_at,
      workflow_order: parseInt(row.workflow_order) || 1,
      created_by: row.created_by || null,
    }])
  )

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
      is_primary: lead.is_hot_lead || false,
      // Flatten sale_status fields to top level for easier access
      price_customer: lead.price_customer,
      bot_active: lead.bot_status || false,
      price_highest_bid: lead.price_highest_bid,
      stage: lead.stage || "UNDEFINED",
      notes: lead.notes,
      first_message_sent: first_message_sent,
      session_created: session_created,
      // Also keep nested sale_status for backwards compatibility
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
      decoy_thread_count: decoyThreadCounts[lead.lead_id] || 0,
      bidding_session_count: lead.car_id ? biddingSessionCounts[lead.car_id] || 0 : 0,
      // Add dealer_bidding default - will be enriched by frontend
      dealer_bidding: lead.price_highest_bid
        ? { status: "got_price" as const, maxPrice: lead.price_highest_bid }
        : { status: "not_sent" as const },
      // Latest campaign info for workflow status display
      latest_campaign: lead.car_id ? (latestCampaigns[lead.car_id] || null) : null,
    }
  })

  return {
    leads: enrichedLeads,
    pagination: {
      current_page: page,
      per_page: per_page,
    },
  }
}
