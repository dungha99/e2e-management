import { getE2ePool } from "@/lib/db"

export interface EnqueueParams {
  group_name: string
  message: string
  caption?: string
  image_url?: string[]
  action?: string
}

export interface QueueItem {
  id: number
  group_name: string
  message: string
  caption: string
  image_url: string[]
  action: string
  attempts: number
}

/** Insert a message into the queue */
export async function enqueueMessage(params: EnqueueParams): Promise<{ queueId: number }> {
  const pool = getE2ePool()

  const { rows } = await pool.query(
    `INSERT INTO zalo_message_queue (group_name, message, caption, image_url, action)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING id`,
    [
      params.group_name,
      params.message,
      params.caption || " ",
      JSON.stringify(params.image_url || []),
      params.action || "",
    ]
  )

  return { queueId: rows[0].id }
}

/** Claim one message per group_name (oldest first) for processing */
export async function claimNextBatch(): Promise<QueueItem[]> {
  const pool = getE2ePool()

  const { rows } = await pool.query(`
    UPDATE zalo_message_queue
    SET status = 'processing', started_at = NOW(), attempts = attempts + 1
    WHERE id IN (
      SELECT DISTINCT ON (group_name) id
      FROM zalo_message_queue
      WHERE status = 'pending'
         OR (status = 'failed' AND attempts < max_attempts)
      ORDER BY group_name, created_at ASC
    )
    RETURNING id, group_name, message, caption, image_url, action, attempts
  `)

  return rows
}

/** Mark a queue item as sent */
export async function markSent(id: number): Promise<void> {
  const pool = getE2ePool()
  await pool.query(
    `UPDATE zalo_message_queue SET status = 'sent', completed_at = NOW() WHERE id = $1`,
    [id]
  )
}

/** Mark a queue item as failed */
export async function markFailed(id: number, error: string): Promise<void> {
  const pool = getE2ePool()
  await pool.query(
    `UPDATE zalo_message_queue SET status = 'failed', error_message = $2 WHERE id = $1`,
    [id, error]
  )
}
