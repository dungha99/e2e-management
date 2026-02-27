import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"
import { submitAiFeedback } from "@/lib/insight-feedback-service"
import { callGemini } from "@/lib/gemini"

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
  stoppedReason: "all_done" | "scheduled_future" | "step_failed" | "error" | "customer_no_response"
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
              responded = await checkCustomerResponded(customerPhone, picId)
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

          // --- 2c. Mark step as running ---
          await e2eQuery(
            `UPDATE step_executions SET status = 'running', executed_at = NOW() WHERE id = $1`,
            [execution.id]
          )

          // --- 2d. Pre-execution AI Script Evaluator (for "Gửi Script" only) ---
          if (execution.connector_id === "05b6afa5-786f-4062-9d53-de9cb89450ee") { // Gửi Script
            console.log(`[Process AI Workflows] Triggering AI Script Evaluator for Gửi Script...`)
            try {
              let requestPayload = execution.request_payload
              if (typeof requestPayload === "string") {
                requestPayload = JSON.parse(requestPayload)
              }

              if (requestPayload && Array.isArray(requestPayload.messages) && customerPhone && picId) {
                // Fetch shopId via n8n
                let shopId: string | undefined
                try {
                  const n8nRes = await fetch("https://n8n.vucar.vn/webhook/f23b1b03-b198-4dc3-a196-d97a5cae8aff", {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pic_id: picId })
                  })
                  if (n8nRes.ok) {
                    let n8nData: any = await n8nRes.json()
                    if (Array.isArray(n8nData)) n8nData = n8nData[0]
                    shopId = n8nData?.shop_id
                  }
                } catch (e) {
                  console.warn(`[Process AI Workflows] AI Evaluator failed to get shopId for picId=${picId}`, e)
                }

                if (shopId) {
                  // Fetch last 20 messages from CRM
                  const historyRes = await fetch("https://crm-vucar-api.vucar.vn/api/v1/akabiz/get-chat-history", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "accept": "application/json" },
                    body: JSON.stringify({ phone: customerPhone, shop_id: shopId }),
                  })

                  if (historyRes.ok) {
                    const historyData = await historyRes.json()
                    if (historyData.is_successful && historyData.chat_history) {
                      const recentChat = historyData.chat_history.slice(-20)

                      const systemPrompt = `Bạn là một chuyên gia về giao tiếp và tối ưu hóa hội thoại. Nhiệm vụ của bạn là xem xét 20 tin nhắn gần nhất trong lịch sử chat và tập hợp các tin nhắn dự kiến sắp gửi.

Quy trình làm việc:
- Phân tích ngữ cảnh: Xác định rõ mục đích của người dùng, tông giọng (tone of voice) đang sử dụng và cảm xúc hiện tại của cuộc hội thoại.
- Đánh giá tin nhắn dự kiến: Kiểm tra xem các tin nhắn sắp gửi có:
  + Tự nhiên: Không bị máy móc, lặp từ hoặc quá trang trọng/suồng sã so với ngữ cảnh.
  + Đúng trọng tâm: Phản hồi trực tiếp các câu hỏi hoặc vấn đề người dùng vừa nêu.
  + Tương tác: Tạo tiền đề hoặc gợi mở cho các tương tác tiếp theo thay vì đóng lại cuộc hội thoại.

Quyết định:
- Nếu tin nhắn dự kiến đã tối ưu, hãy giữ nguyên.
- Nếu chưa, hãy viết lại chúng để đảm bảo sự tự nhiên, trôi chảy và phù hợp.

Yêu cầu quan trọng:
- Luôn giữ nguyên ý định ban đầu (intent) nhưng điều chỉnh cách diễn đạt cho giống người.
- Kết quả trả về phải là định dạng JSON hợp lệ, không kèm thêm bất kỳ văn bản giải thích nào.

Expected Output Schema:
{
  "messages": ["tin nhắn 1", "tin nhắn 2"]
}`

                      const prompt = `Lịch sử chat (20 tin nhắn gần nhất):\n${JSON.stringify(recentChat)}\n\nTin nhắn dự kiến sắp gửi:\n${JSON.stringify(requestPayload.messages)}\n\nHãy đánh giá và trả về JSON.`

                      const geminiResult = await callGemini(prompt, "gemini-2.5-flash", systemPrompt)

                      const jsonMatch = geminiResult.match(/\{[\s\S]*\}/)
                      if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0])
                        if (parsed && Array.isArray(parsed.messages)) {
                          requestPayload.messages = parsed.messages
                          execution.request_payload = requestPayload // update in memory

                          // Update in DB so we have a record of the rewritten payload
                          await e2eQuery(
                            `UPDATE step_executions SET request_payload = $1 WHERE id = $2`,
                            [JSON.stringify(requestPayload), execution.id]
                          )
                          console.log(`[Process AI Workflows] AI Script Evaluator successfully rewrote messages.`)
                        }
                      }
                    }
                  } else {
                    console.warn(`[Process AI Workflows] CRM history fetch failed with status ${historyRes.status}`)
                  }
                }
              }
            } catch (err) {
              console.error(`[Process AI Workflows] AI Script Evaluator failed, falling back to original payload:`, err)
            }
          }

          // --- 2e. Execute the connector ---
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
  } catch (err) {
    clearTimeout(timeoutId)
    const errorMessage = err instanceof Error && err.name === 'AbortError'
      ? 'Connector execution timed out after 5 minutes'
      : (err instanceof Error ? err.message : String(err))

    return { success: false, error: errorMessage }
  }
}

// =========================================================================
// Helper: Check if customer has responded in the last 2 days via Zalo chat
// =========================================================================
async function checkCustomerResponded(phone: string, picId: string): Promise<boolean> {
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000

  // Step 1: Get shop_id from n8n webhook using pic_id
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000) // 5 minutes

  let shopId: string | undefined

  try {
    const n8nRes = await fetch(
      "https://n8n.vucar.vn/webhook/f23b1b03-b198-4dc3-a196-d97a5cae8aff",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pic_id: picId }),
        signal: controller.signal,
      }
    )
    clearTimeout(timeoutId)

    if (!n8nRes.ok) {
      throw new Error(`n8n webhook failed: ${n8nRes.status}`)
    }

    let n8nData: any = await n8nRes.json()
    if (Array.isArray(n8nData)) n8nData = n8nData[0]
    shopId = n8nData?.shop_id
  } catch (err) {
    clearTimeout(timeoutId)
    console.error(`[checkCustomerResponded] n8n fetch error:`, err)
    // Fallback: assume responded if we can't get shopId
    return true
  }
  if (!shopId) {
    console.warn(`[checkCustomerResponded] No shop_id returned for picId=${picId}. Assuming responded.`)
    return true
  }

  // Step 2: Fetch chat history from AkaBiz
  const chatRes = await fetch(
    "https://crm-vucar-api.vucar.vn/api/v1/akabiz/get-chat-history",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contacts_limit: 10,
        contacts_max_pages: 10,
        messages_limit: 20,
        phone,
        shop_id: shopId,
      }),
    }
  )

  if (!chatRes.ok) {
    throw new Error(`AkaBiz chat history API failed: ${chatRes.status}`)
  }

  const chatData: any = await chatRes.json()
  const chatHistory: any[] = chatData?.chat_history || []

  if (chatHistory.length === 0) {
    console.log(`[checkCustomerResponded] No chat history found for phone=${phone}`)
    return false
  }

  // Step 3: Find any message from the CUSTOMER (senderName without "Vucar") within 6 hours
  const cutoff = new Date(Date.now() - SIX_HOURS_MS)
  const customerReplied = chatHistory.some((msg) => {
    const name: string = msg.senderName || ""
    const isCustomer = !name.toLowerCase().includes("vucar")
    if (!isCustomer) return false
    const msgDate = new Date(msg.dateAction)
    return msgDate >= cutoff
  })

  console.log(
    `[checkCustomerResponded] phone=${phone}, shopId=${shopId}, ` +
    `messages=${chatHistory.length}, customerRepliedIn6Hours=${customerReplied}`
  )
  return customerReplied
}
