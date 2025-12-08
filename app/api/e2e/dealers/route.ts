import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await query(
      `SELECT id, name, group_zalo_name 
       FROM dealers 
       WHERE is_active = TRUE 
       ORDER BY name ASC`
    )

    return NextResponse.json({
      dealers: result.rows
    })
  } catch (error) {
    console.error("[Dealers API] Error fetching dealers:", error)
    return NextResponse.json({
      error: "Failed to fetch dealers",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
