import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"
import { findSimilarLeads } from "@/lib/vector-search"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { carId, sourceInstanceId, phoneNumber, userFeedback } = body

    // Validation
    if (!carId || !phoneNumber) {
      return NextResponse.json(
        { error: "Missing required fields: carId, phoneNumber" },
        { status: 400 }
      )
    }

    // --- Step 1: Check database for latest AI insight (across ALL instances for this car) ---
    const latestInsightResult = await e2eQuery(
      `SELECT
        ai.id,
        ai.ai_insight_summary,
        ai.selected_transition_id,
        ai.target_workflow_id,
        ai.is_positive,
        ai.created_at,
        ai.source_instance_id,
        EXTRACT(EPOCH FROM (NOW() - ai.created_at)) as age_seconds
       FROM ai_insights ai
       WHERE ai.car_id = $1
       ORDER BY ai.created_at DESC
       LIMIT 1`,
      [carId]
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
      // An insight is complete if it has a summary and is NOT marked as processing
      const isComplete = !isProcessing && existingInsight.ai_insight_summary != null

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

    // Step 4b: Fetch historical feedback
    let feedbackHistoryText = ""
    try {
      const historyResult = await e2eQuery(
        `SELECT oai.user_feedback, oai.created_at
         FROM old_ai_insights oai
         JOIN ai_insights ai ON ai.id = oai.ai_insight_id
         WHERE ai.car_id = $1
         ORDER BY oai.created_at ASC`,
        [carId]
      )

      if (historyResult.rows.length > 0) {
        // Construct the history text with order
        feedbackHistoryText = historyResult.rows
          .map((row, index) => {
            const dateObj = new Date(row.created_at)
            // Add 7 hours for VN time
            const vnTime = new Date(dateObj.getTime() + 7 * 60 * 60 * 1000)
            const dateStr = vnTime.toISOString().replace('T', ' ').slice(0, 16)
            return `[Lần ${index + 1} - ${dateStr}] Feedback: ${row.user_feedback}`
          })
          .join('\n\n')
      }
    } catch (err) {
      console.error("[AI Insights] Failed to fetch feedback history (non-blocking):", err)
    }

    // Step 4c: Query api_connectors table for AI webhook configuration
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

    // Resolve the real previousInsight:
    // If existing insight is in "processing" state (from a previous call), 
    // fetch the last archived insight from old_ai_insights instead.
    let realPreviousInsight = existingInsight?.ai_insight_summary
    if (realPreviousInsight?.processing === true) {
      try {
        const archivedResult = await e2eQuery(
          `SELECT ai_insight_summary FROM old_ai_insights
           WHERE ai_insight_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [existingInsight.id]
        )
        if (archivedResult.rows.length > 0) {
          const archived = archivedResult.rows[0].ai_insight_summary
          realPreviousInsight = typeof archived === 'string' ? JSON.parse(archived) : archived
          console.log(`[AI Insights] previousInsight was processing, using archived insight instead`)
        }
      } catch (err) {
        console.warn(`[AI Insights] Failed to fetch archived insight, using processing state:`, err)
      }
    }

    // Step 4d: Fetch real-time Zalo chat history via AkaBiz CRM API
    let chatHistory: any[] = []
    try {
      const { fetchZaloChatHistory } = await import("@/lib/chat-history-service")
      chatHistory = await fetchZaloChatHistory({ carId, phone: phoneNumber })
    } catch (err) {
      console.warn("[AI Insights] Failed to fetch chat history (non-blocking):", err)
    }

    // Build payload
    const payload = {
      carId,
      sourceInstanceId,
      phoneNumber,
      previousInsight: realPreviousInsight,
      feedback: userFeedback || "",
      feedbackHistory: feedbackHistoryText, // Historical user feedback
      currentContext,        // template sentence used as the vector search query
      similarLeadsContext,  // formatted text string of win/failed cases
      chat_history: chatHistory,
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

    // --- Step 5: Async webhook call with callback ---
    // Build callback URL for n8n to POST results to
    const appBaseUrl = process.env.APP_BASE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    const callbackUrl = `${appBaseUrl}/api/e2e/ai-insights/callback`

    // Add callback metadata to payload
    const asyncPayload = {
      ...payload,
      insightIdToUpdate,
      callbackUrl,
    }

    // Fire webhook without waiting for full response
    // n8n should respond immediately with "Respond to Webhook" node, then POST result to callbackUrl
    try {
      const response = await fetch(webhookUrl, {
        method: method || "POST",
        headers,
        body: JSON.stringify(asyncPayload),
      })

      // n8n responds immediately — 2xx means accepted
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[AI Insights] Webhook rejected: ${response.status} - ${errorText}`)
        if (!existingInsight) await e2eQuery(`DELETE FROM ai_insights WHERE id = $1`, [insightIdToUpdate])
        return NextResponse.json(
          { success: false, error: `AI Webhook error: ${response.status}` },
          { status: 502 }
        )
      }

      console.log(`[AI Insights] Webhook accepted, awaiting callback at: ${callbackUrl}`)
    } catch (error) {
      console.error("[AI Insights] Webhook fetch error:", error)
      if (!existingInsight) await e2eQuery(`DELETE FROM ai_insights WHERE id = $1`, [insightIdToUpdate])
      return NextResponse.json(
        { success: false, error: "Failed to call AI webhook", details: String(error) },
        { status: 500 }
      )
    }

    // Return processing status immediately — the callback will update the record when n8n finishes
    return NextResponse.json({
      success: true,
      processing: true,
      message: "AI insights are being processed. Results will be available shortly.",
      aiInsightId: insightIdToUpdate,
    }, { status: 202 })

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
    currentDiary: currentDiary,
  })
}
