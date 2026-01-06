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

    // Step 1: Check database for existing AI insights
    const existingInsightResult = await e2eQuery(
      `SELECT
        ai.id,
        ai.car_id,
        ai.source_instance_id,
        ai.ai_insight_summary,
        ai.selected_transition_id,
        ai.target_workflow_id,
        ai.created_at,
        w.name as target_workflow_name
       FROM ai_insights ai
       LEFT JOIN workflows w ON w.id = ai.target_workflow_id
       WHERE ai.car_id = $1 AND ai.source_instance_id = $2
       ORDER BY ai.created_at DESC
       LIMIT 1`,
      [carId, sourceInstanceId]
    )

    // If existing insight found, return it
    if (existingInsightResult.rows.length > 0) {
      const existingInsight = existingInsightResult.rows[0]
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

    // Step 2: No existing insight, call AI webhook
    const aiWebhookUrl = `https://n8n.vucar.vn/webhook/c87920ee-2cc1-4493-a692-a5e4df64569e/a692-a5e4df64569e-c87920ee-2cc1-4493/${phoneNumber}`

    let aiResponse
    try {
      const response = await fetch(aiWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      return NextResponse.json(
        { error: "Invalid AI response type", details: `Expected object, got ${typeof aiResponse}` },
        { status: 500 }
      )
    }

    if (!aiResponse.analysis) {
      console.error("[AI Insights] Missing analysis field:", aiResponse)
      return NextResponse.json(
        { error: "Invalid AI response structure", details: "Missing 'analysis' field" },
        { status: 500 }
      )
    }

    if (!aiResponse.selected_transition_id) {
      console.error("[AI Insights] Missing selected_transition_id field:", aiResponse)
      return NextResponse.json(
        { error: "Invalid AI response structure", details: "Missing 'selected_transition_id' field" },
        { status: 500 }
      )
    }

    if (!aiResponse.target_workflow_id) {
      console.error("[AI Insights] Missing target_workflow_id field:", aiResponse)
      return NextResponse.json(
        { error: "Invalid AI response structure", details: "Missing 'target_workflow_id' field" },
        { status: 500 }
      )
    }

    // Step 4: Store new AI insights in database
    const insertResult = await e2eQuery(
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
        JSON.stringify(aiResponse.analysis),
        aiResponse.selected_transition_id,
        aiResponse.target_workflow_id,
      ]
    )

    const aiInsightId = insertResult.rows[0].id

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
