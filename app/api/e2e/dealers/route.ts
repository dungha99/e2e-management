import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getCached } from "@/lib/cache"

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const dealers = await getCached(
      "dealers:active",
      async () => {
        const result = await query(
          `SELECT id, name, group_zalo_name
           FROM dealers
           WHERE is_active = TRUE
           ORDER BY name ASC`
        )
        return result.rows
      },
      300 // Cache for 5 minutes - dealers rarely change
    )

    return NextResponse.json({
      dealers: dealers
    })
  } catch (error) {
    console.error("[Dealers API] Error fetching dealers:", error)
    return NextResponse.json({
      error: "Failed to fetch dealers",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
