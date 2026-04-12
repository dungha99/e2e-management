import { getE2ePool } from "@/lib/db"

export interface ZaloAccount {
  id: number
  phone: string
  account_name: string
  abitstore_id: string
  dynamic_key: string
  default_group_id: string | null
  get_groups_key: string
  smownerid: string
  account_type: string | null
  b_user_id: string | null
}

/** Pick the least-recently-used active Abit account (round-robin) */
export async function getNextZaloAccount(): Promise<ZaloAccount> {
  const pool = getE2ePool()

  // Select and update in one atomic operation
  const { rows } = await pool.query(`
    UPDATE abit_zalo_accounts
    SET last_used_at = NOW(), request_count = request_count + 1
    WHERE id = (
      SELECT id FROM abit_zalo_accounts
      WHERE is_active = true
        AND (account_type IS NULL OR account_type = 'abit')
      ORDER BY last_used_at ASC NULLS FIRST
      LIMIT 1
    )
    RETURNING id, phone, account_name, abitstore_id, dynamic_key, default_group_id, get_groups_key, smownerid, account_type, b_user_id
  `)

  if (rows.length === 0) {
    throw new Error("No active Zalo account available")
  }

  return rows[0]
}

export function buildAbitstoreUrl(account: ZaloAccount): string {
  return `https://new.abitstore.vn/zalo/sendImageToGroupZalo/${account.abitstore_id}/${account.account_name}/${account.dynamic_key}`
}
