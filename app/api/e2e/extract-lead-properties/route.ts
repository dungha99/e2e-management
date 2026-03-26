import { NextResponse } from "next/server"
import { callGemini } from "@/lib/gemini"

export const dynamic = "force-dynamic"

/**
 * POST /api/e2e/extract-lead-properties
 *
 * Uses Gemini to extract structured lead properties from a chat summary.
 *
 * Body: {
 *   lead_id: string,
 *   summary: string
 * }
 *
 * Returns: {
 *   lead_id: string,
 *   properties: {
 *     location, brand, model, variant, year, mileage, plate,
 *     qualified, stage, price_customer
 *   }
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { lead_id, summary } = body

    if (!lead_id) {
      return NextResponse.json({ error: "lead_id is required" }, { status: 400 })
    }

    if (!summary || typeof summary !== "string" || !summary.trim()) {
      return NextResponse.json({ error: "summary is required" }, { status: 400 })
    }

    const systemPrompt = `Bạn là một hệ thống trích xuất thông tin từ tóm tắt hội thoại bán hàng xe cũ của công ty Vucar.

Từ đoạn tóm tắt được cung cấp, hãy trích xuất các thông tin sau và trả về MỘT JSON object duy nhất:

{
  "thinking_process": "Giải thích chi tiết lý do tại sao bạn điền từng giá trị vào các trường bên dưới. Ví dụ: 'location=TP.HCM vì tóm tắt đề cập khách ở HCM; stage=negotiation vì khách hỏi giá 700 triệu; qualified=weak_qualified vì không thấy đề cập ảnh xe'",
  "location": "Tỉnh/thành phố của xe (chỉ tên tỉnh/thành, không cần quận/huyện). null nếu không có.",
  "brand": "Thương hiệu xe (VD: Toyota, Honda, ...). null nếu không có.",
  "model": "Dòng xe (VD: Camry, Civic, ...). null nếu không có.",
  "variant": "Phiên bản/variant (VD: 2.0G, 1.5MT, ...). null nếu không có.",
  "year": "Năm sản xuất (4 chữ số). null nếu không có.",
  "mileage": "Số km đã đi (chỉ số nguyên, không đơn vị). null nếu không có.",
  "plate": "Biển số xe. null nếu không có.",
  "qualified": "Xem logic qualified bên dưới",
  "stage": "Xem logic stage bên dưới",
  "price_customer": "Giá khách muốn bán (số nguyên VND, VD: nếu khách nói '700tr' thì 700000000, nếu '1,2 tỷ' thì 1200000000). null nếu không có đề cập.",
  "had_image": "Khách đã gửi hình ảnh chưa (true/false)."
}

LOGIC QUALIFIED:
- Nếu trong tóm tắt có đề cập khách đã gửi ảnh xe → "strong_qualified"
- Nếu không đề cập ảnh xe → "weak_qualified"

LOGIC STAGE (ưu tiên theo thứ tự từ cao xuống thấp):
- "completed" nếu: có xác nhận giao dịch thành công ("đã bán", "chốt rồi", "hoàn tất", ...)
- "failed" nếu: khách từ chối rõ ràng ("thôi không bán nữa", "bán bên khác rồi", "không liên hệ nữa", ...)
- "inspection" nếu: khách đồng ý lịch kiểm định, hoặc mention "kiểm định", "xem xe", "cho người xuống xem"
- "negotiation" nếu: khách đã nhắc đến giá, hỏi giá, phản giá, hoặc có signal đàm phán ("giá đó thấp quá", "bên kia trả cao hơn", ...)
- "contacted" nếu: AI/bot đã gửi tin nhắn đầu tiên, khách chưa phản hồi hoặc mới reply lần đầu
- "chưa liên hệ được" nếu không rõ ràng

CHỈ trả về JSON object. KHÔNG giải thích, KHÔNG markdown, KHÔNG text thêm.`

    const userPrompt = `TÓM TẮT HỘI THOẠI:\n${summary}`

    const rawResponse = await callGemini(userPrompt, "gemini-3-flash-preview", systemPrompt)

    // Parse JSON from response
    let properties: Record<string, any> = {}
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        properties = JSON.parse(jsonMatch[0])
      } else {
        throw new Error("No JSON found in Gemini response")
      }
    } catch (parseErr) {
      console.error("[Extract Lead Properties API] Failed to parse Gemini JSON:", rawResponse.slice(0, 500))
      return NextResponse.json(
        { error: "Failed to parse Gemini response as JSON", raw: rawResponse.slice(0, 500) },
        { status: 500 }
      )
    }

    return NextResponse.json({
      lead_id,
      thinking_process: properties.thinking_process || null,
      properties: (({ thinking_process, ...rest }) => rest)(properties),
    })
  } catch (error: any) {
    console.error("[Extract Lead Properties API] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to extract lead properties" },
      { status: 500 }
    )
  }
}
