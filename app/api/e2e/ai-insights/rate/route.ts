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

      // Trigger AI Note Update for feedback analysis
      if (isPositive !== null) {
        const insightResult = await e2eQuery(`SELECT ai_insight_summary FROM old_ai_insights WHERE id = $1`, [id])
        const insight = insightResult.rows[0]
        if (insight) {
          const { updateAiNoteFromFeedback } = await import("@/lib/ai-notes-service")
          updateAiNoteFromFeedback({
            block: "insight-generator",
            aiResponse: JSON.stringify(insight.ai_insight_summary),
            userFeedback: isPositive ? "User liked this analysis." : "User disliked this analysis.",
            feedbackType: isPositive ? "positive" : "negative",
            feedbackInsightId: id
          }).catch(err => console.error("[AI Note Update Rate History] Error:", err))
        }
      }
    } else {
      // Update ai_insights table
      await e2eQuery(
        `UPDATE ai_insights SET is_positive = $1 WHERE id = $2`,
        [isPositive, id]
      )

      // If rating the CURRENT insight, we archive a copy to capture the "rating event" 
      // as a snapshot for the AI to learn from.
      if (isPositive !== null) {
        const currentResult = await e2eQuery(`SELECT * FROM ai_insights WHERE id = $1`, [id])
        const current = currentResult.rows[0]
        if (current) {
          const archiveResult = await e2eQuery(
            `INSERT INTO old_ai_insights (ai_insight_id, ai_insight_summary, user_feedback, is_positive, created_at)
             VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
            [id, JSON.stringify(current.ai_insight_summary), isPositive ? "Positive Rating" : "Negative Rating", isPositive]
          )
          const archiveId = archiveResult.rows[0].id

          const { updateAiNoteFromFeedback } = await import("@/lib/ai-notes-service")
          updateAiNoteFromFeedback({
            block: "insight-generator",
            aiResponse: JSON.stringify(current.ai_insight_summary),
            userFeedback: isPositive ? "User liked this analysis." : "User disliked this analysis.",
            feedbackType: isPositive ? "positive" : "negative",
            feedbackInsightId: archiveId
          }).catch(err => console.error("[AI Note Update Rate Current] Error:", err))
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[AI Rating API] Error:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
