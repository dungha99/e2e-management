import { e2eQuery, vucarV2Query } from "@/lib/db"
import { findSimilarLeads } from "@/lib/vector-search"
import { handleAutoUseFlow } from "@/lib/workflow-service"

/**
 * Shared service for submitting AI feedback and triggering re-analysis.
 * Can be called from API routes (server-side) directly — no internal HTTP calls.
 *
 * Extracted from ai-insights/route.ts to be reusable by evaluate-step.
 */

export interface SubmitFeedbackParams {
  carId: string
  sourceInstanceId: string
  phoneNumber: string
  feedback: string
}

export interface SubmitFeedbackResult {
  success: boolean
  insightId?: string
  newAnalysis?: any
  error?: string
}

/**
 * Submit AI feedback: archive old insight, reset to processing, call n8n webhook,
 * and save the new analysis. Same logic as the feedback path in ai-insights/route.ts.
 */
export async function submitAiFeedback(params: SubmitFeedbackParams): Promise<SubmitFeedbackResult> {
  const { carId, sourceInstanceId, phoneNumber, feedback } = params

  try {
    // --- 1. Get existing insight ---
    const latestInsightResult = await e2eQuery(
      `SELECT id, ai_insight_summary, is_positive, created_at
       FROM ai_insights
       WHERE car_id = $1 AND source_instance_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [carId, sourceInstanceId]
    )

    const existingInsight = latestInsightResult.rows[0]
    let insightIdToUpdate: string

    if (existingInsight) {
      // --- 2a. Archive current insight ---
      console.log(`[InsightFeedback] Archiving insight ${existingInsight.id}`)
      await e2eQuery(
        `INSERT INTO old_ai_insights (
            ai_insight_id, ai_insight_summary, user_feedback, is_positive, created_at
          ) VALUES ($1, $2, $3, $4, NOW())`,
        [
          existingInsight.id,
          JSON.stringify(existingInsight.ai_insight_summary),
          feedback,
          existingInsight.is_positive,
        ]
      )

      // --- 2b. Trigger AI Note update in background ---
      import("@/lib/ai-notes-service")
        .then(({ updateAiNoteFromFeedback }) => {
          updateAiNoteFromFeedback({
            block: "insight-generator",
            aiResponse: JSON.stringify(existingInsight.ai_insight_summary),
            userFeedback: feedback,
            feedbackType: "text",
          }).catch((err) =>
            console.error("[InsightFeedback] AI Note update error:", err)
          )
        })
        .catch(() => { })

      // --- 2c. Reset to processing ---
      await e2eQuery(
        `UPDATE ai_insights
         SET ai_insight_summary = $1,
             selected_transition_id = NULL,
             target_workflow_id = NULL,
             is_positive = NULL,
             created_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({ processing: true, feedbackContext: feedback }),
          existingInsight.id,
        ]
      )
      insightIdToUpdate = existingInsight.id
    } else {
      // Create new placeholder
      const placeholderResult = await e2eQuery(
        `INSERT INTO ai_insights (car_id, source_instance_id, ai_insight_summary, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id`,
        [carId, sourceInstanceId, JSON.stringify({ processing: true })]
      )
      insightIdToUpdate = placeholderResult.rows[0].id
    }

    // --- 3. Vector search for similar leads context ---
    let similarLeadsContext = ""
    let currentContext = ""
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
      )
      if (leadResult.rows.length > 0) {
        const vectorResult = await findSimilarLeads(leadResult.rows[0])
        similarLeadsContext = vectorResult.similarLeadsContext
        currentContext = vectorResult.currentContext
      }
    } catch (err) {
      console.error("[InsightFeedback] Vector search failed (non-blocking):", err)
    }

    // --- 4. Call AI webhook via connector ---
    const connectorResult = await e2eQuery(
      `SELECT * FROM api_connectors WHERE name = $1 LIMIT 1`,
      ["AI_INSIGHTS_WEBHOOK"]
    )

    if (connectorResult.rows.length === 0) {
      return {
        success: false,
        error: 'Connector "AI_INSIGHTS_WEBHOOK" not configured',
      }
    }

    const connector = connectorResult.rows[0]
    const { base_url, method, auth_config } = connector

    const payload = {
      carId,
      sourceInstanceId,
      phoneNumber,
      previousInsight: existingInsight?.ai_insight_summary,
      feedback,
      currentContext,
      similarLeadsContext,
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (auth_config?.type === "bearer" && auth_config?.token) {
      headers["Authorization"] = `Bearer ${auth_config.token}`
    } else if (
      auth_config?.type === "api_key" &&
      auth_config?.key &&
      auth_config?.header
    ) {
      headers[auth_config.header] = auth_config.key
    }

    const webhookUrl = `${base_url}/${encodeURIComponent(phoneNumber)}`
    console.log(`[InsightFeedback] Calling webhook: ${method || "POST"} ${webhookUrl}`)

    const response = await fetch(webhookUrl, {
      method: method || "POST",
      headers,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`AI Webhook failed: ${response.status}`)
    }

    let aiResponse = await response.json()
    if (Array.isArray(aiResponse)) aiResponse = aiResponse[0]

    // --- 5. Extract and save result ---
    const findNestedValue = (obj: any, targetKey: string): any => {
      if (!obj || typeof obj !== "object") return undefined
      if (targetKey in obj) return obj[targetKey]
      for (const key in obj) {
        const found = findNestedValue(obj[key], targetKey)
        if (found !== undefined) return found
      }
      return undefined
    }

    // Guard: the AI may return "N/A" or other non-UUID strings for ID fields.
    // PostgreSQL will reject those — convert to null.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const toUuidOrNull = (v: any): string | null =>
      typeof v === "string" && UUID_RE.test(v) ? v : null

    const selectedTransitionId = toUuidOrNull(findNestedValue(aiResponse, "selected_transition_id"))
    const targetWorkflowId = toUuidOrNull(findNestedValue(aiResponse, "target_workflow_id"))
    const storageSummary = aiResponse.analysis || aiResponse

    await e2eQuery(
      `UPDATE ai_insights
       SET ai_insight_summary = $1, selected_transition_id = $2, target_workflow_id = $3
       WHERE id = $4`,
      [
        JSON.stringify(storageSummary),
        selectedTransitionId,
        targetWorkflowId,
        insightIdToUpdate,
      ]
    )

    console.log(`[InsightFeedback] Successfully updated insight ${insightIdToUpdate}`)

    // --- 6. Auto Use Flow: fire-and-forget for test Car IDs ---
    const testCarIds = [
      "4f4aba46-9e76-4100-87f9-26a37c141d04",
      "faaaac34-1fcb-4bb3-99d8-4f1597251bb7",
      "6f38b1e4-4708-4547-bc04-46d5b9c6082b",
      "41a305f9-1742-4712-940b-fd84e714384c",
      "f360a4f8-5539-4a0e-9a9d-47e453058d58",
      "eb268d8a-1763-460f-b773-4687d356879b"
    ]
    try {
      // Get pic_id for background processing context
      const leadCheck = await vucarV2Query(
        `SELECT l.pic_id FROM cars c JOIN leads l ON l.id = c.lead_id WHERE c.id = $1 LIMIT 1`,
        [carId]
      )
      const currentPicId = leadCheck.rows[0]?.pic_id

      if (testCarIds.includes(carId)) {
        console.log(`[InsightFeedback] Auto Use Flow triggered for test PIC/car`)
        // Inline await for stability on Vercel
        try {
          console.log(`[InsightFeedback] Starting handleAutoUseFlow for car ${carId}...`)
          await handleAutoUseFlow({
            carId,
            aiInsightSummary: storageSummary,
            picId: currentPicId,
          })
          console.log(`[InsightFeedback] handleAutoUseFlow finished successfully for car ${carId}`)
        } catch (err) {
          console.error(`[InsightFeedback] handleAutoUseFlow FAILED for car ${carId}:`, err)
        }
      }
    } catch (autoFlowErr) {
      console.error("[InsightFeedback] Auto Use Flow check error (non-blocking):", autoFlowErr)
    }

    return {
      success: true,
      insightId: insightIdToUpdate,
      newAnalysis: storageSummary,
    }
  } catch (error) {
    console.error("[InsightFeedback] Error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
