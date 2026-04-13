import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const picId = searchParams.get("pic_id")

    if (!picId) {
      return NextResponse.json(
        { error: "Missing required param: pic_id" },
        { status: 400 }
      )
    }

    const result = await vucarV2Query(
      `SELECT sc.b_user_id, u.user_name
       FROM staff_connections sc
       JOIN users u ON u.id = sc.b_user_id
       WHERE sc.c_user_id = $1
       ORDER BY u.user_name ASC`,
      [picId]
    )

    return NextResponse.json({ partners: result.rows })
  } catch (error) {
    console.error("[Staff Connections API] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch staff connections", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
