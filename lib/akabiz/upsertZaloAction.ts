import { e2eQuery } from "@/lib/db"

/**
 * STEP 1 — Tìm hoặc tạo mới zalo_account theo car_id.
 *
 * - Nếu đã tồn tại (is_delete = false): trả về id của account đó.
 * - Nếu chưa tồn tại: INSERT mới với phone làm name, trả về id vừa tạo.
 *
 * @throws Ném lỗi ra ngoài để caller xử lý (không tự catch ở đây).
 */
async function findOrCreateZaloAccount(car_id: string, phone: string): Promise<string> {
  const selectRes = await e2eQuery(
    `SELECT id
     FROM zalo_account
     WHERE car_id = $1
       AND is_delete = false
     ORDER BY created_at DESC
     LIMIT 1`,
    [car_id]
  )

  if (selectRes.rows.length > 0) {
    console.log("[findOrCreateZaloAccount] Found existing account. id:", selectRes.rows[0].id)
    return selectRes.rows[0].id
  }

  console.log("[findOrCreateZaloAccount] No account found for car_id:", car_id, "— creating with phone:", phone)
  const insertRes = await e2eQuery(
    `INSERT INTO zalo_account
       (id, car_id, name, is_login, is_delete, created_at, updated_at)
     VALUES
       (gen_random_uuid(), $1, $2, false, false, NOW(), NOW())
     RETURNING id`,
    [car_id, phone]
  )
  console.log("[findOrCreateZaloAccount] Created new account. id:", insertRes.rows[0].id)
  return insertRes.rows[0].id
}

/**
 * STEP 2 — Upsert zalo_action theo (zalo_account_id, action_type).
 *
 * - Nếu chưa có record: INSERT mới.
 * - Nếu đã có record:
 *     - Status cũ là "success" → KHÔNG update (bảo vệ record thành công).
 *     - Status cũ là "failed"  → UPDATE sang status mới + payload mới.
 *
 * @throws Ném lỗi ra ngoài để caller xử lý (không tự catch ở đây).
 */
async function upsertZaloActionRecord(
  zalo_account_id: string,
  action_type: string,
  status: "success" | "failed",
  payloadJson: string | null
): Promise<void> {
  const selectRes = await e2eQuery(
    `SELECT id, status
     FROM zalo_action
     WHERE zalo_account_id = $1
       AND action_type = $2
     LIMIT 1`,
    [zalo_account_id, action_type]
  )

  if (selectRes.rows.length === 0) {
    // Chưa có record → INSERT mới
    console.log("[upsertZaloActionRecord] No existing record — inserting. status:", status)
    await e2eQuery(
      `INSERT INTO zalo_action
         (id, zalo_account_id, action_type, status, payload, created_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
      [zalo_account_id, action_type, status, payloadJson]
    )
    console.log("[upsertZaloActionRecord] INSERT done.")
    return
  }

  const existingStatus = selectRes.rows[0].status

  if (existingStatus === "success") {
    // Đã thành công trước đó → tuyệt đối không lùi về "failed"
    console.log("[upsertZaloActionRecord] Existing status is 'success' — skipping downgrade.")
    return
  }

  // Status cũ là "failed" → UPDATE sang status mới
  console.log("[upsertZaloActionRecord] Existing status:", existingStatus, "— updating to:", status)
  await e2eQuery(
    `UPDATE zalo_action
     SET status  = $3,
         payload = $4
     WHERE zalo_account_id = $1
       AND action_type = $2`,
    [zalo_account_id, action_type, status, payloadJson]
  )
  console.log("[upsertZaloActionRecord] UPDATE done.")
}

/**
 * PUBLIC API — Hàm dùng chung cho tất cả API routes.
 *
 * Luồng:
 *  1. findOrCreateZaloAccount(car_id, phone)  → lấy zalo_account_id
 *  2. upsertZaloActionRecord(...)             → ghi nhận action
 *
 * Non-blocking: bọc toàn bộ trong try/catch, in log chi tiết,
 * KHÔNG re-throw để không làm gián đoạn HTTP response của client.
 */
export async function upsertZaloAction(
  car_id: string,
  phone: string,
  action_type: string,
  status: "success" | "failed",
  payload?: object
): Promise<void> {
  try {
    console.log("[upsertZaloAction] ▶ Start — car_id:", car_id, "| action_type:", action_type, "| status:", status)

    const zalo_account_id = await findOrCreateZaloAccount(car_id, phone)

    const payloadJson = payload ? JSON.stringify(payload) : null
    await upsertZaloActionRecord(zalo_account_id, action_type, status, payloadJson)

    console.log("[upsertZaloAction] ✓ Complete.")
  } catch (err: any) {
    // In đủ thông tin để debug mà không nuốt lỗi im lặng
    console.error("[upsertZaloAction] ✗ DB error — message :", err?.message)
    console.error("[upsertZaloAction] ✗ DB error — stack   :", err?.stack)
    console.error("[upsertZaloAction] ✗ DB error — full    :", err)
    // Không re-throw: lỗi DB không được block HTTP response
  }
}
