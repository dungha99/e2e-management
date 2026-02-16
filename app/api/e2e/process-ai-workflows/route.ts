import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

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
  stoppedReason: "all_done" | "scheduled_future" | "step_failed" | "error"
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
       WHERE w.type = 'AI' AND wi.status = 'running'
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
            `SELECT se.*, ws.connector_id, ws.step_name, ws.step_order, ws.input_mapping
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

          // Skip if already completed or failed
          if (execution.status === 'success' || execution.status === 'failed') {
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
          const scheduledAt = execution.scheduled_at ? new Date(execution.scheduled_at) : null
          const now = new Date()

          if (scheduledAt && scheduledAt > now) {
            // Scheduled in the future → skip, wait for next cron run
            console.log(`[Process AI Workflows] Step "${execution.step_name}" scheduled for ${scheduledAt.toISOString()}, skipping`)
            result.stoppedReason = "scheduled_future"
            continueLoop = false
            break
          }

          // --- 2c. Mark step as running ---
          await e2eQuery(
            `UPDATE step_executions SET status = 'running', executed_at = NOW() WHERE id = $1`,
            [execution.id]
          )

          // --- 2d. Execute the connector ---
          console.log(`[Process AI Workflows] Executing step "${execution.step_name}" (connector: ${execution.connector_id})`)

          let connectorSuccess = false
          let responsePayload: any = null
          let errorMessage: string | null = null

          try {
            const execResponse = await executeConnector(execution.connector_id, execution.request_payload)
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
            result.stoppedReason = "step_failed"
            result.error = errorMessage || undefined
            // Mark instance as failed on step failure
            await e2eQuery(
              `UPDATE workflow_instances SET status = 'failed' WHERE id = $1`,
              [instance.id]
            )
            continueLoop = false
            break
          }

          // --- 2f. Advance to next step ---
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
  requestPayload: any
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

  const fetchOptions: RequestInit = {
    method: method || "POST",
    headers,
  }

  if (method !== "GET" && method !== "HEAD") {
    fetchOptions.body = JSON.stringify(payload)
  }

  const response = await fetch(base_url, fetchOptions)
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
}
