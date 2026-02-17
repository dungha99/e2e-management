import { e2eQuery, vucarV2Query } from "@/lib/db"

/**
 * Shared service for AI workflows. 
 * Can be called from API routes (server-side) or Server Actions.
 */

const CONNECTOR_MAP = {
  script: {
    connectorId: "05b6afa5-786f-4062-9d53-de9cb89450ee",
    stepName: "Gửi Script",
  },
  bidding: {
    connectorId: "6e98e9e6-87a6-41b8-9694-294472419351",
    stepName: "Tạo phiên đấu giá",
  },
}

const DEFAULT_STAGE_ID = "456e0d0b-bd97-4ef6-893e-8674447ed882"

export interface ExtractedStep {
  stepName: string
  connectorId: string
  connectorLabel: string
  rawContext: string
  aiAction?: string
  expectedReaction?: string
  successSignal?: string
  failureSignal?: string
  ifSuccess?: string
  ifFailure?: string
}

export interface StepInput {
  stepName: string
  stepOrder: number
  connectorId: string
  inputMapping: Record<string, string>
  requestPayload: Record<string, any>
  scheduledAt?: string
  description?: string
}

/**
 * Walk through AI analysis result and extract candidates for workflow steps
 */
export function extractStepsFromAnalysis(analysis: any): ExtractedStep[] {
  const steps: ExtractedStep[] = []
  const synthesis = analysis?.final_synthesis || analysis

  const walkObject = (obj: any) => {
    if (!obj || typeof obj !== "object") return

    const isScript = typeof obj.script === "string" && obj.script.trim()
    const action = typeof obj.action === "string" ? obj.action.toLowerCase() : ""
    const isBidding = action.includes("tạo phiên đấu giá") ||
      action.includes("tạo phiên") ||
      action.includes("đấu giá") ||
      action.includes("bidding")

    if (isScript || isBidding) {
      console.log(`[extractStepsFromAnalysis] Found actionable item:`, { isScript, isBidding, action })
      steps.push({
        stepName: isScript ? CONNECTOR_MAP.script.stepName : CONNECTOR_MAP.bidding.stepName,
        connectorId: isScript ? CONNECTOR_MAP.script.connectorId : CONNECTOR_MAP.bidding.connectorId,
        connectorLabel: isScript ? "Gửi Script" : "Tạo phiên đấu giá",
        rawContext: isScript ? obj.script : obj.action,
        aiAction: obj.action,
        expectedReaction: obj.expected_customer_reaction || obj.expected_reaction,
        successSignal: obj.success_signal,
        failureSignal: obj.failure_signal,
        ifSuccess: obj.if_success,
        ifFailure: obj.if_failure,
      })
    }

    if (Array.isArray(obj)) {
      obj.forEach(walkObject)
    } else {
      Object.values(obj).forEach((v) => {
        if (typeof v === "object" && v !== null) walkObject(v)
      })
    }
  }

  walkObject(synthesis)
  return steps
}

/**
 * Creates a workflow, steps, instance, and pending executions in the DB.
 */
export async function persistWorkflow(params: {
  name: string
  description?: string
  carId: string
  steps: StepInput[]
}) {
  const { name, description, carId, steps } = params

  // 1. Create workflow
  const workflowResult = await e2eQuery(
    `INSERT INTO workflows (name, stage_id, is_active, description, type)
     VALUES ($1, $2, true, $3, 'AI')
     RETURNING *`,
    [name, DEFAULT_STAGE_ID, description || null]
  )
  const workflow = workflowResult.rows[0]

  // 2. Create workflow_steps
  const createdSteps: any[] = []
  for (const step of steps) {
    const stepResult = await e2eQuery(
      `INSERT INTO workflow_steps (workflow_id, step_name, step_order, connector_id, input_mapping, is_automated, description)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       RETURNING *`,
      [
        workflow.id,
        step.stepName,
        step.stepOrder,
        step.connectorId,
        JSON.stringify(step.inputMapping),
        step.description || null,
      ]
    )
    createdSteps.push(stepResult.rows[0])
  }

  // 3. Create workflow_instance
  const instanceResult = await e2eQuery(
    `INSERT INTO workflow_instances (car_id, workflow_id, current_step_id, status, started_at)
     VALUES ($1, $2, $3, 'running', NOW())
     RETURNING *`,
    [carId, workflow.id, createdSteps[0].id]
  )
  const instance = instanceResult.rows[0]

  // 4. Create step_executions
  const createdExecutions: any[] = []
  for (let i = 0; i < createdSteps.length; i++) {
    const step = createdSteps[i]
    const stepInput = steps[i]

    const execResult = await e2eQuery(
      `INSERT INTO step_executions (instance_id, step_id, status, scheduled_at, request_payload)
       VALUES ($1, $2, 'pending', $3, $4)
       RETURNING *`,
      [
        instance.id,
        step.id,
        stepInput.scheduledAt || null,
        JSON.stringify(stepInput.requestPayload),
      ]
    )
    createdExecutions.push(execResult.rows[0])
  }

  return {
    workflowId: workflow.id,
    instanceId: instance.id,
    stepsCreated: createdSteps.length
  }
}

/**
 * Main routine for automatic flow creation triggered by AI insights
 */
export async function handleAutoUseFlow(params: {
  carId: string
  aiInsightSummary: any
  picId?: string
}) {
  const { carId, aiInsightSummary, picId } = params

  try {
    console.log(`[handleAutoUseFlow] DEBUG: carId=${carId}, hasSummary=${!!aiInsightSummary}, picId=${picId}`)
    const envKeys = Object.keys(process.env).filter(k => k.includes("DB_") || k.includes("VUCAR_") || k.includes("GEMINI"))
    console.log(`[handleAutoUseFlow] Available Env Keys: ${envKeys.join(", ")}`)
    console.log(`[handleAutoUseFlow] DB CONFIG CHECK: V2_HOST=${process.env.VUCAR_V2_DB_HOST ? "SET" : "MISSING"}, E2E_HOST=${process.env.E2E_DB_HOST ? "SET" : "MISSING"}`)

    // Helper for timeout
    const withTimeout = (promise: Promise<any>, timeoutMs: number, label: string) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT: ${label} exceeded ${timeoutMs}ms`)), timeoutMs))
      ])
    }

    // 1. Extract steps
    const extractedSteps = extractStepsFromAnalysis(aiInsightSummary)
    console.log(`[handleAutoUseFlow] Extracted steps count: ${extractedSteps.length}`)
    if (extractedSteps.length === 0) {
      console.log(`[handleAutoUseFlow] No actionable steps found in summary. First 500 chars:`, JSON.stringify(aiInsightSummary).substring(0, 500))
      return { success: true, message: "No actionable steps" }
    }

    // 2. Fetch context
    console.log(`[handleAutoUseFlow] Starting fetchLeadContext for car ${carId}...`)
    const contextStart = Date.now()
    const leadContext = await withTimeout(fetchLeadContext(carId), 10000, "fetchLeadContext")
    console.log(`[handleAutoUseFlow] fetchLeadContext finished in ${Date.now() - contextStart}ms. Context length: ${leadContext.length}`)

    console.log(`[handleAutoUseFlow] Fetching phone number from V2 DB...`)
    const phoneStart = Date.now()
    const phoneResult = await withTimeout(vucarV2Query(
      `SELECT l.phone, l.additional_phone FROM cars c
       JOIN leads l ON l.id = c.lead_id
       WHERE c.id = $1 LIMIT 1`,
      [carId]
    ), 10000, "vucarV2Query-Phone")
    console.log(`[handleAutoUseFlow] Phone query finished in ${Date.now() - phoneStart}ms`)
    const phoneNumber = phoneResult.rows[0]?.phone || phoneResult.rows[0]?.additional_phone || ""
    console.log(`[handleAutoUseFlow] Phone found: ${phoneNumber ? "YES" : "NO"}`)

    // 3. Load connector schemas
    console.log(`[handleAutoUseFlow] Loading connector schemas...`)
    const schemaStart = Date.now()
    const stepSchemas = await Promise.all(
      extractedSteps.map(step => loadConnectorSchema(step.connectorId))
    )
    console.log(`[handleAutoUseFlow] Schemas loaded in ${Date.now() - schemaStart}ms`)

    // 4. Call Gemini for parameters
    console.log(`[handleAutoUseFlow] Calling Gemini for parameters for ${extractedSteps.length} steps...`)
    const geminiResults = await callGeminiForParameters(
      extractedSteps,
      stepSchemas,
      leadContext,
      picId || "",
      carId,
      phoneNumber
    )
    console.log(`[handleAutoUseFlow] Gemini returned ${geminiResults?.length} results`)

    // 5. Build payload
    const workflowName = `AI Auto Flow ${new Date().toLocaleDateString('vi-VN')}`
    const stepsPayload: StepInput[] = extractedSteps.map((step, idx) => {
      const geminiStep = geminiResults[idx] || {}
      const actualValues = geminiStep.parameters || {}
      const fields = stepSchemas[idx]?.fields || []

      const genericMapping: Record<string, string> = {}
      if (fields.length > 0) {
        for (const field of fields) {
          if (field.hidden) continue
          genericMapping[field.name] = `{{${field.name}}}`
        }
      } else {
        for (const key of Object.keys(actualValues)) {
          genericMapping[key] = `{{${key}}}`
        }
      }

      const nextStep = extractedSteps[idx + 1]
      const description = [
        step.aiAction ? `Action: ${step.aiAction}` : null,
        step.expectedReaction ? `Expected Customer Reaction: ${step.expectedReaction}` : null,
        step.successSignal ? `Success Signal: ${step.successSignal}` : null,
        step.failureSignal ? `Failure Signal: ${step.failureSignal}` : null,
        step.ifSuccess ? `If Success: ${step.ifSuccess}` : null,
        step.ifFailure ? `If Failure: ${step.ifFailure}` : null,
        nextStep?.aiAction ? `Ở bước kế tiếp, mục tiêu sẽ là ${nextStep.aiAction}` : null,
      ].filter(Boolean).join('\n')

      return {
        stepName: step.stepName,
        stepOrder: idx + 1,
        connectorId: step.connectorId,
        inputMapping: genericMapping,
        requestPayload: actualValues,
        scheduledAt: geminiStep.scheduled_at || null,
        description
      }
    })

    // 6. Save to DB
    console.log(`[handleAutoUseFlow] Persisting workflow for car ${carId}...`)
    const result = await persistWorkflow({
      name: workflowName,
      description: `Auto-created from AI analysis for car ${carId}`,
      carId,
      steps: stepsPayload
    })
    console.log(`[handleAutoUseFlow] Persistence success:`, result)
    return result
  } catch (err) {
    console.error(`[handleAutoUseFlow] CRITICAL ERROR for car ${carId}:`, err)
    throw err
  }
}

// --- Internal Helper: Fetch context ---
async function fetchLeadContext(carId: string): Promise<string> {
  const result = await vucarV2Query(
    `SELECT c.brand, c.model, c.variant, c.year, c.location, c.mileage, c.plate,
            ss.price_customer, ss.price_highest_bid, ss.stage, ss.qualified,
            ss.intention, ss.negotiation_ability, ss.notes, ss.messages_zalo,
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
  const parts: string[] = []
  parts.push(`=== LEAD CONTEXT ===`)
  parts.push(`Customer: ${row.customer_name || "Unknown"}`)
  parts.push(`Phone: ${row.phone || "N/A"}`)
  parts.push(`Car: ${[row.brand, row.model, row.variant].filter(Boolean).join(" ")} ${row.year || ""}`)
  parts.push(`Price Highest Bid: ${row.price_highest_bid ? `${row.price_highest_bid} triệu` : "N/A"}`)
  parts.push(`Notes: ${row.notes || "N/A"}`)

  if (row.messages_zalo && Array.isArray(row.messages_zalo)) {
    const recentMessages = row.messages_zalo.slice(-10)
    parts.push(`\n=== RECENT CHAT HISTORY ===`)
    recentMessages.forEach((msg: any) => {
      const sender = msg.fromMe ? "PIC" : "Customer"
      const text = typeof msg === "string" ? msg : (msg.text || msg.body || JSON.stringify(msg))
      parts.push(`[${sender}]: ${text}`)
    })
  }
  return parts.join("\n")
}

// --- Internal Helper: Connector schemas (with simple memoization to prevent parallel query bursts) ---
const connectorSchemaCache = new Map<string, any>()

async function loadConnectorSchema(connectorId: string) {
  if (connectorSchemaCache.has(connectorId)) return connectorSchemaCache.get(connectorId)

  const res = await e2eQuery(`SELECT * FROM api_connectors WHERE id = $1`, [connectorId])
  if (res.rows.length === 0) return { fields: [] }
  const connector = res.rows[0]
  let schema = connector.input_schema
  if (typeof schema === "string") schema = JSON.parse(schema)

  const properties = schema?.properties || schema?.body?.properties || schema?.body || {}
  const fields = Object.entries(properties).map(([name, prop]: [string, any]) => ({
    name,
    label: prop.description || name,
    type: prop.type || "string",
    hidden: prop.hidden === true,
  }))

  const result = { fields }
  connectorSchemaCache.set(connectorId, result)
  return result
}

// --- Internal Helper: Gemini ---
async function callGeminiForParameters(
  steps: ExtractedStep[],
  schemas: any[],
  leadContext: string,
  picId: string,
  carId: string,
  phoneNumber: string
) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY missing")

  const now = new Date()
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const todayInfo = `Current time (VN UTC+7): ${vnTime.toISOString().replace('T', ' ').slice(0, 19)}`

  const prompt = `You are filling workflow parameters.
${todayInfo}
${leadContext}
Steps: ${JSON.stringify(steps.map((s, i) => ({ ...s, schema: schemas[i].fields })))}
IDs: picId=${picId}, carId=${carId}, phone=${phoneNumber}

Return JSON array of { "scheduled_at": ISO or null, "parameters": { ... } } only.`

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  })

  if (!res.ok) throw new Error("Gemini failed")
  const data = await res.json()
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
  const jsonMatch = rawText.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error("Invalid Gemini JSON")
  return JSON.parse(jsonMatch[0])
}
