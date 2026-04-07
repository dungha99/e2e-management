import { NextResponse } from "next/server"
import { callGemini } from "@/lib/gemini"

export const dynamic = "force-dynamic"

/**
 * POST /api/e2e/analyze-lead
 *
 * Combined API that:
 * 1. Summarizes chat history (incrementally from offset)
 * 2. Extracts structured lead properties from the summary
 *
 * Body: {
 *   lead_id: string,
 *   chat_history: ChatMessage[],
 *   previous_summary?: { text: string, offset: number },
 *   has_image?: boolean
 * }
 *
 * Returns: {
 *   lead_id: string,
 *   summary: { text: string, offset: number },
 *   properties: {
 *     location, brand, model, variant, year, mileage, plate,
 *     qualified, stage, seller_sentiment, price_customer, price_vucar_offered,
 *     negotiation_rounds, had_image,
 *     info_collected_at, price_vucar_offered_at, inspection_booked_at
 *   }
 * }
 */

interface ChatMessage {
  _id?: string
  id?: string
  content?: string
  type?: string
  dateAction?: string
  createdAt?: string
  uidFrom?: string
  senderName?: string
  senderType?: string
  staffName?: string
  source?: string
}

function formatMessageForSummary(msg: ChatMessage): string | null {
  if (msg.type === "event" || !msg.content?.trim()) return null

  const timestamp = msg.dateAction || msg.createdAt || ""
  const date = timestamp ? new Date(timestamp).toLocaleString("vi-VN") : ""
  const sender = msg.staffName
    ? `[Staff: ${msg.staffName}]`
    : msg.senderName
      ? `[${msg.senderName}]`
      : msg.uidFrom === "0" || msg.uidFrom === "bot"
        ? "[Bot/Staff]"
        : "[Customer]"

  return `${date} ${sender}: ${msg.content.trim()}`
}

async function summarizeChat(
  lead_id: string,
  chat_history: ChatMessage[],
  previous_summary?: { text: string; offset: number }
): Promise<{ text: string; offset: number }> {
  const offset = previous_summary?.offset ?? 0
  const newMessages = chat_history.slice(offset)
  const newOffset = chat_history.length

  if (newMessages.length === 0 && previous_summary?.text) {
    return { text: previous_summary.text, offset: previous_summary.offset }
  }

  const formattedMessages = newMessages
    .map(formatMessageForSummary)
    .filter(Boolean)
    .join("\n")

  if (!formattedMessages && previous_summary?.text) {
    return { text: previous_summary.text, offset: newOffset }
  }

  const systemPrompt = `Bạn là một trợ lý phân tích hội thoại bán hàng của Vucar - nền tảng thu mua xe cũ.
Nhiệm vụ: Tóm tắt lịch sử chat giữa nhân viên Vucar và khách hàng muốn bán xe.

Hãy tóm tắt ngắn gọn các thông tin quan trọng bao gồm:
- Thông tin xe muốn bán (thương hiệu, model, năm sản xuất, biển số, ODO, tình trạng)  
- Giá kỳ vọng của khách hàng (nếu có)
- Tỉnh/thành phố của xe
- Trạng thái đàm phán và thiện chí của khách
- Các hình ảnh xe có được gửi không (nếu có đề cập)
- Kết quả/trạng thái hiện tại của cuộc trò chuyện

Giữ tóm tắt dưới 500 từ. Viết bằng tiếng Việt. Chỉ trả về nội dung tóm tắt, không giải thích.`

  let userPrompt = ""
  if (previous_summary?.text) {
    userPrompt = `TÓM TẮT TRƯỚC ĐÓ (messages 1 đến ${offset}):\n${previous_summary.text}\n\n---\n\nMESSAGES MỚI (messages ${offset + 1} đến ${chat_history.length}):\n${formattedMessages}\n\nHãy cập nhật tóm tắt tổng hợp từ tóm tắt trước đó và các tin nhắn mới.`
  } else {
    userPrompt = `LỊCH SỬ CHAT:\n${formattedMessages}\n\nHãy tóm tắt lịch sử chat này.`
  }

  const summaryText = await callGemini(userPrompt, "gemini-2.0-flash", systemPrompt)
  return { text: summaryText.trim(), offset: newOffset }
}

async function extractLeadProperties(
  summary: string,
  previous_properties?: Record<string, any> | null
): Promise<Record<string, any>> {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().replace("Z", "+07:00")
  const prevPropsSection = previous_properties
    ? `\nDỮ LIỆU PROPERTIES TRƯỚC ĐÓ (đã trích xuất từ lần chạy trước):\n${JSON.stringify(previous_properties, null, 2)}\n\nHãy dùng dữ liệu trước đó làm nền tảng, chỉ cập nhật các trường có thông tin mới hoặc chính xác hơn từ tóm tắt. Giữ nguyên giá trị cũ nếu tóm tắt mới không đề cập rõ ràng.\n`
    : ""

  const systemPrompt = `Bạn là một hệ thống trích xuất thông tin từ tóm tắt hội thoại bán hàng xe cũ của công ty Vucar.
THỜI GIAN HIỆN TẠI: ${now} — Dùng làm mốc thời gian khi tóm tắt đề cập sự kiện xảy ra "vừa rồi", "hôm nay", "lúc nãy" mà không có timestamp cụ thể.
${prevPropsSection}
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
  "seller_sentiment": "MỚI. Thái độ khách trong tin nhắn gần nhất: • willing — hợp tác, thiện chí • hesitant — do dự, chưa quyết • ghosting — ngừng phản hồi / không đọc tin • angry — có từ ngữ như 'lừa đảo', 'scam', 'lừa tôi', 'không tin' • bot_detected — khách hỏi 'bạn là bot à', 'mày là AI hả', 'có phải người không' • want_human — 'muốn gặp trực tiếp', 'cho gặp người thật', 'gọi cho tôi', 'có số điện thoại không', 'chỗ khác giá tốt hơn' (cạnh tranh giá).",
  "price_customer": "Giá khách muốn bán HIỆN TẠI (số nguyên VND, VD: nếu khách nói '700tr' thì 700000000, nếu '1,2 tỷ' thì 1200000000). Nếu giá đã thay đổi qua đàm phán, lấy giá MỚI NHẤT khách đề nghị. null nếu không có đề cập.",
  "price_vucar_offered": "Mức giá Vucar/AI/Staff đã chào cho khách (số nguyên VND, lấy giá MỚI NHẤT). VD: 'Vucar báo giá 230 triệu' → 230000000. null nếu chưa chào giá.",
  "negotiation_rounds": "Số lần price_customer thay đổi giá trị (đếm lũy tiến). Bắt đầu từ 0, tăng 1 mỗi khi khách thay đổi mức giá yêu cầu. Nếu có previous_properties, cộng thêm vào giá trị cũ.",
  "had_image": "Khách đã gửi hình ảnh chưa (true/false).",
  "info_collected_at": "ISO timestamp của thời điểm đầu tiên khách gửi ảnh xe (had_image = true). Lấy từ timestamp của tin nhắn chứa ảnh đầu tiên. null nếu chưa gửi ảnh. Nếu previous_properties đã có giá trị, giữ nguyên giá trị cũ.",
  "price_vucar_offered_at": "ISO timestamp của thời điểm đầu tiên Vucar/AI/Staff chào giá cho khách. Lấy từ timestamp của tin nhắn chào giá đầu tiên. null nếu chưa chào giá. Nếu previous_properties đã có giá trị, giữ nguyên giá trị cũ.",
  "inspection_booked_at": "ISO timestamp của thời điểm đầu tiên khách đồng ý hẹn kiểm định có tín hiệu rõ ràng ('đồng ý xem xe', 'hẹn kiểm định lúc X giờ', 'kỹ thuật sẽ đến'). null nếu chỉ 'đang cố gắng hẹn' hoặc chưa hẹn. Nếu previous_properties đã có giá trị, giữ nguyên giá trị cũ."
}

LOGIC NEGOTIATION_ROUNDS:
- Đếm số lần khách THAY ĐỔI mức giá yêu cầu trong cuộc hội thoại (không đếm lần đầu nêu giá).
- VD: Khách nói "700tr" → sau đó "680tr" → sau đó "650tr" = negotiation_rounds: 2 (2 lần thay đổi).
- Nếu có previous_properties.negotiation_rounds, cộng thêm số lần thay đổi MỚI trong đoạn chat mới.

LOGIC SLA TIMESTAMPS:
- info_collected_at, price_vucar_offered_at, inspection_booked_at: CHỈ set lần đầu tiên. Nếu previous_properties đã có giá trị (khác null), LUÔN giữ nguyên giá trị cũ, KHÔNG ghi đè.
- Nếu previous_properties chưa có giá trị (null) và tóm tắt mới cho thấy sự kiện đã xảy ra, hãy lấy timestamp gần đúng nhất từ nội dung chat.

LOGIC QUALIFIED:
- Nếu trong tóm tắt có đề cập khách đã gửi ảnh xe → "strong_qualified"
- Nếu không đề cập ảnh xe → "weak_qualified"

LOGIC STAGE (ưu tiên theo thứ tự từ cao xuống thấp):
- "completed" nếu: có xác nhận giao dịch thành công ("đã bán", "chốt rồi", "hoàn tất", ...)
- "failed" nếu: khách từ chối rõ ràng ("thôi không bán nữa", "bán bên khác rồi", "không liên hệ nữa", ...)
- "inspection" nếu: khách đồng ý lịch kiểm định, hoặc mention "kiểm định", "xem xe", "cho người xuống xem"
- "negotiation" nếu: khách đã nhắc đến giá, hỏi giá, phản giá, hoặc có signal đàm phán
- "contacted" nếu: AI/bot đã gửi tin nhắn đầu tiên, khách chưa phản hồi hoặc mới reply lần đầu
- "chưa liên hệ được" nếu không rõ ràng

CHỈ trả về JSON object. KHÔNG giải thích, KHÔNG markdown, KHÔNG text thêm.`

  const rawResponse = await callGemini(`TÓM TẮT HỘI THOẠI:\n${summary}`, "gemini-2.5-flash", systemPrompt)

  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Gemini did not return valid JSON: ${rawResponse.slice(0, 300)}`)
  return JSON.parse(jsonMatch[0])
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { lead_id, chat_history, previous_summary, previous_properties } = body
    // previous_properties can be the full object from DB (with id, summary_id, result, ...)
    // or just the result object itself — normalize to just the result fields
    const prevProps = previous_properties?.result ?? previous_properties ?? null

    if (!lead_id) {
      return NextResponse.json({ error: "lead_id is required" }, { status: 400 })
    }

    if (!Array.isArray(chat_history) || chat_history.length === 0) {
      return NextResponse.json({ error: "chat_history must be a non-empty array" }, { status: 400 })
    }

    // Step 1: Summarize chat history
    let summary: { text: string; offset: number }
    try {
      summary = await summarizeChat(lead_id, chat_history, previous_summary)
      console.log(`[Analyze Lead] Summarized chat for lead ${lead_id}, offset: ${summary.offset}`)
    } catch (err: any) {
      return NextResponse.json(
        { error: "Failed to summarize chat history", details: err.message },
        { status: 500 }
      )
    }

    // Step 2: Extract lead properties from summary
    let properties: Record<string, any> = {}
    try {
      properties = await extractLeadProperties(summary.text, prevProps)
      console.log(`[Analyze Lead] Extracted properties for lead ${lead_id}:`, properties)
    } catch (err: any) {
      return NextResponse.json(
        { error: "Failed to extract lead properties", details: err.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      lead_id,
      summary: {
        text: summary.text,
        offset: summary.offset,
      },
      properties,
    })
  } catch (error: any) {
    console.error("[Analyze Lead API] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to analyze lead" },
      { status: 500 }
    )
  }
}
