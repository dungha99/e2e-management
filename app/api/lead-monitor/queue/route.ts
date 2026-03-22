import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"
import { HITLLead, StepKey, Severity, BlockerType, StepProgress, StepStatus, PaginatedLeadsResponse, ZaloErrorCategory, ZaloErrorSegment } from "@/components/lead-monitor/types"

export const dynamic = "force-dynamic"

const PAGE_SIZE_DEFAULT = 15
const PAGE_SIZE_MAX = 50

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

// ── Zalo error categorization ──────────────────────────────────────────────
function categorizeZaloError(payload: any): { category: ZaloErrorCategory; detail: string } {
  const akabizError = payload?.akabiz_error ?? ""
  const reason = payload?.reason ?? ""
  const error = payload?.error ?? ""
  const raw = akabizError || reason || error || "Unknown error"

  const lower = raw.toLowerCase()

  if (lower.includes("chặn không nhận tin nhắn từ người lạ"))
    return { category: "BLOCKED_STRANGER", detail: raw }
  if (lower.includes("không muốn nhận tin nhắn"))
    return { category: "DECLINED_MESSAGES", detail: raw }
  if (lower.includes("no uid found"))
    return { category: "NO_UID_FOUND", detail: raw }
  if (lower.includes("contact not found"))
    return { category: "CONTACT_NOT_FOUND", detail: raw }
  if (lower.includes("timed out") || lower.includes("timeout"))
    return { category: "TIMEOUT", detail: raw }
  if (lower.includes("search failed") || lower.includes("error getting search"))
    return { category: "SEARCH_FAILED", detail: raw }

  return { category: "OTHER", detail: raw }
}

async function fetchZaloErrors(carIds: string[]): Promise<Map<string, ZaloErrorSegment[]>> {
  const map = new Map<string, ZaloErrorSegment[]>()
  if (carIds.length === 0) return map

  const result = await e2eQuery(`
    SELECT za.action_type, za.payload, za.created_at, zac.car_id
    FROM zalo_action za
    JOIN zalo_account zac ON zac.id = za.zalo_account_id
    WHERE zac.car_id = ANY($1::uuid[]) AND za.status = 'failed'
    ORDER BY za.created_at DESC
  `, [carIds])

  // Group by car_id + category
  const temp = new Map<string, Map<string, { category: ZaloErrorCategory; action_type: string; count: number; latest_detail: string; latest_at: string }>>()

  for (const row of result.rows) {
    const carId = row.car_id as string
    const { category, detail } = categorizeZaloError(row.payload)
    const key = `${category}:${row.action_type}`

    if (!temp.has(carId)) temp.set(carId, new Map())
    const carMap = temp.get(carId)!

    if (carMap.has(key)) {
      carMap.get(key)!.count++
    } else {
      carMap.set(key, {
        category,
        action_type: row.action_type,
        count: 1,
        latest_detail: detail,
        latest_at: row.created_at,
      })
    }
  }

  temp.forEach((carMap, carId) => {
    map.set(carId, Array.from(carMap.values()))
  })

  return map
}

function formatHours(minutes: number): string {
  const hours = Math.max(1, Math.round(Math.abs(minutes) / 60))
  return `${hours} tiếng`
}

function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id })).toString("base64url")
}

function decodeCursor(cursor: string): { id: string } | null {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const picIdFilter = searchParams.get("pic_id")
    const stepKeyParam = searchParams.get("step_key") as StepKey | null
    const limitParam = parseInt(searchParams.get("limit") ?? String(PAGE_SIZE_DEFAULT))
    const limit = Math.min(Math.max(limitParam, 1), PAGE_SIZE_MAX)
    const cursorParam = searchParams.get("cursor")

    if (stepKeyParam) {
      return await handleColumnPagination(stepKeyParam, picIdFilter, limit, cursorParam)
    }

    // ── Legacy mode: return all leads (kept for backward compat) ─────────────
    return await handleLegacyFull(picIdFilter)
  } catch (error) {
    console.error("[Lead Monitor] Error fetching queue:", error)
    return NextResponse.json(
      { error: "Failed to fetch queue", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// ── Per-column paginated fetch ─────────────────────────────────────────────────
async function handleColumnPagination(
  stepKey: StepKey,
  picIdFilter: string | null,
  limit: number,
  cursorParam: string | null
): Promise<NextResponse> {
  const cursor = cursorParam ? decodeCursor(cursorParam) : null

  // ── 1. Fetch all open escalation car_ids (needed for column routing) ───────
  const escalationCarIdsResult = await e2eQuery(`
    SELECT DISTINCT car_id FROM car_blocker_status
    WHERE blocker_type = 'ESCALATION' AND status IN ('OPEN', 'IN_PROGRESS')
  `)
  const escalationCarIds = new Set<string>(escalationCarIdsResult.rows.map((r: any) => r.car_id))

  // ── 2. Fetch sorted rows for the requested column ──────────────────────────
  let allRows: any[] = []

  if (stepKey === "escalation") {
    // Escalation column: all open escalations
    const escResult = await e2eQuery(`
      SELECT DISTINCT ON (cbs.car_id)
        cbs.id                AS id,
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
    // Sort: newest first, then by id
    allRows = escResult.rows.sort((a: any, b: any) => {
      const tDiff = new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
      if (tDiff !== 0) return tDiff
      return a.id.localeCompare(b.id)
    })
  } else {
    // SLA column: exclude escalation cars (they belong to escalation column)
    const slaResult = await e2eQuery(`
      SELECT * FROM (
        SELECT DISTINCT ON (sl.car_id)
          sl.id                 AS id,
          sl.car_id,
          sr.severity,
          sl.status             AS sla_status,
          EXTRACT(EPOCH FROM (
            NOW() - (sl.started_at + sr.sla_duration_hours * INTERVAL '1 hour')
          )) / 60               AS time_overdue_minutes,
          sl.created_at         AS triggered_at,
          (sl.started_at + sr.sla_duration_hours * INTERVAL '1 hour') AS sla_deadline
        FROM sla_logging sl
        JOIN sla_rules sr ON sr.id = sl.sla_id
        WHERE sl.status IN ('ongoing', 'failed')
          AND sr.step_key = $1
        ORDER BY sl.car_id, sl.started_at DESC
      ) AS latest
    `, [stepKey])

    // Filter out cars that have escalations (they show in escalation column)
    const filtered = slaResult.rows.filter((r: any) => !escalationCarIds.has(r.car_id))

    // Sort: earliest deadline first (= most overdue), then newest triggered_at, then id
    allRows = filtered.sort((a: any, b: any) => {
      if (a.sla_deadline && b.sla_deadline) {
        const deadlineDiff = new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime()
        if (deadlineDiff !== 0) return deadlineDiff
      } else if (a.sla_deadline && !b.sla_deadline) {
        return -1
      } else if (!a.sla_deadline && b.sla_deadline) {
        return 1
      }
      const tDiff = new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
      if (tDiff !== 0) return tDiff
      return a.id.localeCompare(b.id)
    })
  }

  // ── 3. Cross-DB validation BEFORE pagination ──────────────────────────────
  // Query VucarV2 for all car_ids from allRows that pass business rules.
  // This must happen before slice() so pagination counts are accurate.
  const allRowCarIds = allRows.map((r: any) => r.car_id)
  const validCarIds = new Set<string>()

  if (allRowCarIds.length > 0) {
    const validParams: any[] = [allRowCarIds]
    const picClauseValid = picIdFilter ? `AND l.pic_id = $2` : ""
    if (picIdFilter) validParams.push(picIdFilter)

    const validResult = await vucarV2Query(`
      SELECT c.id AS car_id
      FROM cars c
      LEFT JOIN leads l ON l.id = c.lead_id
      LEFT JOIN sale_status ss ON ss.car_id = c.id
      WHERE c.id = ANY($1::uuid[])
        AND (ss.stage IS NULL OR ss.stage NOT IN ('FAILED', 'DEPOSIT_PAID', 'COMPLETED'))
        AND (ss.qualified IS NULL OR ss.qualified NOT IN ('NON_QUALIFIED', 'TEST'))
      ${picClauseValid}
    `, validParams)

    validResult.rows.forEach((r: any) => validCarIds.add(r.car_id))
  }

  const filteredRows = allRows.filter((r: any) => validCarIds.has(r.car_id))
  const total = filteredRows.length

  // ── 4. Paginate on the fully-filtered list ────────────────────────────────
  let startIndex = 0
  if (cursor) {
    const pos = filteredRows.findIndex((r: any) => r.id === cursor.id)
    if (pos >= 0) startIndex = pos + 1
  }

  const pageRows = filteredRows.slice(startIndex, startIndex + limit)
  const hasMore = startIndex + limit < total
  const lastItem = pageRows[pageRows.length - 1]
  const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.id) : null

  if (pageRows.length === 0) {
    return NextResponse.json({ items: [], next_cursor: null, has_more: false, total } satisfies PaginatedLeadsResponse)
  }

  const pageCarIds = pageRows.map((r: any) => r.car_id)

  // ── 5. Fetch full car + lead + PIC info for this page only ────────────────
  // No business-rule filters here — cars already validated in step 3.
  const carsResult = await vucarV2Query(`
    SELECT
      c.id              AS car_id,
      c.brand           AS car_brand,
      c.model           AS car_model,
      c.variant,
      c.plate,
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
      ss.bot_status,
      ss.qualified AS qualified_status
    FROM cars c
    LEFT JOIN leads l ON l.id = c.lead_id
    LEFT JOIN users u ON u.id = l.pic_id
    LEFT JOIN sale_status ss ON ss.car_id = c.id
    WHERE c.id = ANY($1::uuid[])
  `, [pageCarIds])

  const carMap = new Map<string, any>()
  carsResult.rows.forEach((r: any) => carMap.set(r.car_id, r))

  // ── 6. Fetch step progress for page cars ─────────────────────────────────
  const STEP_ORDER: StepKey[] = ["zalo_connect", "thu_thap_thong_tin", "dat_lich_kiem_dinh", "dam_phan_1"]

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
  `, [pageCarIds])

  const stepsMap = new Map<string, StepProgress[]>()
  stepsResult.rows.forEach((r: any) => {
    const list = stepsMap.get(r.car_id) ?? []
    const existing = list.findIndex((s) => s.step_key === r.step_key)
    const step: StepProgress = {
      step_key: r.step_key as StepKey,
      label: r.label ?? r.step_key,
      status: r.status as StepStatus,
      is_overdue: r.is_overdue,
      condition_end_met: false,
    }
    if (existing >= 0) list[existing] = step
    else list.push(step)
    stepsMap.set(r.car_id, list)
  })
  stepsMap.forEach((list, key) => {
    stepsMap.set(key, list.sort((a, b) => STEP_ORDER.indexOf(a.step_key) - STEP_ORDER.indexOf(b.step_key)))
  })

  // ── 7. Fetch CRM condition details for page cars only ─────────────────────
  const CRM_BASE = "https://crm-vucar-api.vucar.vn/api/v1/lead-monitor"
  const conditionFetches: Promise<void>[] = []
  stepsMap.forEach((steps, carId) => {
    steps.forEach((step) => {
      const path = step.step_key.replace(/_/g, "-")
      conditionFetches.push(
        fetch(`${CRM_BASE}/${path}/${carId}/success`, { method: "POST" })
          .then((res) => res.ok ? res.json() : null)
          .then((data) => {
            if (!data) return
            step.condition_end_met = data.condition_end_met === true
            if (step.step_key === "thu_thap_thong_tin") {
              const car = carMap.get(carId)
              if (car) car._crm_has_images = data.has_images === true
            }
            if (step.step_key === "dat_lich_kiem_dinh") {
              step.inspection_exists = data.inspection_exists === true
            }
            if (step.step_key === "dam_phan_1") {
              step.price_sold = data.price_sold ?? null
              step.stage = data.stage ?? undefined
            }
          })
          .catch(() => { })
      )
    })
  })
  await Promise.all(conditionFetches)

  // ── 7b. Fetch Zalo errors for zalo_connect step ──────────────────────────
  const zaloErrorsMap = stepKey === "zalo_connect"
    ? await fetchZaloErrors(pageCarIds)
    : new Map<string, ZaloErrorSegment[]>()

  // ── 8. Build HITLLeads for page ───────────────────────────────────────────
  function buildCarBlock(car: any) {
    const thumbnail = extractCarImage(car.additional_images)
    return {
      brand: car.car_brand ?? null,
      model: car.car_model || "Unknown",
      variant: car.variant ?? null,
      plate: car.plate ?? null,
      year: car.car_year ? parseInt(car.car_year) : 0,
      odo: car.car_odo ? parseInt(car.car_odo) : null,
      location: car.car_location ?? null,
      price_expected: car.price_expected ? parseFloat(car.price_expected) : null,
      price_max: car.price_max ? parseFloat(car.price_max) : null,
      thumbnail,
      has_images: car._crm_has_images ?? !!thumbnail,
    }
  }

  const items: HITLLead[] = []

  if (stepKey === "escalation") {
    // Fetch SLA data for escalation cars (for time_overdue_minutes if applicable)
    const slaOverlayResult = await e2eQuery(`
      SELECT DISTINCT ON (sl.car_id)
        sl.car_id,
        EXTRACT(EPOCH FROM (
          NOW() - (sl.started_at + sr.sla_duration_hours * INTERVAL '1 hour')
        )) / 60 AS time_overdue_minutes
      FROM sla_logging sl
      JOIN sla_rules sr ON sr.id = sl.sla_id
      WHERE sl.status IN ('ongoing', 'failed')
        AND sl.car_id = ANY($1::uuid[])
      ORDER BY sl.car_id, sl.started_at DESC
    `, [pageCarIds])

    const slaOverlayMap = new Map<string, number>()
    slaOverlayResult.rows.forEach((r: any) => {
      slaOverlayMap.set(r.car_id, parseFloat(r.time_overdue_minutes))
    })

    for (const row of pageRows) {
      const car = carMap.get(row.car_id)
      if (!car) continue
      items.push({
        id: row.id,
        car_id: row.car_id,
        pic_id: car.pic_id ?? "",
        pic_name: car.pic_name ?? undefined,
        step_key: "escalation",
        customer: { name: car.lead_name ?? "Unknown", avatar: null, phone: car.lead_phone ?? null, location: null },
        car: buildCarBlock(car),
        trigger: {
          type: "ESCALATION" as BlockerType,
          severity: "CRITICAL",
          intent: row.escalation_label ?? "Escalation",
          keywords: row.keywords_matched ?? [],
        },
        is_bot_active: car.bot_status === "active",
        qualified_status: car.qualified_status ?? null,
        triggered_at: row.triggered_at,
        steps: stepsMap.get(row.car_id) ?? [],
        time_overdue_minutes: slaOverlayMap.get(row.car_id),
      })
    }
  } else {
    for (const row of pageRows) {
      const car = carMap.get(row.car_id)
      if (!car) continue
      const timeOverdue = row.time_overdue_minutes != null ? parseFloat(row.time_overdue_minutes) : undefined
      const severity: Severity = mapSeverity(Number(row.severity ?? 1))
      const time_string = timeOverdue != null
        ? (timeOverdue > 0 ? `Quá hạn ${formatHours(timeOverdue)}` : `Còn ${formatHours(-timeOverdue)}`)
        : undefined

      items.push({
        id: row.id,
        car_id: row.car_id,
        pic_id: car.pic_id ?? "",
        pic_name: car.pic_name ?? undefined,
        step_key: stepKey,
        customer: { name: car.lead_name ?? "Unknown", avatar: null, phone: car.lead_phone ?? null, location: null },
        car: buildCarBlock(car),
        trigger: {
          type: "SLA_BREACH" as BlockerType,
          severity,
          time_string,
        },
        is_bot_active: car.bot_status === "active",
        qualified_status: car.qualified_status ?? null,
        triggered_at: row.triggered_at,
        steps: stepsMap.get(row.car_id) ?? [],
        time_overdue_minutes: timeOverdue,
        zalo_errors: zaloErrorsMap.get(row.car_id),
      })
    }
  }

  return NextResponse.json({ items, next_cursor: nextCursor, has_more: hasMore, total } satisfies PaginatedLeadsResponse)
}

// ── Legacy full-load mode (all steps, no pagination) ─────────────────────────
async function handleLegacyFull(picIdFilter: string | null): Promise<NextResponse> {
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

  const carIds = [...new Set([...slaCarIds, ...escalationMap.keys()])]
  if (carIds.length === 0) return NextResponse.json([])

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
      ss.bot_status,
      ss.qualified AS qualified_status
    FROM cars c
    LEFT JOIN leads l ON l.id = c.lead_id
    LEFT JOIN users u ON u.id = l.pic_id
    LEFT JOIN sale_status ss ON ss.car_id = c.id
    WHERE c.id = ANY($1::uuid[])
    ${picClause}
  `, carParams)

  const carMap = new Map<string, any>()
  carsResult.rows.forEach((r: any) => carMap.set(r.car_id, r))

  const STEP_ORDER: StepKey[] = ["zalo_connect", "thu_thap_thong_tin", "dat_lich_kiem_dinh", "dam_phan_1"]

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

  const stepsMap = new Map<string, StepProgress[]>()
  stepsResult.rows.forEach((r: any) => {
    const list = stepsMap.get(r.car_id) ?? []
    const existing = list.findIndex((s) => s.step_key === r.step_key)
    const step: StepProgress = {
      step_key: r.step_key as StepKey,
      label: r.label ?? r.step_key,
      status: r.status as StepStatus,
      is_overdue: r.is_overdue,
      condition_end_met: false,
    }
    if (existing >= 0) list[existing] = step
    else list.push(step)
    stepsMap.set(r.car_id, list)
  })
  stepsMap.forEach((list, key) => {
    stepsMap.set(key, list.sort((a, b) => STEP_ORDER.indexOf(a.step_key) - STEP_ORDER.indexOf(b.step_key)))
  })

  const CRM_BASE = "https://crm-vucar-api.vucar.vn/api/v1/lead-monitor"
  const conditionFetches: Promise<void>[] = []
  stepsMap.forEach((steps, carId) => {
    steps.forEach((step) => {
      const path = step.step_key.replace(/_/g, "-")
      conditionFetches.push(
        fetch(`${CRM_BASE}/${path}/${carId}/success`, { method: "POST" })
          .then((res) => res.ok ? res.json() : null)
          .then((data) => {
            if (!data) return
            step.condition_end_met = data.condition_end_met === true
            if (step.step_key === "thu_thap_thong_tin") {
              const car = carMap.get(carId)
              if (car) car._crm_has_images = data.has_images === true
            }
            if (step.step_key === "dat_lich_kiem_dinh") {
              step.inspection_exists = data.inspection_exists === true
            }
            if (step.step_key === "dam_phan_1") {
              step.price_sold = data.price_sold ?? null
              step.stage = data.stage ?? undefined
            }
          })
          .catch(() => { })
      )
    })
  })
  await Promise.all(conditionFetches)

  // ── Fetch Zalo errors for zalo_connect leads ────────────────────────────
  const zaloConnectCarIds = slaRows
    .filter((r: any) => r.step_key === "zalo_connect")
    .map((r: any) => r.car_id as string)
  const zaloErrorsMapLegacy = await fetchZaloErrors(zaloConnectCarIds)

  function buildCarBlock(car: any) {
    const thumbnail = extractCarImage(car.additional_images)
    return {
      model: [car.car_brand, car.car_model].filter(Boolean).join(" ") || "Unknown",
      year: car.car_year ? parseInt(car.car_year) : 0,
      odo: car.car_odo ? parseInt(car.car_odo) : null,
      location: car.car_location ?? null,
      price_expected: car.price_expected ? parseFloat(car.price_expected) : null,
      price_max: car.price_max ? parseFloat(car.price_max) : null,
      thumbnail,
      has_images: car._crm_has_images ?? !!thumbnail,
    }
  }

  const leads: HITLLead[] = []
  const processedCarIds = new Set<string>()

  for (const sla of slaRows) {
    const car = carMap.get(sla.car_id)
    if (!car) continue

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
      zalo_errors: zaloErrorsMapLegacy.get(sla.car_id),
    })
  }

  for (const [carId, escalation] of escalationMap) {
    if (processedCarIds.has(carId)) continue
    const car = carMap.get(carId)
    if (!car) continue

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

  leads.sort((a, b) => {
    const aOvr = a.time_overdue_minutes ?? -Infinity
    const bOvr = b.time_overdue_minutes ?? -Infinity
    if (aOvr !== bOvr) return bOvr - aOvr
    return new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
  })

  return NextResponse.json(leads)
}
