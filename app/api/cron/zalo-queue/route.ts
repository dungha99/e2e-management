import { NextResponse } from "next/server"
import { getNextZaloAccount, buildAbitstoreUrl } from "@/lib/zalo-accounts"
import { claimNextBatch, markSent, markFailed } from "@/lib/zalo-queue"
import { resolveGroupId, cacheGroupMapping } from "@/lib/zalo-groups"

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const batch = await claimNextBatch()

    if (batch.length === 0) {
      return NextResponse.json({ processed: 0, results: [] })
    }

    console.log(`[Zalo Queue] Processing ${batch.length} messages`)

    const results = []

    for (const item of batch) {
      try {
        // Pick account (round-robin)
        const account = await getNextZaloAccount()

        // Resolve group_id for THIS account
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

        console.log(`[Zalo Queue] Sending item ${item.id} "${item.group_name}" -> ${groupId} via ${account.account_name}`)

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

        // Cache group mapping for this account
        await cacheGroupMapping(account.id, groupId, item.group_name)

        console.log(`[Zalo Queue] Item ${item.id} sent successfully`)
        results.push({ id: item.id, status: "sent" })
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
