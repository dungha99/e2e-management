import { getE2ePool } from "@/lib/db"
import { vucarV2Query } from "@/lib/db"
import { ZaloAccount } from "@/lib/zalo-accounts"

export const VUCAR_SEND_CONNECTOR_ID = "2e0fe6c3-c0c8-4a8f-9df7-41c09959091a"
export const VUCAR_SEND_BASE_URL = "https://zl.vucar.vn/api/accounts/{ownId}/groups/{groupId}/send"
export const VUCAR_GROUPS_BASE_URL = "https://zl.vucar.vn/api/accounts/{ownId}/groups"

export interface VucarZaloAccount extends ZaloAccount {
  own_id: string
  bearer_token: string
}

/**
 * Pick the least-recently-used active Vucar account connected to the given pic_id.
 * Returns null if no staff connections exist for this pic_id → triggers Abit fallback.
 */
export async function getNextVucarAccount(picId: string): Promise<VucarZaloAccount | null> {
  const pool = getE2ePool()

  // 1. Find b_user_ids connected to this pic (c_user_id) — CRM table
  const crmConnections = await vucarV2Query(
    `SELECT b_user_id FROM staff_connections WHERE c_user_id = $1`,
    [picId]
  )
  const connections = crmConnections.rows

  if (connections.length === 0) {
    return null
  }

  const bUserIds = connections.map((r: { b_user_id: string }) => r.b_user_id)

  // 2. Round-robin pick least-recently-used vucar account among connected b_users
  const { rows: accounts } = await pool.query(
    `UPDATE abit_zalo_accounts
     SET last_used_at = NOW(), request_count = request_count + 1
     WHERE id = (
       SELECT id FROM abit_zalo_accounts
       WHERE is_active = true
         AND account_type = 'vucar'
         AND b_user_id = ANY($1::uuid[])
       ORDER BY last_used_at ASC NULLS FIRST
       LIMIT 1
     )
     RETURNING id, phone, account_name, abitstore_id, dynamic_key, default_group_id, get_groups_key, smownerid, account_type, b_user_id`,
    [bUserIds]
  )

  if (accounts.length === 0) {
    return null
  }

  const account = accounts[0]

  // 3. Fetch own_id (zalo_owner_id) from CRM users table
  const crmResult = await vucarV2Query(
    `SELECT zalo_owner_id FROM users WHERE id = $1 LIMIT 1`,
    [account.b_user_id]
  )

  if (crmResult.rows.length === 0 || !crmResult.rows[0].zalo_owner_id) {
    throw new Error(`No zalo_owner_id found for b_user_id ${account.b_user_id}`)
  }

  const ownId = crmResult.rows[0].zalo_owner_id

  // 4. Fetch bearer token from api_connectors
  const { rows: connectorRows } = await pool.query(
    `SELECT auth_config FROM api_connectors WHERE id = $1 LIMIT 1`,
    [VUCAR_SEND_CONNECTOR_ID]
  )

  if (connectorRows.length === 0) {
    throw new Error(`Vucar send connector not found: ${VUCAR_SEND_CONNECTOR_ID}`)
  }

  let authConfig = connectorRows[0].auth_config
  if (typeof authConfig === "string") {
    authConfig = JSON.parse(authConfig)
  }

  // Bearer token: support both { type: "bearer", token: "..." } and flat { Authorization: "Bearer ..." }
  let bearerToken: string | null = null
  if (authConfig?.type === "bearer" && authConfig?.token) {
    bearerToken = authConfig.token
  } else if (authConfig?.Authorization) {
    bearerToken = authConfig.Authorization.replace(/^Bearer\s+/i, "")
  } else if (authConfig?.authorization) {
    bearerToken = authConfig.authorization.replace(/^Bearer\s+/i, "")
  }

  if (!bearerToken) {
    throw new Error(`No bearer token found in api_connectors for ${VUCAR_SEND_CONNECTOR_ID}`)
  }

  return {
    ...account,
    own_id: ownId,
    bearer_token: bearerToken,
  }
}
