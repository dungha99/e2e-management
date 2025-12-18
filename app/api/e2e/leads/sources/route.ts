import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { uid } = body

    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 })
    }

    const result = await vucarV2Query(
      `SELECT DISTINCT source
       FROM leads
       WHERE pic_id = $1::uuid
       AND source IS NOT NULL
       AND source != ''
       ORDER BY source ASC`,
      [uid]
    )

    const sources = result.rows.map((row) => row.source)

    return NextResponse.json({ sources })
  } catch (error) {
    console.error("[E2E Sources API] Error fetching sources:", error)
    return NextResponse.json(
      { error: "Failed to fetch sources", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
