import { e2eQuery, vucarV2Query, followupDataQuery } from "@/lib/db"

const NOTIFY_MONITOR_URL = "https://new.abitstore.vn/zalo/sendMessageToGroupZalo/6/CaNhanTest/JumNkKmJQtMfB6s"
const NOTIFY_FROM_NUMBER = "84963041272"

// ============================================================
// Types
// ============================================================

export interface PlanStep {
  type: "step"
  actionName: string
  description: string
  arguments: Record<string, any>
}

export interface IfBlock {
  type: "if_block"
  condition: string
  children: PlanNode[]
}

export type PlanNode = PlanStep | IfBlock

export interface ActionResult {
  success: boolean
  /** Scalar value used in condition matching, e.g. "pending", "done", "found", "" */
  value: string
  data?: any
  error?: string
}

export interface StepExecutionRecord {
  actionName: string
  description: string
  result: ActionResult
}

export interface ActionContext {
  carId: string
  picId: string
  customerPhone: string
}

// ============================================================
// XML Parser
// ============================================================

/** Extract the text content of a simple (non-nested) tag */
function extractTagText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i")
  const m = xml.match(re)
  return m ? m[1].trim() : ""
}

function parseStepContent(inner: string): PlanStep | null {
  const actionName = extractTagText(inner, "action_name")
  if (!actionName) return null
  const description = extractTagText(inner, "description")
  let args: Record<string, any> = {}
  const rawArgs = extractTagText(inner, "arguments")
  if (rawArgs) {
    try { args = JSON.parse(rawArgs) } catch { /* ignore malformed JSON */ }
  }
  return { type: "step", actionName, description, arguments: args }
}

/**
 * Find the matching </if_block> for an opening <if_block ...> at startPos.
 * Returns { condition, inner, endPos } or null.
 */
function extractIfBlockAt(
  content: string,
  startPos: number
): { condition: string; inner: string; endPos: number } | null {
  const openTagEnd = content.indexOf(">", startPos)
  if (openTagEnd === -1) return null

  const openTag = content.slice(startPos, openTagEnd + 1)
  const condMatch = openTag.match(/condition\s*=\s*['"]([^'"]*)['"]/i)
  const condition = condMatch ? condMatch[1] : ""

  let depth = 1
  let pos = openTagEnd + 1
  while (pos < content.length && depth > 0) {
    const nextOpen = content.indexOf("<if_block", pos)
    const nextClose = content.indexOf("</if_block>", pos)
    if (nextClose === -1) return null
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      pos = nextOpen + 9
    } else {
      depth--
      if (depth === 0) {
        const inner = content.slice(openTagEnd + 1, nextClose)
        return { condition, inner, endPos: nextClose + 11 }
      }
      pos = nextClose + 11
    }
  }
  return null
}

/** Recursively parse a block of XML into PlanNodes */
function parseNodes(content: string): PlanNode[] {
  const nodes: PlanNode[] = []
  let pos = 0

  while (pos < content.length) {
    const tagStart = content.indexOf("<", pos)
    if (tagStart === -1) break

    if (content.startsWith("<step>", tagStart)) {
      const end = content.indexOf("</step>", tagStart)
      if (end === -1) { pos = tagStart + 1; continue }
      const step = parseStepContent(content.slice(tagStart + 6, end))
      if (step) nodes.push(step)
      pos = end + 7
    } else if (content.startsWith("<if_block", tagStart)) {
      const result = extractIfBlockAt(content, tagStart)
      if (result) {
        nodes.push({
          type: "if_block",
          condition: result.condition,
          children: parseNodes(result.inner),
        })
        pos = result.endPos
      } else {
        pos = tagStart + 1
      }
    } else {
      pos = tagStart + 1
    }
  }
  return nodes
}

/** Parse a full <plan>...</plan> XML string into a list of PlanNodes */
export function parsePlanXml(rawXml: string): PlanNode[] {
  const xml = rawXml.trim()
  const planMatch = xml.match(/<plan[^>]*>([\s\S]*?)<\/plan>/i)
  return parseNodes(planMatch ? planMatch[1] : xml)
}

// ============================================================
// Condition Evaluator
// ============================================================

/**
 * Evaluate an if_block condition against the current variables map.
 *
 * Supported forms:
 *   '<var> found'           → variable is truthy
 *   'no <var> found'        → variable is falsy/empty
 *   '<var> is VALUE'        → variable equals VALUE (case-insensitive)
 *   '<var> is not VALUE'    → variable does not equal VALUE
 */
export function evaluateCondition(
  condition: string,
  variables: Record<string, string>
): boolean {
  const lower = condition.toLowerCase().trim()

  // Extract <variable_name> from the condition
  const varMatch = condition.match(/<([^>]+)>/)
  if (!varMatch) {
    // No variable reference — treat as constant true/false
    return lower !== "false" && lower !== "no" && lower !== "0"
  }

  const varName = varMatch[1].trim()
  const varValue = variables[varName] ?? ""
  const lowerValue = varValue.toLowerCase()

  // 'no <var> found'
  if (lower.startsWith("no ") && lower.includes("found")) {
    return !varValue || varValue === ""
  }

  // '<var> is not VALUE'
  if (lower.includes(" is not ")) {
    const expected = lower.split(" is not ").pop()?.trim() ?? ""
    return lowerValue !== expected
  }

  // '<var> is VALUE'
  if (lower.includes(" is ")) {
    const parts = lower.split(" is ")
    const expected = parts[parts.length - 1].trim()
    return lowerValue === expected
  }

  // '<var> found'
  if (lower.includes("found")) {
    return !!varValue && varValue !== ""
  }

  // Fallback: truthy check
  return !!varValue && varValue !== ""
}

// ============================================================
// Action Handlers
// ============================================================

type ActionHandler = (
  args: Record<string, any>,
  ctx: ActionContext
) => Promise<ActionResult>

/**
 * Returns the current inspection status for a car.
 * Possible values: "not_scheduled" | "pending" | "done"
 */
async function action_check_inspection_status(
  _args: Record<string, any>,
  ctx: ActionContext
): Promise<ActionResult> {
  try {
    const result = await e2eQuery(
      `SELECT i.status
       FROM inspections i
       WHERE i.car_id = $1
       ORDER BY i.created_at DESC
       LIMIT 1`,
      [ctx.carId]
    )
    if (result.rows.length === 0) {
      return { success: true, value: "not_scheduled", data: null }
    }
    const status: string = result.rows[0].status || "pending"
    return { success: true, value: status, data: result.rows[0] }
  } catch (err) {
    console.error("[TaskDispatcher] check_inspection_status error:", err)
    return { success: false, value: "", error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Returns "responded" if the customer sent a message in the last 24h, else "no_response".
 */
async function action_check_customer_response(
  _args: Record<string, any>,
  ctx: ActionContext
): Promise<ActionResult> {
  try {
    const WINDOW_MS = 24 * 60 * 60 * 1000

    // Try sale_status.messages_zalo first
    const dbResult = await vucarV2Query(
      `SELECT ss.messages_zalo FROM cars c
       LEFT JOIN sale_status ss ON ss.car_id = c.id
       WHERE c.id = $1 LIMIT 1`,
      [ctx.carId]
    )
    const msgs: any[] | null = dbResult.rows[0]?.messages_zalo
    if (msgs && Array.isArray(msgs) && msgs.length > 0) {
      const responded = msgs.some((m: any) => {
        const isCustomer = m.fromMe === false || (m.uidFrom && m.uidFrom !== 0 && m.uidFrom !== "0")
        if (!isCustomer) return false
        const ts = m.timestamp ? new Date(m.timestamp).getTime() : 0
        return ts >= Date.now() - WINDOW_MS
      })
      return {
        success: true,
        value: responded ? "responded" : "no_response",
        data: { source: "messages_zalo_db" },
      }
    }

    return { success: true, value: "no_response", data: { source: "none" } }
  } catch (err) {
    console.error("[TaskDispatcher] check_customer_response error:", err)
    return { success: false, value: "", error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Returns the current stage of the lead.
 */
async function action_get_lead_stage(
  _args: Record<string, any>,
  ctx: ActionContext
): Promise<ActionResult> {
  try {
    const result = await vucarV2Query(
      `SELECT ss.stage FROM cars c
       LEFT JOIN sale_status ss ON ss.car_id = c.id
       WHERE c.id = $1 LIMIT 1`,
      [ctx.carId]
    )
    const stage: string = result.rows[0]?.stage || "unknown"
    return { success: true, value: stage, data: { stage } }
  } catch (err) {
    console.error("[TaskDispatcher] get_lead_stage error:", err)
    return { success: false, value: "", error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Sends a Zalo notification to the PIC.
 * Stub — implement with real connector/Zalo API when available.
 */
async function action_notify_pic(
  args: Record<string, any>,
  ctx: ActionContext
): Promise<ActionResult> {
  const { message, urgency = "normal" } = args
  console.log(`[TaskDispatcher] notify_pic | carId=${ctx.carId} picId=${ctx.picId} urgency=${urgency}`)
  console.log(`[TaskDispatcher] notify_pic | message: ${message}`)
  // TODO: Call Zalo connector to send message to PIC
  return { success: true, value: "sent", data: { message, urgency, picId: ctx.picId } }
}

/**
 * Creates an inspection task for the inspector team.
 * Stub — implement with real task creation API when available.
 */
async function action_create_inspection_task(
  args: Record<string, any>,
  ctx: ActionContext
): Promise<ActionResult> {
  const { notes = "", preferred_date = null } = args
  console.log(`[TaskDispatcher] create_inspection_task | carId=${ctx.carId} date=${preferred_date}`)
  // TODO: Insert into inspection tasks table or call connector
  return { success: true, value: "created", data: { notes, preferred_date, carId: ctx.carId } }
}

/**
 * Creates a follow-up reminder task for the PIC.
 * Stub — implement with real task/reminder system when available.
 */
async function action_create_followup_task(
  args: Record<string, any>,
  ctx: ActionContext
): Promise<ActionResult> {
  const { remind_in_hours = 24, note = "" } = args
  const remindAt = new Date(Date.now() + remind_in_hours * 60 * 60 * 1000).toISOString()
  console.log(`[TaskDispatcher] create_followup_task | carId=${ctx.carId} remindAt=${remindAt}`)
  // TODO: Insert into reminders/tasks table
  return { success: true, value: "created", data: { remindAt, note, carId: ctx.carId } }
}

/**
 * Sends a priority notification to the PIC's manager.
 * Stub — implement with real notification system when available.
 */
async function action_notify_manager(
  args: Record<string, any>,
  ctx: ActionContext
): Promise<ActionResult> {
  const { message, reason = "general" } = args
  console.log(`[TaskDispatcher] notify_manager | carId=${ctx.carId} reason=${reason}`)
  console.log(`[TaskDispatcher] notify_manager | message: ${message}`)
  // TODO: Fetch manager of picId, then send Zalo/notification
  return { success: true, value: "sent", data: { message, reason, picId: ctx.picId } }
}

// ── shared sub-functions (also exported for use in other routes) ──────

/** Send a message to the PIC's monitor Zalo group */
export async function notifyMonitorGroup(ctx: ActionContext, message: string): Promise<void> {
  try {
    const staffResult = await followupDataQuery(
      `SELECT group_id FROM staffs WHERE pic_id = $1 LIMIT 1`,
      [ctx.picId]
    )
    const groupId: string | null = staffResult.rows[0]?.group_id ?? null
    if (!groupId) {
      console.warn(`[TaskDispatcher] notifyMonitorGroup: no group_id for pic_id=${ctx.picId}`)
      return
    }
    const res = await fetch(NOTIFY_MONITOR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ send_from_number: NOTIFY_FROM_NUMBER, send_to_groupid: groupId, message }),
    })
    if (!res.ok) console.error(`[TaskDispatcher] notifyMonitorGroup failed: ${res.status}`)
    else console.log(`[TaskDispatcher] notifyMonitorGroup sent to group ${groupId}`)
  } catch (err) {
    console.error(`[TaskDispatcher] notifyMonitorGroup error:`, err)
  }
}

/** Blacklist car and terminate running workflow instances */
export async function deactivateAi(ctx: ActionContext): Promise<void> {
  await e2eQuery(
    `INSERT INTO ai_process_blacklist (car_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [ctx.carId]
  )
  await e2eQuery(
    `UPDATE workflow_instances SET status = 'terminated', completed_at = NOW()
     WHERE car_id = $1 AND status = 'running'`,
    [ctx.carId]
  )
  console.log(`[TaskDispatcher] deactivateAi: blacklisted carId=${ctx.carId}`)
}

/**
 * Notifies the monitor group that this lead has low gap, high intention,
 * and is likely to close.
 */
async function action_check_intention(
  _args: Record<string, any>,
  ctx: ActionContext
): Promise<ActionResult> {
  const message = `🔥 Lead có khả năng chốt cao!\nSĐT: ${ctx.customerPhone}\nGap thấp, có thiện chí, có khả năng chốt`
  await notifyMonitorGroup(ctx, message)
  return { success: true, value: "notified", data: { carId: ctx.carId, phone: ctx.customerPhone } }
}

/**
 * Books an inspection for the lead.
 * On success, automatically runs notify_monitor + deactive_ai.
 * TODO: implement actual inspection booking logic.
 */
async function action_book_inspection(
  args: Record<string, any>,
  ctx: ActionContext
): Promise<ActionResult> {
  console.log(`[TaskDispatcher] book_inspection: carId=${ctx.carId}`)
  // TODO: create inspection record / call booking API here

  const message = `📋 Đặt lịch kiểm định mới\nXe: ${ctx.carId}\nSĐT: ${ctx.customerPhone}\nLý do: ${args.description || "Agent decided to book inspection"}`
  await notifyMonitorGroup(ctx, message)
  await deactivateAi(ctx)

  return { success: true, value: "booked", data: { carId: ctx.carId } }
}

async function action_no_action(
  args: Record<string, any>,
  _ctx: ActionContext
): Promise<ActionResult> {
  console.log(`[TaskDispatcher] no_action | reason: ${args.reason || "no reason given"}`)
  return { success: true, value: "skipped", data: args }
}

/** Registry of all available action handlers */
const ACTION_HANDLERS: Record<string, ActionHandler> = {
  // Read actions
  check_inspection_status: action_check_inspection_status,
  check_customer_response: action_check_customer_response,
  get_lead_stage: action_get_lead_stage,
  // Write/dispatch actions
  check_intention: action_check_intention,
  book_inspection: action_book_inspection,
  notify_pic: action_notify_pic,
  create_inspection_task: action_create_inspection_task,
  create_followup_task: action_create_followup_task,
  notify_manager: action_notify_manager,
  no_action: action_no_action,
}

// ============================================================
// Plan Executor
// ============================================================

/**
 * Execute a list of PlanNodes recursively.
 * Accumulates variable bindings from step results for condition evaluation.
 */
async function executeNodes(
  nodes: PlanNode[],
  ctx: ActionContext,
  variables: Record<string, string>,
  records: StepExecutionRecord[]
): Promise<void> {
  for (const node of nodes) {
    if (node.type === "step") {
      const handler = ACTION_HANDLERS[node.actionName]
      if (!handler) {
        console.warn(`[TaskDispatcher] Unknown action: "${node.actionName}" — skipping`)
        continue
      }
      try {
        const result = await handler(node.arguments || {}, ctx)
        // Store result for use in condition evaluation
        const varKey = `${node.actionName}_result`
        variables[varKey] = result.value
        records.push({ actionName: node.actionName, description: node.description, result })
        console.log(`[TaskDispatcher] ${node.actionName} → ${result.success ? "OK" : "FAIL"} (value="${result.value}")`)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`[TaskDispatcher] ${node.actionName} threw:`, errMsg)
        variables[`${node.actionName}_result`] = ""
        records.push({
          actionName: node.actionName,
          description: node.description,
          result: { success: false, value: "", error: errMsg },
        })
      }
    } else if (node.type === "if_block") {
      const conditionMet = evaluateCondition(node.condition, variables)
      console.log(`[TaskDispatcher] if_block condition="${node.condition}" → ${conditionMet}`)
      if (conditionMet) {
        await executeNodes(node.children, ctx, variables, records)
      }
    }
  }
}

export interface PlanExecutionResult {
  steps: StepExecutionRecord[]
  variables: Record<string, string>
}

/**
 * Parse and execute a full XML plan.
 * Returns all executed step records and the final variables map.
 */
export async function executeTaskDispatcherPlan(
  xmlPlan: string,
  ctx: ActionContext
): Promise<PlanExecutionResult> {
  const nodes = parsePlanXml(xmlPlan)
  console.log(`[TaskDispatcher] Parsed ${nodes.length} top-level node(s) from plan`)

  const variables: Record<string, string> = {}
  const steps: StepExecutionRecord[] = []
  await executeNodes(nodes, ctx, variables, steps)

  return { steps, variables }
}

// ============================================================
// Full pipeline: fetch context → call Gemini → execute plan
// Can be called directly from any route without going via HTTP.
// ============================================================

import { callGemini } from "@/lib/gemini"
import { getPicAgentConfig, getActiveAgentNote, storeAgentOutput } from "@/lib/ai-agent-service"
import { fetchZaloChatHistory } from "@/lib/chat-history-service"

const AGENT_NAME = "Task Dispatcher"

async function fetchLeadContextForDispatcher(carId: string): Promise<string> {
  const result = await vucarV2Query(
    `SELECT c.brand, c.model, c.variant, c.year, c.plate,
            ss.price_customer, ss.price_highest_bid, ss.stage,
            ss.qualified, ss.intention, ss.notes,
            l.name AS customer_name, l.phone, l.additional_phone
     FROM cars c
     LEFT JOIN leads l ON l.id = c.lead_id
     LEFT JOIN sale_status ss ON ss.car_id = c.id
     WHERE c.id = $1 LIMIT 1`,
    [carId]
  )
  if (result.rows.length === 0) return "No lead data found."
  const r = result.rows[0]
  return [
    `Customer: ${r.customer_name || "Unknown"} (Phone: ${r.phone || "N/A"})`,
    `Car: ${[r.brand, r.model, r.variant].filter(Boolean).join(" ")} ${r.year || ""}`,
    `Plate: ${r.plate || "N/A"}`,
    `Stage: ${r.stage || "N/A"}`,
    `Qualified: ${r.qualified ?? "N/A"}`,
    `Intention: ${r.intention || "N/A"}`,
    `Price Customer: ${r.price_customer ? `${r.price_customer} triệu` : "N/A"}`,
    `Price Highest Bid: ${r.price_highest_bid ? `${r.price_highest_bid} triệu` : "N/A"}`,
    `Notes: ${r.notes || "N/A"}`,
  ].join("\n")
}

/**
 * Full task-dispatcher pipeline callable from any server-side context.
 * Fetches context, calls Gemini, executes the XML plan.
 */
export async function runTaskDispatcher(params: {
  carId: string
  picId: string
  customerPhone: string
  trigger?: string
}): Promise<PlanExecutionResult | null> {
  const { carId, picId, customerPhone, trigger = "internal" } = params

  try {
    const [leadContext, chatMessages, picPrompt, agentNote] = await Promise.all([
      fetchLeadContextForDispatcher(carId),
      fetchZaloChatHistory({ carId, phone: customerPhone, picId }),
      getPicAgentConfig(AGENT_NAME, picId).catch(() => null),
      getActiveAgentNote(AGENT_NAME).catch(() => null),
    ])

    if (!picPrompt) {
      console.warn(`[TaskDispatcher] runTaskDispatcher: no prompt configured for "${AGENT_NAME}"`)
      return null
    }

    const systemPrompt = `${picPrompt}${agentNote ? `\n\n### Cấu Hình Bổ Sung:\n${agentNote}` : ""}`

    const recentChat = chatMessages.slice(-30)
    const chatSection = recentChat.length > 0
      ? `\n\n=== RECENT CHAT (last ${recentChat.length} messages) ===\n${
          recentChat.map((m: any) => `[${m.dateAction || ""}] ${m.senderName}: ${m.msg_content || m.content || ""}`).join("\n")
        }`
      : "\n\n=== RECENT CHAT ===\n(no messages found)"

    const userPrompt = `Trigger: ${trigger}\n\n=== LEAD CONTEXT ===\n${leadContext}${chatSection}\n\nBased on everything above, produce the XML dispatch plan.`

    const rawXml = await callGemini(userPrompt, "gemini-2.5-flash-preview-04-17", systemPrompt)
    console.log(`[TaskDispatcher] runTaskDispatcher plan (${rawXml.length} chars): ${rawXml.slice(0, 200)}`)

    const ctx: ActionContext = { carId, picId, customerPhone }
    const result = await executeTaskDispatcherPlan(rawXml, ctx)

    storeAgentOutput({
      agentName: AGENT_NAME,
      carId,
      inputPayload: { trigger, recentChatCount: recentChat.length },
      outputPayload: { rawXml, steps: result.steps, variables: result.variables },
    }).catch(err => console.error("[TaskDispatcher] storeAgentOutput failed:", err))

    return result
  } catch (err) {
    console.error(`[TaskDispatcher] runTaskDispatcher failed for carId=${carId}:`, err)
    return null
  }
}
