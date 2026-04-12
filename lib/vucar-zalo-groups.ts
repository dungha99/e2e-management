import { getE2ePool } from "@/lib/db"
import { VucarZaloAccount, VUCAR_GROUPS_BASE_URL } from "@/lib/vucar-zalo-accounts"

/**
 * Look up group_id by name for the Vucar API.
 * Uses the same zalo_group_cache table (keyed by account_id from abit_zalo_accounts).
 * Cache miss → fetch all groups from zl.vucar.vn and populate cache.
 */
export async function resolveVucarGroupId(
  groupName: string,
  account: VucarZaloAccount
): Promise<string> {
  const pool = getE2ePool()

  // 1. DB cache lookup (same table as Abit path)
  const { rows } = await pool.query(
    `SELECT group_id FROM zalo_group_cache WHERE account_id = $1 AND group_name = $2`,
    [account.id, groupName]
  )

  if (rows.length > 0) {
    console.log(`[Vucar Groups] Cache HIT for "${groupName}" -> ${rows[0].group_id}`)
    return rows[0].group_id
  }

  // 2. Cache miss — fetch all groups from vucar API and cache them
  console.log(`[Vucar Groups] Cache MISS for "${groupName}", fetching from API...`)
  await fetchAndCacheVucarGroups(account)

  // 3. Re-query cache
  const { rows: retryRows } = await pool.query(
    `SELECT group_id FROM zalo_group_cache WHERE account_id = $1 AND group_name = $2`,
    [account.id, groupName]
  )

  if (retryRows.length > 0) {
    return retryRows[0].group_id
  }

  throw new Error(`Group not found: "${groupName}" for account ${account.account_name}`)
}

/** Fetch all groups from zl.vucar.vn and upsert into zalo_group_cache */
export async function fetchAndCacheVucarGroups(account: VucarZaloAccount): Promise<void> {
  const pool = getE2ePool()

  const url = VUCAR_GROUPS_BASE_URL.replace("{ownId}", account.own_id)

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${account.bearer_token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Vucar listGroups API returned ${response.status}`)
  }

  const data = await response.json()

  if (!Array.isArray(data)) {
    console.warn("[Vucar Groups] Unexpected response shape from groups API:", data)
    return
  }

  console.log(`[Vucar Groups] Fetched ${data.length} groups for account ${account.account_name}`)

  // Response shape: [{ id, name, memberCount, avatar, creatorId }]
  for (const group of data) {
    await pool.query(
      `INSERT INTO zalo_group_cache (account_id, group_id, group_name, member_count, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (account_id, group_name)
       DO UPDATE SET group_id = EXCLUDED.group_id, member_count = EXCLUDED.member_count, updated_at = NOW()`,
      [account.id, group.id, group.name, group.memberCount ?? null]
    )
  }
}

/** Upsert a single group mapping after a successful vucar send */
export async function cacheVucarGroupMapping(
  accountId: number,
  groupId: string,
  groupName: string
): Promise<void> {
  const pool = getE2ePool()
  await pool.query(
    `INSERT INTO zalo_group_cache (account_id, group_id, group_name, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (account_id, group_name)
     DO UPDATE SET group_id = EXCLUDED.group_id, updated_at = NOW()`,
    [accountId, groupId, groupName]
  )
}
