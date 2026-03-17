import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"
import { HITLLead, StepKey, Severity, BlockerType, StepProgress, StepStatus } from "@/components/lead-monitor/types"

export const dynamic = "force-dynamic"

function mapSeverity(severityNum: number): Severity {
  if (severityNum >= 3) return "CRITICAL"
  if (severityNum >= 2) return "WARN"
  return "NORMAL"
}

function extractCarImage(additionalImages: any): string | null {
  let images = additionalImages || {}
  if (typeof images === "string") {
    try { images = JSON.parse(images) } catch { images = {} }
  }
  for (const category of ["outside", "inside", "paper"]) {
    const imgs = images[category]
    if (Array.isArray(imgs) && imgs.length > 0 && imgs[0]?.url) return imgs[0].url
  }
  return null
}

function formatHours(minutes: number): string {
  const hours = Math.max(1, Math.round(Math.abs(minutes) / 60))
  return `${hours} tiếng`
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const picIdFilter = searchParams.get("pic_id")

    // ── 1. Fetch active SLA logs — one per car (latest step) ────────────────
    const slaResult = await e2eQuery(`
      SELECT DISTINCT ON (sl.car_id)
        sl.id                 AS sla_log_id,
        sl.car_id,
        sr.step_key,
        sr.severity,
        sl.status             AS sla_status,
        EXTRACT(EPOCH FROM (
          NOW() - (sl.started_at + sr.sla_duration_hours * INTERVAL '1 hour')
        )) / 60               AS time_overdue_minutes,
        sl.created_at         AS triggered_at
      FROM sla_logging sl
      JOIN sla_rules sr ON sr.id = sl.sla_id
      WHERE sl.status IN ('ongoing', 'failed')
      ORDER BY sl.car_id, sl.started_at DESC
    `)

    const slaRows: any[] = slaResult.rows ?? []
    const slaCarIds = new Set(slaRows.map((r: any) => r.car_id as string))

    // ── 2. Fetch ALL open escalations (not restricted to SLA cars) ──────────
    const escalationResult = await e2eQuery(`
      SELECT DISTINCT ON (cbs.car_id)
        cbs.id                AS blocker_id,
        cbs.car_id,
        el.keywords_matched,
        er.label              AS escalation_label,
        cbs.created_at        AS triggered_at
      FROM car_blocker_status cbs
      JOIN escalation_logging el
        ON el.id = cbs.source_id AND cbs.source_type = 'escalation_logging'
      JOIN escalation_rules er ON er.id = el.escalation_id
      WHERE cbs.status IN ('OPEN', 'IN_PROGRESS')
        AND cbs.blocker_type = 'ESCALATION'
      ORDER BY cbs.car_id, cbs.created_at DESC
    `)

    const escalationMap = new Map<string, any>()
    escalationResult.rows.forEach((r: any) => escalationMap.set(r.car_id, r))

    // Union of SLA car IDs + escalation-only car IDs
    const carIds = [...new Set([...slaCarIds, ...escalationMap.keys()])]
    if (carIds.length === 0) return NextResponse.json([])

    // ── 3. Fetch car + lead + PIC info from VucarV2 ─────────────────────────
    const carParams: any[] = [carIds]
    const picClause = picIdFilter ? `AND l.pic_id = $2` : ""
    if (picIdFilter) carParams.push(picIdFilter)

    const carsResult = await vucarV2Query(`
      SELECT
        c.id              AS car_id,
        c.brand           AS car_brand,
        c.model           AS car_model,
        c.year            AS car_year,
        c.mileage         AS car_odo,
        c.location        AS car_location,
        c.additional_images,
        l.name            AS lead_name,
        l.phone           AS lead_phone,
        l.pic_id,
        u.user_name       AS pic_name,
        ss.price_customer AS price_expected,
        ss.price_highest_bid AS price_max,
        ss.bot_status
      FROM cars c
      LEFT JOIN leads l ON l.id = c.lead_id
      LEFT JOIN users u ON u.id = l.pic_id
      LEFT JOIN sale_status ss ON ss.car_id = c.id
      WHERE c.id = ANY($1::uuid[])
        AND (ss.stage IS NULL OR ss.stage NOT IN ('FAILED', 'DEPOSIT_PAID', 'COMPLETED'))
        AND (ss.qualified IS NULL OR ss.qualified NOT IN ('NON_QUALIFIED', 'TEST'))
      ${picClause}
    `, carParams)

    const carMap = new Map<string, any>()
    carsResult.rows.forEach((r: any) => carMap.set(r.car_id, r))

    // ── 4. Fetch step progress per car ───────────────────────────────────────
    const stepsResult = await e2eQuery(`
      SELECT
        sl.car_id,
        sr.step_key,
        sr.label,
        sl.status,
        CASE
          WHEN sl.status IN ('success', 'terminated') THEN false
          WHEN sl.started_at IS NOT NULL
            AND NOW() > (sl.started_at + sr.sla_duration_hours * INTERVAL '1 hour') THEN true
          ELSE false
        END AS is_overdue
      FROM sla_logging sl
      JOIN sla_rules sr ON sr.id = sl.sla_id
      WHERE sl.car_id = ANY($1::uuid[])
      ORDER BY sl.car_id, sr.step_key
    `, [carIds])

    const STEP_ORDER: StepKey[] = ["zalo_connect", "thu_thap_thong_tin", "dat_lich_kiem_dinh", "dam_phan_1"]
    const stepsMap = new Map<string, StepProgress[]>()
    stepsResult.rows.forEach((r: any) => {
      const list = stepsMap.get(r.car_id) ?? []
      const existing = list.findIndex((s) => s.step_key === r.step_key)
      const step: StepProgress = {
        step_key: r.step_key as StepKey,
        label: r.label ?? r.step_key,
        status: r.status as StepStatus,
        is_overdue: r.is_overdue,
        condition_end_met: false, // populated below
      }
      if (existing >= 0) list[existing] = step
      else list.push(step)
      stepsMap.set(r.car_id, list)
    })
    stepsMap.forEach((list, key) => {
      stepsMap.set(key, list.sort((a, b) => STEP_ORDER.indexOf(a.step_key) - STEP_ORDER.indexOf(b.step_key)))
    })

    // ── 4b. Fetch condition_end_met from CRM API for each step in parallel ────
    // Exception: thu_thap_thong_tin derives condition_end_met from cars.additional_images
    const CRM_BASE = "https://crm-vucar-api.vucar.vn/api/v1/lead-monitor"
    const conditionFetches: Promise<void>[] = []
    stepsMap.forEach((steps, carId) => {
      steps.forEach((step) => {
        if (step.step_key === "thu_thap_thong_tin") {
          const car = carMap.get(carId)
          step.condition_end_met = !!extractCarImage(car?.additional_images)
          return
        }
        const path = step.step_key.replace(/_/g, "-")
        conditionFetches.push(
          fetch(`${CRM_BASE}/${path}/${carId}/success`, { method: "POST" })
            .then((res) => res.ok ? res.json() : null)
            .then((data) => { if (data) step.condition_end_met = data.condition_end_met === true })
            .catch(() => {})
        )
      })
    })
    await Promise.all(conditionFetches)

    // ── 5. Build one HITLLead per car ─────────────────────────────────────────
    const leads: HITLLead[] = []
    const processedCarIds = new Set<string>()

    function buildCarBlock(car: any) {
      return {
        model: [car.car_brand, car.car_model].filter(Boolean).join(" ") || "Unknown",
        year: car.car_year ? parseInt(car.car_year) : 0,
        odo: car.car_odo ? parseInt(car.car_odo) : null,
        location: car.car_location ?? null,
        price_expected: car.price_expected ? parseFloat(car.price_expected) : null,
        price_max: car.price_max ? parseFloat(car.price_max) : null,
        thumbnail: extractCarImage(car.additional_images),
        has_images: !!extractCarImage(car.additional_images),
      }
    }

    // SLA cars (with optional escalation overlay)
    for (const sla of slaRows) {
      const car = carMap.get(sla.car_id)
      if (!car) continue // PIC filter excluded this car

      processedCarIds.add(sla.car_id)
      const escalation = escalationMap.get(sla.car_id)
      const isEscalation = !!escalation

      const timeOverdue = sla.time_overdue_minutes != null ? parseFloat(sla.time_overdue_minutes) : undefined
      const severity: Severity = isEscalation ? "CRITICAL" : mapSeverity(Number(sla.severity ?? 1))

      let time_string: string | undefined
      if (!isEscalation && timeOverdue != null) {
        time_string = timeOverdue > 0
          ? `Quá hạn ${formatHours(timeOverdue)}`
          : `Còn ${formatHours(-timeOverdue)}`
      }

      leads.push({
        id: isEscalation ? escalation.blocker_id : sla.sla_log_id,
        car_id: sla.car_id,
        pic_id: car.pic_id ?? "",
        pic_name: car.pic_name ?? undefined,
        step_key: isEscalation ? "escalation" : (sla.step_key as StepKey) ?? "zalo_connect",
        customer: { name: car.lead_name ?? "Unknown", avatar: null, phone: car.lead_phone ?? null, location: null },
        car: buildCarBlock(car),
        trigger: {
          type: (isEscalation ? "ESCALATION" : "SLA_BREACH") as BlockerType,
          severity,
          time_string,
          intent: isEscalation ? (escalation.escalation_label ?? "Escalation") : undefined,
          keywords: escalation?.keywords_matched ?? [],
        },
        is_bot_active: car.bot_status === "active",
        triggered_at: isEscalation ? escalation.triggered_at : sla.triggered_at,
        steps: stepsMap.get(sla.car_id) ?? [],
        time_overdue_minutes: timeOverdue,
      })
    }

    // Escalation-only cars (no active sla_logging) — goes straight to escalation column
    for (const [carId, escalation] of escalationMap) {
      if (processedCarIds.has(carId)) continue // already included above
      const car = carMap.get(carId)
      if (!car) continue // PIC filter excluded

      leads.push({
        id: escalation.blocker_id,
        car_id: carId,
        pic_id: car.pic_id ?? "",
        pic_name: car.pic_name ?? undefined,
        step_key: "escalation",
        customer: { name: car.lead_name ?? "Unknown", avatar: null, phone: car.lead_phone ?? null, location: null },
        car: buildCarBlock(car),
        trigger: {
          type: "ESCALATION",
          severity: "CRITICAL",
          intent: escalation.escalation_label ?? "Escalation",
          keywords: escalation.keywords_matched ?? [],
        },
        is_bot_active: car.bot_status === "active",
        triggered_at: escalation.triggered_at,
        steps: stepsMap.get(carId) ?? [],
        time_overdue_minutes: undefined,
      })
    }

    // ── 6. Sort: most overdue → closest to breach → newest LIFO ──────────────
    leads.sort((a, b) => {
      const aOvr = a.time_overdue_minutes ?? -Infinity
      const bOvr = b.time_overdue_minutes ?? -Infinity
      if (aOvr !== bOvr) return bOvr - aOvr // larger overdue first
      // Tiebreak: newest triggered_at first
      return new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
    })

    return NextResponse.json(leads)
  } catch (error) {
    console.error("[Lead Monitor] Error fetching queue:", error)
    return NextResponse.json(
      { error: "Failed to fetch queue", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
