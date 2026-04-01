import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"

export const dynamic = "force-dynamic"

// Non-AI workflow IDs to exclude
const NON_AI_WORKFLOW_IDS = [
  '36af24d3-6e60-43b8-b198-cfec8b5d0e0e',
  '3b78a161-116e-43a2-8b7f-61fcf9ba9930',
  'e06d0d0b-be03-45f9-97f1-38964ee7e231',
  'fc43e876-0948-4d5a-b16d-a717e891fd57',
  '9f130676-a416-418f-bae9-a581096f6426',
]

/**
 * Helper: extract field from summary_properties result (handles array vs object)
 */
function getLatestSnapshotField(result: any, field: string): any {
  if (!result) return null
  if (Array.isArray(result)) {
    const last = result[result.length - 1]
    return last?.[field] ?? null
  }
  return result[field] ?? null
}

/**
 * Helper: get all snapshots as array
 */
function getSnapshots(result: any): any[] {
  if (!result) return []
  if (Array.isArray(result)) return result
  return [result]
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const filterPicId = searchParams.get('picId')

    // ============================================================
    // Step 1: Get AI lead car_ids from ai_agent_outputs (E2E DB)
    // ============================================================
    let aiLeadsQuery = `
      SELECT DISTINCT car_id
      FROM ai_agent_outputs
      WHERE agent_id = 'd68a4392-c2d7-4311-8c0a-816a232014eb'
    `
    const queryParams: any[] = []
    if (startDate && endDate) {
      aiLeadsQuery += ` AND created_at >= $1 AND created_at <= $2`
      queryParams.push(startDate, endDate)
    }

    const aiLeadsRes = await e2eQuery(aiLeadsQuery, queryParams)
    const aiCarIds = aiLeadsRes.rows.map((r: any) => r.car_id).filter(Boolean)

    if (aiCarIds.length === 0) {
      return NextResponse.json({
        volume: { totalAiLeads: 0, aiLeadsWithSummary: 0, active: 0, closed: 0, stageDistribution: [], qualifiedDistribution: [] },
        conversion: { stageReachRates: [], stageToStage: [], negotiationAnalysis: {} },
        sla: { milestones: [], breachRates: [] },
        quality: {},
        byPic: [],
      })
    }

    // ============================================================
    // Step 2: Get workflow started_at for SLA calculations (E2E DB)
    // ============================================================
    const workflowStartRes = await e2eQuery(`
      SELECT car_id, MIN(started_at) as started_at
      FROM workflow_instances
      WHERE workflow_id != ALL($1::uuid[])
        AND car_id = ANY($2::uuid[])
      GROUP BY car_id
    `, [NON_AI_WORKFLOW_IDS, aiCarIds])
    const workflowStartMap = new Map<string, Date>()
    for (const row of workflowStartRes.rows) {
      workflowStartMap.set(row.car_id, new Date(row.started_at))
    }

    // ============================================================
    // Step 3: Get CRM metadata + lead_id mapping (VucarV2 DB)
    // ============================================================
    const vucarV2Res = await vucarV2Query(`
      SELECT 
        c.id as car_id,
        c.lead_id,
        c.additional_images,
        l.pic_id,
        ss.stage as crm_stage,
        ss.qualified as crm_qualified
      FROM cars c
      LEFT JOIN leads l ON l.id = c.lead_id
      LEFT JOIN LATERAL (
        SELECT stage, qualified FROM sale_status
        WHERE car_id = c.id
        ORDER BY updated_at DESC
        LIMIT 1
      ) ss ON true
      WHERE c.id = ANY($1::uuid[])
    `, [aiCarIds])

    const carToLeadMap = new Map<string, string>()
    const leadToCarMap = new Map<string, string>()
    const carMetadataMap = new Map<string, { crmStage: string | null, crmQualified: string | null, picId: string | null, leadId: string | null, additionalImages: any }>()

    for (const row of vucarV2Res.rows) {
      if (row.car_id && row.lead_id) {
        carToLeadMap.set(row.car_id, row.lead_id)
        leadToCarMap.set(row.lead_id, row.car_id)
      }
      carMetadataMap.set(row.car_id, {
        crmStage: row.crm_stage,
        crmQualified: row.crm_qualified,
        picId: row.pic_id,
        leadId: row.lead_id,
        additionalImages: row.additional_images
      })
    }

    const leadIds = Array.from(new Set(vucarV2Res.rows.map((r: any) => r.lead_id).filter(Boolean)))

    // ============================================================
    // Step 4: Get summary_properties from VucarV2 DB
    // ============================================================
    let summaryResRows: any[] = []
    if (leadIds.length > 0) {
      const summaryRes = await vucarV2Query(`
        SELECT 
          cs.lead_id,
          sp.result as sp_result,
          sp.created_at as sp_created_at,
          sp.updated_at as sp_updated_at
        FROM chat_summary cs
        JOIN summary_properties sp ON sp.summary_id = cs.id
        WHERE cs.lead_id = ANY($1::uuid[])
        ORDER BY sp.updated_at DESC
      `, [leadIds])
      summaryResRows = summaryRes.rows
    }

    // ============================================================
    // Build per-lead data
    // ============================================================
    interface LeadData {
      carId: string
      hasSummary: boolean
      latestStage: string | null // final_stage combining AI + CRM
      aiStage: string | null
      crmStage: string | null
      crmQualified: string | null
      qualified: string | null
      hadCarImage: boolean
      isStrongQualified: boolean
      priceCustomer: number | null
      priceVucarOffered: number | null
      negotiationRounds: number
      infoCollectedAt: string | null
      priceSharedAt: string | null
      priceVucarOfferedAt: string | null
      inspectionBookedAt: string | null
      spCreatedAt: string | null
      spUpdatedAt: string | null
      workflowStartedAt: Date | null
      picId: string | null
      snapshots: any[]
      sellerSentiment: string | null
    }

    const leadsMap = new Map<string, LeadData>()

    // Merge CRM metadata and E2E summaries
    const summaryByLeadMap = new Map<string, any>()
    for (const row of summaryResRows) {
      // Since it's ordered by updated_at DESC, the first one seen is the most recent
      if (!summaryByLeadMap.has(row.lead_id)) {
        summaryByLeadMap.set(row.lead_id, row)
      }
    }

      for (const carId of aiCarIds) {
      const crm = carMetadataMap.get(carId)
      const leadId = crm?.leadId
      const summaryRow = leadId ? summaryByLeadMap.get(leadId) : null
      
      const spResult = summaryRow?.sp_result
      const hasSummary = !!spResult
      const snapshots = getSnapshots(spResult)
      const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null

      // Determine AI stage (normalize contact → contacted)
      let aiStage = latestSnapshot?.stage ?? null
      if (aiStage === 'contacted' || aiStage === 'contact') aiStage = 'contacted'

      // ============================================================
      // SLA Timestamp Extraction (Waterfall logic)
      // ============================================================
      let infoCollectedAt = latestSnapshot?.info_collected_at ?? null
      let priceSharedAt = latestSnapshot?.price_shared_at ?? null
      let priceVucarOfferedAt = latestSnapshot?.price_vucar_offered_at ?? null
      let inspectionBookedAt = latestSnapshot?.inspection_booked_at ?? null

      if (Array.isArray(snapshots)) {
        for (const snap of snapshots) {
          const snapTime = snap.created_at || null
          if (!infoCollectedAt && (snap.info_collected_at || snap.mileage || snap.location)) {
            infoCollectedAt = snap.info_collected_at || snapTime
          }
          if (!priceSharedAt && (snap.price_shared_at || snap.price_customer)) {
            priceSharedAt = snap.price_shared_at || snapTime
          }
          if (!priceVucarOfferedAt && (snap.price_vucar_offered_at || snap.price_vucar_offered)) {
            priceVucarOfferedAt = snap.price_vucar_offered_at || snapTime
          }
          if (!inspectionBookedAt && (snap.inspection_booked_at || snap.stage === 'inspection')) {
            inspectionBookedAt = snap.inspection_booked_at || snapTime
          }
        }
      }

      // Determine CRM stage
      const crmStage = crm?.crmStage ?? null
      const crmQualified = crm?.crmQualified ?? null

      // Final stage
      let finalStage = aiStage
      if (crmStage === 'COMPLETED') finalStage = 'completed'
      else if (crmStage === 'DEPOSIT_PAID') finalStage = 'deposited'
      else if (crmStage === 'FAILED') finalStage = 'failed'

      let hadCarImage = false
      if (Array.isArray(snapshots)) {
        hadCarImage = snapshots.some((snap: any) => 
          snap.had_car_image === true || (snap.had_car_image === undefined && snap.had_image === true)
        )
      } else {
        hadCarImage = latestSnapshot?.had_car_image === true || (latestSnapshot?.had_car_image === undefined && latestSnapshot?.had_image === true)
      }

      const isStrongQualified = hadCarImage || crm?.additionalImages != null
      const priceCustomer = latestSnapshot?.price_customer ? parseInt(latestSnapshot.price_customer) : null
      const priceVucarOffered = latestSnapshot?.price_vucar_offered ? parseInt(latestSnapshot.price_vucar_offered) : null
      const negotiationRounds = parseInt(latestSnapshot?.negotiation_rounds ?? '0') || 0
      const sellerSentiment = latestSnapshot?.seller_sentiment ?? null

      leadsMap.set(carId, {
        carId,
        hasSummary,
        latestStage: finalStage,
        aiStage,
        crmStage,
        crmQualified,
        qualified: isStrongQualified ? 'strong_qualified' : 'weak_qualified',
        hadCarImage,
        isStrongQualified,
        priceCustomer,
        priceVucarOffered,
        negotiationRounds,
        infoCollectedAt,
        priceSharedAt,
        priceVucarOfferedAt,
        inspectionBookedAt,
        spCreatedAt: summaryRow?.sp_created_at ?? null,
        spUpdatedAt: summaryRow?.sp_updated_at ?? null,
        workflowStartedAt: workflowStartMap.get(carId) ?? null,
        picId: crm?.picId ?? null,
        snapshots,
        sellerSentiment,
      } as any)
    }

    // Also add AI leads without summary
    for (const car_id of aiCarIds) {
      if (!leadsMap.has(car_id)) {
        leadsMap.set(car_id, {
          carId: car_id,
          hasSummary: false,
          latestStage: null,
          aiStage: null,
          crmStage: null,
          crmQualified: null,
          qualified: null,
          hadCarImage: false,
          isStrongQualified: false,
          priceCustomer: null,
          priceVucarOffered: null,
          negotiationRounds: 0,
          infoCollectedAt: null,
          priceSharedAt: null,
          priceVucarOfferedAt: null,
          inspectionBookedAt: null,
          spCreatedAt: null,
          spUpdatedAt: null,
          workflowStartedAt: workflowStartMap.get(car_id) ?? null,
          picId: null,
          snapshots: [],
          sellerSentiment: null,
        })
      }
    }

    const unfilteredLeads = Array.from(leadsMap.values())

    // ============================================================
    // PRE-CALC: Total Assigned Leads for Baselines
    // ============================================================
    // PIC Assigned Leads filter theo time
    let totalAssignedQuery = `
      SELECT pic_id, COUNT(id) as total_assigned
      FROM leads
      WHERE pic_id IS NOT NULL
    `
    const assignedParams: any[] = []
    if (startDate && endDate) {
      totalAssignedQuery += ` AND created_at >= $1 AND created_at <= $2`
      assignedParams.push(startDate, endDate)
    }
    totalAssignedQuery += ` GROUP BY pic_id`
    
    const assignedRes = await vucarV2Query(totalAssignedQuery, assignedParams)
    const assignedPerPicMap = new Map<string, number>()
    for (const row of assignedRes.rows) {
      assignedPerPicMap.set(row.pic_id, parseInt(row.total_assigned))
    }

    // Get total assigned for this filtered PIC (or all)
    let totalAssignedLeadsCount = 0
    if (filterPicId && filterPicId !== 'all') {
      totalAssignedLeadsCount = assignedPerPicMap.get(filterPicId) || 0
    } else {
      for (const count of assignedPerPicMap.values()) {
        totalAssignedLeadsCount += count
      }
    }

    const leadsMapFiltered = filterPicId && filterPicId !== 'all' 
      ? unfilteredLeads.filter(l => l.picId === filterPicId)
      : unfilteredLeads

    const leadsWithSummary = leadsMapFiltered.filter(l => l.hasSummary)
    const allLeadsFiltered = leadsMapFiltered
    const activeStages = ['contacted', 'negotiation', 'inspection']

    // ============================================================
    // SECTION 1: Volume
    // ============================================================
    const totalAiLeads = allLeadsFiltered.length
    const aiLeadsWithSummary = leadsWithSummary.length
    const activeLeads = leadsWithSummary.filter(l => l.latestStage && activeStages.includes(l.latestStage)).length
    const closedLeads = leadsWithSummary.filter(l => l.latestStage === 'completed' || l.latestStage === 'deposited').length

    // Stage distribution (snapshot mới nhất)
    const stageCounts: Record<string, number> = {}
    for (const l of leadsWithSummary) {
      const stage = l.latestStage || 'unknown'
      stageCounts[stage] = (stageCounts[stage] || 0) + 1
    }
    const stageDistribution = [
      { stage: 'totalAssigned', count: totalAssignedLeadsCount, percentage: 100 },
      ...Object.entries(stageCounts).map(([stage, count]) => ({
        stage,
        count,
        percentage: totalAssignedLeadsCount > 0 ? Math.round((count / totalAssignedLeadsCount) * 1000) / 10 : 0,
      }))
    ]

    // Qualified distribution
    const strongQualified = leadsWithSummary.filter(l => l.hadCarImage).length
    const weakQualified = leadsWithSummary.filter(l => !l.hadCarImage).length

    // ============================================================
    // SECTION 2: Funnel Conversion
    // ============================================================
    // Stage reach rate: count unique car_ids that EVER appeared at each stage
    const stageOrder = ['contacted', 'negotiation', 'inspection']
    const stageReachCounts: Record<string, Set<string>> = {
      contacted: new Set(),
      negotiation: new Set(),
      inspection: new Set(),
    }

    for (const l of leadsWithSummary) {
      // Mọi lead có summary đều được coi là contacted
      stageReachCounts['contacted'].add(l.carId)

      for (const snap of l.snapshots) {
        let stage = snap.stage
        if (stage === 'negotiation' || snap.price_customer != null) {
          stageReachCounts['negotiation'].add(l.carId)
        }
        if (stage === 'inspection' || snap.inspection_booked_at != null) {
          stageReachCounts['inspection'].add(l.carId)
        }
      }
    }

    const closedSet = new Set(leadsWithSummary.filter(l => l.latestStage === 'completed' || l.latestStage === 'deposited').map(l => l.carId))
    const failedSet = new Set(leadsWithSummary.filter(l => l.latestStage === 'failed').map(l => l.carId))

    const stageReachRates = [
      { stage: 'totalAssigned', count: totalAssignedLeadsCount, rate: 100 },
      { stage: 'totalAi', count: totalAiLeads, rate: totalAssignedLeadsCount > 0 ? Math.round((totalAiLeads / totalAssignedLeadsCount) * 1000) / 10 : 0 },
      { stage: 'summary', count: aiLeadsWithSummary, rate: totalAssignedLeadsCount > 0 ? Math.round((aiLeadsWithSummary / totalAssignedLeadsCount) * 1000) / 10 : 0 },
      { stage: 'contacted', count: stageReachCounts['contacted'].size, rate: totalAssignedLeadsCount > 0 ? Math.round((stageReachCounts['contacted'].size / totalAssignedLeadsCount) * 1000) / 10 : 0 },
      { stage: 'qualified', count: strongQualified, rate: totalAssignedLeadsCount > 0 ? Math.round((strongQualified / totalAssignedLeadsCount) * 1000) / 10 : 0 },
      { stage: 'negotiation', count: stageReachCounts['negotiation'].size, rate: totalAssignedLeadsCount > 0 ? Math.round((stageReachCounts['negotiation'].size / totalAssignedLeadsCount) * 1000) / 10 : 0 },
      { stage: 'inspection', count: stageReachCounts['inspection'].size, rate: totalAssignedLeadsCount > 0 ? Math.round((stageReachCounts['inspection'].size / totalAssignedLeadsCount) * 1000) / 10 : 0 },
      { stage: 'closed', count: closedSet.size, rate: totalAssignedLeadsCount > 0 ? Math.round((closedSet.size / totalAssignedLeadsCount) * 1000) / 10 : 0 }
    ]

    // Stage-to-stage conversion
    const contactedCount = stageReachCounts['contacted'].size
    const negotiationCount = stageReachCounts['negotiation'].size
    const inspectionCount = stageReachCounts['inspection'].size

    const stageToStage = [
      { from: 'totalAssigned', to: 'totalAi', fromCount: totalAssignedLeadsCount, toCount: totalAiLeads, rate: totalAssignedLeadsCount > 0 ? Math.round((totalAiLeads / totalAssignedLeadsCount) * 1000) / 10 : 0 },
      { from: 'totalAi', to: 'summary', fromCount: totalAiLeads, toCount: aiLeadsWithSummary, rate: totalAiLeads > 0 ? Math.round((aiLeadsWithSummary / totalAiLeads) * 1000) / 10 : 0 },
      { from: 'contacted', to: 'negotiation', fromCount: contactedCount, toCount: negotiationCount, rate: contactedCount > 0 ? Math.round((negotiationCount / contactedCount) * 1000) / 10 : 0 },
      { from: 'negotiation', to: 'inspection', fromCount: negotiationCount, toCount: inspectionCount, rate: negotiationCount > 0 ? Math.round((inspectionCount / negotiationCount) * 1000) / 10 : 0 },
      { from: 'inspection', to: 'closed', fromCount: inspectionCount, toCount: closedSet.size, rate: inspectionCount > 0 ? Math.round((closedSet.size / inspectionCount) * 1000) / 10 : 0 },
    ]

    // Negotiation analysis
    const leadsWithPrice = leadsWithSummary.filter(l => l.priceCustomer != null || l.priceVucarOffered != null)
    const leadsWithMultiRounds = leadsWithPrice.filter(l => l.negotiationRounds >= 2)
    const leadsWithSinglePrice = leadsWithPrice.filter(l => l.negotiationRounds < 2)

    // Price reduction calculation
    const priceReductions: number[] = []
    for (const l of leadsWithSummary) {
      if (l.snapshots.length < 2) continue
      const prices = l.snapshots
        .map((s: any) => s.price_customer ? parseInt(s.price_customer) : null)
        .filter((p: number | null): p is number => p != null)
      if (prices.length >= 2 && prices[0] > prices[prices.length - 1]) {
        const reduction = (prices[0] - prices[prices.length - 1]) / prices[0]
        priceReductions.push(reduction)
      }
    }

    const maxNegotiationRounds = Math.max(0, ...leadsWithSummary.map(l => l.negotiationRounds))
    const avgPriceReduction = priceReductions.length > 0
      ? Math.round(priceReductions.reduce((a, b) => a + b, 0) / priceReductions.length * 1000) / 10
      : 0

    const negotiationAnalysis = {
      leadsWithActualNegotiation: leadsWithMultiRounds.length,
      leadsWithSinglePrice: leadsWithSinglePrice.length,
      totalLeadsWithPrice: leadsWithPrice.length,
      multiRoundPercentage: leadsWithPrice.length > 0 ? Math.round((leadsWithMultiRounds.length / leadsWithPrice.length) * 1000) / 10 : 0,
      avgPriceReductionPercent: avgPriceReduction,
      maxNegotiationRounds,
      leadsWithPriceReduction: priceReductions.length,
    }

    // ============================================================
    // SECTION 3: SLA & Speed
    // ============================================================
    const slaMilestones: {
      name: string
      values: number[]
      target: number
      unit: string
    }[] = [
      { name: 'Time to Info Collected', values: [], target: 24, unit: 'hours' },
      { name: 'Time to Price Shared', values: [], target: 24, unit: 'hours' },
      { name: 'Time to Vucar Price Offered', values: [], target: 4, unit: 'hours' },
      { name: 'Time to Inspection Booked', values: [], target: 48, unit: 'hours' },
      { name: 'Lead Cycle Time (active)', values: [], target: 480, unit: 'hours' }, // 20 days
    ]

    let breachInfoCollected = 0, totalInfoCollected = 0
    let breachInspectionBooked = 0, totalInspectionBooked = 0
    let breachPriceResponse = 0, totalPriceResponse = 0

    for (const l of leadsWithSummary) {
      const startedAt = l.workflowStartedAt

      // Time to info collected
      if (l.infoCollectedAt && startedAt) {
        const hours = (new Date(l.infoCollectedAt).getTime() - startedAt.getTime()) / 3600000
          if (hours >= 0) {
            slaMilestones[0].values.push(hours)
            totalInfoCollected++
            if (hours > 24) breachInfoCollected++
          } else {
            console.warn(`[AI Funnel] Negative delta for Info Collected. car_id: ${l.carId}, started_at: ${startedAt.toISOString()}, info_collected_at: ${l.infoCollectedAt}`)
          }
        }

        // Time to price shared
        if (l.priceSharedAt && startedAt) {
          // Parse to UTC properly to avoid timezone mismatch
          const delta = new Date(l.priceSharedAt).getTime() - startedAt.getTime()
          const hours = delta / 3600000
          if (hours >= 0) {
              slaMilestones[1].values.push(hours)
          } else {
              console.warn(`[AI Funnel] Negative delta for Price Shared. car_id: ${l.carId}`)
          }
        }

        // Time to Vucar price offered (from price_shared_at)
        if (l.priceVucarOfferedAt && l.priceSharedAt) {
          const delta = new Date(l.priceVucarOfferedAt).getTime() - new Date(l.priceSharedAt).getTime()
          const hours = delta / 3600000
          if (hours >= 0) {
            slaMilestones[2].values.push(hours)
            totalPriceResponse++
            if (hours > 4) breachPriceResponse++
          } else {
              console.warn(`[AI Funnel] Negative delta for Vucar Price Offered. car_id: ${l.carId}`)
          }
        }

        // Time to inspection booked (from info_collected_at)
        if (l.inspectionBookedAt && l.infoCollectedAt) {
          const delta = new Date(l.inspectionBookedAt).getTime() - new Date(l.infoCollectedAt).getTime()
          const hours = delta / 3600000
          if (hours >= 0) {
            slaMilestones[3].values.push(hours)
            totalInspectionBooked++
            if (hours > 48) breachInspectionBooked++
          } else {
              console.warn(`[AI Funnel] Negative delta for Inspection Booked. car_id: ${l.carId}`)
          }
        }

        // Lead cycle time
        if (l.spCreatedAt && l.spUpdatedAt) {
          const delta = new Date(l.spUpdatedAt).getTime() - new Date(l.spCreatedAt).getTime()
          const hours = delta / 3600000
          if (hours >= 0) slaMilestones[4].values.push(hours)
        }
    }

    // Calculate median and P90
    function calcStats(values: number[]) {
      if (values.length === 0) return { median: null, p90: null, avg: null, count: 0 }
      const sorted = [...values].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      const p90 = sorted[Math.floor(sorted.length * 0.9)]
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      return {
        median: Math.round(median * 10) / 10,
        p90: Math.round(p90 * 10) / 10,
        avg: Math.round(avg * 10) / 10,
        count: values.length,
      }
    }

    const slaResults = slaMilestones.map(m => ({
      name: m.name,
      target: m.target,
      unit: m.unit,
      ...calcStats(m.values),
    }))

    const breachRates: any[] = []

    // ============================================================
    // SECTION 4: AI Quality
    // ============================================================
    const activeOrNegotiatingLeads = leadsWithSummary.filter(l =>
      l.latestStage && ['negotiation', 'inspection'].includes(l.latestStage)
    )
    const avgNegotiationRounds = activeOrNegotiatingLeads.length > 0
      ? Math.round((activeOrNegotiatingLeads.reduce((sum, l) => sum + l.negotiationRounds, 0) / activeOrNegotiatingLeads.length) * 10) / 10
      : 0

    // Price gap
    const priceGaps: number[] = []
    for (const l of leadsWithSummary) {
      if (l.priceCustomer != null && l.priceVucarOffered != null) {
        priceGaps.push(l.priceCustomer - l.priceVucarOffered)
      }
    }
    const avgPriceGap = priceGaps.length > 0
      ? Math.round(priceGaps.reduce((a, b) => a + b, 0) / priceGaps.length)
      : null

    // D6 - Ghosting Rate
    const nowMs = Date.now()
    let ghostedActiveLeads = 0
    for (const l of leadsWithSummary) {
      if (l.latestStage && activeStages.includes(l.latestStage)) {
        if (l.spUpdatedAt && nowMs - new Date(l.spUpdatedAt).getTime() > 48 * 3600000) {
          ghostedActiveLeads++
        }
      }
    }
    const ghostingRate = activeLeads > 0 ? (ghostedActiveLeads / activeLeads) * 100 : 0

    // D11 - Price convergence speed
    let convergenceRounds = { round1: 0, round2: 0, round3Plus: 0 }
    let totalConverged = 0
    for (const l of leadsWithSummary) {
      let pricesSeen = 0
      for (const snap of l.snapshots) {
        const pc = snap.price_customer ? parseInt(snap.price_customer) : null
        const pv = snap.price_vucar_offered ? parseInt(snap.price_vucar_offered) : null
        if (pc != null || pv != null) pricesSeen++
        if (pc != null && pv != null && pc > 0) {
          const gap = (pc - pv) / pc
          if (gap <= 0.05) {
            totalConverged++
            if (pricesSeen === 1) convergenceRounds.round1++
            else if (pricesSeen === 2) convergenceRounds.round2++
            else convergenceRounds.round3Plus++
            break // Counted for this lead
          }
        }
      }
    }

    // D13 - Reactivation rate
    let everGhosted = 0
    let recoveredGhosts = 0
    for (const l of leadsWithSummary) {
      let hasGap = false
      let recovered = false
      for (let i = 1; i < l.snapshots.length; i++) {
        const t1 = new Date(l.snapshots[i - 1].created_at || l.spCreatedAt).getTime()
        const t2 = new Date(l.snapshots[i].created_at || l.spUpdatedAt).getTime()
        if (t2 - t1 > 48 * 3600000) {
          hasGap = true
          recovered = true
        }
      }
      
      const isCurrentlyGhosted = l.latestStage && activeStages.includes(l.latestStage) && l.spUpdatedAt && (nowMs - new Date(l.spUpdatedAt).getTime() > 48 * 3600000)
      if (hasGap || isCurrentlyGhosted) {
        everGhosted++
        if (recovered) recoveredGhosts++
      }
    }
    const reactivationRate = everGhosted > 0 ? (recoveredGhosts / everGhosted) * 100 : 0

    // AI-CRM sync accuracy
    let syncMatch = 0, syncTotal = 0
    for (const l of leadsWithSummary) {
      if (!l.crmStage || !l.aiStage) continue
      syncTotal++
      const crmMapped = l.crmStage === 'COMPLETED' ? 'completed'
        : l.crmStage === 'DEPOSIT_PAID' ? 'deposited'
        : l.crmStage === 'FAILED' ? 'failed'
        : l.crmStage?.toLowerCase()
      if (crmMapped === l.aiStage || (crmMapped === l.latestStage)) syncMatch++
    }

    // ============================================================
    // SECTION: Seller Sentiment (S-metrics)
    // ============================================================
    const leadsWithSentiment = leadsWithSummary.filter(l => l.sellerSentiment)
    const totalWithSentiment = leadsWithSentiment.length
    
    // S1: Distribution
    const sentimentCounts: Record<string, number> = {
      willing: 0, hesitant: 0, want_human: 0, angry: 0, ghosting: 0, bot_detected: 0
    }
    leadsWithSentiment.forEach(l => {
      if (l.sellerSentiment && sentimentCounts[l.sellerSentiment] !== undefined) {
        sentimentCounts[l.sellerSentiment]++
      }
    })

    // S2: Sentiment x Stage Cross-tab
    const sentimentStageMap: Record<string, Record<string, number>> = {}
    const sentimentStages = ['contacted', 'negotiation', 'inspection', 'failed', 'completed', 'deposited']
    leadsWithSentiment.forEach(l => {
      const s = l.sellerSentiment!
      const stage = l.latestStage || 'unknown'
      if (!sentimentStageMap[stage]) sentimentStageMap[stage] = {}
      sentimentStageMap[stage][s] = (sentimentStageMap[stage][s] || 0) + 1
    })

    // S3: Escalation signal rate
    const angryCount = sentimentCounts.angry || 0
    const wantHumanCount = sentimentCounts.want_human || 0
    const botDetectedCount = sentimentCounts.bot_detected || 0
    const escalationCount = angryCount + wantHumanCount + botDetectedCount
    const escalationRate = totalWithSentiment > 0 ? Math.round((escalationCount / totalWithSentiment) * 1000) / 10 : 0

    // S4: Sentiment x Negotiation quality
    const sentimentNegotiation: Record<string, { avgRounds: number, avgPriceGap: number, count: number }> = {}
    leadsWithSentiment.forEach(l => {
      const s = l.sellerSentiment!
      if (!sentimentNegotiation[s]) sentimentNegotiation[s] = { avgRounds: 0, avgPriceGap: 0, count: 0 }
      const sn = sentimentNegotiation[s]
      sn.count++
      sn.avgRounds += l.negotiationRounds
      if (l.priceCustomer && l.priceVucarOffered) {
        sn.avgPriceGap += (l.priceCustomer - l.priceVucarOffered)
      }
    })
    Object.values(sentimentNegotiation).forEach(sn => {
      if (sn.count > 0) {
        sn.avgRounds = Math.round((sn.avgRounds / sn.count) * 10) / 10
        sn.avgPriceGap = Math.round(sn.avgPriceGap / sn.count)
      }
    })

    // Removed S5 (Hesitant Conversion) as requested

    // S6: Ghosting detection rate (proxy)
    const activeLeadsForGhosting = leadsWithSummary.filter(l => 
      l.latestStage && ['contacted', 'negotiation', 'inspection'].includes(l.latestStage)
    )
    const ghostedActive = activeLeadsForGhosting.filter(l => {
        if (!l.spUpdatedAt) return false
        const lastUpdate = new Date(l.spUpdatedAt).getTime()
        const now = new Date().getTime()
        return (now - lastUpdate) > (48 * 3600000)
    })
    const ghostingProxyRate = activeLeadsForGhosting.length > 0 
      ? Math.round((ghostedActive.length / activeLeadsForGhosting.length) * 1000) / 10 
      : 0

    const sentiment = {
      distribution: Object.entries(sentimentCounts).map(([name, value]) => ({ name, value, pct: totalWithSentiment > 0 ? Math.round((value / totalWithSentiment) * 100) : 0 })),
      escalation: {
        rate: escalationRate,
        angry: angryCount,
        wantHuman: wantHumanCount,
        botDetected: botDetectedCount,
        total: totalWithSentiment
      },
      crossTab: sentimentStageMap,
      negotiationQuality: sentimentNegotiation,
      ghostingProxy: {
        rate: ghostingProxyRate,
        count: ghostedActive.length,
        totalActive: activeLeadsForGhosting.length
      }
    }

    const quality = {
      strongQualifiedRate: aiLeadsWithSummary > 0 ? Math.round((strongQualified / aiLeadsWithSummary) * 1000) / 10 : 0,
      avgNegotiationRounds,
      leadsWithPriceReduction: priceReductions.length,
      priceReductionRate: leadsWithPrice.length > 0 ? Math.round((priceReductions.length / leadsWithPrice.length) * 1000) / 10 : 0,
      avgPriceReductionPercent: avgPriceReduction,
      avgPriceGap,
      priceGapCount: priceGaps.length,
      ghostingRate: Math.round(ghostingRate * 10) / 10,
      ghostedActiveLeads,
      reactivationRate: Math.round(reactivationRate * 10) / 10,
      convergenceTotal: totalConverged,
      convergenceRounds,
      sentiment
    }

    // ============================================================
    // SECTION 5: By PIC (Leaderboard)
    // ============================================================
    const picIds = [...new Set(unfilteredLeads.map(l => l.picId).filter(Boolean))] as string[]
    let picNameMap = new Map<string, string>()
    if (picIds.length > 0) {
      const picRes = await vucarV2Query(`
        SELECT id, user_name FROM users WHERE id = ANY($1::uuid[])
      `, [picIds])
      for (const row of picRes.rows) {
        picNameMap.set(row.id, row.user_name)
      }
    }


    const picDataMap = new Map<string, {
      picId: string
      picName: string
      totalAiLeads: number
      aiLeadWins: number
      slaInfoCollectedMet: number
      slaInfoCollectedTotal: number
      slaInspectionBookedMet: number
      slaInspectionBookedTotal: number
    }>()

    for (const l of unfilteredLeads) {
      const pid = l.picId || 'unassigned'
      if (!picDataMap.has(pid)) {
        picDataMap.set(pid, {
          picId: pid,
          picName: picNameMap.get(pid) || (pid === 'unassigned' ? 'Chưa assign' : pid.slice(0, 8)),
          totalAiLeads: 0,
          aiLeadWins: 0,
          slaInfoCollectedMet: 0,
          slaInfoCollectedTotal: 0,
          slaInspectionBookedMet: 0,
          slaInspectionBookedTotal: 0,
        })
      }
      const pd = picDataMap.get(pid)!
      pd.totalAiLeads++
      if (l.latestStage === 'completed' || l.latestStage === 'deposited') {
        pd.aiLeadWins++
      }

      // SLA
      if (l.infoCollectedAt && l.workflowStartedAt) {
        const hours = (new Date(l.infoCollectedAt).getTime() - l.workflowStartedAt.getTime()) / 3600000
        if (hours >= 0) {
          pd.slaInfoCollectedTotal++
          if (hours <= 24) pd.slaInfoCollectedMet++
        }
      }
      if (l.inspectionBookedAt && l.infoCollectedAt) {
        const hours = (new Date(l.inspectionBookedAt).getTime() - new Date(l.infoCollectedAt).getTime()) / 3600000
        if (hours >= 0) {
          pd.slaInspectionBookedTotal++
          if (hours <= 48) pd.slaInspectionBookedMet++
        }
      }
    }

    // ============================================================
    // SECTION 5: Weekly Trends
    // ============================================================
    const weeksMap: Map<string, any> = new Map()
    const getWeekKey = (date: Date) => {
      const d = new Date(date)
      d.setUTCHours(0, 0, 0, 0)
      d.setUTCDate(d.getUTCDate() - (d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1)) // Monday
      return d.toISOString().split('T')[0]
    }

    for (const [carId, startedAt] of workflowStartMap) {
      if (!startedAt) continue
      const week = getWeekKey(startedAt)
      if (!weeksMap.has(week)) {
        weeksMap.set(week, { 
          week, 
          totalLeads: 0, 
          withSummary: 0, 
          strongQualified: 0,
          everNegotiation: 0,
          slaPriceShared: [],
          slaVucarOffered: [],
        })
      }
      const w = weeksMap.get(week)
      w.totalLeads++
      
      const l = leadsMap.get(carId)
      if (l) {
        if (l.hasSummary) w.withSummary++
        if (l.isStrongQualified) w.strongQualified++
        
        // SLA data
        if (l.priceSharedAt) {
          const delta = new Date(l.priceSharedAt).getTime() - startedAt.getTime()
          const hours = delta / 3600000
          if (hours >= 0) w.slaPriceShared.push(hours)
        }
        if (l.priceVucarOfferedAt && l.priceSharedAt) {
          const delta = new Date(l.priceVucarOfferedAt).getTime() - new Date(l.priceSharedAt).getTime()
          const hours = delta / 3600000
          if (hours >= 0) w.slaVucarOffered.push(hours)
        }
        
        // Ever Negotiation logic (simplified for trends)
        if (l.aiStage === 'negotiation' || l.priceCustomer != null) {
          w.everNegotiation++
        }
      }
    }

    const weeklyTrends = Array.from(weeksMap.values())
      .sort((a, b) => a.week.localeCompare(b.week))
      .map(w => {
        const sortedShared = [...w.slaPriceShared].sort((a, b) => a - b)
        const sortedOffered = [...w.slaVucarOffered].sort((a, b) => a - b)
        
        return {
          week: w.week,
          totalLeads: w.totalLeads,
          summaryRate: w.totalLeads > 0 ? Math.round((w.withSummary / w.totalLeads) * 100) : 0,
          strongQualifiedRate: w.withSummary > 0 ? Math.round((w.strongQualified / w.withSummary) * 100) : 0,
          negotiationRate: w.withSummary > 0 ? Math.round((w.everNegotiation / w.withSummary) * 100) : 0,
          medianTimeToPriceShared: sortedShared.length > 0 ? Math.round(sortedShared[Math.floor(sortedShared.length / 2)] * 10) / 10 : null,
          medianTimeToVucarOffered: sortedOffered.length > 0 ? Math.round(sortedOffered[Math.floor(sortedOffered.length / 2)] * 10) / 10 : null,
        }
      })


    const byPic = Array.from(picDataMap.values()).map(p => ({
        ...p,
        totalAssignedLeads: assignedPerPicMap.get(p.picId) || 0,
        aiUtilizationRate: assignedPerPicMap.get(p.picId) ? Math.round((p.totalAiLeads / assignedPerPicMap.get(p.picId)!) * 1000) / 10 : 0,
        aiLeadWinRate: p.totalAiLeads > 0 ? Math.round((p.aiLeadWins / p.totalAiLeads) * 1000) / 10 : 0,
        slaInfoCollectedRate: p.slaInfoCollectedTotal > 0 ? Math.round((p.slaInfoCollectedMet / p.slaInfoCollectedTotal) * 1000) / 10 : 0,
        slaInspectionBookedRate: p.slaInspectionBookedTotal > 0 ? Math.round((p.slaInspectionBookedMet / p.slaInspectionBookedTotal) * 1000) / 10 : 0,
      }))
      .filter(p => p.totalAiLeads > 0 || p.totalAssignedLeads > 0)
      .sort((a, b) => b.totalAiLeads - a.totalAiLeads)

    // Prepare PIC List for frontend filter
    const picListFlat = Array.from(picNameMap.entries()).map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      volume: {
        totalAiLeads,
        aiLeadsWithSummary,
        active: activeLeads,
        closed: closedLeads,
        stageDistribution,
        qualifiedDistribution: {
          strongQualified,
          weakQualified,
          strongQualifiedRate: aiLeadsWithSummary > 0 ? Math.round((strongQualified / aiLeadsWithSummary) * 1000) / 10 : 0,
          weakQualifiedRate: aiLeadsWithSummary > 0 ? Math.round((weakQualified / aiLeadsWithSummary) * 1000) / 10 : 0,
        },
      },
      conversion: {
        stageReachRates,
        stageToStage,
        negotiationAnalysis,
      },
      sla: {
        milestones: slaResults,
        breachRates,
      },
      quality,
      byPic,
      picList: picListFlat,
      weeklyTrends
    })
  } catch (error: any) {
    console.error("[AI Funnel Dashboard API] Error:", error)
    return NextResponse.json({ error: "Failed to fetch dashboard data", details: error?.message }, { status: 500 })
  }
}
