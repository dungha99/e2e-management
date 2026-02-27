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

    // 2. Bypass Gemini: use chat_history directly as context_summary
    // const geminiResult = await callGeminiAnalysis(chat_history) // Temporarily disabled
    const geminiResult = {
      context_summary: JSON.stringify(chat_history),
      action: "new_flow" as const,
    }
    console.log(`[Analyze Lead Chat] phone=${phone}, action=${geminiResult.action} (bypass mode)`)

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

  const systemPrompt = `# VAI TRÒ
Bạn là **Chuyên gia Phân tích Cuộc trò chuyện** cho Vucar. Nhiệm vụ của bạn là đọc lịch sử chat giữa sales và khách hàng, rút ra insight có cấu trúc về thái độ, ý định, và mối quan tâm của khách.

# INPUT BẠN NHẬN ĐƯỢC
Với uidFrom = 0 là tin nhắn từ Sale của Vucar
Với uidFrom != 0 là tin nhắn từ khách hàng của Vucar


# NHIỆM VỤ PHÂN TÍCH

## 1. PHONG CÁCH GIAO TIẾP (Communication Style)
Phân tích tin nhắn của khách:

**Formal** (Trang trọng):
- Câu dài, đầy đủ
- VD: "Em chào anh ạ, em muốn hỏi về giá xe ạ"

**Casual** (Thân mật):
- Câu ngắn, emoji
- VD: "Mình muốn bán xe, giá bao nhiêu bạn?"

**Neutral** (Ngắn gọn):
- Không có dấu hiệu rõ ràng của formal hay casual, giao tiếp ngắn gọn, vào vấn đề

## 2. HÀNH VI PHẢN HỒI (Response Pattern)
Tính thời gian phản hồi trung bình:
**Cách tính:**
Với mỗi cặp: tin nhắn agent → tin nhắn customer
Tính: thời gian giữa 2 tin (giờ)
→ Trung bình tất cả các lần

**Phân loại:**
- **quick_responder**: < 2 giờ trung bình
- **delayed**: 2-24 giờ trung bình
- **ghosted**: Có khoảng cách > 7 ngày HOẶC agent gửi nhưng không reply

**Đặc biệt:** Nếu tin nhắn cuối cùng cách đây > 7 ngày → "ghosted" bất kể average

## 3. TÍN HIỆU KHẨN CẤP (Urgency Keywords)
Tìm các từ khóa trong tin nhắn của customer:

**High Urgency:**
- "gấp", "nhanh", "ngay", "hôm nay", "tuần này", "cần bán ngay"

**Medium Urgency:**
- "sớm", "tháng này", "trong thời gian tới", "mau"

**Low Urgency:**
- "tham khảo", "xem giá", "dự định", "có kế hoạch"

→ List tất cả keywords tìm được

## 4. PHẢN ĐỐI/MỐI LO (Objection Patterns)
Quét tin nhắn customer tìm các pattern:

**Price** (Giá cả):
- "giá thấp", "giá không hợp", "chỗ khác cao hơn", "thêm tiền", "kém"

**Timing** (Thời gian):
- "chưa cần gấp", "để sau", "suy nghĩ thêm", "bàn với", "hỏi vợ/chồng"

**Trust** (Tin tưởng):
- "lo lắng", "đảm bảo", "an toàn không", "uy tín", "lừa đảo"

**Comparison** (So sánh):
- "so sánh", "chỗ khác", "xem thêm", "platform khác"

## 5. MỐI QUAN TÂM CHÍNH (Key Concerns)
Tóm tắt 2-3 điều khách quan tâm nhất từ nội dung chat:
- Quan tâm về quy trình như thế nào?
- Quan tâm về giá cả?
- Quan tâm về thời gian?
- Lo lắng về điều gì?

Phản hồi phải đúng theo cấu trúc JSON duy nhất gồm 2 keys sau:
{
  "context_summary": "Tóm tắt tình hình hiện tại của lead, dựa trên NHIỆM VỤ PHÂN TÍCH phía trên",
  "action": "new_flow"
}
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
