import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"
import { callGemini } from "@/lib/gemini"
import { storeAgentOutput, getActiveAgentNote, getPicAgentConfig, getCarAgentMemory } from "@/lib/ai-agent-service"
import { fetchZaloChatHistory } from "@/lib/chat-history-service"
import { executeTaskDispatcherPlan } from "@/lib/task-dispatcher-service"

export const dynamic = "force-dynamic"

const AGENT_NAME = "Task Dispatcher (Stakeholder)"

// ============================================================
// Lead context builder (same shape as other agents)
// ============================================================
async function fetchLeadContext(carId: string): Promise<string> {
  if (!carId) return "No lead data available."
  try {
    const result = await vucarV2Query(
      `SELECT c.brand, c.model, c.variant, c.year, c.location, c.mileage, c.plate, c.slug,
              ss.price_customer, ss.price_highest_bid, ss.stage, ss.qualified,
              ss.intention, ss.negotiation_ability, ss.notes,
              l.name AS customer_name, l.phone, l.additional_phone,
              l.customer_feedback, l.source, l.pic_id
       FROM cars c
       LEFT JOIN leads l ON l.id = c.lead_id
       LEFT JOIN sale_status ss ON ss.car_id = c.id
       WHERE c.id = $1 LIMIT 1`,
      [carId]
    )
    if (result.rows.length === 0) return "No lead data found."
    const r = result.rows[0]
    const parts: string[] = [
      `Customer: ${r.customer_name || "Unknown"} (Phone: ${r.phone || "N/A"})`,
      `Car: ${[r.brand, r.model, r.variant].filter(Boolean).join(" ")} ${r.year || ""}`,
      `Plate: ${r.plate || "N/A"}`,
      `Slug: ${r.slug || "N/A"}`,
      `Location: ${r.location || "N/A"}`,
      `Mileage: ${r.mileage ? `${r.mileage} km` : "N/A"}`,
      `Price Customer: ${r.price_customer ? `${r.price_customer} triệu` : "N/A"}`,
      `Price Highest Bid: ${r.price_highest_bid ? `${r.price_highest_bid} triệu` : "N/A"}`,
      `Stage: ${r.stage || "N/A"}`,
      `Qualified: ${r.qualified ?? "N/A"}`,
      `Intention: ${r.intention || "N/A"}`,
      `Negotiation Ability: ${r.negotiation_ability || "N/A"}`,
      `Notes: ${r.notes || "N/A"}`,
      `Customer Feedback: ${r.customer_feedback || "N/A"}`,
      `Source: ${r.source || "N/A"}`,
      `PIC ID: ${r.pic_id || "N/A"}`,
    ]
    return parts.join("\n")
  } catch (err) {
    console.error("[TaskDispatcher] fetchLeadContext error:", err)
    return "Error fetching lead context."
  }
}

// ============================================================
// POST /api/e2e/ai-agents/task-dispatcher
// ============================================================

/**
 * Body: { carId: string, picId?: string, trigger?: string }
 *
 * - carId: The car/lead to dispatch tasks for
 * - picId: Optional override; resolved from lead if omitted
 * - trigger: Optional label for why this dispatch was triggered (e.g. "cron", "feedback", "manual")
 */
export async function POST(request: Request) {
  const startTime = Date.now()

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const { trigger = "manual" } = body
  if (!body.carId && !body.phone) {
    return NextResponse.json({ success: false, error: "Missing carId or phone" }, { status: 400 })
  }

  try {
    // --- 1. Resolve carId, picId and phone ---
    let carId: string = body.carId || ""
    let picId: string = body.picId || ""
    let customerPhone: string = ""

    if (body.phone && !carId) {
      // Resolve carId from phone
      const byPhone = await vucarV2Query(
        `SELECT c.id AS car_id, l.pic_id, l.phone, l.additional_phone
         FROM cars c
         JOIN leads l ON l.id = c.lead_id
         WHERE l.phone = $1 OR l.additional_phone = $1
         ORDER BY c.created_at DESC LIMIT 1`,
        [body.phone]
      )
      if (byPhone.rows.length === 0) {
        return NextResponse.json({ success: false, error: `No lead found for phone ${body.phone}` }, { status: 404 })
      }
      carId = byPhone.rows[0].car_id
      picId = picId || byPhone.rows[0].pic_id || ""
      customerPhone = byPhone.rows[0].additional_phone || byPhone.rows[0].phone || body.phone
    } else {
      const contactResult = await vucarV2Query(
        `SELECT l.phone, l.additional_phone, l.pic_id
         FROM cars c
         JOIN leads l ON l.id = c.lead_id
         WHERE c.id = $1 LIMIT 1`,
        [carId]
      )
      const contact = contactResult.rows[0]
      picId = picId || contact?.pic_id || ""
      customerPhone = contact?.additional_phone || contact?.phone || ""
    }

    // --- 2. Fetch all context in parallel ---
    console.log(`[TaskDispatcher] Fetching context for carId=${carId}...`)
    const [leadContext, chatMessages, agentMemory] = await Promise.all([
      fetchLeadContext(carId),
      fetchZaloChatHistory({ carId, phone: customerPhone, picId }),
      getCarAgentMemory(carId).catch(() => null),
    ])

    const recentChat = chatMessages.slice(-30)
    console.log(`[TaskDispatcher] leadContext=${leadContext.length} chars, chat=${recentChat.length} msgs, memory=${agentMemory ? "yes" : "no"}`)

    // --- 3. Resolve system prompt from DB (PIC-specific → global, then append notes) ---
    const [picPrompt, agentNote] = await Promise.all([
      getPicAgentConfig(AGENT_NAME, picId || "").catch(() => null),
      getActiveAgentNote(AGENT_NAME).catch(() => null),
    ])

    if (!picPrompt) {
      return NextResponse.json(
        {
          success: false,
          error: `No system prompt configured for agent "${AGENT_NAME}". Call GET /api/e2e/ai-agents/seed to initialise.`,
        },
        { status: 500 }
      )
    }

    const systemPrompt = `${picPrompt}${agentNote ? `\n\n### Cấu Hình Bổ Sung (System Preferences):\n${agentNote}` : ""}`

    // --- 4. Build user prompt ---
    const chatSection = recentChat.length > 0
      ? `\n\n=== RECENT CHAT HISTORY (last ${recentChat.length} messages) ===\n${recentChat.map((m: any) =>
        `[${m.dateAction || ""}] ${m.senderName}: ${m.msg_content || m.content || ""}`
      ).join("\n")
      }`
      : "\n\n=== RECENT CHAT HISTORY ===\n(no messages found)"

    const memorySection = agentMemory
      ? `\n\n=== AGENT SESSION MEMORY ===\n${agentMemory}`
      : ""

    const userPrompt = `Trigger: ${trigger}

=== LEAD CONTEXT ===
${leadContext}${chatSection}${memorySection}

Based on everything above, produce the XML dispatch plan.`

    // --- 5. Call Gemini ---
    console.log(`[TaskDispatcher] Calling Gemini for carId=${carId}...`)
    const rawXml = await callGemini(userPrompt, "gemini-3-flash-preview", systemPrompt)
    console.log(`[TaskDispatcher] Gemini raw output (${rawXml.length} chars): ${rawXml.slice(0, 300)}`)

    // --- 6. Execute the plan ---
    const ctx = { carId, picId, customerPhone }
    const planResult = await executeTaskDispatcherPlan(rawXml, ctx)
    console.log(`[TaskDispatcher] Executed ${planResult.steps.length} step(s)`)

    // --- 7. Store agent output ---
    storeAgentOutput({
      agentName: AGENT_NAME,
      carId,
      inputPayload: { trigger, leadContext: leadContext.slice(0, 500), recentChatCount: recentChat.length },
      outputPayload: {
        rawXml,
        steps: planResult.steps,
        variables: planResult.variables,
      },
    }).catch(err => console.error("[TaskDispatcher] storeAgentOutput failed:", err))

    return NextResponse.json({
      success: true,
      carId,
      trigger,
      rawXml,
      steps: planResult.steps,
      variables: planResult.variables,
      durationMs: Date.now() - startTime,
    })
  } catch (err) {
    console.error("[TaskDispatcher] Fatal error:", err)
    return NextResponse.json(
      {
        success: false,
        error: "Task dispatcher failed",
        details: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
