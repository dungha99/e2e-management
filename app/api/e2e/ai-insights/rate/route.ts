import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, isHistory, isPositive } = body

    if (!id) {
      return NextResponse.json({ error: "Missing insight ID" }, { status: 400 })
    }

    if (isHistory) {
      // Update old_ai_insights table
      await e2eQuery(
        `UPDATE old_ai_insights SET is_positive = $1 WHERE id = $2`,
        [isPositive, id]
      )
    } else {
      // Update ai_insights table
      await e2eQuery(
        `UPDATE ai_insights SET is_positive = $1 WHERE id = $2`,
        [isPositive, id]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[AI Rating API] Error:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
