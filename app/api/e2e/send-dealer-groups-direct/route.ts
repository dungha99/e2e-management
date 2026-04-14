import { NextResponse } from "next/server"
import { vucarV2Query, e2eQuery } from "@/lib/db"
import { VUCAR_SEND_CONNECTOR_ID, VUCAR_SEND_BASE_URL, VucarZaloAccount } from "@/lib/vucar-zalo-accounts"
import { resolveVucarGroupId, cacheVucarGroupMapping } from "@/lib/vucar-zalo-groups"

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { b_user_id, group_names, message, image_url } = body

    if (!b_user_id || !Array.isArray(group_names) || group_names.length === 0 || !message) {
      return NextResponse.json(
        { error: "Missing required fields: b_user_id, group_names, message" },
        { status: 400 }
      )
    }

    // 1. Get the abit_zalo_accounts row for this b_user
    const accountResult = await e2eQuery(
      `SELECT id, phone, account_name, abitstore_id, dynamic_key, default_group_id,
              get_groups_key, smownerid, account_type, b_user_id
       FROM abit_zalo_accounts
       WHERE b_user_id = $1 AND account_type = 'vucar' AND is_active = true
       LIMIT 1`,
      [b_user_id]
    )

    if (accountResult.rows.length === 0) {
      return NextResponse.json(
        { error: `No active vucar account found for b_user_id ${b_user_id}` },
        { status: 404 }
      )
    }

    const accountRow = accountResult.rows[0]

    // 2. Get own_id (zalo_owner_id) from CRM users
    const userResult = await vucarV2Query(
      `SELECT zalo_owner_id FROM users WHERE id = $1 LIMIT 1`,
      [b_user_id]
    )

    if (userResult.rows.length === 0 || !userResult.rows[0].zalo_owner_id) {
      return NextResponse.json(
        { error: `No zalo_owner_id found for b_user_id ${b_user_id}` },
        { status: 404 }
      )
    }

    const ownId = userResult.rows[0].zalo_owner_id

    // 3. Get bearer token from api_connectors
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

    // Build a VucarZaloAccount object for the lib functions
    const account: VucarZaloAccount = {
      ...accountRow,
      own_id: ownId,
      bearer_token: bearerToken,
    }

    // 4. Send to each group
    const results = []

    for (const groupName of group_names) {
      try {
        const groupId = await resolveVucarGroupId(groupName, account)

        const url = VUCAR_SEND_BASE_URL
          .replace("{ownId}", ownId)
          .replace("{groupId}", groupId)

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${bearerToken}`,
          },
          body: JSON.stringify({
            message,
            image_urls: image_url || [],
          }),
        })

        if (!response.ok) {
          const errText = await response.text()
          throw new Error(`Vucar API ${response.status}: ${errText}`)
        }

        await cacheVucarGroupMapping(account.id, groupId, groupName)

        console.log(`[Send Dealer Direct] Sent to "${groupName}" (${groupId}) via ${account.account_name}`)
        results.push({ groupName, success: true })
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        console.error(`[Send Dealer Direct] Failed "${groupName}":`, errMsg)
        results.push({ groupName, success: false, error: errMsg })
      }
    }

    // 5. Update usage count for this account after sending
    await e2eQuery(
      `UPDATE abit_zalo_accounts
       SET last_used_at = NOW(), request_count = request_count + 1
       WHERE id = $1`,
      [account.id]
    )

    const successCount = results.filter(r => r.success).length

    return NextResponse.json({ successCount, total: group_names.length, results })
  } catch (error) {
    console.error("[Send Dealer Direct] Error:", error)
    return NextResponse.json(
      { error: "Failed to send to dealer groups", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
