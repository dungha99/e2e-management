import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"
import { submitAiFeedback } from "@/lib/insight-feedback-service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const startTime = Date.now()
  try {
    const body = await request.json()
    const { phone, chat_history } = body

    if (!phone || !chat_history || !Array.isArray(chat_history)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid phone or chat_history" },
        { status: 400 }
      )
    }

    // 1. Get lead and car info
    const leadResult = await vucarV2Query(
      `SELECT id, phone, additional_phone, pic_id
       FROM leads
       WHERE phone = $1 OR additional_phone = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone]
    )

    if (leadResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Lead not found for this phone" },
        { status: 404 }
      )
    }
    const lead = leadResult.rows[0]
    const picId = lead.pic_id

    const carResult = await vucarV2Query(
      `SELECT id FROM cars
       WHERE lead_id = $1 AND (is_deleted IS NULL OR is_deleted != true)
       ORDER BY created_at DESC
       LIMIT 1`,
      [lead.id]
    )

    if (carResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No car found for this lead" },
        { status: 404 }
      )
    }
    const carId = carResult.rows[0].id

    // 2. Call Gemini to evaluate the chat history
    const geminiResult = await callGeminiAnalysis(chat_history)
    console.log(`[Analyze Lead Chat] phone=${phone}, action=${geminiResult.action}`)

    // 3. Take action based on Gemini's evaluation
    if (geminiResult.action === "new_flow") {
      // Find the latest workflow instance to use as source
      const instanceResult = await e2eQuery(
        `SELECT id FROM workflow_instances
         WHERE car_id = $1
         ORDER BY started_at DESC
         LIMIT 1`,
        [carId]
      )

      let sourceInstanceId = instanceResult.rows.length > 0 ? instanceResult.rows[0].id : null

      if (!sourceInstanceId) {
        // Create a dummy instance if none exists to satisfy submitAiFeedback constraint
        const dummyWorkflow = await e2eQuery(
          `INSERT INTO workflows (name, stage_id, type) VALUES ($1, $2, 'AI') RETURNING id`,
          ['Auto-Generated Context Workflow', '456e0d0b-bd97-4ef6-893e-8674447ed882']
        )
        const dummyInstance = await e2eQuery(
          `INSERT INTO workflow_instances (workflow_id, car_id, status) VALUES ($1, $2, 'completed') RETURNING id`,
          [dummyWorkflow.rows[0].id, carId]
        )
        sourceInstanceId = dummyInstance.rows[0].id
      }

      await submitAiFeedback({
        carId,
        sourceInstanceId,
        phoneNumber: phone,
        feedback: `[Phân tích Chat] ${geminiResult.context_summary}`,
      })

      return NextResponse.json({
        success: true,
        action_taken: "new_flow",
        context_summary: geminiResult.context_summary,
        durationMs: Date.now() - startTime,
      })
    } else if (geminiResult.action === "contact_sale") {
      // Fetch PIC phone via n8n webhook
      let salePhone = ""
      if (picId) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000)

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
          if (n8nRes.ok) {
            let n8nData: any = await n8nRes.json()
            if (Array.isArray(n8nData)) n8nData = n8nData[0]
            if (n8nData?.phone) {
              const rawPhone = String(n8nData.phone)
              // Format phone from 0... to 84...
              salePhone = rawPhone.startsWith("0") ? "84" + rawPhone.substring(1) : rawPhone
            }
          }
        } catch (err) {
          clearTimeout(timeoutId)
          console.error(`[Analyze Lead Chat] n8n fetch error:`, err)
        }
      }

      if (!salePhone) {
        return NextResponse.json(
          { success: false, error: "Could not resolve sale phone from pic_id" },
          { status: 500 }
        )
      }

      // Execute 'Send message to Sale' connector
      const connectorId = "6ee112d8-3d9b-406f-8b16-a2c4847efdb0"
      // Ensure newlines from Gemini are correctly preserved as literal \n characters 
      // when converted for the connector payload to prevent JSON breaking.
      const safeContextSummary = geminiResult.context_summary.replace(/\r?\n/g, '\\n')
      const messageBody = `Lead Phone: ${phone}\n\nContext Summary: ${safeContextSummary}`

      const payload = {
        send_from_number: "84963041272",
        send_to_number: salePhone,
        message: messageBody,
        action: ""
      }

      const connectorResult = await e2eQuery(
        `SELECT * FROM api_connectors WHERE id = $1 LIMIT 1`,
        [connectorId]
      )

      if (connectorResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Connector not found" },
          { status: 500 }
        )
      }

      const connector = connectorResult.rows[0]
      const { base_url, method, auth_config } = connector
      let parsedAuth = auth_config
      if (typeof parsedAuth === 'string') {
        try { parsedAuth = JSON.parse(parsedAuth) } catch (e) { }
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (parsedAuth && typeof parsedAuth === 'object') {
        Object.entries(parsedAuth).forEach(([k, v]) => {
          if (typeof v === 'string') headers[k] = v
        })
        if (parsedAuth.type === "bearer" && parsedAuth.token) {
          headers["Authorization"] = `Bearer ${parsedAuth.token}`
        }
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000)

      try {
        const fetchOptions: RequestInit = {
          method: method || "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify(payload)
        }

        const res = await fetch(base_url, fetchOptions)
        clearTimeout(timeoutId)

        const responseText = await res.text()
        console.log(`[Analyze Lead Chat] Connector response status: ${res.status}`)
        console.log(`[Analyze Lead Chat] Connector response data:`, responseText)

        if (!res.ok) {
          console.error(`[Analyze Lead Chat] Connector failed:`, responseText)
        } else {
          console.log(`[Analyze Lead Chat] Connector executed successfully for phone ${phone}`)
        }
      } catch (err) {
        clearTimeout(timeoutId)
        console.error(`[Analyze Lead Chat] Connector fetch error:`, err)
      }

      return NextResponse.json({
        success: true,
        action_taken: "contact_sale",
        context_summary: geminiResult.context_summary,
        durationMs: Date.now() - startTime,
      })
    }

    return NextResponse.json({ success: true, action: "none" })

  } catch (error) {
    console.error("[Analyze Lead Chat] Fatal error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to analyze chat",
        details: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

// ==========================================================================
// Gemini analysis call
// ==========================================================================
async function callGeminiAnalysis(chatHistory: any[]): Promise<{ context_summary: string, action: "new_flow" | "contact_sale" }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY missing")

  const geminiHost = process.env.GEMINI_HOST || "https://generativelanguage.googleapis.com"
  const model = "gemini-2.5-flash"
  const url = `${geminiHost}/v1beta/models/${model}:generateContent?key=${apiKey}`

  const systemPrompt = `Bạn là một trợ lý AI chuyên nghiệp phân tích lịch sử trò chuyện của khách hàng để giúp nhân viên sale chốt mua bán ô tô cũ.

Nhiệm vụ:
Đánh giá tình trạng hiện tại của lead dựa vào lịch sử chat.
Xác định xem chúng ta có khả năng chốt sale ngay lúc này với mức giá hiện tại không. Giải thích tại sao có hoặc tại sao không.

Phản hồi phải đúng theo cấu trúc JSON duy nhất gồm 2 keys sau:
{
  "context_summary": "Tóm tắt tình hình hiện tại của lead, lý do tại sao có thể hoặc không thể chốt sale ngay, và chiến lược tiếp theo",
  "action": "new_flow" hoặc "contact_sale"
}

- Chọn action = "new_flow" nếu cần gửi thêm thông tin, kịch bản thuyết phục tự động, tin nhắn theo dõi, thiết lập dòng công việc mời chào khác.
- Chọn action = "contact_sale" nếu lead đã ở giai đoạn cần nhân viên chốt giá và gặp mặt khách trực tiếp.
`

  const userPrompt = `Hãy phân tích đoạn hội thoại Zalo sau:
${JSON.stringify(chatHistory, null, 2)}
`

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: "user",
        parts: [{ text: userPrompt }]
      }],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0.2,
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${errText}`)
  }

  const responseData = await response.json()
  const contentText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || "{}"

  try {
    const rawJson = contentText.replace(/^\`\`\`(json)?/m, '').replace(/\`\`\`$/m, '').trim()
    const parsed = JSON.parse(rawJson)
    return {
      context_summary: parsed.context_summary || "Không thể phân tích",
      action: parsed.action === "contact_sale" ? "contact_sale" : "new_flow",
    }
  } catch (error) {
    console.error("[Analyze Lead Chat] Failed to parse Gemini response:", contentText)
    throw new Error("Invalid output format from Gemini")
  }
}
