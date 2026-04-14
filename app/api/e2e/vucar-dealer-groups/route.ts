import { NextResponse } from "next/server"
import { vucarV2Query, e2eQuery, query } from "@/lib/db"
import { VUCAR_SEND_CONNECTOR_ID, VUCAR_GROUPS_BASE_URL } from "@/lib/vucar-zalo-accounts"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const bUserId = searchParams.get("b_user_id")

    if (!bUserId) {
      return NextResponse.json(
        { error: "Missing required param: b_user_id" },
        { status: 400 }
      )
    }

    // 1. Get own_id (zalo_owner_id) from CRM users
    const userResult = await vucarV2Query(
      `SELECT zalo_owner_id FROM users WHERE id = $1 LIMIT 1`,
      [bUserId]
    )

    if (userResult.rows.length === 0 || !userResult.rows[0].zalo_owner_id) {
      return NextResponse.json(
        { error: `No zalo_owner_id found for user ${bUserId}` },
        { status: 404 }
      )
    }

    const ownId = userResult.rows[0].zalo_owner_id

    // 2. Get bearer token from api_connectors
    const connectorResult = await e2eQuery(
      `SELECT auth_config FROM api_connectors WHERE id = $1 LIMIT 1`,
      [VUCAR_SEND_CONNECTOR_ID]
    )

    if (connectorResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Vucar send connector not configured" },
        { status: 500 }
      )
    }

    let authConfig = connectorResult.rows[0].auth_config
    if (typeof authConfig === "string") authConfig = JSON.parse(authConfig)

    let bearerToken: string | null = null
    if (authConfig?.type === "bearer" && authConfig?.token) {
      bearerToken = authConfig.token
    } else if (authConfig?.Authorization) {
      bearerToken = authConfig.Authorization.replace(/^Bearer\s+/i, "")
    } else if (authConfig?.authorization) {
      bearerToken = authConfig.authorization.replace(/^Bearer\s+/i, "")
    }

    if (!bearerToken) {
      return NextResponse.json(
        { error: "No bearer token found in connector config" },
        { status: 500 }
      )
    }

    // 3. Fetch groups from Vucar Zalo API
    const url = VUCAR_GROUPS_BASE_URL.replace("{ownId}", ownId)
    const groupsResponse = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
    })

    if (!groupsResponse.ok) {
      throw new Error(`Vucar groups API returned ${groupsResponse.status}`)
    }

    const groupsData = await groupsResponse.json()

    if (!Array.isArray(groupsData)) {
      return NextResponse.json({ groups: [] })
    }

    // 4. Fetch active dealers from DRM to match group names
    const dealersResult = await query(
      `SELECT id, name, group_zalo_name FROM dealers WHERE is_active = TRUE`
    )

    const dealersByGroupName = new Map(
      dealersResult.rows.map((d: any) => [d.group_zalo_name, d.id])
    )

    // 5. Map response: [{ id, name, memberCount }] → DealerGroup shape
    const groups = groupsData.map((g: any) => ({
      groupId: g.id,
      groupName: g.name,
      memberCount: g.memberCount ?? 0,
      dealerId: dealersByGroupName.get(g.name) || null,
    }))

    return NextResponse.json({ groups })
  } catch (error) {
    console.error("[Vucar Dealer Groups API] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch vucar dealer groups", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
