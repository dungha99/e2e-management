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
    const filterPicIdRaw = searchParams.get('picId')
    const filterPicIds = filterPicIdRaw && filterPicIdRaw !== 'all' ? filterPicIdRaw.split(',') : []
    const filterSource = searchParams.get('source')

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
        picList: [],
        sourceList: [],
        weeklyTrends: []
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
        l.phone,
        l.source,
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

    const carMetadataMap = new Map<string, { crmStage: string | null, crmQualified: string | null, picId: string | null, leadId: string | null, additionalImages: any, source: string | null }>()

    for (const row of vucarV2Res.rows) {
      carMetadataMap.set(row.car_id, {
        crmStage: row.crm_stage,
        crmQualified: row.crm_qualified,
        picId: row.pic_id,
        leadId: row.lead_id,
        additionalImages: row.additional_images,
        source: row.source
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
      latestStage: string | null
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
      source: string | null
      snapshots: any[]
      sellerSentiment: string | null
    }

    const leadsMap = new Map<string, LeadData>()

    const summaryByLeadMap = new Map<string, any>()
    for (const row of summaryResRows) {
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

      let aiStage = latestSnapshot?.stage ?? null
      if (aiStage === 'contacted' || aiStage === 'contact') aiStage = 'contacted'

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

      const crmStage = crm?.crmStage ?? null
      const crmQualified = crm?.crmQualified ?? null

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
        source: crm?.source ?? null,
        snapshots,
        sellerSentiment,
      } as any)
    }

    // AI leads without summary
    for (const car_id of aiCarIds) {
      if (!leadsMap.has(car_id)) {
        const crm = carMetadataMap.get(car_id)
        leadsMap.set(car_id, {
          carId: car_id,
          hasSummary: false,
          latestStage: null,
          aiStage: null,
          crmStage: crm?.crmStage ?? null,
          crmQualified: crm?.crmQualified ?? null,
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
          picId: crm?.picId ?? null,
          source: crm?.source ?? null,
          snapshots: [],
          sellerSentiment: null,
        })
      }
    }

    const unfilteredLeads = Array.from(leadsMap.values())

    // ============================================================
    // PRE-CALC: Total Assigned Leads for Baselines
    // ============================================================
    let totalAssignedQuery = `
      SELECT 
        l.pic_id, 
        l.source, 
        COUNT(l.id) as total_assigned,
        COUNT(l.id) FILTER (WHERE ss.qualified IN ('STRONG_QUALIFIED', 'WEAK_QUALIFIED')) as qualified_assigned
      FROM leads l
      LEFT JOIN cars c ON c.lead_id = l.id
      LEFT JOIN sale_status ss ON ss.car_id = c.id
      WHERE l.pic_id IS NOT NULL
    `
    const assignedParams: any[] = []
    if (startDate && endDate) {
      totalAssignedQuery += ` AND l.created_at >= $1 AND l.created_at <= $2`
      assignedParams.push(startDate, endDate)
    }
    
    // Apply source filter to baseline if specified
    if (filterSource && filterSource !== 'all') {
      const idx = assignedParams.length + 1
      totalAssignedQuery += ` AND l.source = $${idx}`
      assignedParams.push(filterSource)
    }

    totalAssignedQuery += ` GROUP BY l.pic_id, l.source`
    const assignedRes = await vucarV2Query(totalAssignedQuery, assignedParams)
    
    const assignedPerPicMap = new Map<string, { total: number, qualified: number }>()
    let totalAssignedLeadsCount = 0
    let totalQualifiedAssignedCount = 0

    for (const row of assignedRes.rows) {
      const total = parseInt(row.total_assigned)
      const qualified = parseInt(row.qualified_assigned)
      const picId = row.pic_id
      
      const existing = assignedPerPicMap.get(picId) || { total: 0, qualified: 0 }
      assignedPerPicMap.set(picId, {
        total: existing.total + total,
        qualified: existing.qualified + qualified
      })
      
      // If we are filtering by PIC, only add up that PIC, otherwise add all
      if (filterPicIds.length === 0 || filterPicIds.includes(picId)) {
        totalAssignedLeadsCount += total
        totalQualifiedAssignedCount += qualified
      }
    }

    // Final filter on AI leads
    const leadsMapFiltered = unfilteredLeads.filter(l => {
      const picMatch = filterPicIds.length === 0 || filterPicIds.includes(l.picId || '')
      const sourceMatch = !filterSource || filterSource === 'all' || l.source === filterSource
      return picMatch && sourceMatch
    })

    const leadsWithSummary = leadsMapFiltered.filter(l => l.hasSummary)
    const allLeadsFiltered = leadsMapFiltered
    const activeStages = ['contacted', 'negotiation', 'inspection']

    // ============================================================
    // SECTION 1: Volume
    // ============================================================
    const totalAiLeadsIds = allLeadsFiltered.map(l => l.carId)
    const aiLeadsWithSummaryIds = leadsWithSummary.map(l => l.carId)
    const activeIds = allLeadsFiltered.filter(l => l.latestStage && activeStages.includes(l.latestStage)).map(l => l.carId)
    const closedIds = allLeadsFiltered.filter(l => l.crmStage === 'COMPLETED' || l.crmStage === 'DEPOSIT_PAID').map(l => l.carId)

    const totalAiLeads = totalAiLeadsIds.length
    const aiLeadsWithSummary = aiLeadsWithSummaryIds.length
    const activeLeads = activeIds.length
    const closedLeads = closedIds.length

    const stageCounts: Record<string, { count: number, carIds: string[] }> = {}
    for (const l of leadsWithSummary) {
      const stage = l.latestStage || 'unknown'
      if (!stageCounts[stage]) stageCounts[stage] = { count: 0, carIds: [] }
      stageCounts[stage].count++
      stageCounts[stage].carIds.push(l.carId)
    }
    const stageDistribution = [
      { stage: 'totalAssigned', count: totalAssignedLeadsCount, percentage: 100, carIds: [] },
      ...Object.entries(stageCounts).map(([stage, { count, carIds }]) => ({
        stage,
        count,
        percentage: totalAssignedLeadsCount > 0 ? Math.round((count / totalAssignedLeadsCount) * 1000) / 10 : 0,
        carIds,
      }))
    ]

    const strongQualifiedIds = leadsWithSummary.filter(l => l.hadCarImage).map(l => l.carId)
    const weakQualifiedIds = leadsWithSummary.filter(l => !l.hadCarImage).map(l => l.carId)
    const strongQualified = strongQualifiedIds.length
    const weakQualified = weakQualifiedIds.length

    // ============================================================
    // SECTION 2: Funnel Conversion
    // ============================================================
    const stageReachCounts: Record<string, Set<string>> = {
      contacted: new Set(),
      negotiation: new Set(),
      inspection: new Set(),
    }

    for (const l of leadsWithSummary) {
      stageReachCounts['contacted'].add(l.carId)
      for (const snap of l.snapshots) {
        if (snap.stage === 'negotiation' || snap.price_customer != null) stageReachCounts['negotiation'].add(l.carId)
        if (snap.stage === 'inspection' || snap.inspection_booked_at != null) stageReachCounts['inspection'].add(l.carId)
      }
    }

    const closedSet = new Set(closedIds)
    
    const stageReachRates = [
      { stage: 'totalAssigned', count: totalAssignedLeadsCount, rate: 100, carIds: [] },
      { stage: 'totalAi', count: totalAiLeads, rate: totalAssignedLeadsCount > 0 ? Math.round((totalAiLeads / totalAssignedLeadsCount) * 1000) / 10 : 0, carIds: totalAiLeadsIds },
      { stage: 'summary', count: aiLeadsWithSummary, rate: totalAssignedLeadsCount > 0 ? Math.round((aiLeadsWithSummary / totalAssignedLeadsCount) * 1000) / 10 : 0, carIds: aiLeadsWithSummaryIds },
      { stage: 'contacted', count: stageReachCounts['contacted'].size, rate: totalAssignedLeadsCount > 0 ? Math.round((stageReachCounts['contacted'].size / totalAssignedLeadsCount) * 1000) / 10 : 0, carIds: Array.from(stageReachCounts['contacted']) },
      { stage: 'qualified', count: strongQualified, rate: totalAssignedLeadsCount > 0 ? Math.round((strongQualified / totalAssignedLeadsCount) * 1000) / 10 : 0, carIds: strongQualifiedIds },
      { stage: 'negotiation', count: stageReachCounts['negotiation'].size, rate: totalAssignedLeadsCount > 0 ? Math.round((stageReachCounts['negotiation'].size / totalAssignedLeadsCount) * 1000) / 10 : 0, carIds: Array.from(stageReachCounts['negotiation']) },
      { stage: 'inspection', count: stageReachCounts['inspection'].size, rate: totalAssignedLeadsCount > 0 ? Math.round((stageReachCounts['inspection'].size / totalAssignedLeadsCount) * 1000) / 10 : 0, carIds: Array.from(stageReachCounts['inspection']) },
      { stage: 'closed', count: closedSet.size, rate: totalAssignedLeadsCount > 0 ? Math.round((closedSet.size / totalAssignedLeadsCount) * 1000) / 10 : 0, carIds: Array.from(closedSet) }
    ]

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

    const leadsWithPrice = leadsWithSummary.filter(l => l.priceCustomer != null || l.priceVucarOffered != null)
    const leadsWithMultiRounds = leadsWithPrice.filter(l => l.negotiationRounds >= 2)
    const leadsWithSinglePrice = leadsWithPrice.filter(l => l.negotiationRounds < 2)

    const priceReductions: number[] = []
    for (const l of leadsWithSummary) {
      if (l.snapshots.length < 2) continue
      const prices = l.snapshots.map((s: any) => s.price_customer ? parseInt(s.price_customer) : null).filter((p: number | null): p is number => p != null)
      if (prices.length >= 2 && prices[0] > prices[prices.length - 1]) {
        priceReductions.push((prices[0] - prices[prices.length - 1]) / prices[0])
      }
    }

    const maxNegotiationRounds = Math.max(0, ...leadsWithSummary.map(l => l.negotiationRounds))
    const avgPriceReduction = priceReductions.length > 0 ? Math.round(priceReductions.reduce((a, b) => a + b, 0) / priceReductions.length * 1000) / 10 : 0

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
    const slaMilestones: { name: string, values: number[], target: number, unit: string }[] = [
      { name: 'Time to Info Collected', values: [], target: 24, unit: 'hours' },
      { name: 'Time to Price Shared', values: [], target: 24, unit: 'hours' },
      { name: 'Time to Vucar Price Offered', values: [], target: 4, unit: 'hours' },
      { name: 'Time to Inspection Booked', values: [], target: 48, unit: 'hours' },
      { name: 'Lead Cycle Time (active)', values: [], target: 480, unit: 'hours' },
    ]

    for (const l of leadsWithSummary) {
      const startedAt = l.workflowStartedAt
      if (l.infoCollectedAt && startedAt) {
        const hours = (new Date(l.infoCollectedAt).getTime() - startedAt.getTime()) / 3600000
        if (hours >= 0) slaMilestones[0].values.push(hours)
      }
      if (l.priceSharedAt && startedAt) {
        const hours = (new Date(l.priceSharedAt).getTime() - startedAt.getTime()) / 3600000
        if (hours >= 0) slaMilestones[1].values.push(hours)
      }
      if (l.priceVucarOfferedAt && l.priceSharedAt) {
        const hours = (new Date(l.priceVucarOfferedAt).getTime() - new Date(l.priceSharedAt).getTime()) / 3600000
        if (hours >= 0) slaMilestones[2].values.push(hours)
      }
      if (l.inspectionBookedAt && l.infoCollectedAt) {
        const hours = (new Date(l.inspectionBookedAt).getTime() - new Date(l.infoCollectedAt).getTime()) / 3600000
        if (hours >= 0) slaMilestones[3].values.push(hours)
      }
      if (l.spCreatedAt && l.spUpdatedAt) {
        const hours = (new Date(l.spUpdatedAt).getTime() - new Date(l.spCreatedAt).getTime()) / 3600000
        if (hours >= 0) slaMilestones[4].values.push(hours)
      }
    }

    function calcStats(values: number[]) {
      if (values.length === 0) return { median: null, p90: null, avg: null, count: 0 }
      const sorted = [...values].sort((a, b) => a - b)
      return {
        median: Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10,
        p90: Math.round(sorted[Math.floor(sorted.length * 0.9)] * 10) / 10,
        avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
        count: values.length,
      }
    }
    const slaResults = slaMilestones.map(m => ({ name: m.name, target: m.target, unit: m.unit, ...calcStats(m.values) }))

    // ============================================================
    // SECTION 4: AI Quality
    // ============================================================
    const activeOrNegotiatingLeads = leadsWithSummary.filter(l => l.latestStage && activeStages.includes(l.latestStage))
    const avgNegotiationRounds = activeOrNegotiatingLeads.length > 0 ? Math.round((activeOrNegotiatingLeads.reduce((sum, l) => sum + l.negotiationRounds, 0) / activeOrNegotiatingLeads.length) * 10) / 10 : 0
    const priceGaps = leadsWithSummary.filter(l => l.priceCustomer != null && l.priceVucarOffered != null).map(l => l.priceCustomer! - l.priceVucarOffered!)
    const avgPriceGap = priceGaps.length > 0 ? Math.round(priceGaps.reduce((a, b) => a + b, 0) / priceGaps.length) : null

    const nowMs = Date.now()
    const ghostedActiveLeads = leadsWithSummary.filter(l => l.latestStage && activeStages.includes(l.latestStage) && l.spUpdatedAt && (nowMs - new Date(l.spUpdatedAt).getTime() > 48 * 3600000)).length
    const ghostingRate = activeLeads > 0 ? (ghostedActiveLeads / activeLeads) * 100 : 0

    let convergenceRounds = { round1: 0, round2: 0, round3Plus: 0 }
    let totalConverged = 0
    for (const l of leadsWithSummary) {
      let pricesSeen = 0
      for (const snap of l.snapshots) {
        const pc = snap.price_customer ? parseInt(snap.price_customer) : null
        const pv = snap.price_vucar_offered ? parseInt(snap.price_vucar_offered) : null
        if (pc != null || pv != null) pricesSeen++
        if (pc != null && pv != null && pc > 0 && ((pc - pv) / pc <= 0.05)) {
          totalConverged++
          if (pricesSeen === 1) convergenceRounds.round1++
          else if (pricesSeen === 2) convergenceRounds.round2++
          else convergenceRounds.round3Plus++
          break
        }
      }
    }

    let everGhosted = 0, recoveredGhosts = 0
    for (const l of leadsWithSummary) {
      let hasGap = false, recovered = false
      for (let i = 1; i < l.snapshots.length; i++) {
        if ((new Date(l.snapshots[i].created_at || l.spUpdatedAt).getTime() - new Date(l.snapshots[i - 1].created_at || l.spCreatedAt).getTime()) > 48 * 3600000) {
          hasGap = true; recovered = true
        }
      }
      if (hasGap || (l.latestStage && activeStages.includes(l.latestStage) && l.spUpdatedAt && (nowMs - new Date(l.spUpdatedAt).getTime() > 48 * 3600000))) {
        everGhosted++; if (recovered) recoveredGhosts++
      }
    }
    const reactivationRate = everGhosted > 0 ? (recoveredGhosts / everGhosted) * 100 : 0

    const leadsWithSentiment = leadsWithSummary.filter(l => l.sellerSentiment)
    const totalWithSentiment = leadsWithSentiment.length
    const sentimentCounts: Record<string, { count: number, carIds: string[] }> = { willing: {count:0,carIds:[]}, hesitant: {count:0,carIds:[]}, want_human: {count:0,carIds:[]}, angry: {count:0,carIds:[]}, ghosting: {count:0,carIds:[]}, bot_detected: {count:0,carIds:[]} }
    leadsWithSentiment.forEach(l => { if (sentimentCounts[l.sellerSentiment!]) { sentimentCounts[l.sellerSentiment!].count++; sentimentCounts[l.sellerSentiment!].carIds.push(l.carId) } })

    const sentimentStageMap: Record<string, Record<string, number>> = {}
    leadsWithSentiment.forEach(l => {
      const s = l.sellerSentiment!, stage = l.latestStage || 'unknown'
      if (!sentimentStageMap[stage]) sentimentStageMap[stage] = {}
      sentimentStageMap[stage][s] = (sentimentStageMap[stage][s] || 0) + 1
    })

    const escCount = (sentimentCounts.angry.count + sentimentCounts.want_human.count + sentimentCounts.bot_detected.count)
    const quality = {
      strongQualifiedRate: aiLeadsWithSummary > 0 ? Math.round((strongQualified / aiLeadsWithSummary) * 1000) / 10 : 0,
      avgNegotiationRounds,
      leadsWithPriceReduction: priceReductions.length,
      avgPriceReductionPercent: avgPriceReduction,
      avgPriceGap,
      ghostingRate,
      reactivationRate,
      convergenceTotal: totalConverged,
      convergenceRounds,
      sentiment: {
        distribution: Object.entries(sentimentCounts).map(([name, val]) => ({ name, value: val.count, pct: totalWithSentiment > 0 ? Math.round((val.count / totalWithSentiment) * 100) : 0, carIds: val.carIds })),
        escalation: { rate: totalWithSentiment > 0 ? Math.round((escCount / totalWithSentiment) * 1000) / 10 : 0, total: totalWithSentiment, escalated: escCount, angry: sentimentCounts.angry.count, wantHuman: sentimentCounts.want_human.count, botDetected: sentimentCounts.bot_detected.count }
      }
    }

    // ============================================================
    // SECTION 5: PIC Leaderboard
    // ============================================================
    const picIdSet = new Set(unfilteredLeads.map(l => l.picId).filter(Boolean))
    const picIdsForList = Array.from(picIdSet) as string[]
    let picNameMap = new Map<string, string>()
    if (picIdsForList.length > 0) {
      const picRes = await vucarV2Query(`SELECT id, user_name FROM users WHERE id = ANY($1::uuid[])`, [picIdsForList])
      for (const row of picRes.rows) picNameMap.set(row.id, row.user_name)
    }

    const picDataMap = new Map<string, any>()
    for (const l of unfilteredLeads) {
      if (!l.picId) continue
      if (!picDataMap.has(l.picId)) {
        picDataMap.set(l.picId, { picId: l.picId, picName: picNameMap.get(l.picId) || 'Unknown', totalAiLeads: 0, aiLeadWins: 0, slaInfoCollectedMet: 0, slaInfoCollectedTotal: 0, slaInspectionBookedMet: 0, slaInspectionBookedTotal: 0 })
      }
      const pd = picDataMap.get(l.picId)
      pd.totalAiLeads++
      if (l.latestStage === 'completed' || l.latestStage === 'deposited') pd.aiLeadWins++
      if (l.infoCollectedAt && l.workflowStartedAt) {
        const h = (new Date(l.infoCollectedAt).getTime() - l.workflowStartedAt.getTime()) / 3600000
        if (h >= 0) { pd.slaInfoCollectedTotal++; if (h <= 24) pd.slaInfoCollectedMet++ }
      }
      if (l.inspectionBookedAt && l.infoCollectedAt) {
        const h = (new Date(l.inspectionBookedAt).getTime() - new Date(l.infoCollectedAt).getTime()) / 3600000
        if (h >= 0) { pd.slaInspectionBookedTotal++; if (h <= 48) pd.slaInspectionBookedMet++ }
      }
    }

    const byPic = Array.from(picDataMap.values()).map(pd => {
      const assigned = assignedPerPicMap.get(pd.picId) || { total: 0, qualified: 0 }
      return {
        ...pd,
        totalAssignedLeads: assigned.total,
        totalQualifiedLeads: assigned.qualified,
        aiLeadWinRate: pd.totalAiLeads > 0 ? Math.round((pd.aiLeadWins / pd.totalAiLeads) * 1000) / 10 : 0,
        aiUtilizationRate: assigned.total > 0 ? Math.round((pd.totalAiLeads / assigned.total) * 1000) / 10 : 0,
        aiUtlOverQualifiedRate: assigned.qualified > 0 ? Math.round((pd.totalAiLeads / assigned.qualified) * 1000) / 10 : 0,
        slaInfoCollectedRate: pd.slaInfoCollectedTotal > 0 ? Math.round((pd.slaInfoCollectedMet / pd.slaInfoCollectedTotal) * 1000) / 10 : 0,
        slaInspectionBookedRate: pd.slaInspectionBookedTotal > 0 ? Math.round((pd.slaInspectionBookedMet / pd.slaInspectionBookedTotal) * 1000) / 10 : 0,
      }
    })

    const PIC_FOR_LIST = Array.from(picNameMap.entries()).map(([id, name]) => ({ id, name })).sort((a,b) => a.name.localeCompare(b.name))

    const trendsMap: Map<string, any> = new Map()
    for (const l of unfilteredLeads) {
      if (!l.workflowStartedAt) continue
      const d = new Date(l.workflowStartedAt); d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1))
      const key = d.toISOString().split('T')[0]
      if (!trendsMap.has(key)) trendsMap.set(key, { week: key, totalLeads: 0, strongQualified: 0, summaryLeads: 0 })
      const tw = trendsMap.get(key)
      tw.totalLeads++
      if (l.hasSummary) tw.summaryLeads++
      if (l.isStrongQualified) tw.strongQualified++
    }
    const weeklyTrends = Array.from(trendsMap.values()).sort((a,b) => a.week.localeCompare(b.week)).map(tw => ({
      ...tw,
      strongQualifiedRate: tw.summaryLeads > 0 ? Math.round((tw.strongQualified / tw.summaryLeads) * 100) : 0
    }))

    const sourceListRes = await vucarV2Query(`SELECT DISTINCT source FROM leads WHERE source IS NOT NULL AND source != ''`)
    const sourceList = sourceListRes.rows.map(r => r.source).sort()

    // ============================================================
    // SECTION 6: User Feedback (User Context)
    // ============================================================
    const FEEDBACK_SYSTEM_FILTERS = `
      AND o.user_feedback NOT LIKE '[Phân tích Chat]%'
      AND o.user_feedback NOT LIKE '[Auto-Evaluation]%'
      AND o.user_feedback NOT LIKE 'Negative Rating'
    `
    
    // 6.1 Feedback Metrics
    let feedbackMetricsQuery = `
      SELECT
          COUNT(*)                    AS total_feedback_records,
          COUNT(DISTINCT a.car_id)    AS total_cars_with_feedback
      FROM old_ai_insights o
      JOIN ai_insights a ON o.ai_insight_id = a.id
      WHERE o.user_feedback IS NOT NULL
        ${FEEDBACK_SYSTEM_FILTERS}
    `
    const feedbackParams: any[] = []
    if (startDate && endDate) {
      feedbackMetricsQuery += ` AND o.created_at >= $1 AND o.created_at <= $2`
      feedbackParams.push(startDate, endDate)
    }

    const feedbackMetricsRes = await e2eQuery(feedbackMetricsQuery, feedbackParams)
    const totalFeedbackRecords = parseInt(feedbackMetricsRes.rows[0]?.total_feedback_records || '0')
    const totalCarsWithFeedback = parseInt(feedbackMetricsRes.rows[0]?.total_cars_with_feedback || '0')

    // 6.2 Latest Feedback per Car
    let latestFeedbackQuery = `
      SELECT DISTINCT ON (a.car_id)
          a.car_id,
          o.user_feedback,
          o.created_at
      FROM old_ai_insights o
      JOIN ai_insights a ON o.ai_insight_id = a.id
      WHERE o.user_feedback IS NOT NULL
        ${FEEDBACK_SYSTEM_FILTERS}
    `
    const latestFeedbackParams: any[] = []
    if (startDate && endDate) {
      latestFeedbackQuery += ` AND o.created_at >= $1 AND o.created_at <= $2`
      latestFeedbackParams.push(startDate, endDate)
    }
    latestFeedbackQuery += ` ORDER BY a.car_id, o.created_at DESC`

    const latestFeedbackRes = await e2eQuery(latestFeedbackQuery, latestFeedbackParams)
    const feedbackDetailsRaw = latestFeedbackRes.rows

    // 6.3 Cross-DB: Get Stages for Feedback Cars
    const feedbackCarIds = feedbackDetailsRaw.map(r => r.car_id)
    let feedbackByStage: Record<string, { count: number, carIds: string[] }> = {}
    let feedbackDetails: any[] = []

    if (feedbackCarIds.length > 0) {
      const fbCrmRes = await vucarV2Query(`
        SELECT 
          c.id as car_id,
          ss.stage,
          u.user_name as pic_name
        FROM cars c
        LEFT JOIN leads l ON l.id = c.lead_id
        LEFT JOIN users u ON u.id = l.pic_id
        LEFT JOIN LATERAL (
          SELECT stage FROM sale_status
          WHERE car_id = c.id
          ORDER BY updated_at DESC
          LIMIT 1
        ) ss ON true
        WHERE c.id = ANY($1::uuid[])
      `, [feedbackCarIds])

      const fbCrmMap = new Map<string, { stage: string, picName: string }>()
      for (const row of fbCrmRes.rows) {
        fbCrmMap.set(row.car_id, {
          stage: row.stage || 'UNKNOWN',
          picName: row.pic_name || 'Unknown'
        })
      }

      for (const row of feedbackDetailsRaw) {
        const crmInfo = fbCrmMap.get(row.car_id)
        const stage = crmInfo?.stage || 'UNKNOWN'
        
        // Distribution
        if (!feedbackByStage[stage]) feedbackByStage[stage] = { count: 0, carIds: [] }
        feedbackByStage[stage].count++
        feedbackByStage[stage].carIds.push(row.car_id)

        // Details for table
        feedbackDetails.push({
          carId: row.car_id,
          feedback: row.user_feedback,
          createdAt: row.created_at,
          stage: stage,
          picName: crmInfo?.picName || 'Unknown'
        })
      }
    }

    const feedbackDistribution = Object.entries(feedbackByStage).map(([stage, info]) => ({
      stage,
      count: info.count,
      carIds: info.carIds,
      pct: totalCarsWithFeedback > 0 ? Math.round((info.count / totalCarsWithFeedback) * 1000) / 10 : 0
    })).sort((a,b) => b.count - a.count)

    return NextResponse.json({
      volume: { totalAiLeads, totalAiLeadsIds, aiLeadsWithSummary, aiLeadsWithSummaryIds, active: activeLeads, activeIds, closed: closedLeads, closedIds, stageDistribution, qualifiedDistribution: { strongQualified, strongQualifiedIds, weakQualified, weakQualifiedIds, strongQualifiedRate: quality.strongQualifiedRate } },
      conversion: { stageReachRates, stageToStage, negotiationAnalysis },
      sla: { milestones: slaResults, breachRates: [] },
      quality,
      byPic,
      picList: PIC_FOR_LIST,
      sourceList,
      weeklyTrends,
      feedback: {
        metrics: { totalRecords: totalFeedbackRecords, totalCars: totalCarsWithFeedback },
        distribution: feedbackDistribution,
        details: feedbackDetails
      }
    })
  } catch (error: any) {
    console.error("[AI Funnel Dashboard API] Error:", error)
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 })
  }
}
