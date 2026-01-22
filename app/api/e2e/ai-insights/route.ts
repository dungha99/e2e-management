import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { carId, sourceInstanceId, phoneNumber, userFeedback } = body

    // Validation
    if (!carId || !sourceInstanceId || !phoneNumber) {
      return NextResponse.json(
        { error: "Missing required fields: carId, sourceInstanceId, phoneNumber" },
        { status: 400 }
      )
    }

    // --- Step 1: Check database for latest AI insight ---
    const latestInsightResult = await e2eQuery(
      `SELECT
        ai.id,
        ai.ai_insight_summary,
        ai.selected_transition_id,
        ai.target_workflow_id,
        ai.is_positive,
        ai.created_at,
        EXTRACT(EPOCH FROM (NOW() - ai.created_at)) as age_seconds
       FROM ai_insights ai
       WHERE ai.car_id = $1 AND ai.source_instance_id = $2
       ORDER BY ai.created_at DESC
       LIMIT 1`,
      [carId, sourceInstanceId]
    )

    const existingInsight = latestInsightResult.rows[0]
    const isProcessing = existingInsight?.ai_insight_summary?.processing === true

    // --- Step 2: Handle User Feedback Loop ---
    if (userFeedback && existingInsight && !isProcessing) {
      console.log(`[AI Insights] User feedback received. Archiving current insight ${existingInsight.id}`)

      // 2a. Archive current insight to old_ai_insights
      await e2eQuery(
        `INSERT INTO old_ai_insights (
            ai_insight_id,
            ai_insight_summary,
            user_feedback,
            is_positive,
            created_at
          ) VALUES ($1, $2, $3, $4, NOW())`,
        [
          existingInsight.id,
          JSON.stringify(existingInsight.ai_insight_summary),
          userFeedback,
          existingInsight.is_positive
        ]
      )

      // 2b. Reset current insight to processing state (will be updated after webhook)
      await e2eQuery(
        `UPDATE ai_insights 
         SET ai_insight_summary = $1, 
             selected_transition_id = NULL, 
             target_workflow_id = NULL,
             is_positive = NULL,
             created_at = NOW()
         WHERE id = $2`,
        [JSON.stringify({ processing: true, feedbackContext: userFeedback }), existingInsight.id]
      )

      // Continue to webhook call section...
    } else if (existingInsight) {
      // --- Step 3: Standard Retrieval Check ---
      const ageSeconds = parseFloat(existingInsight.age_seconds)
      const isComplete = !!(existingInsight.selected_transition_id && existingInsight.target_workflow_id)

      // Prevent duplicate calls if recent
      if (ageSeconds < 30) {
        if (isComplete) {
          return await returnWithHistory(existingInsight)
        } else if (isProcessing) {
          return NextResponse.json({
            success: false,
            processing: true,
            message: "AI insights are still being processed.",
            ageSeconds: ageSeconds,
          }, { status: 202 })
        }
      }

      // Return complete insight if found
      if (isComplete) {
        return await returnWithHistory(existingInsight)
      }
    }

    // --- Step 4: Webhook Triggering Section ---
    let insightIdToUpdate = existingInsight?.id

    if (!insightIdToUpdate) {
      // Create new placeholder if none exists
      const placeholderResult = await e2eQuery(
        `INSERT INTO ai_insights (car_id, source_instance_id, ai_insight_summary, created_at) 
         VALUES ($1, $2, $3, NOW()) 
         RETURNING id`,
        [carId, sourceInstanceId, JSON.stringify({ processing: true })]
      )
      insightIdToUpdate = placeholderResult.rows[0].id
    }

    // Fetch history for full context in webhook
    const historyResult = await e2eQuery(
      `SELECT ai_insight_summary, user_feedback, created_at 
       FROM old_ai_insights 
       WHERE ai_insight_id = $1 
       ORDER BY created_at ASC`,
      [insightIdToUpdate]
    )

    // Call AI Webhook
    const aiWebhookUrl = `https://n8n.vucar.vn/webhook/c87920ee-2cc1-4493-a692-a5e4df64569e/a692-a5e4df64569e-c87920ee-2cc1-4493/${phoneNumber}`

    try {
      const response = await fetch(aiWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId,
          sourceInstanceId,
          phoneNumber,
          previousInsight: existingInsight?.ai_insight_summary, // Most recent insight from ai_insights table
          feedback: userFeedback      // Current user feedback
        })
      })

      if (!response.ok) throw new Error(`AI Webhook failed: ${response.status}`)

      let aiResponse = await response.json()
      if (Array.isArray(aiResponse)) aiResponse = aiResponse[0]

      // Update record with results
      await e2eQuery(
        `UPDATE ai_insights
         SET ai_insight_summary = $1, selected_transition_id = $2, target_workflow_id = $3
         WHERE id = $4`,
        [JSON.stringify(aiResponse.analysis), aiResponse.selected_transition_id, aiResponse.target_workflow_id, insightIdToUpdate]
      )

      const updatedInsight = (await e2eQuery(`SELECT * FROM ai_insights WHERE id = $1`, [insightIdToUpdate])).rows[0]
      return await returnWithHistory(updatedInsight, true)

    } catch (error) {
      console.error("[AI Insights] Webhook Error:", error)
      if (!existingInsight) await e2eQuery(`DELETE FROM ai_insights WHERE id = $1`, [insightIdToUpdate])
      return NextResponse.json({ error: "Failed to call AI webhook", details: String(error) }, { status: 500 })
    }

  } catch (error) {
    console.error("[AI Insights API] Error:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

// Helper to return insight with its history
async function returnWithHistory(insight: any, isNew: boolean = false) {
  const historyResult = await e2eQuery(
    `SELECT id, ai_insight_summary, user_feedback, is_positive, created_at 
     FROM old_ai_insights 
     WHERE ai_insight_id = $1 
     ORDER BY created_at ASC`,
    [insight.id]
  )

  const workflowResult = await e2eQuery(
    `SELECT name FROM workflows WHERE id = $1`,
    [insight.target_workflow_id]
  )

  return NextResponse.json({
    success: true,
    aiInsightId: insight.id,
    analysis: insight.ai_insight_summary,
    selectedTransitionId: insight.selected_transition_id,
    targetWorkflowId: insight.target_workflow_id,
    targetWorkflowName: workflowResult.rows[0]?.name || "Unknown Workflow",
    is_positive: insight.is_positive,
    history: historyResult.rows,
    isNew: isNew,
  })
}
