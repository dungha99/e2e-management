import { NextResponse } from "next/server"
import { getNextZaloAccount, buildAbitstoreUrl } from "@/lib/zalo-accounts"
import { claimNextBatch, markSent, markFailed } from "@/lib/zalo-queue"
import { resolveGroupId, cacheGroupMapping } from "@/lib/zalo-groups"
import { getNextVucarAccount, VUCAR_SEND_BASE_URL } from "@/lib/vucar-zalo-accounts"
import { resolveVucarGroupId, cacheVucarGroupMapping } from "@/lib/vucar-zalo-groups"

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const batch = await claimNextBatch()

    if (batch.length === 0) {
      return NextResponse.json({ processed: 0, results: [] })
    }

    console.log(`[Zalo Queue] Processing ${batch.length} messages`)

    const results = []

    // Pre-select one vucar account per unique pic_id for this entire batch.
    // Round-robin advances once per batch (at claim time), not once per message.
    const vucarAccountByPicId = new Map<string, Awaited<ReturnType<typeof getNextVucarAccount>>>()
    for (const item of batch) {
      if (item.pic_id && !vucarAccountByPicId.has(item.pic_id)) {
        vucarAccountByPicId.set(item.pic_id, await getNextVucarAccount(item.pic_id))
      }
    }

    for (const item of batch) {
      try {
        // --- Vucar path: pic_id present and has staff connections ---
        if (item.pic_id) {
          const vucarAccount = vucarAccountByPicId.get(item.pic_id) ?? null

          if (vucarAccount) {
            const groupId = await resolveVucarGroupId(item.group_name, vucarAccount)

            const url = VUCAR_SEND_BASE_URL
              .replace("{ownId}", vucarAccount.own_id)
              .replace("{groupId}", groupId)

            const payload = {
              message: item.message,
              image_urls: item.image_url || [],
            }

            console.log(`[Zalo Queue] [Vucar] Sending item ${item.id} "${item.group_name}" -> ${groupId} via ${vucarAccount.account_name}`)

            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${vucarAccount.bearer_token}`,
              },
              body: JSON.stringify(payload),
            })

            if (!response.ok) {
              const errText = await response.text()
              throw new Error(`Vucar API ${response.status}: ${errText}`)
            }

            await markSent(item.id)
            await cacheVucarGroupMapping(vucarAccount.id, groupId, item.group_name)

            console.log(`[Zalo Queue] [Vucar] Item ${item.id} sent successfully`)
            results.push({ id: item.id, status: "sent", path: "vucar" })
            continue
          }

          // No vucar connections for this pic_id → fall through to Abit
          console.log(`[Zalo Queue] No vucar connections for pic_id ${item.pic_id}, falling back to Abit`)
        }

        // --- Abit path (unchanged) ---
        const account = await getNextZaloAccount()
        const groupId = await resolveGroupId(item.group_name, account)

        const url = buildAbitstoreUrl(account)
        const payload = {
          send_from_number: account.phone,
          send_to_groupid: groupId,
          message: item.message,
          caption: item.caption || " ",
          image_url: item.image_url || [],
          action: item.action || "",
        }

        console.log(`[Zalo Queue] [Abit] Sending item ${item.id} "${item.group_name}" -> ${groupId} via ${account.account_name}`)

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errText = await response.text()
          throw new Error(`Abitstore ${response.status}: ${errText}`)
        }

        await markSent(item.id)
        await cacheGroupMapping(account.id, groupId, item.group_name)

        console.log(`[Zalo Queue] [Abit] Item ${item.id} sent successfully`)
        results.push({ id: item.id, status: "sent", path: "abit" })

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        console.error(`[Zalo Queue] Item ${item.id} failed:`, errMsg)
        await markFailed(item.id, errMsg)
        results.push({ id: item.id, status: "failed", error: errMsg })
      }
    }

    return NextResponse.json({ processed: batch.length, results })
  } catch (error) {
    console.error("[Zalo Queue] Cron error:", error)
    return NextResponse.json(
      { error: "Queue processing failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
