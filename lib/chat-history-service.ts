import { vucarV2Query } from "@/lib/db"

const N8N_SHOPID_WEBHOOK = "https://n8n.vucar.vn/webhook/f23b1b03-b198-4dc3-a196-d97a5cae8aff"
const AKABIZ_CHAT_HISTORY_URL = "https://crm-vucar-api.vucar.vn/api/v1/akabiz/get-chat-history"

/**
 * Fetch real-time Zalo chat history from AkaBiz CRM API.
 * 
 * Flow:
 * 1. Resolve picId from carId if not provided
 * 2. Get shopId from n8n webhook using picId
 * 3. Fetch chat history from AkaBiz using phone + shopId
 * 
 * Returns last `limit` messages (default 100), or empty array on failure.
 */
export async function fetchZaloChatHistory({
  carId,
  phone,
  picId,
  limit = 100,
}: {
  carId: string
  phone: string
  picId?: string | null
  limit?: number
}): Promise<any[]> {
  try {
    // Step 1: Resolve picId if not provided
    let resolvedPicId = picId
    if (!resolvedPicId) {
      const leadCheck = await vucarV2Query(
        `SELECT l.pic_id FROM cars c JOIN leads l ON l.id = c.lead_id WHERE c.id = $1 LIMIT 1`,
        [carId]
      )
      resolvedPicId = leadCheck.rows[0]?.pic_id
    }

    if (!resolvedPicId) {
      console.warn(`[ChatHistoryService] No picId found for car ${carId}, cannot fetch chat history`)
      return []
    }

    // Step 2: Get shopId from n8n
    let shopId: string | undefined
    try {
      const n8nRes = await fetch(N8N_SHOPID_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pic_id: resolvedPicId }),
      })
      if (n8nRes.ok) {
        let n8nData: any = await n8nRes.json()
        if (Array.isArray(n8nData)) n8nData = n8nData[0]
        shopId = n8nData?.shop_id
      }
    } catch (err) {
      console.warn(`[ChatHistoryService] Failed to get shopId for picId=${resolvedPicId}:`, err)
    }

    if (!shopId) {
      console.warn(`[ChatHistoryService] No shopId returned for picId=${resolvedPicId}`)
      return []
    }

    // Step 3: Fetch chat history from AkaBiz (with retries)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const historyRes = await fetch(AKABIZ_CHAT_HISTORY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({ phone, shop_id: shopId }),
        })

        if (!historyRes.ok) {
          console.warn(`[ChatHistoryService] AkaBiz API failed on attempt ${attempt}: ${historyRes.status}`)
          if (attempt < 3) await new Promise((res) => setTimeout(res, 2000))
          continue
        }

        const historyData = await historyRes.json()
        if (historyData.is_successful && historyData.chat_history) {
          const messages = historyData.chat_history.slice(-limit)
          console.log(`[ChatHistoryService] Loaded ${messages.length} messages for phone=${phone}, car=${carId}`)
          return messages
        }

        console.warn(`[ChatHistoryService] AkaBiz returned is_successful=false for phone=${phone} (attempt ${attempt})`)
        if (attempt < 3) await new Promise((res) => setTimeout(res, 2000))
        continue // Retry on data-level failure
      } catch (err) {
        console.warn(`[ChatHistoryService] Error during AkaBiz fetch (attempt ${attempt}):`, err)
        if (attempt < 3) await new Promise((res) => setTimeout(res, 2000))
      }
    }

    return []
  } catch (err) {
    console.error(`[ChatHistoryService] Error fetching chat history:`, err)
    return []
  }
}
