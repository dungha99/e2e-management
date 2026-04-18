import { NextResponse } from "next/server"
import { vucarZaloQuery } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone } = body

    if (!phone) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 })
    }

    console.log(`[Messages Zalo V2] Fetching messages for phone: ${phone}`)

    // Step 1: Find the leads_relation record(s) for this phone
    const relRes = await vucarZaloQuery(
      `SELECT lr.account_id, lr.friend_id, lr.lead_name
       FROM leads_relation lr
       WHERE lr.phone = $1
       ORDER BY lr.updated_at DESC NULLS LAST
       LIMIT 5`,
      [phone]
    )

    if (relRes.rows.length === 0) {
      console.log(`[Messages Zalo V2] No leads_relation found for phone: ${phone}`)
      return NextResponse.json({ messages: [], accounts: [], debug: "No leads_relation record found" })
    }

    // Collect all thread lookups
    const threadPairs = relRes.rows.map((r: any) => ({
      account_id: r.account_id,
      friend_id: r.friend_id,
      lead_name: r.lead_name,
    }))

    // Step 2: Fetch messages for ALL thread pairs (some leads have multiple Zalo accounts)
    const friendIds = threadPairs.map((t: any) => t.friend_id)
    const accountIds = threadPairs.map((t: any) => t.account_id)

    const msgRes = await vucarZaloQuery(
      `SELECT
         m.id,
         m.own_id,
         m.thread_id,
         m.uid_from,
         m.display_name,
         m.msg_type,
         m.content,
         m.timestamp::text AS timestamp,
         m.created_at,
         m.is_self,
         m.attachments,
         m.media_path,
         m.quote
       FROM messages m
       WHERE m.thread_id = ANY($1::text[])
         AND m.own_id = ANY($2::text[])
       ORDER BY m.created_at ASC
       LIMIT 500`,
      [friendIds, accountIds]
    )

    console.log(`[Messages Zalo V2] Found ${msgRes.rows.length} messages across ${threadPairs.length} thread(s)`)

    // Step 3: Also fetch conversation metadata
    const convRes = await vucarZaloQuery(
      `SELECT c.own_id, c.thread_id, c.name, c.last_message_at, c.message_count
       FROM conversations c
       WHERE c.thread_id = ANY($1::text[])
         AND c.own_id = ANY($2::text[])`,
      [friendIds, accountIds]
    )

    // Build account info map
    const accountsInfo = threadPairs.map((t: any) => {
      const conv = convRes.rows.find((c: any) => c.thread_id === t.friend_id && c.own_id === t.account_id)
      return {
        account_id: t.account_id,
        friend_id: t.friend_id,
        lead_name: t.lead_name,
        conversation_name: conv?.name || null,
        last_message_at: conv?.last_message_at || null,
        message_count: conv?.message_count || 0,
      }
    })

    // Transform messages to a consistent format for ZaloChatViewer
    const messages = msgRes.rows.map((m: any) => {
      // Parse attachments for image URLs
      let imgUrl: string | null = null
      let msgType = m.msg_type || "text"

      if (m.attachments) {
        try {
          const attachments = typeof m.attachments === "string" ? JSON.parse(m.attachments) : m.attachments
          if (Array.isArray(attachments) && attachments.length > 0) {
            const first = attachments[0]
            if (first.href || first.url) {
              imgUrl = first.href || first.url
              if (!msgType || msgType === "webchat") msgType = "image"
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      if (m.media_path && !imgUrl) {
        imgUrl = m.media_path
        if (!msgType || msgType === "webchat") msgType = "image"
      }

      return {
        _id: String(m.id),
        content: m.content || "",
        uidFrom: m.is_self ? "0" : m.uid_from,
        fromMe: m.is_self,
        timestamp: m.timestamp ? parseInt(m.timestamp, 10) : new Date(m.created_at).getTime(),
        dateAction: m.created_at,
        type: msgType === "webchat" ? "text" : msgType,
        img: imgUrl,
        displayName: m.display_name || null,
        accountId: m.own_id,
        threadId: m.thread_id,
        quote: m.quote || null,
      }
    })

    return NextResponse.json({
      messages,
      accounts: accountsInfo,
    })
  } catch (error) {
    console.error("[Messages Zalo V2] Error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { messages: [], accounts: [], error: "Failed to fetch messages", details: errorMessage },
      { status: 500 }
    )
  }
}
