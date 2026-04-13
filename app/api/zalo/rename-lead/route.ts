import { NextResponse } from "next/server"
import { vucarV2Query, e2eQuery } from "@/lib/db"
import { upsertZaloAction } from "@/lib/akabiz/upsertZaloAction"

// Same connector as send-bidding-link — holds base_url + bearer token for zl.vucar.vn
const VUCAR_FRIENDS_CONNECTOR_ID = "a1b8debd-7e9d-45d4-8804-cb817d5504f5"

/**
 * POST /api/zalo/rename-lead
 *
 * "Đổi tên Lead" — sets a Zalo friend alias using the customer's car model + phone.
 *
 * Flow:
 *  1. Look up lead + car from CRM DB (by phone or car_id).
 *  2. Build alias: "{cars.model} - {leads.phone}".
 *  3. Extract ownId from leads.zalo_account ("ownId:threadId").
 *  4. Fetch bearer token from api_connectors.
 *  5. PUT https://zl.vucar.vn/accounts/{ownId}/friends/alias-by-phone
 *  6. Record result in zalo_action via upsertZaloAction.
 *
 * Request body:
 *   { phone: string, car_id?: string }
 */
export async function POST(request: Request) {
  let car_id: string | undefined
  let phone: string | undefined
  let actionRecorded = false

  try {
    const body = await request.json()
    phone = body.phone as string | undefined
    car_id = body.car_id as string | undefined

    if (!phone && !car_id) {
      return NextResponse.json(
        { error: "phone or car_id is required" },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 1. Resolve lead + car from CRM DB
    // -------------------------------------------------------------------------
    const whereClause = car_id
      ? "c.id = $1"
      : "(l.phone = $1 OR l.additional_phone = $1)"
    const param = car_id ?? phone

    const dbResult = await vucarV2Query(
      `SELECT
         l.id             AS lead_id,
         l.phone          AS lead_phone,
         l.zalo_account,
         c.id             AS car_id,
         c.model
       FROM leads l
       JOIN cars c ON c.lead_id = l.id AND c.is_deleted = false
       WHERE ${whereClause}
       ORDER BY l.created_at DESC, c.created_at DESC
       LIMIT 1`,
      [param]
    )

    if (!dbResult.rows.length) {
      return NextResponse.json({ error: "No lead/car found" }, { status: 404 })
    }

    const row = dbResult.rows[0]
    car_id = row.car_id
    phone = row.lead_phone

    const { zalo_account, model } = row

    if (!zalo_account) {
      return NextResponse.json(
        { error: "No zalo_account linked to this lead" },
        { status: 422 }
      )
    }

    // -------------------------------------------------------------------------
    // 2. Parse ownId from "ownId:threadId"
    // -------------------------------------------------------------------------
    const [ownId] = (zalo_account as string).split(":")

    if (!ownId) {
      return NextResponse.json(
        { error: `Invalid zalo_account format: "${zalo_account}"` },
        { status: 422 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. Build alias: "{car.model} - {lead.phone}"
    // -------------------------------------------------------------------------
    const alias = `${model ?? "Unknown"} - ${phone}`

    // -------------------------------------------------------------------------
    // 4. Fetch connector URL + bearer token
    // -------------------------------------------------------------------------
    const connectorResult = await e2eQuery(
      `SELECT base_url, auth_config FROM api_connectors WHERE id = $1 LIMIT 1`,
      [VUCAR_FRIENDS_CONNECTOR_ID]
    )

    if (!connectorResult.rows.length) {
      return NextResponse.json(
        { error: `Connector ${VUCAR_FRIENDS_CONNECTOR_ID} not found` },
        { status: 500 }
      )
    }

    let { base_url, auth_config } = connectorResult.rows[0]
    if (typeof auth_config === "string") {
      try { auth_config = JSON.parse(auth_config) } catch { /* keep raw */ }
    }

    let bearerToken: string | null = null
    if (auth_config?.type === "bearer" && auth_config?.token) {
      bearerToken = auth_config.token
    } else if (auth_config?.Authorization) {
      bearerToken = (auth_config.Authorization as string).replace(/^Bearer\s+/i, "")
    } else if (auth_config?.authorization) {
      bearerToken = (auth_config.authorization as string).replace(/^Bearer\s+/i, "")
    }

    if (!bearerToken) {
      return NextResponse.json(
        { error: "No bearer token in connector config" },
        { status: 500 }
      )
    }

    // Replace {ownId} template — e.g. "https://zl.vucar.vn/accounts/{ownId}/friends/alias-by-phone"
    const url = (base_url as string).replace("{ownId}", ownId)

    console.log("[RenameLead] PUT", url, "| alias:", alias)

    // -------------------------------------------------------------------------
    // 5. PUT alias-by-phone on Zalo
    // -------------------------------------------------------------------------
    const zaloRes = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({
        account_id: ownId,
        phone,
        alias,
      }),
    })

    const zaloData = await zaloRes.json().catch(() => ({})) as Record<string, unknown>

    // -------------------------------------------------------------------------
    // 6. Record action
    // -------------------------------------------------------------------------
    const status = zaloRes.ok ? "success" : "failed"
    await upsertZaloAction(car_id!, phone!, "rename", status, {
      alias,
      phone,
      zalo_status: zaloRes.status,
      reason: zaloRes.ok ? "Đổi tên lead thành công" : `Zalo API returned ${zaloRes.status}`,
    })
    actionRecorded = true

    if (!zaloRes.ok) {
      console.error("[RenameLead] Zalo API error:", zaloRes.status, zaloData)
      return NextResponse.json(
        { error: "Zalo API returned an error", detail: zaloData },
        { status: zaloRes.status }
      )
    }

    return NextResponse.json({
      success: true,
      account_id: ownId,
      phone,
      alias,
      car_id,
      lead_id: row.lead_id,
      data: zaloData,
    })
  } catch (error) {
    console.error("[RenameLead] Error:", error)

    if (car_id && phone && !actionRecorded) {
      await upsertZaloAction(car_id, phone, "rename", "failed", {
        reason: error instanceof Error ? error.message : String(error),
      })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rename lead" },
      { status: 500 }
    )
  }
}
