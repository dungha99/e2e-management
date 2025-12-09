import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getCached } from "@/lib/cache"

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const dynamicKey = process.env.ZALO_DYNAMIC_KEY
    const smownerId = process.env.ZALO_SMOWNER_ID

    if (!dynamicKey || !smownerId) {
      return NextResponse.json(
        { error: "Zalo API credentials not configured" },
        { status: 500 }
      )
    }

    const groups = await getCached(
      "dealer-groups:all",
      async () => {
        const response = await fetch(
          `https://new.abitstore.vn/zalo/listAllGroup?dynamic_key=${dynamicKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              smownerid: smownerId
            }),
          }
        )

        if (!response.ok) {
          throw new Error(`Zalo API returned ${response.status}`)
        }

        const data = await response.json()

        // Fetch dealers from database to match with Zalo groups
        const dealersResult = await query(
          `SELECT id, name, group_zalo_name FROM dealers WHERE is_active = TRUE`
        )

        const dealersByGroupName = new Map(
          dealersResult.rows.map((dealer: any) => [dealer.group_zalo_name, dealer.id])
        )

        // Extract all_groups array from the response
        if (data && data.all_groups && Array.isArray(data.all_groups)) {
          return data.all_groups.map((group: any) => ({
            groupId: group.groupId,
            groupName: group.groupname,
            numberMembers: group.number_member,
            dealerId: dealersByGroupName.get(group.groupname) || null
          }))
        }

        return []
      },
      300 // Cache for 5 minutes - groups don't change often
    )

    return NextResponse.json({ groups })
  } catch (error) {
    console.error("[Dealer Groups API] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch dealer groups",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
