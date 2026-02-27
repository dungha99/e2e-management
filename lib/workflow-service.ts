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

    // Emit SEPARATE steps for script and bidding — a single AI node can have both
    if (isScript) {
      console.log(`[extractStepsFromAnalysis] Found SCRIPT step:`, { action })
      steps.push({
        stepName: CONNECTOR_MAP.script.stepName,
        connectorId: CONNECTOR_MAP.script.connectorId,
        connectorLabel: "Gửi Script",
        rawContext: obj.script,
        aiAction: obj.action,
        expectedReaction: obj.expected_customer_reaction || obj.expected_reaction,
        successSignal: obj.success_signal,
        failureSignal: obj.failure_signal,
        ifSuccess: obj.if_success,
        ifFailure: obj.if_failure,
      })
    }

    if (isBidding) {
      console.log(`[extractStepsFromAnalysis] Found BIDDING step:`, { action })
      steps.push({
        stepName: CONNECTOR_MAP.bidding.stepName,
        connectorId: CONNECTOR_MAP.bidding.connectorId,
        connectorLabel: "Tạo phiên đấu giá",
        rawContext: obj.action,
        aiAction: obj.action,
        expectedReaction: obj.expected_customer_reaction || obj.expected_reaction,
        successSignal: obj.success_signal,
        failureSignal: obj.failure_signal,
        ifSuccess: obj.if_success,
        ifFailure: obj.if_failure,
      })

      console.log(`[extractStepsFromAnalysis] Auto-appending SCRIPT step after BIDDING`)
      steps.push({
        stepName: CONNECTOR_MAP.script.stepName,
        connectorId: CONNECTOR_MAP.script.connectorId,
        connectorLabel: "Gửi Script",
        rawContext: `YÊU CẦU BẮT BUỘC: Generate parameters với mảng messages chính xác chứa 1 phần tử là: "dạ e gửi link phiên đấu giá ạ: https://vucar.vn/phien-dau-gia/tin-xe/{{cars.sku}}" (giữ nguyên từng chữ, không di dịch, chỉ thay đổi sku thành giá trị sku chính xác của xe).`,
        aiAction: "Gửi link phiên đấu giá tự động cho khách",
        expectedReaction: "Khách hàng nhận được link và xem phiên đấu giá",
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

  // 0. Terminate existing "running" instances for this car
  console.log(`[Workflow Service] Terminating existing running workflows for car ${carId}...`)
  await e2eQuery(
    `UPDATE workflow_instances SET status = 'terminated' WHERE car_id = $1 AND status = 'running'`,
    [carId]
  )

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
  const parts: string[] = []
  parts.push(`=== LEAD CONTEXT ===`)
  parts.push(`Customer: ${row.customer_name || "Unknown"}`)
  parts.push(`Phone: ${row.phone || "N/A"}`)
  parts.push(`Car: ${[row.brand, row.model, row.variant].filter(Boolean).join(" ")} ${row.year || ""}`)
  parts.push(`Car Slug: ${row.slug || "N/A"} (use this exact value when referencing {{cars.slug}} in the bidding link)`)
  parts.push(`Bidding Link: https://vucar.vn/phien-dau-gia/tin-xe/${row.slug || "{{cars.slug}}"}`)
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
  if (typeof schema === "string") {
    try { schema = JSON.parse(schema) } catch { return { fields: [] } }
  }

  const properties = schema?.properties || schema?.body?.properties || schema?.body || {}
  const requiredFields: string[] = Array.isArray(schema?.required) ? schema.required : []
  const fields = Object.entries(properties).map(([name, prop]: [string, any]) => ({
    name,
    label: prop.description || name,
    type: prop.type || "string",
    required: prop.required || requiredFields.includes(name),
    hidden: prop.hidden === true,
    description: prop.description as string | undefined,
    enumValues: prop.enum as string[] | undefined,
  }))

  const result = { fields }
  connectorSchemaCache.set(connectorId, result)
  return result
}

// --- Internal Helper: Build field-description string for Gemini prompts ---
function buildFieldDescriptions(fields: { name: string; label: string; type: string; required?: boolean; hidden?: boolean; description?: string; enumValues?: string[] }[]): string {
  return fields
    .filter(f => !f.hidden)
    .map(f => {
      let desc = `  - "${f.name}" (type: ${f.type}${f.required ? ', REQUIRED' : ''}): ${f.description || f.label}`
      if (f.enumValues) desc += ` [options: ${f.enumValues.join(', ')}]`
      return desc
    })
    .join('\n')
}

// --- Internal Helper: Parse a single JSON object from Gemini's response ---
function parseGeminiJsonObject(rawText: string): any {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Gemini did not return valid JSON. Response: ${rawText.slice(0, 300)}`)
  }

  let jsonStr = jsonMatch[0]
  try { return JSON.parse(jsonStr) } catch {
    console.warn("[Workflow Service] JSON parse failed, attempting repair...")
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

  try { return JSON.parse(jsonStr) } catch {
    throw new Error(`Could not parse Gemini response as JSON. Raw: ${rawText.slice(0, 500)}`)
  }
}

// --- Internal Helper: Gemini (sequential – one Gemini call per step, with previous-step context) ---
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

  const geminiHost = process.env.GEMINI_HOST || "https://generativelanguage.googleapis.com"
  const url = `${geminiHost}/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

  const now = new Date()
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
  const todayInfo = `Current date and time (Vietnam UTC+7): ${vnTime.toISOString().replace('T', ' ').slice(0, 19)}, ${dayNames[vnTime.getUTCDay()]}`

  const baseSystemPrompt = `Role: Bạn là một Trợ lý Bán hàng (Sales Agent) chuyên nghiệp tại Vucar. Nhiệm vụ của bạn là trích xuất dữ liệu từ kịch bản tư vấn để điều phối quy trình qua API.

Objective: Xác định đúng hành động (Action) và điền tham số (parameters). Đặc biệt lưu ý tính toán thời gian scheduled_at dựa trên trình tự các bước.

1. Nguyên tắc lập lịch (Scheduling Logic)

Tham chiếu: scheduled_at phải dựa trên thời gian hiện tại và thời gian của bước ngay trước đó (cho các Step sau). Ví dụ ngày hiện tại là "2026-02-22T18:00:00" và timing là "1-2 ngày sau", thì scheduled_at là "2026-02-23T18:00:00". Ví dụ nếu step 2 có thời gian là "2026-02-23T18:00:00", thì step 3 với timing "Trong vòng 4-5 giờ sau khi gửi thông tin thị trường và báo cáo kiểm định" sẽ có scheduled vào "2026-02-23T22:00:00"

Tuyệt đối luôn xem xét kĩ lưỡng scheduled_at, tránh bỏ trống dữ liệu này, điền dữ liệu cần hợp lí theo tham chiếu.

Tính toán khoảng cách: * Dựa vào mục "timing" trong input (VD: "sau 1 ngày", "sau 2 giờ").

Quy tắc Sub-steps: Nếu một Step yêu cầu 2 hành động (ví dụ: Gửi Script và Tạo phiên đấu giá), hành động thứ hai phải được đặt scheduled_at sau hành động thứ nhất đúng 30 phút.

Ràng buộc thời gian: * Định dạng: ISO 8601 với offset +07:00 (VD: "2026-02-24T18:00:00+07:00").

Chỉ đặt lịch trong khung 08:00 - 22:00. Nếu thời gian tính toán rơi vào sau 22:00, phải tự động dời sang 08:00 sáng ngày hôm sau.

Nếu bước đầu tiên yêu cầu "Ngay lập tức", đặt scheduled_at: null.

2. Quy định về API
API 1: Gửi Kịch Bản Tư Vấn (Gui Script)
Sử dụng khi cần gửi tin nhắn chăm sóc khách hàng hoặc kịch bản bán hàng có sẵn.
- picId (String): ID của nhân viên phụ trách.
- messages (Array of Strings): Danh sách các câu thoại/tin nhắn cần gửi.
- customer_phone (String): Số điện thoại khách hàng (định dạng Việt Nam).

API 2: Tạo Phiên Đấu Giá (Create Bidding Session)
Sử dụng khi bắt đầu đưa một chiếc xe lên sàn đấu giá.
- carId (String): ID định danh của chiếc xe.
- duration (Integer): Thời gian đấu giá (tính bằng giờ).
- minPrice (Integer): Giá khởi điểm (VNĐ).
- shouldGenerateMetadata (Object): Cấu hình tự động tạo nội dung.

3. Giọng văn & Thuật ngữ (Tone & Terminology)
- Tự nhiên, thân thiện, giống người thật.
- TUYỆT ĐỐI KHÔNG dùng từ "dealer". Hãy dùng "người mua".
- Nhấn mạnh: Giúp khách bán giá CAO NHẤT, rủi ro THẤP NHẤT.
- Ngắn gọn: Mỗi tin nhắn dưới 500 ký tự.
- Tuyệt đối KHÔNG tự giới thiệu lại thông tin như "Chào anh, em là Huy Hồ từ Vucar"
- Tránh giữ nguyên các biến số như: "[Dải giá thị trường hợp lý, ví dụ: từ 700-800 triệu VND nếu xe đẹp, hoặc thấp hơn nếu xe có vấn đề theo kiểm định và anh đã xác minh là do lỗi xe]"
- Chỉ đổi giọng văn, phải tuân theo các giá trị từ thông tin của lead, không được đưa thông tin ảo, đặc biệt là về giá xe.
- Nên tách các tin nhắn thành nhiều tin nhắn nhỏ, nếu tin nhắn gốc dài.

4. Định dạng đầu ra (Output Format)
CHỈ trả về MỘT object JSON duy nhất:
{
  "scheduled_at": "ISO string hoặc null",
  "parameters": { ... }
}

CHỈ TRẢ VỀ JSON, KHÔNG GIẢI THÍCH.`

  const results: any[] = []

  for (let idx = 0; idx < steps.length; idx++) {
    const step = steps[idx]
    const schema = schemas[idx]
    const fieldDescriptions = buildFieldDescriptions(schema.fields || [])

    // Build context from previously decided steps
    let previousStepContext = ""
    if (idx > 0) {
      const prevStep = steps[idx - 1]
      const prevResult = results[idx - 1]
      previousStepContext = `
=== PREVIOUS STEP (already decided) ===
Step ${idx}: "${prevStep.stepName}" (connector: ${prevStep.connectorLabel})
Instruction: "${prevStep.rawContext}"
Decided scheduled_at: ${prevResult.scheduled_at ? `"${prevResult.scheduled_at}"` : "null (immediate)"}
Decided parameters: ${JSON.stringify(prevResult.parameters, null, 2)}
`
    }

    const systemPrompt = idx > 0
      ? baseSystemPrompt + "\n- Phải được đặt SAU thời điểm của bước trước đó."
      : baseSystemPrompt

    const userPrompt = `
${todayInfo}

${leadContext}
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

    console.log(`[Workflow Service] Calling Gemini for step ${idx + 1}/${steps.length}: "${step.stepName}"...`)

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 16384 },
      })
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Gemini API failed for step ${idx + 1} (${res.status}): ${errorText}`)
    }

    const data = await res.json()
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
    console.log(`[Workflow Service] Gemini response for step ${idx + 1}:`, rawText.slice(0, 300))

    const parsed = parseGeminiJsonObject(rawText)
    results.push(parsed)
  }

  return results
}

