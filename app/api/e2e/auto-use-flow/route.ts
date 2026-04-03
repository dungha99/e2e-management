import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"
import { storeAgentOutput, getActiveAgentNote, getPicAgentConfig } from "@/lib/ai-agent-service"
import { getAgentTools, executeToolCall } from "@/lib/agent-tools"
import { searchPicRAG, getLastCustomerMessage, formatRAGExamples } from "@/lib/pic-rag-search"

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

/**
 * Gemini returns scheduled_at as Vietnam local time (e.g. "2026-02-24T18:00:00").
 * On Vercel (UTC server), new Date() would parse that as UTC → 7 hrs ahead.
 * This helper ensures timezone offset is present, then converts to UTC ISO string.
 */
function toUtcFromVietnam(value: string | null | undefined): string | null {
  if (!value) return null
  // If there's already a timezone indicator (+, Z), trust it
  const hasOffset = /[+\-]\d{2}:\d{2}$/.test(value) || value.endsWith('Z')
  const withOffset = hasOffset ? value : `${value}+07:00`
  const date = new Date(withOffset)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

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

      if (isBidding) {
        console.log(`[extractStepsFromAnalysis] Auto-appending SCRIPT step after BIDDING`)
        steps.push({
          stepName: CONNECTOR_MAP.script.stepName,
          connectorId: CONNECTOR_MAP.script.connectorId,
          connectorLabel: "Gửi Script",
          rawContext: `YÊU CẦU BẮT BUỘC: Generate parameters với mảng messages chính xác chứa 1 phần tử là: "dạ e gửi link phiên đấu giá ạ: https://vucar.vn/phien-dau-gia/tin-xe/{{cars.slug}}" (giữ nguyên từng chữ, không di dịch, chỉ thay đổi cars.slug thành giá trị slug chính xác của xe).`,
          aiAction: "Gửi link phiên đấu giá tự động cho khách",
          expectedReaction: "Khách hàng nhận được link và xem phiên đấu giá",
        })
      }
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
      `SELECT c.brand, c.model, c.variant, c.year, c.location, c.mileage, c.plate, c.slug,
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
// Call Gemini 2.5 Flash to decide parameters (one step at a time)
// ========================================================================

function buildFieldDescriptions(fields: ParsedField[]): string {
  return fields
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
}

function parseGeminiJson(rawText: string): any {
  // Parse JSON from response (may be wrapped in code block)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Gemini did not return valid JSON. Response: ${rawText.slice(0, 300)}`)
  }

  let jsonStr = jsonMatch[0]

  // Try parsing directly first
  try {
    return JSON.parse(jsonStr)
  } catch {
    console.warn("[Auto Use Flow] JSON parse failed, attempting repair...")
  }

  // Repair truncated JSON
  jsonStr = jsonStr.replace(/,\s*"[^"]*$/, '')
  jsonStr = jsonStr.replace(/:\s*"[^"]*$/, ': ""')

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

  if (inString) jsonStr += '"'
  for (let i = 0; i < openBraces; i++) jsonStr += '}'
  for (let i = 0; i < openBrackets; i++) jsonStr += ']'

  try {
    const parsed = JSON.parse(jsonStr)
    console.log("[Auto Use Flow] Successfully repaired truncated JSON")
    return parsed
  } catch (repairErr) {
    console.error("[Auto Use Flow] JSON repair also failed:", repairErr)
  }

  throw new Error(`Could not parse Gemini response as JSON. Raw: ${rawText.slice(0, 500)}`)
}

async function callGeminiForParameters(
  steps: ExtractedStep[],
  stepSchemas: { fields: ParsedField[] }[],
  leadContext: string,
  picId: string,
  carId: string,
  phoneNumber: string,
  ragExamplesContext?: string | null
): Promise<any[]> {
  const geminiHost = process.env.GEMINI_HOST || "https://generativelanguage.googleapis.com"
  const geminiApiKey = process.env.GEMINI_API_KEY

  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured")
  }

  const now = new Date()
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const todayInfo = `Current date and time (Vietnam UTC+7): ${vnTime.toISOString().replace('T', ' ').slice(0, 19)}, ${['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][vnTime.getUTCDay()]}`

  const url = `${geminiHost}/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`

  const [picPrompt, agentNote] = await Promise.all([
    getPicAgentConfig("Worker (Parameter/Rule)", picId),
    getActiveAgentNote("Worker (Parameter/Rule)"),
  ])
  const baseSystemPrompt = `${picPrompt || ''}${agentNote ? `\n\n### Cấu Hình Bổ Sung (System Preferences):\n${agentNote}` : ''}`

  const results: any[] = []

  for (let idx = 0; idx < steps.length; idx++) {
    const step = steps[idx]
    const schema = stepSchemas[idx]
    const fieldDescriptions = buildFieldDescriptions(schema.fields)

    // Build previous step context (if any)
    let previousStepContext = ""
    if (idx > 0) {
      const prevStep = steps[idx - 1]
      const prevResult = results[idx - 1]
      previousStepContext = `
=== PREVIOUS STEP (already decided) ===
Step ${idx}: "${prevStep.stepName}" (connector: ${prevStep.connectorLabel})
AI's instruction: "${prevStep.rawContext}"
Decided scheduled_at: ${prevResult.scheduled_at ? `"${prevResult.scheduled_at}"` : "null (immediate)"}
Decided parameters: ${JSON.stringify(prevResult.parameters, null, 2)}
`
    }

    const systemPrompt = idx > 0
      ? baseSystemPrompt + "\n- Phải được đặt SAU thời điểm của bước trước đó."
      : baseSystemPrompt


    const ragSection = ragExamplesContext ? `\n=== RAG EXAMPLES (Similar successful conversations from this PIC) ===\nDưới đây là các ví dụ từ những cuộc hội thoại thành công tương tự, hãy tham khảo phong cách và cách tiếp cận:\n${ragExamplesContext}\n` : ""

    const userPrompt = `
${todayInfo}

${leadContext}
${ragSection}
${previousStepContext}

=== CURRENT STEP TO FILL (Step ${idx + 1} of ${steps.length}) ===
"${step.stepName}" (connector: ${step.connectorLabel})
Instruction: "${step.rawContext}"

Required Fields:
${fieldDescriptions || '  (no schema fields - provide raw payload)'}

Context IDs:
- picId: "${picId}"
- carId: "${carId}"
- customer_phone: "${phoneNumber}"

Return JSON object.`

    console.log(`[Auto Use Flow] Calling Gemini for step ${idx + 1}/${steps.length}: "${step.stepName}"...`)

    // Retry loop for JSON parsing
    let parsed: any = null
    let currentPrompt = userPrompt

    for (let parseAttempt = 0; parseAttempt < 3; parseAttempt++) {
      // Function calling loop: Gemini may call tools (booking, google search) before generating JSON
      const contents: any[] = [{ role: "user", parts: [{ text: currentPrompt }] }]
      const baseBody = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.2, maxOutputTokens: 16384 },
        tools: getAgentTools(),
      }

      let rawText = ""
      for (let iteration = 0; iteration <= 3; iteration++) {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, contents }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Gemini API failed for step ${idx + 1} (${response.status}): ${errorText}`)
        }

        const data = await response.json()
        const parts = data?.candidates?.[0]?.content?.parts || []
        const functionCall = parts.find((p: any) => p.functionCall)

        if (functionCall && iteration < 3) {
          const { name, args } = functionCall.functionCall
          console.log(`[Auto Use Flow] Step ${idx + 1} tool call: ${name}(${JSON.stringify(args)})`)
          const toolResult = await executeToolCall(name, args || {})
          contents.push({ role: "model", parts })
          contents.push({ role: "user", parts: [{ functionResponse: { name, response: { result: toolResult } } }] })
          continue
        }

        rawText = parts.find((p: any) => p.text)?.text || ""
        break
      }

      console.log(`[Auto Use Flow] Gemini response for step ${idx + 1} (attempt ${parseAttempt + 1}):`, rawText.slice(0, 300))

      try {
        parsed = parseGeminiJson(rawText)
        break // Success
      } catch (err: any) {
        console.warn(`[Auto Use Flow] JSON parse failed on attempt ${parseAttempt + 1} for step ${idx + 1}`)
        if (parseAttempt === 2) {
          throw err // Fail after 3 attempts
        }
        currentPrompt += `\n\nERROR on previous attempt: You did not return a valid JSON object. Please ensure your ENTIRE response is a single valid JSON object without markdown formatting or extra text. Previous invalid response: ${rawText}`
      }
    }

    results.push(parsed)
  }

  return results
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
    let { carId, aiInsightSummary, picId } = body

    if (!carId || !aiInsightSummary) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: carId, aiInsightSummary" },
        { status: 400 }
      )
    }

    // Auto-fetch picId from DB if not provided (same pattern as ai-insights/callback)
    if (!picId) {
      try {
        const leadCheck = await vucarV2Query(
          `SELECT l.pic_id FROM cars c JOIN leads l ON l.id = c.lead_id WHERE c.id = $1 LIMIT 1`,
          [carId]
        )
        picId = leadCheck.rows[0]?.pic_id || null
        console.log(`[Auto Use Flow] picId auto-resolved from DB: ${picId}`)
      } catch (err) {
        console.warn("[Auto Use Flow] Failed to auto-resolve picId:", err)
      }
    }

    // --- 1. Extract steps from analysis ---
    const extractedSteps = extractStepsFromAnalysis(aiInsightSummary)
    console.log(`[Auto Use Flow] Extracted ${extractedSteps.length} steps from analysis`)

    // Track Router (Plan) agent output
    storeAgentOutput({
      agentName: "Router (Plan)",
      carId,
      inputPayload: { prompt: typeof aiInsightSummary === 'string' ? aiInsightSummary : JSON.stringify(aiInsightSummary) },
      outputPayload: { extractedSteps },
    }).catch(err => console.error("[Auto Use Flow] Failed to store Router output:", err))

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

    // --- 3. Load connector schemas + RAG examples in parallel ---
    const [stepSchemas, ragExamplesContext] = await Promise.all([
      Promise.all(extractedSteps.map(step => loadConnectorSchema(step.connectorId))),
      (async () => {
        try {
          const messagesResult = await vucarV2Query(
            `SELECT ss.messages_zalo FROM cars c
             LEFT JOIN sale_status ss ON ss.car_id = c.id
             WHERE c.id = $1 LIMIT 1`,
            [carId]
          )
          const messagesZalo = messagesResult.rows[0]?.messages_zalo
          const lastCustomerMsg = getLastCustomerMessage(messagesZalo)
          const ragQuery = lastCustomerMsg ? `CUSTOMER: ${lastCustomerMsg}` : "CUSTOMER"
          console.log(`[Auto Use Flow] RAG query (${lastCustomerMsg ? "customer msg" : "no messages fallback"}): "${ragQuery.slice(0, 100)}"`)
          const ragResults = await searchPicRAG(picId || null, ragQuery, 5)
          const formatted = formatRAGExamples(ragResults)
          console.log(`[Auto Use Flow] RAG returned ${ragResults.length} examples`)
          return formatted || null
        } catch (err) {
          console.error("[Auto Use Flow] RAG search failed (non-blocking):", err)
          return null
        }
      })(),
    ])

    // --- 4. Call Gemini to decide parameters ---
    const geminiResults = await callGeminiForParameters(
      extractedSteps,
      stepSchemas,
      leadContext,
      picId,
      carId,
      phoneNumber,
      ragExamplesContext
    )

    console.log(`[Auto Use Flow] Gemini decided parameters for ${geminiResults.length} steps`)

    // Track Worker (Parameter/Rule) agent output
    storeAgentOutput({
      agentName: "Worker (Parameter/Rule)",
      carId,
      inputPayload: { prompt: geminiResults.map((r: any) => r._prompt).join("\n\n=== NEXT STEP ===\n\n") },
      outputPayload: geminiResults,
    }).catch(err => console.error("[Auto Use Flow] Failed to store Worker output:", err))

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

    // 6. Terminate existing "running" instances for this car
    console.log(`[Auto Use Flow] Terminating existing running workflows for car ${carId}...`)
    await e2eQuery(
      `UPDATE workflow_instances SET status = 'terminated' WHERE car_id = $1 AND status = 'running'`,
      [carId]
    )

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
