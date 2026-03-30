import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const car_id = searchParams.get("car_id")
    const action_type = searchParams.get("action_type")

    if (!car_id || !action_type) {
      return NextResponse.json(
        { error: "car_id and action_type are required" },
        { status: 400 }
      )
    }

    const accountRes = await e2eQuery(
      `SELECT id FROM zalo_account WHERE car_id = $1 AND is_delete = false ORDER BY created_at DESC LIMIT 1`,
      [car_id]
    )

    if (accountRes.rows.length === 0) {
      return NextResponse.json({ success: false })
    }

    const zalo_account_id = accountRes.rows[0].id
    const actionRes = await e2eQuery(
      `SELECT status FROM zalo_action WHERE zalo_account_id = $1 AND action_type = $2 LIMIT 1`,
      [zalo_account_id, action_type]
    )

    if (actionRes.rows.length === 0) {
      return NextResponse.json({ success: false, failed: false })
    }

    const status = actionRes.rows[0].status
    return NextResponse.json({ success: status === "success", failed: status === "failed" })
  } catch (error) {
    console.error("[Check Zalo Action API] Error:", error)
    return NextResponse.json(
      { error: "Failed to check zalo action" },
      { status: 500 }
    )
  }
}
