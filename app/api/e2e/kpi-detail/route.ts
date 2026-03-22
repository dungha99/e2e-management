import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/e2e/kpi-detail?pic_id=xxx&metric=UNDEFINED_QUALIFIED|NO_ZALO_ACTION|BLOCKED_STRANGER|...
 *     [&search=...&sources=zalo,facebook&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD]
 *
 * Returns: { leads: Array<{ phone, name, car_id, brand, model, year, car_created_at, zaloError? }> }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const picId = searchParams.get("pic_id")
    const metric = searchParams.get("metric")
    const search = searchParams.get("search") || ""
    const sources = searchParams.get("sources")?.split(",").filter(Boolean) || []
    const dateFrom = searchParams.get("dateFrom") || ""
    const dateTo = searchParams.get("dateTo") || ""

    if (!picId || !metric) {
      return NextResponse.json({ error: "pic_id and metric are required" }, { status: 400 })
    }

    // ── Build dynamic WHERE clauses ─────────────────────────────────────────
    const conditions = [`l.pic_id = $1`]
    const params: any[] = [picId]
    let idx = 2

    if (search) {
      conditions.push(`(l.name ILIKE $${idx} OR l.phone ILIKE $${idx} OR l.additional_phone ILIKE $${idx})`)
      params.push(`%${search}%`)
      idx++
    }
    if (sources.length > 0) {
      conditions.push(`l.source = ANY($${idx}::text[])`)
      params.push(sources)
      idx++
    }
    if (dateFrom) {
      conditions.push(`c.created_at >= $${idx}::timestamp`)
      params.push(`${dateFrom}T00:00:00`)
      idx++
    }
    if (dateTo) {
      conditions.push(`c.created_at <= $${idx}::timestamp`)
      params.push(`${dateTo}T23:59:59`)
      idx++
    }

    const filterWhere = conditions.join(" AND ")

    // ── FUNNEL METRICS (Tiers 1, 2) ──────────────────────────────────────────
    if (metric === 'FUNNEL_TOTAL_LEADS' || metric === 'FUNNEL_HAS_IMAGE' || metric === 'FUNNEL_NO_IMAGE') {
      let extraWhere = "";
      if (metric === 'FUNNEL_HAS_IMAGE') extraWhere = " AND ss.qualified = 'STRONG_QUALIFIED'";
      if (metric === 'FUNNEL_NO_IMAGE') extraWhere = " AND (ss.qualified != 'STRONG_QUALIFIED' OR ss.qualified IS NULL)";

      const result = await vucarV2Query(`
        SELECT l.phone, l.additional_phone, l.name, c.id AS car_id,
               c.brand, c.model, c.year, c.created_at AS car_created_at, 
               c.location, c.mileage, ss.notes
        FROM leads l
        LEFT JOIN cars c ON c.lead_id = l.id
        LEFT JOIN sale_status ss ON ss.car_id = c.id
        WHERE ${filterWhere} ${extraWhere}
        ORDER BY l.created_at DESC
        LIMIT 500
      `, params)

      return NextResponse.json({
        leads: result.rows.map((r: any) => ({
          phone: r.phone || r.additional_phone || "N/A",
          name: r.name || "—",
          car_id: r.car_id,
          brand: r.brand,
          model: r.model,
          year: r.year,
          car_created_at: r.car_created_at,
          location: r.location,
          mileage: r.mileage,
          notes: r.notes || "",
        })),
      })
    }

    // ── FUNNEL METRICS (Tier 3 Zalo) ─────────────────────────────────────────
    if (metric === 'FUNNEL_FIRST_MESSAGE_SUCCESS' || metric === 'FUNNEL_NEVER_FIRST_MESSAGE' || metric === 'FUNNEL_FIRST_MESSAGE_FAILED' || metric === 'FUNNEL_BLOCKED_MESSAGE' || metric === 'FUNNEL_SYSTEM_ERROR') {
      const crmRes = await vucarV2Query(`
        SELECT l.phone, l.additional_phone, l.name, c.id AS car_id,
               c.brand, c.model, c.year, c.created_at AS car_created_at,
               c.location, c.mileage, ss.notes
        FROM leads l
        LEFT JOIN cars c ON c.lead_id = l.id
        LEFT JOIN sale_status ss ON ss.car_id = c.id
        WHERE ${filterWhere} AND (ss.qualified != 'STRONG_QUALIFIED' OR ss.qualified IS NULL)
          AND l.phone IS NOT NULL
        ORDER BY l.created_at DESC
        LIMIT 500
      `, params)

      const crmLeads = crmRes.rows;
      const phones = [...new Set(crmLeads.map((r: any) => r.phone).filter(Boolean))];

      if (phones.length === 0) {
        return NextResponse.json({ leads: [] });
      }

      const e2eConditions = [`action_type = 'firstMessage'`];
      const e2eParams: any[] = [];
      let e2eIdx = 1;
      if (dateFrom) { e2eConditions.push(`created_at >= $${e2eIdx}::timestamp`); e2eParams.push(`${dateFrom} 00:00:00`); e2eIdx++; }
      if (dateTo) { e2eConditions.push(`created_at <= $${e2eIdx}::timestamp`); e2eParams.push(`${dateTo} 23:59:59`); e2eIdx++; }

      e2eConditions.push(`COALESCE(payload->>'phone', payload->>'customer_phone') = ANY($${e2eIdx}::text[])`);
      e2eParams.push(phones);

      const zaloRes = await e2eQuery(`
        SELECT
          COALESCE(payload->>'phone', payload->>'customer_phone') AS phone,
          MAX(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS has_success,
          MAX(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END) AS has_failed,
          STRING_AGG(DISTINCT CASE WHEN status = 'failed' THEN COALESCE(payload->>'akabiz_error', payload->>'reason', payload->>'error') END, ' | ') AS fail_reasons
        FROM zalo_action
        WHERE ${e2eConditions.join(" AND ")}
        GROUP BY 1
      `, e2eParams)

      const phoneStatus = new Map(zaloRes.rows.map((r: any) => [r.phone, r]));

      const filteredLeads = crmLeads.filter((r: any) => {
        const status = phoneStatus.get(r.phone);
        if (metric === 'FUNNEL_NEVER_FIRST_MESSAGE') {
          return !status || (status.has_success === 0 && status.has_failed === 0);
        } else if (metric === 'FUNNEL_FIRST_MESSAGE_SUCCESS') {
          return status && status.has_success === 1;
        } else if (metric === 'FUNNEL_FIRST_MESSAGE_FAILED' || metric === 'FUNNEL_BLOCKED_MESSAGE' || metric === 'FUNNEL_SYSTEM_ERROR') {
          if (status && status.has_success === 0 && status.has_failed === 1) {
            if (metric === 'FUNNEL_FIRST_MESSAGE_FAILED') return true;

            const reasons = (status.fail_reasons || "").toLowerCase();
            if (metric === 'FUNNEL_BLOCKED_MESSAGE') {
              return reasons.includes("bạn chưa thể gửi") || reasons.includes("xin lỗi! hiện tại");
            }
            if (metric === 'FUNNEL_SYSTEM_ERROR') {
              return reasons.includes("no uid found") || reasons.includes("request timed out") || reasons.includes("connection reset") || reasons.includes("no staff found");
            }
          }
        }
        return false;
      })

      return NextResponse.json({
        leads: filteredLeads.map((r: any) => ({
          phone: r.phone || r.additional_phone || "N/A",
          name: r.name || "—",
          car_id: r.car_id,
          brand: r.brand,
          model: r.model,
          year: r.year,
          car_created_at: r.car_created_at,
          location: r.location,
          mileage: r.mileage,
          notes: r.notes || "",
        })),
      })
    }

    // ── UNDEFINED_QUALIFIED metric ──────────────────────────────────────────
    if (metric === "UNDEFINED_QUALIFIED") {
      const result = await vucarV2Query(`
        SELECT l.phone, l.additional_phone, l.name, c.id AS car_id,
               c.brand, c.model, c.year, c.created_at AS car_created_at, 
               c.location, c.mileage, ss.notes
        FROM cars c
        LEFT JOIN leads l ON l.id = c.lead_id
        LEFT JOIN sale_status ss ON ss.car_id = c.id
        WHERE ${filterWhere}
          AND ss.qualified = 'UNDEFINED_QUALIFIED'
          AND (ss.stage IS NULL OR ss.stage NOT IN ('FAILED', 'DEPOSIT_PAID', 'COMPLETED'))
        ORDER BY c.created_at DESC
        LIMIT 200
      `, params)

      return NextResponse.json({
        leads: result.rows.map((r: any) => ({
          phone: r.phone || r.additional_phone || "N/A",
          name: r.name || "—",
          car_id: r.car_id,
          brand: r.brand,
          model: r.model,
          year: r.year,
          car_created_at: r.car_created_at,
          location: r.location,
          mileage: r.mileage,
          notes: r.notes || "",
        })),
      })
    }

    // ── Zalo-related metrics (NO_ZALO_ACTION or error categories) ────────────
    // First, get zalo_connect SLA car_ids
    const zaloSlaResult = await e2eQuery(`
      SELECT DISTINCT ON (sl.car_id) sl.car_id
      FROM sla_logging sl
      JOIN sla_rules sr ON sr.id = sl.sla_id
      WHERE sl.status IN ('ongoing', 'failed')
        AND sr.step_key = 'zalo_connect'
      ORDER BY sl.car_id, sl.started_at DESC
    `)
    const allZaloCarIds = zaloSlaResult.rows.map((r: any) => r.car_id as string)

    if (allZaloCarIds.length === 0) {
      return NextResponse.json({ leads: [] })
    }

    // Filter to this PIC's cars
    const picCarsResult = await vucarV2Query(`
      SELECT c.id AS car_id, l.phone, l.additional_phone, l.name,
             c.brand, c.model, c.year, c.created_at AS car_created_at,
             c.location, c.mileage, ss.notes
      FROM cars c
      LEFT JOIN leads l ON l.id = c.lead_id
      LEFT JOIN sale_status ss ON ss.car_id = c.id
      WHERE c.id = ANY($${idx}::uuid[])
        AND ${filterWhere}
        AND (ss.stage IS NULL OR ss.stage NOT IN ('FAILED', 'DEPOSIT_PAID', 'COMPLETED'))
        AND (ss.qualified IS NULL OR ss.qualified NOT IN ('NON_QUALIFIED', 'TEST'))
    `, [...params, allZaloCarIds])

    const picCars = picCarsResult.rows as any[]
    const picCarIds = picCars.map((r: any) => r.car_id as string)

    if (picCarIds.length === 0) {
      return NextResponse.json({ leads: [] })
    }

    // ── NO_ZALO_ACTION: leads with zero zalo_action rows ────────────────────
    if (metric === "NO_ZALO_ACTION") {
      // Find car_ids with no zalo_action
      const noActionResult = await e2eQuery(`
        SELECT unnest($1::uuid[]) AS input_car_id
        EXCEPT
        SELECT DISTINCT zac.car_id
        FROM zalo_account zac
        JOIN zalo_action za ON za.zalo_account_id = zac.id
        WHERE zac.car_id = ANY($1::uuid[])
      `, [picCarIds])

      const noActionCarIds = new Set(noActionResult.rows.map((r: any) => r.input_car_id as string))

      return NextResponse.json({
        leads: picCars
          .filter((r: any) => noActionCarIds.has(r.car_id))
          .map((r: any) => ({
            phone: r.phone || r.additional_phone || "N/A",
            name: r.name || "—",
            car_id: r.car_id,
            brand: r.brand,
            model: r.model,
            year: r.year,
            car_created_at: r.car_created_at,
            notes: r.notes || "",
          })),
      })
    }

    // ── Zalo error category metrics ─────────────────────────────────────────
    // Fetch failed zalo actions
    const zaloErrorResult = await e2eQuery(`
      SELECT za.payload, zac.car_id
      FROM zalo_action za
      JOIN zalo_account zac ON zac.id = za.zalo_account_id
      WHERE zac.car_id = ANY($1::uuid[]) AND za.status = 'failed'
    `, [picCarIds])

    // Categorize and find car_ids matching the requested metric
    const matchingCarIds = new Set<string>()
    for (const row of zaloErrorResult.rows) {
      const category = categorizeZaloError(row.payload)
      if (category === metric) {
        matchingCarIds.add(row.car_id as string)
      }
    }

    return NextResponse.json({
      leads: picCars
        .filter((r: any) => matchingCarIds.has(r.car_id))
        .map((r: any) => ({
          phone: r.phone || r.additional_phone || "N/A",
          name: r.name || "—",
          car_id: r.car_id,
          brand: r.brand,
          model: r.model,
          year: r.year,
          car_created_at: r.car_created_at,
          location: r.location,
          mileage: r.mileage,
          notes: r.notes || "",
        })),
    })
  } catch (error) {
    console.error("[E2E] Error fetching KPI detail:", error)
    return NextResponse.json(
      { error: "Failed to fetch KPI detail", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// ── Zalo error categorization ──────────────────────────────────────────────
function categorizeZaloError(payload: any): string {
  const akabizError = payload?.akabiz_error ?? ""
  const reason = payload?.reason ?? ""
  const error = payload?.error ?? ""
  const raw = akabizError || reason || error || ""
  const lower = raw.toLowerCase()

  if (lower.includes("chặn không nhận tin nhắn từ người lạ")) return "BLOCKED_STRANGER"
  if (lower.includes("không muốn nhận tin nhắn")) return "DECLINED_MESSAGES"
  if (lower.includes("no uid found")) return "NO_UID_FOUND"
  if (lower.includes("contact not found")) return "CONTACT_NOT_FOUND"
  if (lower.includes("timed out") || lower.includes("timeout")) return "TIMEOUT"
  if (lower.includes("search failed") || lower.includes("error getting search")) return "SEARCH_FAILED"
  return "OTHER"
}
