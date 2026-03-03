import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"
import { submitAiFeedback } from "@/lib/insight-feedback-service"
import { storeAgentOutput } from "@/lib/ai-agent-service"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/e2e/evaluate-step
 *
 * Takes raw auto-chat output (phone-based), resolves lead → car → instance → step,
 * uses Gemini to evaluate conversation progress vs step goals.
 * If deviated, triggers AI strategy revision via shared service.
 *
 * Input: array of { phone, index, output: { context_summary, actions, message_suggestions } }
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  const encoder = new TextEncoder()

  // Quick validation before streaming
  let items: any[]
  try {
    const body = await request.json()
    items = Array.isArray(body) ? body : [body]
    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Empty input array" },
        { status: 400 }
      )
    }
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const stream = new ReadableStream({
    async start(controller) {
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode("\n"))
        } catch {
          clearInterval(heartbeatInterval)
        }
      }, 10_000)

      try {
        const results = []

        for (const item of items) {
          const { phone, output } = item

          if (!phone || !output) {
            results.push({
              phone,
              success: false,
              error: "Missing phone or output",
            })
            continue
          }

          try {
            const result = await evaluateSingleItem(phone, output)
            results.push(result)
          } catch (err) {
            console.error(`[EvaluateStep] Error for phone ${phone}:`, err)
            results.push({
              phone,
              success: false,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }

        controller.enqueue(encoder.encode(JSON.stringify({
          success: true,
          results,
          durationMs: Date.now() - startTime,
        })))
      } catch (error) {
        console.error("[EvaluateStep] Fatal error:", error)
        controller.enqueue(encoder.encode(JSON.stringify({
          success: false,
          error: "Failed to evaluate step",
          details: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        })))
      } finally {
        clearInterval(heartbeatInterval)
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    },
  })
}

// ==========================================================================
// Core logic for a single phone/output item
// ==========================================================================
async function evaluateSingleItem(phone: string, autoChatOutput: any) {
  // --- 1. Resolve: phone → lead → car → instance → step ---

  // 1a. Get lead by phone (CRM DB)
  const leadResult = await vucarV2Query(
    `SELECT id, phone, additional_phone, pic_id
     FROM leads
     WHERE phone = $1 OR additional_phone = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone]
  )

  if (leadResult.rows.length === 0) {
    return { phone, success: false, error: "Lead not found for this phone" }
  }
  const lead = leadResult.rows[0]

  // 1b. Get car by lead_id (CRM DB)
  const carResult = await vucarV2Query(
    `SELECT id FROM cars
     WHERE lead_id = $1 AND (is_deleted IS NULL OR is_deleted != true)
     ORDER BY created_at DESC
     LIMIT 1`,
    [lead.id]
  )

  if (carResult.rows.length === 0) {
    return { phone, success: false, error: "No car found for this lead" }
  }
  const car = carResult.rows[0]

  // 1c. Get running workflow instance (E2E DB)
  const instanceResult = await e2eQuery(
    `SELECT id, current_step_id, workflow_id
     FROM workflow_instances
     WHERE car_id = $1 AND status = 'running'
     ORDER BY started_at DESC
     LIMIT 1`,
    [car.id]
  )

  if (instanceResult.rows.length === 0) {
    return {
      phone,
      carId: car.id,
      success: false,
      error: "No running workflow instance for this car",
    }
  }
  const instance = instanceResult.rows[0]

  // 1d. Get current step details (E2E DB)
  const stepResult = await e2eQuery(
    `SELECT id, step_name, description, step_order
     FROM workflow_steps
     WHERE id = $1`,
    [instance.current_step_id]
  )

  if (stepResult.rows.length === 0) {
    return {
      phone,
      carId: car.id,
      instanceId: instance.id,
      success: false,
      error: "Current step not found",
    }
  }
  const step = stepResult.rows[0]

  // --- 2. Load existing AI insight for context ---
  const insightResult = await e2eQuery(
    `SELECT ai_insight_summary
     FROM ai_insights
     WHERE car_id = $1 AND source_instance_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [car.id, instance.id]
  )
  const existingInsight = insightResult.rows[0]?.ai_insight_summary

  // --- 3. Call Gemini to evaluate ---
  const geminiResult = await callGeminiEvaluation(
    step,
    autoChatOutput,
    existingInsight
  )

  console.log(
    `[EvaluateStep] Phone=${phone}, Step="${step.step_name}", Verdict=${geminiResult.verdict}`
  )

  // Track Evaluate-step agent output
  storeAgentOutput({
    agentName: "Evaluate-step",
    carId: car.id,
    sourceInstanceId: instance.id,
    inputPayload: prompt,
    outputPayload: geminiResult,
  }).catch(err => console.error("[EvaluateStep] Failed to store agent output:", err))

  // --- 4. If deviated, submit feedback to trigger re-analysis ---
  let strategyRevised = false
  let newInsights = null

  if (geminiResult.verdict === "deviated") {
    console.log(
      `[EvaluateStep] Deviation detected for phone ${phone}. Submitting automated feedback...`
    )

    const phoneNumber = lead.phone || lead.additional_phone || phone
    const feedbackResult = await submitAiFeedback({
      carId: car.id,
      sourceInstanceId: instance.id,
      phoneNumber,
      feedback: `[Auto-Evaluation] ${geminiResult.thinking}\n\nAuto-chat output: ${JSON.stringify(autoChatOutput)}`,
    })

    strategyRevised = feedbackResult.success
    newInsights = feedbackResult.newAnalysis || null
  }

  return {
    phone,
    carId: car.id,
    instanceId: instance.id,
    currentStep: step.step_name,
    verdict: geminiResult.verdict,
    thinking: geminiResult.thinking,
    strategyRevised,
    newInsights,
    success: true,
  }
}

// ==========================================================================
// Gemini evaluation call
// ==========================================================================
async function callGeminiEvaluation(
  step: { step_name: string; description: string | null },
  autoChatOutput: {
    context_summary?: string
    actions?: string[]
    message_suggestions?: string[]
  },
  existingInsight?: any
): Promise<{ thinking: string; verdict: "on_track" | "deviated" }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY missing")

  const geminiHost =
    process.env.GEMINI_HOST ||
    "https://generativelanguage.googleapis.com"
  const model = "gemini-3-flash-preview"
  const url = `${geminiHost}/v1beta/models/${model}:generateContent?key=${apiKey}`

  const stepDescription = step.description || "Không có mô tả chi tiết cho bước này."

  const systemPrompt = `Bạn là 1 AI evaluator cho quy trình sales xe cũ VuCar.

## NHIỆM VỤ
Đánh giá output từ hệ thống auto-chat và xác định liệu cuộc hội thoại có đang đi đúng hướng so với mục tiêu của bước workflow hiện tại hay không.

## YÊU CẦU OUTPUT
Trả về JSON duy nhất với format:
{
  "thinking": "Phân tích chi tiết bằng tiếng Việt: tình trạng cuộc trò chuyện, khách hàng đang phản ứng ra sao, có phù hợp với mục tiêu bước này không, tại sao on_track hoặc deviated",
  "verdict": "on_track" hoặc "deviated"
}

Chỉ verdict "deviated" khi:
- Khách rõ ràng từ chối / không hợp tác
- Auto-chat đang đi sai hướng so với mục tiêu bước
- Tình huống cho thấy chiến lược hiện tại không hiệu quả

Verdict "on_track" khi:
- Cuộc trò chuyện đang đi đúng hướng
- Khách phản hồi tích cực hoặc trung lập
- Auto-chat actions phù hợp với mục tiêu bước

CHỈ TRẢ VỀ JSON, KHÔNG CÓ GÌ KHÁC.`

  const userPrompt = `## THÔNG TIN BƯỚC HIỆN TẠI
Tên bước: ${step.step_name}
Mô tả chi tiết:
${stepDescription}

## OUTPUT TỪ AUTO-CHAT
Context Summary: ${autoChatOutput.context_summary || "N/A"}
Actions: ${JSON.stringify(autoChatOutput.actions || [])}
Message Suggestions: ${JSON.stringify(autoChatOutput.message_suggestions || [])}

${existingInsight ? `## PHÂN TÍCH AI TRƯỚC ĐÓ\n${JSON.stringify(existingInsight, null, 2).substring(0, 2000)}` : ""}`

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API failed: ${response.status} - ${errorText.substring(0, 200)}`)
  }

  const data = await response.json()
  const rawText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text || ""

  // Parse JSON from response
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        thinking: parsed.thinking || "Không có phân tích",
        verdict:
          parsed.verdict === "deviated" ? "deviated" : "on_track",
      }
    }
  } catch {
    console.warn("[EvaluateStep] Failed to parse Gemini JSON, treating as on_track")
  }

  // Fallback: if we can't parse, default to on_track
  return {
    thinking: rawText || "Không thể phân tích response từ Gemini",
    verdict: "on_track",
  }
}
