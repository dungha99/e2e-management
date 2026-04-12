import { vucarV2Query, e2eQuery } from "@/lib/db"

const N8N_SHOPID_WEBHOOK = "https://n8n.vucar.vn/webhook/f23b1b03-b198-4dc3-a196-d97a5cae8aff"
const AKABIZ_CHAT_HISTORY_URL = "https://crm-vucar-api.vucar.vn/api/v1/akabiz/get-chat-history"
const VUCAR_ZALO_GET_MSG_CONNECTOR_ID = "3579bf8f-0d19-4e10-ab89-21a6133f8e04"

/**
 * Fetch Zalo chat history with 3-source fallback:
 *   Source 1: AkaBiz CRM API (via n8n shopId)
 *   Source 2: Vucar Zalo Get Message API (via leads.zalo_account)
 *   Source 3: sale_status.messages_zalo (DB)
 *
 * All sources normalize to objects containing at minimum:
 *   senderName  — "Vucar ..." = PIC, otherwise = customer
 *   dateAction  — ISO date string
 *   msg_content — message text
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

  // --- Source 1: AkaBiz ---
  try {
    let resolvedPicId = picId
    if (!resolvedPicId) {
      const leadCheck = await vucarV2Query(
        `SELECT l.pic_id FROM cars c JOIN leads l ON l.id = c.lead_id WHERE c.id = $1 LIMIT 1`,
        [carId]
      )
      resolvedPicId = leadCheck.rows[0]?.pic_id
    }

    if (resolvedPicId) {
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

      if (shopId) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const historyRes = await fetch(AKABIZ_CHAT_HISTORY_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json", accept: "application/json" },
              body: JSON.stringify({ phone, shop_id: shopId }),
            })

            if (historyRes.ok) {
              const historyData = await historyRes.json()
              if (historyData.is_successful && historyData.chat_history?.length > 0) {
                const messages = historyData.chat_history.slice(-limit)
                console.log(`[ChatHistoryService] Source: AkaBiz — ${messages.length} messages (shopId=${shopId})`)
                return messages
              }
            }

            console.warn(`[ChatHistoryService] AkaBiz attempt ${attempt} failed for phone=${phone}`)
            if (attempt < 3) await new Promise((r) => setTimeout(r, 2000))
          } catch (err) {
            console.warn(`[ChatHistoryService] AkaBiz attempt ${attempt} error:`, err)
            if (attempt < 3) await new Promise((r) => setTimeout(r, 2000))
          }
        }
      } else {
        console.warn(`[ChatHistoryService] No shopId for picId=${resolvedPicId}, skipping AkaBiz`)
      }
    } else {
      console.warn(`[ChatHistoryService] No picId for car ${carId}, skipping AkaBiz`)
    }
  } catch (err) {
    console.warn(`[ChatHistoryService] Source 1 (AkaBiz) unexpected error:`, err)
  }

  // --- Source 2: Vucar Zalo Get Message API ---
  try {
    const leadResult = await vucarV2Query(
      `SELECT l.zalo_account FROM cars c JOIN leads l ON l.id = c.lead_id WHERE c.id = $1 LIMIT 1`,
      [carId]
    )
    const zaloAccount: string | null = leadResult.rows[0]?.zalo_account || null
    if (zaloAccount) {
      const [ownId, threadId] = zaloAccount.split(":")
      if (ownId && threadId) {
        const connectorResult = await e2eQuery(
          `SELECT * FROM api_connectors WHERE id = $1 LIMIT 1`,
          [VUCAR_ZALO_GET_MSG_CONNECTOR_ID]
        )
        if (connectorResult.rows.length > 0) {
          const connector = connectorResult.rows[0]
          let authConfig = connector.auth_config
          if (typeof authConfig === "string") {
            try { authConfig = JSON.parse(authConfig) } catch { /* ignore */ }
          }
          const headers: Record<string, string> = { "Content-Type": "application/json" }
          if (authConfig?.type === "bearer" && authConfig?.token) {
            headers["Authorization"] = `Bearer ${authConfig.token}`
          } else if (authConfig && typeof authConfig === "object") {
            Object.entries(authConfig).forEach(([k, v]) => {
              if (typeof v === "string" && k !== "type") headers[k] = v
            })
          }
          let url: string = connector.base_url
          url = url.replace("{ownId}", ownId).replace("{threadId}", threadId)
          const res = await fetch(url, { method: "GET", headers })
          if (res.ok) {
            const data = await res.json()
            const rawMessages: any[] = data?.data || []
            if (rawMessages.length > 0) {
              const messages = rawMessages.slice(-limit).map((msg: any) => ({
                senderName: msg.is_self ? "Vucar PIC" : "Customer",
                dateAction: msg.created_at || new Date(parseInt(msg.timestamp) * 1000).toISOString(),
                msg_content: msg.content || "",
                content: msg.content || "",
              }))
              console.log(`[ChatHistoryService] Source: Vucar Zalo API — ${messages.length} messages (ownId=${ownId}, threadId=${threadId})`)
              return messages
            }
          }
        }
      }
    } else {
      console.warn(`[ChatHistoryService] No zalo_account for car ${carId}, skipping Vucar Zalo API`)
    }
  } catch (err) {
    console.warn(`[ChatHistoryService] Source 2 (Vucar Zalo API) failed:`, err)
  }

  // --- Source 3: sale_status.messages_zalo (DB) ---
  try {
    const dbResult = await vucarV2Query(
      `SELECT ss.messages_zalo FROM cars c
       LEFT JOIN sale_status ss ON ss.car_id = c.id
       WHERE c.id = $1 LIMIT 1`,
      [carId]
    )
    const zaloMessages: any[] | null = dbResult.rows[0]?.messages_zalo
    if (zaloMessages && Array.isArray(zaloMessages) && zaloMessages.length > 0) {
      const messages = zaloMessages.slice(-limit).map((msg: any) => {
        const isFromCustomer = msg.fromMe === false || (msg.uidFrom && msg.uidFrom !== 0 && msg.uidFrom !== "0")
        return {
          senderName: isFromCustomer ? "Customer" : "Vucar PIC",
          dateAction: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
          msg_content: msg.text || msg.body || msg.content || "",
          content: msg.text || msg.body || msg.content || "",
        }
      })
      console.log(`[ChatHistoryService] Source: messages_zalo DB — ${messages.length} messages`)
      return messages
    }
  } catch (err) {
    console.warn(`[ChatHistoryService] Source 3 (messages_zalo DB) failed:`, err)
  }

  console.warn(`[ChatHistoryService] All sources failed for carId=${carId}, phone=${phone}`)
  return []
}
