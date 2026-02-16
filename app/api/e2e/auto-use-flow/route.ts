import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"

/**
 * POST /api/e2e/auto-use-flow
 *
 * Automatically creates an AI workflow from a final_synthesis analysis.
 * Uses Gemini 2.5 Flash to decide parameter values for each step.
 *
 * Body: { carId, aiInsightSummary, picId }
 *
 * Can be called in the background (fire-and-forget) after AI insights complete.
 */

// Known connector mappings (same as AiThinkingChat.tsx extractSteps)
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

// ========================================================================
// Step extraction from analysis (mirrors AiThinkingChat logic)
// ========================================================================
interface ExtractedStep {
  stepName: string
  connectorId: string
  connectorLabel: string
  rawContext: string // The raw action/script text for Gemini context
  aiAction?: string
  expectedReaction?: string
  successSignal?: string
  failureSignal?: string
  ifSuccess?: string
  ifFailure?: string
}

function extractStepsFromAnalysis(analysis: any): ExtractedStep[] {
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

// ========================================================================
// Server-side schema parsing (mirrors connectorFormUtils.ts but uses DB directly)
// ========================================================================
interface SchemaProperty {
  type?: string
  default?: any
  description?: string
  enum?: string[]
  hidden?: boolean
  "read-only"?: boolean
  required?: boolean
  properties?: Record<string, SchemaProperty>
}

interface ParsedField {
  name: string
  label: string
  type: string
  required: boolean
  default?: any
  description?: string
  enumValues?: string[]
  hidden?: boolean
  readOnly?: boolean
  subFields?: ParsedField[]
}

function parseInputSchema(inputSchema: any): ParsedField[] | null {
  if (!inputSchema || typeof inputSchema !== "object") return null

  let properties = inputSchema.properties
  if (!properties && inputSchema.body) {
    if (inputSchema.body.properties) {
      properties = inputSchema.body.properties
    } else {
      properties = inputSchema.body
    }
  }

  if (!properties || typeof properties !== "object") return null

  const requiredFields: string[] = Array.isArray(inputSchema.required) ? inputSchema.required : []

  return Object.entries(properties).map(([name, prop]) => {
    const schemaProp = prop as SchemaProperty
    const field: ParsedField = {
      name,
      label: schemaProp.description || name,
      type: schemaProp.type || "string",
      required: schemaProp.required || requiredFields.includes(name),
      default: schemaProp.default,
      description: schemaProp.description,
      enumValues: schemaProp.enum,
      hidden: schemaProp.hidden === true,
      readOnly: schemaProp["read-only"] === true,
    }

    if ((schemaProp.type === 'dict' || schemaProp.type === 'object') && schemaProp.properties) {
      field.subFields = Object.entries(schemaProp.properties).map(([subName, subProp]) => {
        const subSchemaProp = subProp as SchemaProperty
        return {
          name: `${name}.${subName}`,
          label: subSchemaProp.description || subName,
          type: subSchemaProp.type || "string",
          required: subSchemaProp.required || false,
          default: subSchemaProp.default,
          description: subSchemaProp.description,
          enumValues: subSchemaProp.enum,
          hidden: subSchemaProp.hidden === true,
          readOnly: subSchemaProp["read-only"] === true,
        }
      })
    }

    return field
  })
}

async function enrichDictFields(fields: ParsedField[]): Promise<ParsedField[]> {
  const dictFields = fields.filter(f => f.type === 'dict' || f.type === 'object')
  if (dictFields.length === 0) return fields

  try {
    const res = await e2eQuery(`SELECT * FROM dict_variables LIMIT 100`)
    const dictVars = res.rows

    return fields.map(field => {
      if (field.type !== 'dict' && field.type !== 'object') return field

      const dictVar = dictVars.find((d: any) => d.name === field.name)
      if (!dictVar || !dictVar.variables) return field

      let variables = dictVar.variables
      if (typeof variables === 'string') {
        try { variables = JSON.parse(variables) } catch { return field }
      }

      const subFields: ParsedField[] = Object.entries(variables).map(([subName, subDef]: [string, any]) => ({
        name: `${field.name}.${subName}`,
        label: subDef.description || subName,
        type: subDef.type || 'string',
        required: subDef.required || false,
        default: subDef.default,
        description: subDef.description,
        enumValues: subDef.enum,
        hidden: subDef.hidden === true,
        readOnly: subDef['read-only'] === true,
      }))

      return { ...field, subFields }
    })
  } catch {
    return fields
  }
}

// ========================================================================
// Load connector schema fields
// ========================================================================
async function loadConnectorSchema(connectorId: string): Promise<{ connector: any; fields: ParsedField[] }> {
  const res = await e2eQuery(
    `SELECT * FROM api_connectors WHERE id = $1 LIMIT 1`,
    [connectorId]
  )
  if (res.rows.length === 0) return { connector: null, fields: [] }

  const connector = res.rows[0]
  if (!connector.input_schema) return { connector, fields: [] }

  let schema = connector.input_schema
  if (typeof schema === "string") {
    try { schema = JSON.parse(schema) } catch { return { connector, fields: [] } }
  }

  const parsed = parseInputSchema(schema)
  if (!parsed || parsed.length === 0) return { connector, fields: [] }

  const enriched = await enrichDictFields(parsed)
  return { connector, fields: enriched }
}

// ========================================================================
// Fetch lead context from DB
// ========================================================================
async function fetchLeadContext(carId: string): Promise<string> {
  try {
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

    // Build context string
    const parts: string[] = []
    parts.push(`=== LEAD CONTEXT ===`)
    parts.push(`Customer: ${row.customer_name || "Unknown"}`)
    parts.push(`Phone: ${row.phone || "N/A"}`)
    parts.push(`Car: ${[row.brand, row.model, row.variant].filter(Boolean).join(" ")} ${row.year || ""}`)
    parts.push(`Plate: ${row.plate || "N/A"}`)
    parts.push(`Location: ${row.location || "N/A"}`)
    parts.push(`Mileage: ${row.mileage ? `${row.mileage} km` : "N/A"}`)
    parts.push(`Price Customer: ${row.price_customer ? `${row.price_customer} triệu` : "N/A"}`)
    parts.push(`Price Highest Bid: ${row.price_highest_bid ? `${row.price_highest_bid} triệu` : "N/A"}`)
    parts.push(`Stage: ${row.stage || "N/A"}`)
    parts.push(`Qualified: ${row.qualified || "N/A"}`)
    parts.push(`Intention: ${row.intention || "N/A"}`)
    parts.push(`Negotiation Ability: ${row.negotiation_ability || "N/A"}`)
    parts.push(`Notes: ${row.notes || "N/A"}`)

    // Chat history (last 10 messages for brevity)
    if (row.messages_zalo && Array.isArray(row.messages_zalo)) {
      const recentMessages = row.messages_zalo.slice(-10)
      if (recentMessages.length > 0) {
        parts.push(`\n=== RECENT CHAT HISTORY (last ${recentMessages.length} messages) ===`)
        recentMessages.forEach((msg: any) => {
          const sender = msg.fromMe ? "PIC" : "Customer"
          const text = typeof msg === "string" ? msg : (msg.text || msg.body || JSON.stringify(msg))
          parts.push(`[${sender}]: ${text}`)
        })
      }
    }

    return parts.join("\n")
  } catch (error) {
    console.error("[Auto Use Flow] Error fetching lead context:", error)
    return "Error fetching lead context."
  }
}

// ========================================================================
// Call Gemini 2.5 Flash to decide parameters
// ========================================================================
async function callGeminiForParameters(
  steps: ExtractedStep[],
  stepSchemas: { fields: ParsedField[] }[],
  leadContext: string,
  picId: string,
  carId: string,
  phoneNumber: string,
): Promise<any[]> {
  const geminiHost = process.env.GEMINI_HOST || "https://generativelanguage.googleapis.com"
  const geminiApiKey = process.env.GEMINI_API_KEY

  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured")
  }

  // Build current datetime info for precise scheduling
  const now = new Date()
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const todayInfo = `Current date and time (Vietnam UTC+7): ${vnTime.toISOString().replace('T', ' ').slice(0, 19)}, ${['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][vnTime.getUTCDay()]}`

  // Build step descriptions for Gemini
  const stepDescriptions = steps.map((step, idx) => {
    const schema = stepSchemas[idx]
    const fieldDescriptions = schema.fields
      .filter(f => !f.hidden)
      .map(f => {
        let desc = `  - "${f.name}" (type: ${f.type}${f.required ? ', REQUIRED' : ''}): ${f.description || f.label}`
        if (f.default !== undefined) desc += ` [default: ${JSON.stringify(f.default)}]`
        if (f.enumValues) desc += ` [options: ${f.enumValues.join(', ')}]`
        if (f.subFields) {
          desc += `\n    Sub-fields:`
          f.subFields.filter(sf => !sf.hidden).forEach(sf => {
            desc += `\n      - "${sf.name.split('.').pop()}" (${sf.type}${sf.required ? ', REQUIRED' : ''}): ${sf.description || sf.label}`
          })
        }
        return desc
      })
      .join('\n')

    return `
STEP ${idx + 1}: "${step.stepName}" (connector: ${step.connectorLabel})
AI's instruction/context for this step:
"""
${step.rawContext}
"""
Required fields schema:
${fieldDescriptions || '  (no schema fields - provide raw payload)'}
`
  }).join('\n---\n')

  const prompt = `You are an AI assistant that decides execution parameters for workflow automation steps.

${todayInfo}

${leadContext}

=== WORKFLOW STEPS TO FILL ===
${stepDescriptions}

=== KNOWN VALUES ===
- picId (sale person ID): "${picId}"
- carId: "${carId}"
- customer_phone: "${phoneNumber}"

=== INSTRUCTIONS ===
For each step, you must decide:
1. **scheduled_at**: ISO datetime string (Vietnam time UTC+7) for when to execute this step.
   - If the step should run immediately, set to null.
   - If the AI's instruction mentions timing (e.g., "gửi sau 2 giờ", "sáng mai", "Ngày 1"), calculate the exact datetime.
   - For relative day offsets like "Ngày X", treat it as an offset from today (Ngày 1 = tomorrow, Ngày 2 = 2 days from now, "Ngày 1-2" = between tomorrow and 2 days from now).
   - Consider business hours (8:00-18:00 Vietnam time) and today's schedule.
2. **parameters**: The values for each field in the schema.
   - For "messages" arrays: Fill in the actual script text. Replace any placeholder like "X", "Y", "Z" or "[...]" with appropriate values from the lead context.
   - **Tone & Terminology**:
     - Make messages feel NATURAL, HUMAN, and friendly (like a helpful consultant).
     - NEVER use the word "dealer". Use "người mua" (buyer) instead.
     - Always sound HELPFUL. Emphasize that we are helping the customer get the HIGHEST price with the SMALLEST risk (saving them time and cost).
   - IMPORTANT: Keep each message string CONCISE (under 500 characters). Be direct and clear, do not write essays.
   - For "picId": Use the known picId value.
   - For "customer_phone": Use the known phone value.
   - For "carId": Use the known carId value.
   - For "duration": Decide based on the context (typical bidding duration).
   - For any dict/object fields: Fill sub-fields appropriately.

Return ONLY valid JSON array with one object per step:
[
  {
    "scheduled_at": "2026-02-12T16:00:00+07:00" or null,
    "parameters": { "fieldName": "value", ... }
  }
]

Do NOT include any text outside the JSON array.`

  const url = `${geminiHost}/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`

  console.log(`[Auto Use Flow] Calling Gemini 2.5 Flash for ${steps.length} steps...`)

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 65536,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API failed (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
  console.log("[Auto Use Flow] Gemini raw response:", rawText.slice(0, 500))

  // Parse JSON from response (may be wrapped in code block)
  const jsonMatch = rawText.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error(`Gemini did not return valid JSON array. Response: ${rawText.slice(0, 300)}`)
  }

  let jsonStr = jsonMatch[0]

  // Try parsing directly first
  try {
    const parsed = JSON.parse(jsonStr)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // JSON might be truncated — try to repair it
    console.warn("[Auto Use Flow] JSON parse failed, attempting repair...")
  }

  // Repair truncated JSON: close any unclosed strings, arrays, objects
  // Remove trailing incomplete string value
  jsonStr = jsonStr.replace(/,\s*"[^"]*$/, '')  // remove trailing incomplete key-value
  jsonStr = jsonStr.replace(/:\s*"[^"]*$/, ': ""')  // close incomplete string value

  // Count and close unclosed brackets
  let openBraces = 0, openBrackets = 0
  let inString = false, escape = false
  for (const ch of jsonStr) {
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') openBraces++
    if (ch === '}') openBraces--
    if (ch === '[') openBrackets++
    if (ch === ']') openBrackets--
  }

  // Close unclosed strings
  if (inString) jsonStr += '"'
  // Close unclosed braces and brackets
  for (let i = 0; i < openBraces; i++) jsonStr += '}'
  for (let i = 0; i < openBrackets; i++) jsonStr += ']'

  try {
    const parsed = JSON.parse(jsonStr)
    if (Array.isArray(parsed)) {
      console.log("[Auto Use Flow] Successfully repaired truncated JSON")
      return parsed
    }
  } catch (repairErr) {
    console.error("[Auto Use Flow] JSON repair also failed:", repairErr)
  }

  throw new Error(`Could not parse Gemini response as JSON. Raw: ${rawText.slice(0, 500)}`)
}

// ========================================================================
// Main endpoint
// ========================================================================
export async function POST(request: Request) {
  const startTime = Date.now()

  // --- 0. Authentication Check ---
  const authHeader = request.headers.get("x-api-secret")
  const apiSecret = process.env.VUCAR_API_SECRET

  if (apiSecret && authHeader !== apiSecret) {
    console.warn("[Auto Use Flow] Unauthorized attempt - missing or invalid x-api-secret")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { carId, aiInsightSummary, picId } = body

    if (!carId || !aiInsightSummary) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: carId, aiInsightSummary" },
        { status: 400 }
      )
    }

    // --- 1. Extract steps from analysis ---
    const extractedSteps = extractStepsFromAnalysis(aiInsightSummary)
    console.log(`[Auto Use Flow] Extracted ${extractedSteps.length} steps from analysis`)

    if (extractedSteps.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No actionable steps found in analysis",
        stepsFound: 0,
        durationMs: Date.now() - startTime,
      })
    }

    // --- 2. Fetch lead context ---
    const leadContext = await fetchLeadContext(carId)

    // Get phone number from lead
    const phoneResult = await vucarV2Query(
      `SELECT l.phone, l.additional_phone FROM cars c
       JOIN leads l ON l.id = c.lead_id
       WHERE c.id = $1 LIMIT 1`,
      [carId]
    )
    const phoneNumber = phoneResult.rows[0]?.phone || phoneResult.rows[0]?.additional_phone || ""

    // --- 3. Load connector schemas ---
    const stepSchemas = await Promise.all(
      extractedSteps.map(step => loadConnectorSchema(step.connectorId))
    )

    // --- 4. Call Gemini to decide parameters ---
    const geminiResults = await callGeminiForParameters(
      extractedSteps,
      stepSchemas,
      leadContext,
      picId || "",
      carId,
      phoneNumber,
    )

    console.log(`[Auto Use Flow] Gemini decided parameters for ${geminiResults.length} steps`)

    // --- 5. Build workflow creation payload ---
    const workflowName = `AI Auto Flow ${new Date().toLocaleDateString('vi-VN')}`

    const stepsPayload = extractedSteps.map((step, idx) => {
      const geminiStep = geminiResults[idx] || {}
      const actualValues = geminiStep.parameters || {}
      const fields = stepSchemas[idx]?.fields || []

      // Build generic input_mapping template
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

      // Build step description from AI metadata
      const nextStep = extractedSteps[idx + 1]
      const descriptionParts = [
        step.aiAction ? `Action: ${step.aiAction}` : null,
        step.expectedReaction ? `Expected Customer Reaction: ${step.expectedReaction}` : null,
        step.successSignal ? `Success Signal: ${step.successSignal}` : null,
        step.failureSignal ? `Failure Signal: ${step.failureSignal}` : null,
        step.ifSuccess ? `If Success: ${step.ifSuccess}` : null,
        step.ifFailure ? `If Failure: ${step.ifFailure}` : null,
        nextStep?.aiAction ? `Ở bước kế tiếp, mục tiêu sẽ là ${nextStep.aiAction}` : null,
      ].filter(Boolean)

      return {
        stepName: step.stepName,
        stepOrder: idx + 1,
        connectorId: step.connectorId,
        inputMapping: genericMapping,
        requestPayload: actualValues,
        scheduledAt: geminiStep.scheduled_at || null,
        description: descriptionParts.join('\n'),
      }
    })

    // --- 6. Create workflow (same logic as create-ai-workflow) ---
    const workflowResult = await e2eQuery(
      `INSERT INTO workflows (name, stage_id, is_active, description, type)
       VALUES ($1, $2, true, $3, 'AI')
       RETURNING *`,
      [workflowName, DEFAULT_STAGE_ID, `Auto-created from AI analysis for car ${carId}`]
    )
    const workflow = workflowResult.rows[0]

    const createdSteps: any[] = []
    for (const step of stepsPayload) {
      const stepResult = await e2eQuery(
        `INSERT INTO workflow_steps (workflow_id, step_name, step_order, connector_id, input_mapping, is_automated, description)
         VALUES ($1, $2, $3, $4, $5, true, $6)
         RETURNING *`,
        [workflow.id, step.stepName, step.stepOrder, step.connectorId, JSON.stringify(step.inputMapping), step.description]
      )
      createdSteps.push(stepResult.rows[0])
    }

    const instanceResult = await e2eQuery(
      `INSERT INTO workflow_instances (car_id, workflow_id, current_step_id, status, started_at)
       VALUES ($1, $2, $3, 'running', NOW())
       RETURNING *`,
      [carId, workflow.id, createdSteps[0].id]
    )
    const instance = instanceResult.rows[0]

    for (let i = 0; i < createdSteps.length; i++) {
      await e2eQuery(
        `INSERT INTO step_executions (instance_id, step_id, status, scheduled_at, request_payload)
         VALUES ($1, $2, 'pending', $3, $4)`,
        [
          instance.id,
          createdSteps[i].id,
          stepsPayload[i].scheduledAt || null,
          JSON.stringify(stepsPayload[i].requestPayload),
        ]
      )
    }

    console.log(`[Auto Use Flow] Created workflow "${workflowName}" with ${createdSteps.length} steps`)

    return NextResponse.json({
      success: true,
      workflowId: workflow.id,
      workflowName,
      instanceId: instance.id,
      stepsCreated: createdSteps.length,
      geminiDecisions: geminiResults,
      durationMs: Date.now() - startTime,
    })
  } catch (error) {
    console.error("[Auto Use Flow] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to auto-create AI workflow",
        details: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
