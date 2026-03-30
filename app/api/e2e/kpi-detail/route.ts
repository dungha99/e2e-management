import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const picId = searchParams.get("pic_id")
    const metric = searchParams.get("metric")
    const search = searchParams.get("search") || ""
    const sources = searchParams.get("sources")?.split(",").filter(Boolean) || []
    const dateFrom = searchParams.get("dateFrom") || ""
    const dateTo = searchParams.get("dateTo") || ""

    const startTs = dateFrom ? `${dateFrom} 00:00:00` : "2000-01-01 00:00:00"
    const endTs = dateTo ? `${dateTo} 23:59:59` : "2100-01-01 23:59:59"

    if (!metric) {
      return NextResponse.json({ error: "metric is required" }, { status: 400 })
    }

    // ── Build dynamic WHERE clauses ─────────────────────────────────────────
    const conditions: string[] = []
    const params: any[] = []
    let idx = 1

    if (picId && picId !== 'all') {
      conditions.push(`l.pic_id = $${idx}`)
      params.push(picId)
      idx++
    }

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
      conditions.push(`l.created_at >= $${idx}::timestamp`)
      params.push(`${dateFrom} 00:00:00`)
      idx++
    }
    if (dateTo) {
      conditions.push(`l.created_at <= $${idx}::timestamp`)
      params.push(`${dateTo} 23:59:59`)
      idx++
    }
    const qFilter = searchParams.get("qualified")
    if (qFilter) {
      conditions.push(`ss.qualified::text = ANY($${idx}::text[])`)
      params.push(qFilter.split(","))
      idx++
    }

    const filterWhere = conditions.length > 0 ? conditions.join(" AND ") : "1=1"
    
    // Also get available qualification values for the filter (all available in DB)
    const qValuesRes = await vucarV2Query(`
      SELECT DISTINCT qualified FROM sale_status WHERE qualified IS NOT NULL ORDER BY qualified
    `, [])
    const qualifiedValues = qValuesRes.rows.map((r: any) => r.qualified)

    const crmConditions = [...conditions];
    const crmWhere = crmConditions.length > 0 ? crmConditions.join(" AND ") : "1=1"

    // ── 1. Tiers 1 & 2 (Total, Has Image, No Image) ──────────────────────────
    if (metric === 'FUNNEL_TOTAL_LEADS' || metric === 'FUNNEL_HAS_IMAGE' || metric === 'FUNNEL_HAS_IMAGE_WITH_ADDITIONAL' || metric === 'FUNNEL_HAS_IMAGE_WITHOUT_ADDITIONAL' || metric === 'FUNNEL_NO_IMAGE') {
      let extraWhere = "";
      if (metric === 'FUNNEL_HAS_IMAGE') extraWhere = " AND ss.qualified::text = 'STRONG_QUALIFIED'";
      if (metric === 'FUNNEL_NO_IMAGE') extraWhere = " AND (ss.qualified::text != 'STRONG_QUALIFIED' OR ss.qualified IS NULL)";

      // For 2A sub-metrics, first find phones per-phone aggregation, then filter detail query
      let phoneFilter: string[] | null = null;
      if (metric === 'FUNNEL_HAS_IMAGE_WITH_ADDITIONAL' || metric === 'FUNNEL_HAS_IMAGE_WITHOUT_ADDITIONAL') {
        extraWhere = " AND ss.qualified::text = 'STRONG_QUALIFIED'";
        const hasAdditionalFlag = metric === 'FUNNEL_HAS_IMAGE_WITH_ADDITIONAL' ? 1 : 0;
        const phoneAggRes = await vucarV2Query(`
          SELECT phone FROM (
            SELECT l.phone,
              MAX(CASE 
                WHEN c.additional_images IS NOT NULL 
                  AND c.additional_images::text != 'null' 
                  AND c.additional_images::text != '{}' 
                  AND c.additional_images::text != ''
                THEN 1 ELSE 0 
              END) AS has_additional
            FROM leads l
            LEFT JOIN cars c ON c.lead_id = l.id
            LEFT JOIN sale_status ss ON ss.car_id = c.id
            WHERE ${filterWhere} AND ss.qualified::text = 'STRONG_QUALIFIED'
            GROUP BY l.phone
          ) sub WHERE has_additional = $${idx}
        `, [...params, hasAdditionalFlag])
        phoneFilter = phoneAggRes.rows.map((r: any) => r.phone).filter(Boolean);
        if (phoneFilter.length === 0) return NextResponse.json({ leads: [], qualifiedValues });
      }

      let phoneWhere = "";
      const queryParams = [...params];
      if (phoneFilter) {
        phoneWhere = ` AND l.phone = ANY($${idx + 1}::text[])`;
        queryParams.push(phoneFilter);
      }

      const result = await vucarV2Query(`
        SELECT DISTINCT ON (l.phone)
               l.id AS id, l.phone, l.additional_phone, l.name, c.id AS car_id,
               c.brand, c.model, c.year, c.created_at AS car_created_at, 
               c.location, c.mileage, ss.notes, ss.qualified
        FROM leads l
        LEFT JOIN cars c ON c.lead_id = l.id
        LEFT JOIN sale_status ss ON ss.car_id = c.id
        WHERE ${filterWhere} ${extraWhere} ${phoneWhere}
        ORDER BY l.phone, l.created_at DESC
        LIMIT 500
      `, queryParams)

      const leads = result.rows;
      const phones = [...new Set(leads.map((r: any) => r.phone).filter(Boolean))];
      const zaloActionsMap = new Map();
      if (phones.length > 0) {
        const actionsRes = await e2eQuery(`
          SELECT COALESCE(payload->>'phone', payload->>'customer_phone') AS phone, action_type, status FROM zalo_action WHERE COALESCE(payload->>'phone', payload->>'customer_phone') = ANY($1::text[]) ORDER BY created_at DESC
        `, [phones]);
        for (const act of actionsRes.rows) {
          if (!zaloActionsMap.has(act.phone)) zaloActionsMap.set(act.phone, {});
          const leadActions = zaloActionsMap.get(act.phone);
          if (!leadActions[act.action_type]) leadActions[act.action_type] = act.status;
        }
      }

      return NextResponse.json({
        leads: leads.map((r: any) => ({
          id: r.id,
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
          qualified: r.qualified,
          zaloActions: zaloActionsMap.get(r.phone) || {}
        })),
        qualifiedValues
      })
    }

    // ── 2. Tier 3 Zalo (v2 Restructure) ──────────────────────────────────────
    // Uses the SAME per-phone aggregation as funnel-stats to ensure counts match
    const zaloMetricPrefixes = [
      'FUNNEL_FIRST_MESSAGE_SUCCESS', 
      'FUNNEL_NEVER_FIRST_MESSAGE', 
      'FUNNEL_FIRST_MESSAGE_FAILED', 
      'FUNNEL_BLOCKED_MESSAGE', 
      'FUNNEL_SYSTEM_ERROR',
      'FUNNEL_RENAME_'
    ];

    if (zaloMetricPrefixes.some(p => metric.startsWith(p))) {
      // Step 1: Aggregate messages per PHONE (same as funnel-stats GROUP BY l.phone)
      const phoneAggRes = await vucarV2Query(`
        SELECT DISTINCT l.phone,
               MAX(CASE 
                 WHEN ss.messages_zalo IS NOT NULL 
                  AND ss.messages_zalo != 'null'::jsonb 
                  AND jsonb_array_length(ss.messages_zalo) > 0 
                 THEN 1 ELSE 0 
               END) AS has_messages_zalo,
               SUM(CASE WHEN ss.messages_zalo IS NOT NULL THEN (
                 SELECT COUNT(*) FROM jsonb_array_elements(ss.messages_zalo) m
                 WHERE m->>'uidFrom' = '0'
               ) ELSE 0 END) AS msgs_from_sale,
               SUM(CASE WHEN ss.messages_zalo IS NOT NULL THEN (
                 SELECT COUNT(*) FROM jsonb_array_elements(ss.messages_zalo) m
                 WHERE m->>'uidFrom' != '0'
               ) ELSE 0 END) AS msgs_from_customer,
               COALESCE(
                 MAX(CASE WHEN ss.messages_zalo IS NOT NULL AND jsonb_array_length(ss.messages_zalo) > 0
                   THEN (
                     SELECT MAX((m->>'dateAction')::timestamptz)
                     FROM jsonb_array_elements(ss.messages_zalo) m
                     WHERE m->>'dateAction' IS NOT NULL AND m->>'dateAction' != ''
                   )
                 END),
                 MAX(l.created_at)
               ) AS last_msg_at,
               COALESCE(
                 MAX(CASE WHEN ss.messages_zalo IS NOT NULL AND jsonb_array_length(ss.messages_zalo) > 0
                   THEN (
                     SELECT MAX((m->>'dateAction')::timestamptz)
                     FROM jsonb_array_elements(ss.messages_zalo) m
                     WHERE m->>'uidFrom' = '0'
                       AND m->>'dateAction' IS NOT NULL AND m->>'dateAction' != ''
                   )
                 END),
                 MAX(l.created_at)
               ) AS last_sale_msg_at
        FROM leads l
        LEFT JOIN cars c ON c.lead_id = l.id
        LEFT JOIN sale_status ss ON ss.car_id = c.id
        WHERE ${filterWhere}
          AND (ss.qualified::text != 'STRONG_QUALIFIED' OR ss.qualified IS NULL)
          AND l.phone IS NOT NULL
        GROUP BY l.phone
      `, params)

      const phoneAggRows = phoneAggRes.rows;
      const phones = phoneAggRows.map((r: any) => r.phone).filter(Boolean);

      if (phones.length === 0) return NextResponse.json({ leads: [], qualifiedValues });

      // Step 2: Fetch firstMessage actions (same as funnel-stats)
      const fmRes = await e2eQuery(`
        SELECT
          COALESCE(payload->>'phone', payload->>'customer_phone') AS phone,
          MAX(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS has_success,
          MIN(CASE WHEN status = 'success' THEN created_at END) AS first_success_at,
          MAX(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END) AS has_failed,
          STRING_AGG(DISTINCT CASE WHEN status = 'failed' THEN COALESCE(payload->>'akabiz_error', payload->>'reason', payload->>'error') END, ' | ') AS fail_reasons
        FROM zalo_action
        WHERE action_type = 'firstMessage'
          AND created_at >= $1::timestamp AND created_at <= $2::timestamp
          AND COALESCE(payload->>'phone', payload->>'customer_phone') = ANY($3::text[])
        GROUP BY 1
      `, [startTs, endTs, phones])

      const fmStatusMap = new Map(fmRes.rows.map((r: any) => [r.phone, r]));

      // Step 3: Fetch rename actions if relevant
      let renameStatusMap = new Map();
      if (metric.startsWith('FUNNEL_RENAME_') || metric.includes('_RENAME') || metric === 'FUNNEL_NEVER_FIRST_MESSAGE_NO_INTERACTION') {
        const renRes = await e2eQuery(`
          SELECT
            COALESCE(payload->>'phone', payload->>'customer_phone') AS phone,
            MAX(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS has_success,
            MAX(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END) AS has_failed
          FROM zalo_action
          WHERE action_type = 'rename'
            AND created_at >= $1::timestamp AND created_at <= $2::timestamp
            AND COALESCE(payload->>'phone', payload->>'customer_phone') = ANY($3::text[])
          GROUP BY 1
        `, [startTs, endTs, phones])
        renameStatusMap = new Map(renRes.rows.map((r: any) => [r.phone, r]));
      }

      // Step 4: Classify each phone using SAME logic as funnel-stats
      const matchingPhones: string[] = [];
      const phoneDaysWaiting = new Map<string, number>();

      for (const row of phoneAggRows) {
        const phone = row.phone;
        const hasMZ = row.has_messages_zalo === 1;
        const nSale = parseInt(row.msgs_from_sale || "0", 10);
        const nCust = parseInt(row.msgs_from_customer || "0", 10);
        const lastMsgAt = row.last_msg_at ? new Date(row.last_msg_at).getTime() : 0;
        const lastSaleMsgAt = row.last_sale_msg_at ? new Date(row.last_sale_msg_at).getTime() : 0;

        const fmStatus = fmStatusMap.get(phone) as any;
        const renStatus = renameStatusMap.get(phone) as any;

        const isAutoSuccess = fmStatus?.has_success === 1;
        const isManualTwoWay = hasMZ && nSale > 0 && nCust > 0;

        let matches = false;

        // 3a. Success (Auto + Manual / Split)
        if (metric === 'FUNNEL_FIRST_MESSAGE_SUCCESS' || metric.startsWith('FUNNEL_FIRST_MESSAGE_SUCCESS_')) {
          const isAuto = metric.includes('_AUTO');
          const isManual = metric.includes('_MANUAL');

          let isSuccess = false;
          if (isAuto) isSuccess = isAutoSuccess;
          else if (isManual) isSuccess = !isAutoSuccess && isManualTwoWay;
          else isSuccess = isAutoSuccess || isManualTwoWay;

          if (isSuccess) {
            if (metric === 'FUNNEL_FIRST_MESSAGE_SUCCESS' || metric === 'FUNNEL_FIRST_MESSAGE_SUCCESS_AUTO' || metric === 'FUNNEL_FIRST_MESSAGE_SUCCESS_MANUAL') {
              matches = true;
            } else {
              let establishedAt = 0;
              if (isAutoSuccess && fmStatus.first_success_at) establishedAt = new Date(fmStatus.first_success_at).getTime();
              else if (isManualTwoWay && lastMsgAt) establishedAt = lastMsgAt;

              if (establishedAt) {
                const days = (Date.now() - establishedAt) / 86400000;
                let dayMatch = false;
                if (metric.includes('_HOT')) dayMatch = days > 7;
                else if (metric.includes('_WARN')) dayMatch = days > 4 && days <= 7;
                else if (metric.includes('_MEDIUM')) dayMatch = days > 2 && days <= 4;
                else if (metric.includes('_FRESH')) dayMatch = days <= 2;
                else dayMatch = true;

                if (dayMatch) {
                  if (metric.endsWith('_RENAME')) {
                    matches = renStatus?.has_success === 1;
                  } else {
                    matches = true;
                  }
                }
              }
            }
          }
        }
        // 3b. Failed
        else if (metric === 'FUNNEL_FIRST_MESSAGE_FAILED' || metric === 'FUNNEL_BLOCKED_MESSAGE' || metric === 'FUNNEL_SYSTEM_ERROR') {
          if (!isAutoSuccess && !isManualTwoWay && fmStatus?.has_failed === 1) {
            if (metric === 'FUNNEL_FIRST_MESSAGE_FAILED') {
              matches = true;
            } else {
              const reasons = (fmStatus.fail_reasons || "").toLowerCase();
              const isBlocked = reasons.includes("bạn chưa thể gửi") || reasons.includes("xin lỗi! hiện tại");
              if (metric === 'FUNNEL_BLOCKED_MESSAGE') matches = isBlocked;
              if (metric === 'FUNNEL_SYSTEM_ERROR') matches = !isBlocked;
            }
          }
        }
        // 3c. Never
        else if (metric.startsWith('FUNNEL_NEVER_FIRST_MESSAGE') || metric.startsWith('FUNNEL_RENAME_')) {
          if (!isAutoSuccess && !isManualTwoWay && !(fmStatus?.has_failed === 1)) {
            if (metric === 'FUNNEL_NEVER_FIRST_MESSAGE') {
              matches = true;
            } else if (metric === 'FUNNEL_NEVER_FIRST_MESSAGE_SALE_ONLY') {
              matches = nSale > 0 && nCust === 0;
              if (matches && lastSaleMsgAt) {
                phoneDaysWaiting.set(phone, Math.round((Date.now() - lastSaleMsgAt) / 86400000 * 10) / 10);
              }
            } else if (metric === 'FUNNEL_NEVER_FIRST_MESSAGE_NO_INTERACTION' || metric.startsWith('FUNNEL_RENAME_')) {
              const isNoInteract = nSale === 0;
              if (isNoInteract) {
                if (lastMsgAt) {
                  phoneDaysWaiting.set(phone, Math.round((Date.now() - lastMsgAt) / 86400000 * 10) / 10);
                }
                if (metric === 'FUNNEL_NEVER_FIRST_MESSAGE_NO_INTERACTION') matches = true;
                else if (metric === 'FUNNEL_RENAME_SUCCESS') matches = renStatus?.has_success === 1;
                else if (metric === 'FUNNEL_RENAME_FAILED') matches = renStatus?.has_failed === 1 && renStatus?.has_success === 0;
                else if (metric === 'FUNNEL_RENAME_NONE') matches = !renStatus;
                else if (metric === 'FUNNEL_RENAME_RESERVE') matches = !renStatus || (renStatus.has_success === 0);
              }
            }
          }
        }

        if (matches) matchingPhones.push(phone);
      }

      if (matchingPhones.length === 0) return NextResponse.json({ leads: [], qualifiedValues });

      // Step 5: Fetch lead details for matching phones only
      const detailIdx = params.length + 1;
      const detailRes = await vucarV2Query(`
        SELECT DISTINCT ON (l.phone)
               l.id AS id, l.phone, l.additional_phone, l.name, c.id AS car_id,
               c.brand, c.model, c.year, c.created_at AS car_created_at,
               c.location, c.mileage, ss.notes, ss.qualified
        FROM leads l
        LEFT JOIN cars c ON c.lead_id = l.id
        LEFT JOIN sale_status ss ON ss.car_id = c.id
        WHERE ${filterWhere}
          AND (ss.qualified::text != 'STRONG_QUALIFIED' OR ss.qualified IS NULL)
          AND l.phone = ANY($${detailIdx}::text[])
        ORDER BY l.phone, l.created_at DESC
      `, [...params, matchingPhones])

      // Step 6: Fetch zalo actions for display
      const zaloActionsMap = new Map();
      if (matchingPhones.length > 0) {
        const actionsRes = await e2eQuery(`
          SELECT 
            COALESCE(payload->>'phone', payload->>'customer_phone') AS phone,
            action_type,
            status,
            created_at
          FROM zalo_action
          WHERE COALESCE(payload->>'phone', payload->>'customer_phone') = ANY($1::text[])
          ORDER BY created_at DESC
        `, [matchingPhones]);

        for (const act of actionsRes.rows) {
          if (!zaloActionsMap.has(act.phone)) zaloActionsMap.set(act.phone, {});
          const leadActions = zaloActionsMap.get(act.phone);
          if (!leadActions[act.action_type]) {
            leadActions[act.action_type] = act.status;
          }
        }
      }

      return NextResponse.json({
        leads: detailRes.rows.map((r: any) => ({
          id: r.id,
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
          qualified: r.qualified,
          daysWaiting: phoneDaysWaiting.get(r.phone) || null,
          zaloActions: zaloActionsMap.get(r.phone) || {}
        })),
        qualifiedValues
      })
    }

    // ── 3. Other Metrics (UNDEFINED_QUALIFIED, NO_ZALO_ACTION, etc.) ────────
    if (metric === "UNDEFINED_QUALIFIED") {
      const result = await vucarV2Query(`
        SELECT DISTINCT ON (l.phone)
               l.id AS id, l.phone, l.additional_phone, l.name, c.id AS car_id,
               c.brand, c.model, c.year, c.created_at AS car_created_at, 
               c.location, c.mileage, ss.notes, ss.qualified
        FROM cars c
        LEFT JOIN leads l ON l.id = c.lead_id
        LEFT JOIN sale_status ss ON ss.car_id = c.id
        WHERE ${filterWhere}
          AND ss.qualified::text = 'UNDEFINED_QUALIFIED'
          AND (ss.stage IS NULL OR ss.stage NOT IN ('FAILED', 'DEPOSIT_PAID', 'COMPLETED'))
        ORDER BY l.phone, c.created_at DESC
        LIMIT 200
      `, params)

      const leads = result.rows;
      const phones = [...new Set(leads.map((r: any) => r.phone).filter(Boolean))];
      const zaloActionsMap = new Map();
      if (phones.length > 0) {
        const actionsRes = await e2eQuery(`
          SELECT COALESCE(payload->>'phone', payload->>'customer_phone') AS phone, action_type, status FROM zalo_action WHERE COALESCE(payload->>'phone', payload->>'customer_phone') = ANY($1::text[]) ORDER BY created_at DESC
        `, [phones]);
        for (const act of actionsRes.rows) {
          if (!zaloActionsMap.has(act.phone)) zaloActionsMap.set(act.phone, {});
          const leadActions = zaloActionsMap.get(act.phone);
          if (!leadActions[act.action_type]) leadActions[act.action_type] = act.status;
        }
      }

      return NextResponse.json({
        leads: leads.map((r: any) => ({
          id: r.id,
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
          qualified: r.qualified,
          zaloActions: zaloActionsMap.get(r.phone) || {}
        })),
        qualifiedValues
      })
    }

    return NextResponse.json({ leads: [], qualifiedValues })
  } catch (error) {
    console.error("[KPI Detail API] Error:", error)
    return NextResponse.json({ error: "Failed to fetch KPI detail" }, { status: 500 })
  }
}
