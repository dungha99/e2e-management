import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { carId, sourceInstanceId, phoneNumber } = body

    // Validation
    if (!carId || !sourceInstanceId || !phoneNumber) {
      return NextResponse.json(
        { error: "Missing required fields: carId, sourceInstanceId, phoneNumber" },
        { status: 400 }
      )
    }

    // Step 1: Check database for existing AI insights with age calculation
    const existingInsightResult = await e2eQuery(
      `SELECT
        ai.id,
        ai.car_id,
        ai.source_instance_id,
        ai.ai_insight_summary,
        ai.selected_transition_id,
        ai.target_workflow_id,
        ai.created_at,
        w.name as target_workflow_name,
        EXTRACT(EPOCH FROM (NOW() - ai.created_at)) as age_seconds
       FROM ai_insights ai
       LEFT JOIN workflows w ON w.id = ai.target_workflow_id
       WHERE ai.car_id = $1 AND ai.source_instance_id = $2
       ORDER BY ai.created_at DESC
       LIMIT 1`,
      [carId, sourceInstanceId]
    )

    // If existing insight found, check its age and completeness
    if (existingInsightResult.rows.length > 0) {
      const existingInsight = existingInsightResult.rows[0]
      const ageSeconds = parseFloat(existingInsight.age_seconds)
      const isComplete = !!(existingInsight.selected_transition_id && existingInsight.target_workflow_id)

      console.log(`[AI Insights] Found existing insight: age=${ageSeconds.toFixed(1)}s, complete=${isComplete}`)

      // If insight is less than 30 seconds old, prevent duplicate webhook call
      if (ageSeconds < 30) {
        if (isComplete) {
          // Complete and recent - return cached data
          console.log("[AI Insights] Returning cached complete insight (< 30s old)")
          return NextResponse.json({
            success: true,
            cached: true,
            aiInsightId: existingInsight.id,
            analysis: existingInsight.ai_insight_summary,
            selectedTransitionId: existingInsight.selected_transition_id,
            targetWorkflowId: existingInsight.target_workflow_id,
            targetWorkflowName: existingInsight.target_workflow_name || "Unknown Workflow",
            message: "Using cached AI insights",
          })
        } else {
          // Incomplete but recent - still processing
          console.log("[AI Insights] AI webhook still processing (< 30s old)")
          return NextResponse.json({
            success: false,
            processing: true,
            message: "AI insights are still being processed. Please wait a moment and try again.",
            ageSeconds: ageSeconds,
          }, { status: 202 }) // 202 Accepted - request is being processed
        }
      }

      // If insight is older than 30 seconds and complete, return it
      if (isComplete) {
        console.log("[AI Insights] Returning cached complete insight (> 30s old)")
        return NextResponse.json({
          success: true,
          cached: true,
          aiInsightId: existingInsight.id,
          analysis: existingInsight.ai_insight_summary,
          selectedTransitionId: existingInsight.selected_transition_id,
          targetWorkflowId: existingInsight.target_workflow_id,
          targetWorkflowName: existingInsight.target_workflow_name || "Unknown Workflow",
          message: "Using cached AI insights",
        })
      }

      // If older than 30 seconds but incomplete, allow re-fetching
      console.log("[AI Insights] Old incomplete insight found (> 30s), allowing new webhook call")
    }

    // Step 2: Create placeholder record BEFORE calling webhook to prevent race conditions
    console.log("[AI Insights] Creating placeholder record before webhook call")
    const placeholderResult = await e2eQuery(
      `INSERT INTO ai_insights (
        car_id,
        source_instance_id,
        ai_insight_summary,
        selected_transition_id,
        target_workflow_id,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id`,
      [
        carId,
        sourceInstanceId,
        JSON.stringify({ processing: true }), // Placeholder analysis
        null, // Will be updated after webhook completes
        null, // Will be updated after webhook completes
      ]
    )

    const placeholderId = placeholderResult.rows[0].id
    console.log(`[AI Insights] Placeholder created with ID: ${placeholderId}`)

    // Step 3: Call AI webhook
    const aiWebhookUrl = `https://n8n.vucar.vn/webhook/c87920ee-2cc1-4493-a692-a5e4df64569e/a692-a5e4df64569e-c87920ee-2cc1-4493/${phoneNumber}`

    let aiResponse
    try {
      const response = await fetch(aiWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          carId,
          sourceInstanceId,
          phoneNumber
        })
      })

      if (!response.ok) {
        throw new Error(`AI webhook returned status ${response.status}`)
      }

      aiResponse = await response.json()

      // Handle array response format
      if (Array.isArray(aiResponse) && aiResponse.length > 0) {
        aiResponse = aiResponse[0]
      }

      console.log("[AI Insights] Raw webhook response:", JSON.stringify(aiResponse, null, 2))
    } catch (error) {
      console.error("[AI Insights] Error calling webhook:", error)

      // Delete placeholder record since webhook failed
      await e2eQuery(`DELETE FROM ai_insights WHERE id = $1`, [placeholderId])
      console.log(`[AI Insights] Deleted placeholder ${placeholderId} due to webhook error`)

      return NextResponse.json(
        {
          error: "Failed to call AI webhook",
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      )
    }

    // Step 3: Validate AI response structure
    if (!aiResponse || typeof aiResponse !== "object") {
      console.error("[AI Insights] Invalid response type:", typeof aiResponse)
      await e2eQuery(`DELETE FROM ai_insights WHERE id = $1`, [placeholderId])
      return NextResponse.json(
        { error: "Invalid AI response type", details: `Expected object, got ${typeof aiResponse}` },
        { status: 500 }
      )
    }

    if (!aiResponse.analysis) {
      console.error("[AI Insights] Missing analysis field:", aiResponse)
      await e2eQuery(`DELETE FROM ai_insights WHERE id = $1`, [placeholderId])
      return NextResponse.json(
        { error: "Invalid AI response structure", details: "Missing 'analysis' field" },
        { status: 500 }
      )
    }

    if (!aiResponse.selected_transition_id) {
      console.error("[AI Insights] Missing selected_transition_id field:", aiResponse)
      await e2eQuery(`DELETE FROM ai_insights WHERE id = $1`, [placeholderId])
      return NextResponse.json(
        { error: "Invalid AI response structure", details: "Missing 'selected_transition_id' field" },
        { status: 500 }
      )
    }

    if (!aiResponse.target_workflow_id) {
      console.error("[AI Insights] Missing target_workflow_id field:", aiResponse)
      await e2eQuery(`DELETE FROM ai_insights WHERE id = $1`, [placeholderId])
      return NextResponse.json(
        { error: "Invalid AI response structure", details: "Missing 'target_workflow_id' field" },
        { status: 500 }
      )
    }

    // Step 4: Update placeholder record with webhook results
    console.log(`[AI Insights] Updating placeholder ${placeholderId} with webhook results`)
    await e2eQuery(
      `UPDATE ai_insights
       SET ai_insight_summary = $1,
           selected_transition_id = $2,
           target_workflow_id = $3
       WHERE id = $4`,
      [
        JSON.stringify(aiResponse.analysis),
        aiResponse.selected_transition_id,
        aiResponse.target_workflow_id,
        placeholderId,
      ]
    )

    const aiInsightId = placeholderId

    // Step 5: Fetch target workflow name for response
    const workflowResult = await e2eQuery(
      `SELECT name FROM workflows WHERE id = $1`,
      [aiResponse.target_workflow_id]
    )

    const targetWorkflowName = workflowResult.rows[0]?.name || "Unknown Workflow"

    return NextResponse.json({
      success: true,
      cached: false,
      aiInsightId,
      analysis: aiResponse.analysis,
      selectedTransitionId: aiResponse.selected_transition_id,
      targetWorkflowId: aiResponse.target_workflow_id,
      targetWorkflowName,
      message: "AI insights generated and stored successfully",
    })
  } catch (error) {
    console.error("[E2E API] Error processing AI insights:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process AI insights",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
