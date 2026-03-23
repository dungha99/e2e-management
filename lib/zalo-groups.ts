import { getE2ePool } from "@/lib/db"
import { ZaloAccount } from "@/lib/zalo-accounts"

/** Look up group_id by name: DB cache first, then abitstore API fallback */
export async function resolveGroupId(groupName: string, account: ZaloAccount): Promise<string> {
  const pool = getE2ePool()

  // 1. DB cache lookup
  const { rows } = await pool.query(
    `SELECT group_id FROM zalo_group_cache WHERE account_id = $1 AND group_name = $2`,
    [account.id, groupName]
  )

  if (rows.length > 0) {
    console.log(`[Zalo Groups] Cache HIT for "${groupName}" -> ${rows[0].group_id}`)
    return rows[0].group_id
  }

  // 2. Cache miss — fetch all groups from abitstore and cache them
  console.log(`[Zalo Groups] Cache MISS for "${groupName}", fetching from API...`)
  await fetchAndCacheAllGroups(account)

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

/** Fetch all groups from abitstore API and upsert into zalo_group_cache */
export async function fetchAndCacheAllGroups(account: ZaloAccount): Promise<void> {
  const pool = getE2ePool()

  const response = await fetch(
    `https://new.abitstore.vn/zalo/listAllGroup?dynamic_key=${account.get_groups_key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smownerid: account.smownerid }),
    }
  )

  if (!response.ok) {
    throw new Error(`Abitstore listAllGroup API returned ${response.status}`)
  }

  const data = await response.json()

  if (!data?.all_groups || !Array.isArray(data.all_groups)) {
    console.warn("[Zalo Groups] No groups returned from API")
    return
  }

  console.log(`[Zalo Groups] Fetched ${data.all_groups.length} groups for account ${account.account_name}`)

  // Upsert all groups
  for (const group of data.all_groups) {
    await pool.query(
      `INSERT INTO zalo_group_cache (account_id, group_id, group_name, member_count, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (account_id, group_name)
       DO UPDATE SET group_id = EXCLUDED.group_id, member_count = EXCLUDED.member_count, updated_at = NOW()`,
      [account.id, group.groupId, group.groupname, group.number_member]
    )
  }
}

/** Upsert a single group mapping after a successful send */
export async function cacheGroupMapping(accountId: number, groupId: string, groupName: string): Promise<void> {
  const pool = getE2ePool()
  await pool.query(
    `INSERT INTO zalo_group_cache (account_id, group_id, group_name, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (account_id, group_name)
     DO UPDATE SET group_id = EXCLUDED.group_id, updated_at = NOW()`,
    [accountId, groupId, groupName]
  )
}
