import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"
import { getCached } from "@/lib/cache"

export async function POST(req: Request) {
  try {
    const { lead_id } = await req.json()

    if (!lead_id) {
      return NextResponse.json({ error: "Lead ID is required" }, { status: 400 })
    }

    const cacheKey = `decoy-chat:${lead_id}`

    const threads = await getCached(
      cacheKey,
      async () => {
        // 1. Get phone number from lead
        const leadResult = await vucarV2Query(
          `SELECT phone, additional_phone
           FROM leads
           WHERE id = $1
           LIMIT 1`,
          [lead_id]
        )

        if (leadResult.rows.length === 0) {
          throw new Error("Lead not found")
        }

        const phone = leadResult.rows[0].phone || leadResult.rows[0].additional_phone

        if (!phone) {
          return []
        }

        // 2. Find auth_user with name equal to phone
        const authUserResult = await vucarV2Query(
          `SELECT id
           FROM auth_user
           WHERE name = $1
           LIMIT 1`,
          [phone]
        )

        if (authUserResult.rows.length === 0) {
          return []
        }

        const authUserId = authUserResult.rows[0].id

        // 3. Fetch threads with messages in a single optimized query (fixes N+1 pattern)
        const threadsResult = await vucarV2Query(
          `SELECT
            ct.id,
            ct.metadata,
            ct.created_at,
            COALESCE(
              json_agg(
                json_build_object(
                  'content', cm.content,
                  'sender', cm.sender,
                  'displayed_at', cm.displayed_at
                )
                ORDER BY cm.displayed_at ASC
              ) FILTER (WHERE cm.id IS NOT NULL),
              '[]'
            ) as messages
           FROM chat_threads ct
           LEFT JOIN chat_messages cm ON cm.thread_id = ct.id
           WHERE ct.user_id = $1
           GROUP BY ct.id, ct.metadata, ct.created_at
           ORDER BY ct.created_at DESC`,
          [authUserId]
        )

        // 4. Transform results and extract bot names
        const threadsWithMessages = threadsResult.rows.map((thread) => {
          // Extract bot name from metadata
          // If metadata.bot exists, use it; otherwise it's "default"
          let botName = "default"
          let metadata = thread.metadata

          // Handle if metadata is a JSON string
          if (typeof metadata === 'string') {
            try {
              metadata = JSON.parse(metadata)
            } catch (e) {
              // Keep as string if parse fails
            }
          }

          // Check for 'bot' key in metadata
          if (metadata && typeof metadata === 'object' && metadata.bot) {
            botName = metadata.bot
          }

          return {
            id: thread.id,
            bot_name: botName,
            created_at: thread.created_at,
            messages: thread.messages || []
          }
        })

        return threadsWithMessages
      },
      90 // Cache for 1.5 minutes - decoy threads don't change often
    )

    return NextResponse.json({ threads })
  } catch (error) {
    console.error("[Decoy Chat API] Error fetching chat:", error)
    return NextResponse.json({ error: "Failed to fetch decoy chat" }, { status: 500 })
  }
}
