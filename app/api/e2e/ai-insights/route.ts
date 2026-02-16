import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"
import { findSimilarLeads } from "@/lib/vector-search"
import { handleAutoUseFlow } from "@/lib/workflow-service"

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
      const archiveResult = await e2eQuery(
        `INSERT INTO old_ai_insights (
            ai_insight_id,
            ai_insight_summary,
            user_feedback,
            is_positive,
            created_at
          ) VALUES ($1, $2, $3, $4, NOW())
          RETURNING id`,
        [
          existingInsight.id,
          JSON.stringify(existingInsight.ai_insight_summary),
          userFeedback,
          existingInsight.is_positive
        ]
      )
      const feedbackInsightId = archiveResult.rows[0].id

      // 2b. Trigger AI Note Update in parallel
      // We use a separate block name for this context
      import("@/lib/ai-notes-service").then(({ updateAiNoteFromFeedback }) => {
        updateAiNoteFromFeedback({
          block: "insight-generator",
          aiResponse: JSON.stringify(existingInsight.ai_insight_summary),
          userFeedback,
          feedbackType: "text",
          feedbackInsightId
        }).catch(err => console.error("[AI Note Update] Background error:", err))
      })

      // 2c. Reset current insight to processing state (will be updated after webhook)
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

    // --- Step 4a: Vector search for similar leads context ---
    let similarLeadsContext = "";
    let currentContext = "";
    try {
      const leadResult = await vucarV2Query(
        `SELECT c.brand, c.model, c.variant, c.year, c.location, c.mileage,
                ss.price_customer, ss.price_highest_bid, ss.stage, ss.qualified,
                ss.intention, ss.negotiation_ability, l.source, ss.notes, l.customer_feedback
         FROM cars c
         LEFT JOIN leads l ON l.id = c.lead_id
         LEFT JOIN sale_status ss ON ss.car_id = c.id
         WHERE c.id = $1 LIMIT 1`,
        [carId]
      );
      if (leadResult.rows.length > 0) {
        const vectorResult = await findSimilarLeads(leadResult.rows[0]);
        similarLeadsContext = vectorResult.similarLeadsContext;
        currentContext = vectorResult.currentContext;
      }
    } catch (err) {
      console.error("[AI Insights] Vector search failed (non-blocking):", err);
    }

    // Step 4b: Query api_connectors table for AI webhook configuration
    const connectorName = "AI_INSIGHTS_WEBHOOK"
    const connectorResult = await e2eQuery(
      `SELECT * FROM api_connectors WHERE name = $1 LIMIT 1`,
      [connectorName]
    )

    if (connectorResult.rows.length === 0) {
      console.error(`[AI Insights] Connector "${connectorName}" not found in api_connectors table`)
      return NextResponse.json(
        { error: `Connector "${connectorName}" not configured. Please add it to api_connectors table.` },
        { status: 500 }
      )
    }

    const connector = connectorResult.rows[0]
    const { base_url, method, auth_config, input_schema } = connector

    // Build payload
    const payload = {
      carId,
      sourceInstanceId,
      phoneNumber,
      previousInsight: existingInsight?.ai_insight_summary, // Most recent insight from ai_insights table
      feedback: userFeedback,      // Current user feedback
      currentContext,        // template sentence used as the vector search query
      similarLeadsContext,  // formatted text string of win/failed cases
    }

    // Optional: Validate payload against input_schema if provided
    if (input_schema) {
      console.log("[AI Insights] input_schema available for validation:", input_schema)
      // TODO: Add JSON schema validation library (e.g., ajv) if strict validation is needed
    }

    // Build headers using auth_config from connector
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (auth_config?.type === "bearer" && auth_config?.token) {
      headers["Authorization"] = `Bearer ${auth_config.token}`
      console.log("[AI Insights] Using bearer token authentication from api_connectors")
    } else if (auth_config?.type === "api_key" && auth_config?.key && auth_config?.header) {
      headers[auth_config.header] = auth_config.key
      console.log(`[AI Insights] Using API key authentication (${auth_config.header}) from api_connectors`)
    }

    // Call AI Webhook using connector configuration
    // n8n webhook expects phone as path param: base_url/:phone
    const webhookUrl = `${base_url}/${encodeURIComponent(phoneNumber)}`
    console.log(`[AI Insights] Calling connector "${connectorName}": ${method || "POST"} ${webhookUrl}`)

    try {
      const response = await fetch(webhookUrl, {
        method: method || "POST",
        headers,
        body: JSON.stringify(payload)
      })

      if (!response.ok) throw new Error(`AI Webhook failed: ${response.status}`)

      let aiResponse = await response.json()
      if (Array.isArray(aiResponse)) aiResponse = aiResponse[0]

      // Helper to find specific keys recursively in a nested object
      const findNestedValue = (obj: any, targetKey: string): any => {
        if (!obj || typeof obj !== "object") return undefined
        if (targetKey in obj) return obj[targetKey]
        for (const key in obj) {
          const found = findNestedValue(obj[key], targetKey)
          if (found !== undefined) return found
        }
        return undefined
      }

      // Dynamic Extraction
      const selectedTransitionId = findNestedValue(aiResponse, "selected_transition_id")
      const targetWorkflowId = findNestedValue(aiResponse, "target_workflow_id")

      // Use the 'analysis' field if it exists (backwards compatibility), 
      // otherwise use the entire response as the summary
      const storageSummary = aiResponse.analysis || aiResponse

      // Update record with results
      await e2eQuery(
        `UPDATE ai_insights
         SET ai_insight_summary = $1, selected_transition_id = $2, target_workflow_id = $3
         WHERE id = $4`,
        [JSON.stringify(storageSummary), selectedTransitionId, targetWorkflowId, insightIdToUpdate]
      )

      // --- Auto Use Flow: fire-and-forget for test Car IDs ---
      const testCarIds = [
        "4f4aba46-9e76-4100-87f9-26a37c141d04",
        "faaaac34-1fcb-4bb3-99d8-4f1597251bb7"
      ]
      try {
        // Get pic_id for background processing context
        const leadCheck = await vucarV2Query(
          `SELECT l.pic_id FROM cars c JOIN leads l ON l.id = c.lead_id WHERE c.id = $1 LIMIT 1`,
          [carId]
        )
        const currentPicId = leadCheck.rows[0]?.pic_id

        if (testCarIds.includes(carId)) {
          console.log(`[AI Insights] Auto Use Flow triggered for test PIC/car`)
          // Call the service directly - zero HTTP overhead, zero 401s
          handleAutoUseFlow({
            carId,
            aiInsightSummary: storageSummary,
            picId: currentPicId,
          }).catch(err => console.error("[AI Insights] Auto Use Flow background error:", err))
        }
      } catch (autoFlowErr) {
        console.error("[AI Insights] Auto Use Flow check error (non-blocking):", autoFlowErr)
      }

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

  const { getLatestAiNote } = await import("@/lib/ai-notes-service")
  const currentDiary = await getLatestAiNote("insight-generator")

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
    currentDiary: currentDiary, // Include the Knowledge Diary for the UI
  })
}
