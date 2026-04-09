import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"
import { submitAiFeedback } from "@/lib/insight-feedback-service"
import { callGemini } from "@/lib/gemini"
import { getAgentTools } from "@/lib/agent-tools"
import { storeAgentOutput, getActiveAgentNote, getPicAgentConfig, getCarAgentMemory } from "@/lib/ai-agent-service"
import { fetchZaloChatHistory } from "@/lib/chat-history-service"
import { runTaskDispatcher } from "@/lib/task-dispatcher-service"

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/e2e/process-ai-workflows
 *
 * Cron-compatible endpoint that processes running AI workflow instances.
 * Can be called by Vercel cron or locally via curl / browser.
 *
 * Flow per instance:
 *  1. Get current_step_id → find step_execution (pending)
 *  2. If scheduled_at is null or in the past → execute the connector
 *  3. Update step_execution with result (success/failed)
 *  4. Advance current_step_id to next step
 *  5. Loop until a future scheduled_at or no more steps
 */

interface ProcessingResult {
  instanceId: string
  workflowName: string
  stepsProcessed: number
  stoppedReason: "all_done" | "scheduled_future" | "step_failed" | "step_retry_scheduled" | "error" | "customer_no_response"
  error?: string
}

export async function GET() {
  const startTime = Date.now()
  const results: ProcessingResult[] = []

  try {
    // --- 1. Find all running AI workflow instances ---
    const instancesResult = await e2eQuery(
      `SELECT wi.*, w.name AS workflow_name
       FROM workflow_instances wi
       JOIN workflows w ON w.id = wi.workflow_id
       LEFT JOIN ai_process_blacklist pb ON pb.car_id = wi.car_id
       WHERE w.type = 'AI' AND wi.status = 'running' AND pb.car_id IS NULL
       ORDER BY wi.started_at ASC`
    )

    const instances = instancesResult.rows
    console.log(`[Process AI Workflows] Found ${instances.length} running AI instances`)

    if (instances.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No running AI workflow instances",
        processed: 0,
        results: [],
        durationMs: Date.now() - startTime,
      })
    }

    // --- 2. Process each instance ---
    for (const instance of instances) {
      const result: ProcessingResult = {
        instanceId: instance.id,
        workflowName: instance.workflow_name,
        stepsProcessed: 0,
        stoppedReason: "all_done",
      }

      // Resolve customer phone (additional_phone first) and pic_id for this instance
      let customerPhone = ""
      let picId = ""
      try {
        const contactResult = await vucarV2Query(
          `SELECT l.phone, l.additional_phone, l.pic_id
           FROM cars c
           JOIN leads l ON l.id = c.lead_id
           WHERE c.id = $1 LIMIT 1`,
          [instance.car_id]
        )
        const contact = contactResult.rows[0]
        customerPhone = contact?.additional_phone || contact?.phone || ""
        picId = contact?.pic_id || ""
      } catch (err) {
        console.warn(`[Process AI Workflows] Could not resolve phone/picId for car ${instance.car_id}:`, err)
      }

      try {
        let currentStepId = instance.current_step_id
        let continueLoop = true

        while (continueLoop) {
          if (!currentStepId) {
            // No more steps → mark instance as completed
            await e2eQuery(
              `UPDATE workflow_instances SET status = 'completed', completed_at = NOW() WHERE id = $1`,
              [instance.id]
            )
            result.stoppedReason = "all_done"
            break
          }

          // --- 2a. Get the step_execution for this step ---
          const execResult = await e2eQuery(
            `SELECT se.*, ws.connector_id, ws.step_name, ws.step_order, ws.input_mapping, ws.description
             FROM step_executions se
             JOIN workflow_steps ws ON ws.id = se.step_id
             WHERE se.instance_id = $1 AND se.step_id = $2
             ORDER BY se.id DESC
             LIMIT 1`,
            [instance.id, currentStepId]
          )

          if (execResult.rows.length === 0) {
            console.warn(`[Process AI Workflows] No step_execution found for instance=${instance.id}, step=${currentStepId}`)
            result.stoppedReason = "error"
            result.error = `No step_execution for step ${currentStepId}`
            break
          }

          const execution = execResult.rows[0]

          // Skip only truly terminal / in-progress states.
          // NOTE: 'running' is intentionally NOT guarded here — stale running steps
          // (timed-out after >5 min) are handled by the atomic re-claim below.
          if (execution.status === 'success' || execution.status === 'failed' || execution.status === 'skipped') {
            // Move to next step
            currentStepId = await getNextStepId(instance.workflow_id, execution.step_order)
            if (currentStepId) {
              await e2eQuery(
                `UPDATE workflow_instances SET current_step_id = $1 WHERE id = $2`,
                [currentStepId, instance.id]
              )
            }
            continue
          }

          // --- 2b. Check scheduled_at ---
          // scheduled_at is stored as Vietnam local time (UTC+7) without timezone info.
          // Vercel runs in UTC, so new Date() on a bare datetime string treats it as UTC
          // → 7 hours ahead of real time. Subtract 7h to get the true UTC equivalent.
          const scheduledAt = execution.scheduled_at
            ? new Date(new Date(execution.scheduled_at).getTime() - 7 * 60 * 60 * 1000)
            : null
          const now = new Date()

          if (scheduledAt && scheduledAt > now) {
            // Scheduled in the future → skip, wait for next cron run
            console.log(`[Process AI Workflows] Step "${execution.step_name}" scheduled for ${scheduledAt.toISOString()}, skipping`)
            result.stoppedReason = "scheduled_future"
            continueLoop = false
            break
          }

          // --- 2b-ii. Customer engagement check (only for scheduled steps) ---
          // If the step had a scheduled_at, the customer had time to respond.
          // If they haven't replied in 2 days, skip and trigger re-analysis.
          if (execution.scheduled_at && customerPhone && picId) {
            console.log(`[Process AI Workflows] Checking customer response for "${execution.step_name}" (phone: ${customerPhone})...`)
            let responded = false
            try {
              responded = await checkCustomerResponded(customerPhone, picId, instance.car_id)
            } catch (err) {
              console.warn(`[Process AI Workflows] Engagement check failed (non-blocking):`, err)
              responded = true // Default to proceeding if the check itself fails
            }

            if (!responded) {
              console.log(`[Process AI Workflows] Customer has NOT responded in 2 days. Triggering re-analysis...`)

              await e2eQuery(
                `UPDATE step_executions SET status = 'skipped', error_message = $1 WHERE id = $2`,
                ['Customer did not respond within 2 days — strategy re-analysis triggered', execution.id]
              )

              // Terminate the instance so subsequent cron runs don't re-trigger re-analysis
              await e2eQuery(
                `UPDATE workflow_instances SET status = 'terminated', completed_at = NOW() WHERE id = $1`,
                [instance.id]
              )

              if (instance.car_id) {
                const noResponseFeedback = `[Auto-Check] Khách hàng chưa phản hồi trong 2 ngày kể từ bước "${execution.step_name}". Cần điều chỉnh chiến lược tiếp cận.`

                // 1. Update the AI Knowledge Diary so the model learns from this pattern
                import("@/lib/ai-notes-service").then(({ updateAiNoteFromFeedback }) => {
                  updateAiNoteFromFeedback({
                    block: "insight-generator",
                    aiResponse: `Workflow step "${execution.step_name}" was scheduled and executed, but the customer did not reply within 2 days.`,
                    userFeedback: noResponseFeedback,
                    feedbackType: "text",
                  }).catch((err) => console.error(`[Process AI Workflows] AI Notes update failed:`, err))
                }).catch(() => { })

                // 2. Submit insight feedback → triggers AI re-analysis + new workflow creation
                try {
                  console.log(`[Process AI Workflows] Submitting feedback for car ${instance.car_id}...`)
                  await submitAiFeedback({
                    carId: instance.car_id,
                    sourceInstanceId: instance.id,
                    phoneNumber: customerPhone,
                    feedback: noResponseFeedback,
                    retrigger: true,
                  })
                  console.log(`[Process AI Workflows] Re-analysis and new workflow triggered successfully.`)
                } catch (err) {
                  console.error(`[Process AI Workflows] submitAiFeedback failed:`, err)
                }
              }

              result.stoppedReason = "customer_no_response"
              continueLoop = false
              break
            }

            console.log(`[Process AI Workflows] Customer HAS responded recently. Proceeding with step.`)
          }

          // --- 2c. Atomic claim: mark step as running only if still pending OR stale ---
          // Guards against:
          //   • Concurrent cron runs (race condition) → only one claim succeeds
          //   • Stale 'running' steps (AI took >5 min, Vercel timed out) → re-claimed
          const isStaleRunning = execution.status === 'running'
          const claimResult = await e2eQuery(
            `UPDATE step_executions SET status = 'running', executed_at = NOW()
             WHERE id = $1
               AND (
                 status = 'pending'
                 OR (status = 'running' AND executed_at < NOW() - INTERVAL '5 minutes')
               )
             RETURNING id`,
            [execution.id]
          )
          if (claimResult.rows.length === 0) {
            // Either another cron already claimed it, or it's still actively running (<5 min)
            console.log(`[Process AI Workflows] Step "${execution.step_name}" is locked (running <5 min or already claimed), skipping`)
            result.stoppedReason = "scheduled_future"
            continueLoop = false
            break
          }
          if (isStaleRunning) {
            console.warn(`[Process AI Workflows] Re-claiming stale step "${execution.step_name}" — was stuck in 'running' >5 min`)
          }

          // --- 2d. Pre-execution AI Script Evaluator (for "Gửi Script" only, AI-triggered instances) ---
          if (execution.connector_id === "05b6afa5-786f-4062-9d53-de9cb89450ee" && instance.triggered_by !== 'user') { // Gửi Script
            console.log(`[Process AI Workflows] Triggering AI Script Evaluator for Gửi Script...`)
            try {
              let requestPayload = execution.request_payload
              if (typeof requestPayload === "string") {
                requestPayload = JSON.parse(requestPayload)
              }

              if (requestPayload && Array.isArray(requestPayload.messages) && customerPhone && picId) {
                const chatMessages = await fetchZaloChatHistory({ carId: instance.car_id, phone: customerPhone, picId })
                const recentChat = chatMessages.length > 0 ? chatMessages.slice(-100) : null
                console.log(`[Process AI Workflows] AI Evaluator chat messages: ${recentChat?.length ?? 0}`)

                if (recentChat) {
                    const [picPrompt, reviewAgentNote] = await Promise.all([
                      getPicAgentConfig("Review Messages Scheduled", picId),
                      getActiveAgentNote("Review Messages Scheduled"),
                    ])

                    const systemPrompt = `${picPrompt || ''}${reviewAgentNote ? `\n\n### Cấu Hình Bổ Sung (System Preferences):\n${reviewAgentNote}` : ''}`


                    const tacticalCommand = execution.description || execution.step_name
                    const [leadContext, agentMemory] = await Promise.all([
                      fetchLeadContext(instance.car_id || ""),
                      getCarAgentMemory(instance.car_id).catch(() => null),
                    ])
                    const memorySection = agentMemory ? `\n${agentMemory}\n\n` : ""
                    const prompt = `Lịch sử chat (100 tin nhắn gần nhất):\n${JSON.stringify(recentChat)}\n\nThông tin xe và Lead:\n${leadContext}\n${memorySection}Tactical Command:\n${tacticalCommand}\n\nTin nhắn dự kiến sắp gửi:\n${JSON.stringify(requestPayload.messages)}\n\nHãy đánh giá và trả về JSON.`

                    const geminiResult = await callGemini(prompt, "gemini-3-flash-preview", systemPrompt, getAgentTools())

                    const jsonMatch = geminiResult.match(/\{[\s\S]*\}/)
                    if (jsonMatch) {
                      let parsed: any
                      try {
                        parsed = JSON.parse(jsonMatch[0])
                      } catch (parseErr) {
                        storeAgentOutput({
                          agentName: "Review Messages Scheduled",
                          carId: instance.car_id,
                          sourceInstanceId: instance.id,
                          inputPayload: prompt,
                          outputPayload: { error: "JSON.parse failed", raw: jsonMatch[0].slice(0, 500), level: -1 },
                        }).catch(err => console.error("[Process AI Workflows] Failed to store agent output:", err))
                      }
                      if (parsed && parsed.status) {

                        // ── REVISED_PLAN ─────────────────────────────────────────────
                        // Context does not match current workflow plan → skip this step,
                        // terminate the instance, and trigger re-analysis directly via router.
                        if (parsed.status === "REVISED_PLAN") {
                          console.log(`[Process AI Workflows] REVISED_PLAN detected — skipping messages, terminating instance, triggering re-analysis for ${customerPhone}`)

                          // Mark this step as skipped (not failed) — don't send messages
                          await e2eQuery(
                            `UPDATE step_executions SET status = 'skipped', error_message = $1, completed_at = NOW() WHERE id = $2`,
                            [`REVISED_PLAN: ${typeof parsed.reasoning === "string" ? parsed.reasoning.slice(0, 300) : "Plan mismatch"}`, execution.id]
                          )

                          // Terminate the workflow instance
                          await e2eQuery(
                            `UPDATE workflow_instances SET status = 'terminated', completed_at = NOW() WHERE id = $1`,
                            [instance.id]
                          )

                          await storeAgentOutput({
                            agentName: "Review Messages Scheduled",
                            carId: instance.car_id,
                            sourceInstanceId: instance.id,
                            inputPayload: prompt,
                            outputPayload: { ...parsed, level: 2 },
                          }).catch(err => console.error("[Process AI Workflows] Failed to store agent output:", err))

                          // Trigger re-analysis directly via router (same as no-response path)
                          const revisedPlanFeedback = `[Auto-Check] Review Messages phát hiện bối cảnh thực tế không khớp với kế hoạch tại bước "${execution.step_name}". Lý do: ${typeof parsed.reasoning === "string" ? parsed.reasoning : JSON.stringify(parsed.reasoning)}`

                          if (instance.car_id) {
                            try {
                              console.log(`[Process AI Workflows] Submitting feedback for re-analysis, car ${instance.car_id}...`)
                              await submitAiFeedback({
                                carId: instance.car_id,
                                sourceInstanceId: instance.id,
                                phoneNumber: customerPhone,
                                feedback: revisedPlanFeedback,
                                retrigger: true,
                              })
                              console.log(`[Process AI Workflows] Re-analysis triggered successfully.`)
                            } catch (err) {
                              console.error(`[Process AI Workflows] submitAiFeedback failed:`, err)
                            }
                          }

                          // Stop processing this instance
                          result.stoppedReason = "customer_no_response"
                          continueLoop = false
                          break
                        }

                        // ── EMPTY ────────────────────────────────────────────────────
                        // No messages needed — clear the messages array
                        if (parsed.status === "EMPTY") {
                          requestPayload.messages = []
                          execution.request_payload = requestPayload

                          await e2eQuery(
                            `UPDATE step_executions SET request_payload = $1 WHERE id = $2`,
                            [JSON.stringify(requestPayload), execution.id]
                          )
                          console.log(`[Process AI Workflows] AI Script Evaluator: EMPTY — cleared messages`)
                        } else {
                          // ── APPROVED ──────────────────────────────────────────────────
                          // Messages are fine as-is, no changes needed
                          console.log(`[Process AI Workflows] AI Script Evaluator: APPROVED — keeping original messages`)
                        }

                        storeAgentOutput({
                          agentName: "Review Messages Scheduled",
                          carId: instance.car_id,
                          sourceInstanceId: instance.id,
                          inputPayload: prompt,
                          outputPayload: { ...parsed, level: parsed.status === "EMPTY" ? 1 : 0 },
                        }).catch(err => console.error("[Process AI Workflows] Failed to store agent output:", err))
                      } else {
                        storeAgentOutput({
                          agentName: "Review Messages Scheduled",
                          carId: instance.car_id,
                          sourceInstanceId: instance.id,
                          inputPayload: prompt,
                          outputPayload: { error: "Gemini response missing status field", parsed, level: -1 },
                        }).catch(err => console.error("[Process AI Workflows] Failed to store agent output:", err))
                      }
                    } else {
                      storeAgentOutput({
                        agentName: "Review Messages Scheduled",
                        carId: instance.car_id,
                        sourceInstanceId: instance.id,
                        inputPayload: prompt,
                        outputPayload: { error: "Gemini returned unparseable response", raw: geminiResult.slice(0, 500), level: -1 },
                      }).catch(err => console.error("[Process AI Workflows] Failed to store agent output:", err))
                    }
                }
              }
            } catch (err) {
              console.error(`[Process AI Workflows] AI Script Evaluator failed, falling back to original payload:`, err)
              storeAgentOutput({
                agentName: "Review Messages Scheduled",
                carId: instance.car_id,
                sourceInstanceId: instance.id,
                inputPayload: null,
                outputPayload: { error: err instanceof Error ? err.message : String(err), level: -1 },
              }).catch(e => console.error("[Process AI Workflows] Failed to store agent output:", e))
            }
          }

          // --- 2e. Execute the connector ---
          // For "Gửi Script" steps, check if leads.zalo_account is set → use Vucar Zalo connector instead
          let effectiveConnectorId = execution.connector_id
          let effectivePayload = execution.request_payload
          let urlVariables: Record<string, string> | undefined

          if (execution.connector_id === "05b6afa5-786f-4062-9d53-de9cb89450ee") {
            try {
              const zalosResult = await vucarV2Query(
                `SELECT l.zalo_account FROM cars c JOIN leads l ON l.id = c.lead_id WHERE c.id = $1 LIMIT 1`,
                [instance.car_id]
              )
              const zaloAccount: string | null = zalosResult.rows[0]?.zalo_account || null
              if (zaloAccount) {
                const [ownId, userId] = zaloAccount.split(":")
                if (ownId && userId) {
                  let parsedPayload = effectivePayload
                  if (typeof parsedPayload === "string") {
                    try { parsedPayload = JSON.parse(parsedPayload) } catch { /* keep */ }
                  }
                  effectiveConnectorId = "a1b8debd-7e9d-45d4-8804-cb817d5504f5"
                  effectivePayload = { userId, messages: parsedPayload?.messages || [] }
                  urlVariables = { ownId }
                  console.log(`[Process AI Workflows] Zalo override: using Vucar Zalo connector (ownId=${ownId}, userId=${userId})`)

                  // Update workflow_step and step_execution to reflect the actual connector used
                  await e2eQuery(
                    `UPDATE workflow_steps SET connector_id = $1 WHERE id = $2`,
                    [effectiveConnectorId, execution.step_id]
                  )
                  await e2eQuery(
                    `UPDATE step_executions SET request_payload = $1 WHERE id = $2`,
                    [JSON.stringify(effectivePayload), execution.id]
                  )
                }
              }
            } catch (err) {
              console.warn(`[Process AI Workflows] Failed to check zalo_account, falling back to default connector:`, err)
            }
          }

          console.log(`[Process AI Workflows] Executing step "${execution.step_name}" (connector: ${effectiveConnectorId})`)

          let connectorSuccess = false
          let responsePayload: any = null
          let errorMessage: string | null = null

          try {
            const execResponse = await executeConnector(effectiveConnectorId, effectivePayload, urlVariables)
            connectorSuccess = execResponse.success
            responsePayload = execResponse.data
            if (!connectorSuccess) {
              errorMessage = execResponse.error || "Connector execution failed"
            }
          } catch (err) {
            connectorSuccess = false
            errorMessage = err instanceof Error ? err.message : String(err)
          }

          // --- 2e. Update step_execution with result ---
          await e2eQuery(
            `UPDATE step_executions
             SET status = $1,
                 completed_at = NOW(),
                 response_payload = $2,
                 error_message = $3
             WHERE id = $4`,
            [
              connectorSuccess ? 'success' : 'failed',
              responsePayload ? JSON.stringify(responsePayload) : null,
              errorMessage,
              execution.id,
            ]
          )

          result.stepsProcessed++
          console.log(`[Process AI Workflows] Step "${execution.step_name}" → ${connectorSuccess ? 'success' : 'failed'}`)

          if (!connectorSuccess) {
            const currentRetryCount = execution.retry_count || 0
            const maxRetries = 3

            if (currentRetryCount < maxRetries) {
              // Retry: reset step to pending, schedule 30 minutes later, increment retry_count
              const retryNumber = currentRetryCount + 1
              const delayMinutes = 30
              console.log(`[Process AI Workflows] Step "${execution.step_name}" failed, scheduling retry ${retryNumber}/${maxRetries} in ${delayMinutes} minutes`)
              // NOW() returns UTC on Vercel, but scheduled_at is stored as VN time (UTC+7)
              await e2eQuery(
                `UPDATE step_executions
                 SET status = 'pending',
                     scheduled_at = NOW() + INTERVAL '7 hours 30 minutes',
                     retry_count = $1,
                     error_message = $2,
                     completed_at = NULL
                 WHERE id = $3`,
                [retryNumber, errorMessage, execution.id]
              )

              // Also delay all subsequent pending steps with explicit schedules by the same amount
              await e2eQuery(
                `UPDATE step_executions
                 SET scheduled_at = scheduled_at + INTERVAL '${delayMinutes} minutes'
                 WHERE instance_id = $1
                   AND status = 'pending'
                   AND id != $2
                   AND scheduled_at IS NOT NULL`,
                [instance.id, execution.id]
              )

              result.stoppedReason = "step_retry_scheduled"
              result.error = `Retry ${retryNumber}/${maxRetries} scheduled in ${delayMinutes} minutes: ${errorMessage}`
            } else {
              // Max retries exhausted — mark as permanently failed
              console.error(`[Process AI Workflows] Step "${execution.step_name}" failed after ${maxRetries} retries`)
              result.stoppedReason = "step_failed"
              result.error = errorMessage || undefined
              await e2eQuery(
                `UPDATE workflow_instances SET status = 'failed' WHERE id = $1`,
                [instance.id]
              )
            }
            continueLoop = false
            break
          }

          // --- 2f. Run task-dispatcher after Gửi Script to let agent decide next actions ---
          if (execution.connector_id === "05b6afa5-786f-4062-9d53-de9cb89450ee" && connectorSuccess) {
            runTaskDispatcher({
              carId: instance.car_id,
              picId,
              customerPhone,
              trigger: "after_script_sent",
            }).catch(err => console.error(`[Process AI Workflows] runTaskDispatcher failed:`, err))
          }

          // --- 2g. Advance to next step ---
          const nextStepId = await getNextStepId(instance.workflow_id, execution.step_order)

          if (nextStepId) {
            await e2eQuery(
              `UPDATE workflow_instances SET current_step_id = $1 WHERE id = $2`,
              [nextStepId, instance.id]
            )
            currentStepId = nextStepId
            // Continue loop → will check the next step's schedule
          } else {
            // No more steps → workflow is complete
            await e2eQuery(
              `UPDATE workflow_instances SET status = 'completed', completed_at = NOW() WHERE id = $1`,
              [instance.id]
            )
            result.stoppedReason = "all_done"
            continueLoop = false
          }
        }
      } catch (err) {
        result.stoppedReason = "error"
        result.error = err instanceof Error ? err.message : String(err)
        console.error(`[Process AI Workflows] Error processing instance ${instance.id}:`, err)
      }

      results.push(result)
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} instance(s)`,
      processed: results.length,
      results,
      durationMs: Date.now() - startTime,
    })
  } catch (error) {
    console.error("[Process AI Workflows] Fatal error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process AI workflows",
        details: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

// =========================================================================
// Helper: Get the next step ID by step_order
// =========================================================================
async function getNextStepId(workflowId: string, currentStepOrder: number): Promise<string | null> {
  const result = await e2eQuery(
    `SELECT id FROM workflow_steps
     WHERE workflow_id = $1 AND step_order > $2
     ORDER BY step_order ASC
     LIMIT 1`,
    [workflowId, currentStepOrder]
  )
  return result.rows.length > 0 ? result.rows[0].id : null
}

// =========================================================================
// Helper: Execute a connector by ID using the same pattern as execute-connector/route.ts
// =========================================================================
async function executeConnector(
  connectorId: string,
  requestPayload: any,
  urlVariables?: Record<string, string>
): Promise<{ success: boolean; data?: any; error?: string }> {
  // Parse request_payload if it's a string
  let payload = requestPayload
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload) } catch { /* keep as-is */ }
  }

  // Look up connector
  const connectorResult = await e2eQuery(
    `SELECT * FROM api_connectors WHERE id = $1 LIMIT 1`,
    [connectorId]
  )

  if (connectorResult.rows.length === 0) {
    return { success: false, error: `Connector ${connectorId} not found` }
  }

  const connector = connectorResult.rows[0]
  let { base_url, method, auth_config } = connector

  // Substitute URL path variables (e.g. {ownId} → actual value)
  if (urlVariables) {
    Object.entries(urlVariables).forEach(([key, value]) => {
      base_url = base_url.replace(`{${key}}`, value)
    })
  }

  // Parse auth_config if it's a string
  if (typeof auth_config === 'string') {
    try { auth_config = JSON.parse(auth_config) } catch { /* ignore */ }
  }

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (auth_config && typeof auth_config === 'object') {
    Object.entries(auth_config).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value
      }
    })
    if (auth_config.type === "bearer" && auth_config.token) {
      headers["Authorization"] = `Bearer ${auth_config.token}`
    }
  }

  // Call the connector
  console.log(`[Process AI Workflows] Calling connector: ${method} ${base_url}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000) // 5 minutes

  const fetchOptions: RequestInit = {
    method: method || "POST",
    headers,
    signal: controller.signal,
  }

  if (method !== "GET" && method !== "HEAD") {
    fetchOptions.body = JSON.stringify(payload)
  }

  try {
    const response = await fetch(base_url, fetchOptions)
    clearTimeout(timeoutId)

    const responseText = await response.text()
    let data: any
    try {
      data = JSON.parse(responseText)
    } catch {
      data = responseText
    }

    if (!response.ok) {
      return {
        success: false,
        data,
        error: `Connector returned ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data).slice(0, 200)}`,
      }
    }

    return { success: true, data }
  } catch (err: any) {
    clearTimeout(timeoutId)
    const errMessage = err.name === 'AbortError' ? 'Connector timeout' : err.message
    return { success: false, error: errMessage }
  }
}

// =========================================================================
// Helper: Fetch lead context from DB (same as auto-use-flow)
// =========================================================================
async function fetchLeadContext(carId: string): Promise<string> {
  if (!carId) return "No lead data available."
  try {
    const result = await vucarV2Query(
      `SELECT c.brand, c.model, c.variant, c.year, c.location, c.mileage, c.plate, c.slug,
              ss.price_customer, ss.price_highest_bid, ss.stage, ss.qualified,
              ss.intention, ss.negotiation_ability, ss.notes,
              l.name as customer_name, l.phone, l.additional_phone,
              l.customer_feedback, l.source
       FROM cars c
       LEFT JOIN leads l ON l.id = c.lead_id
       LEFT JOIN sale_status ss ON ss.car_id = c.id
       WHERE c.id = $1 LIMIT 1`,
      [carId]
    )

    if (result.rows.length === 0) return "No lead data found."

    const row = result.rows[0]

    // Build context string
    const parts: string[] = []
    parts.push(`Customer: ${row.customer_name || "Unknown"} (Phone: ${row.phone || "N/A"})`)
    parts.push(`Car: ${[row.brand, row.model, row.variant].filter(Boolean).join(" ")} ${row.year || ""}`)
    parts.push(`Car Slug: ${row.slug || "N/A"} (use this exact value when referencing {{cars.slug}} in the bidding link)`)
    parts.push(`Plate: ${row.plate || "N/A"}`)
    parts.push(`Bidding Link: https://vucar.vn/phien-dau-gia/tin-xe/${row.slug || "{{cars.slug}}"}`)
    parts.push(`Location: ${row.location || "N/A"}`)
    parts.push(`Mileage: ${row.mileage ? `${row.mileage} km` : "N/A"}`)
    parts.push(`Price Customer: ${row.price_customer ? `${row.price_customer} triệu` : "N/A"}`)
    parts.push(`Price Highest Bid: ${row.price_highest_bid ? `${row.price_highest_bid} triệu` : "N/A"}`)
    parts.push(`Stage: ${row.stage || "N/A"}`)
    parts.push(`Qualified: ${row.qualified || "N/A"}`)
    parts.push(`Intention: ${row.intention || "N/A"}`)
    parts.push(`Negotiation Ability: ${row.negotiation_ability || "N/A"}`)

    return parts.join("\n")
  } catch (error) {
    console.error("[Process AI Workflows] Error fetching lead context:", error)
    return "Error fetching lead context."
  }
}

// =========================================================================
// Helper: Check if customer has responded in the last 2 days via Zalo chat
// =========================================================================
async function checkCustomerResponded(phone: string, picId: string, carId: string): Promise<boolean> {
  const CustomerResponded_MS = 2 * 24 * 60 * 60 * 1000

  const messages = await fetchZaloChatHistory({ carId, phone, picId })

  if (messages.length === 0) {
    console.log(`[checkCustomerResponded] No messages found for phone=${phone}`)
    return false
  }

  const cutoff = new Date(Date.now() - CustomerResponded_MS)
  const customerReplied = messages.some((msg: any) => {
    const isCustomer = !msg.senderName.toLowerCase().includes("vucar")
    if (!isCustomer) return false
    const msgDate = new Date(msg.dateAction)
    return msgDate >= cutoff
  })

  console.log(
    `[checkCustomerResponded] phone=${phone}, messages=${messages.length}, customerReplied=${customerReplied}`
  )
  return customerReplied
}
