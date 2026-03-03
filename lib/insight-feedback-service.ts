import { e2eQuery, vucarV2Query } from "@/lib/db"
import { findSimilarLeads } from "@/lib/vector-search"
import { getActiveAgentNote } from "@/lib/ai-agent-service"

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
  chat_history?: any
}

export interface SubmitFeedbackResult {
  success: boolean
  insightId?: string
  newAnalysis?: any
  processing?: boolean
  error?: string
}

/**
 * Submit AI feedback: archive old insight, reset to processing, call n8n webhook,
 * and save the new analysis. Same logic as the feedback path in ai-insights/route.ts.
 */
export async function submitAiFeedback(params: SubmitFeedbackParams): Promise<SubmitFeedbackResult> {
  const { carId, sourceInstanceId, phoneNumber, feedback, chat_history } = params

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

    // --- 2.5 Fetch historical feedback ---
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
            // Add 7 hours for VN time (similar to workflow-service logic)
            const vnTime = new Date(dateObj.getTime() + 7 * 60 * 60 * 1000)
            const dateStr = vnTime.toISOString().replace('T', ' ').slice(0, 16)
            return `[Lần ${index + 1} - ${dateStr}] Feedback: ${row.user_feedback}`
          })
          .join('\n\n')
      }
    } catch (err) {
      console.error("[InsightFeedback] Failed to fetch feedback history (non-blocking):", err)
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
          console.log(`[InsightFeedback] previousInsight was processing, using archived insight instead`)
        }
      } catch (err) {
        console.warn(`[InsightFeedback] Failed to fetch archived insight, using processing state:`, err)
      }
    }

    const feedbackAgentNote = await getActiveAgentNote("Feedback")
    const routerAgentNote = await getActiveAgentNote("Router (Plan)")

    const payload = {
      carId,
      sourceInstanceId,
      phoneNumber,
      previousInsight: realPreviousInsight,
      feedback: feedback || "",
      feedbackHistory: feedbackHistoryText,
      currentContext,
      similarLeadsContext,
      chat_history,
      feedbackAgentNote,
      routerAgentNote,
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

    // --- 5. Async webhook call with callback ---
    const appBaseUrl = process.env.APP_BASE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    const callbackUrl = `${appBaseUrl}/api/e2e/ai-insights/callback`

    const asyncPayload = {
      ...payload,
      insightIdToUpdate,
      callbackUrl,
    }

    const response = await fetch(webhookUrl, {
      method: method || "POST",
      headers,
      body: JSON.stringify(asyncPayload),
    })

    // n8n should respond immediately via "Respond to Webhook" node
    if (!response.ok) {
      throw new Error(`AI Webhook failed: ${response.status}`)
    }

    console.log(`[InsightFeedback] Webhook accepted for insight ${insightIdToUpdate}, awaiting callback`)

    // Return immediately — the callback endpoint will handle DB update, Auto Use Flow, and agent tracking
    return {
      success: true,
      insightId: insightIdToUpdate,
      processing: true,
    }
  } catch (error) {
    console.error("[InsightFeedback] Error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
