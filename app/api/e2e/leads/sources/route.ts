import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { uid } = body

    if (!uid) {
      return NextResponse.json({ error: "UID is required" }, { status: 400 })
    }

    if (!isValidUUID(uid)) {
      return NextResponse.json({ sources: [] })
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
