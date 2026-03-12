import { NextResponse } from "next/server"
import { callGemini } from "@/lib/gemini"

export const dynamic = "force-dynamic"

/**
 * POST /api/e2e/summarize-chat
 *
 * Summarizes chat history incrementally using Gemini.
 * Only processes messages after the `previous_summary.offset`.
 *
 * Body: {
 *   lead_id: string,
 *   chat_history: ChatMessage[],
 *   previous_summary?: { text: string, offset: number }
 * }
 *
 * Returns: { summary: string, offset: number }
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
  // Skip system/event messages that carry no useful info
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

export async function POST(request: Request) {
  try {
    let body = await request.json()
    // Handle double-encoded JSON (body sent as a string instead of object)
    if (typeof body === "string") {
      try { body = JSON.parse(body) } catch { }
    }
    const { lead_id, chat_history, previous_summary } = body

    if (!lead_id) {
      return NextResponse.json({ error: "lead_id is required" }, { status: 400 })
    }

    if (!Array.isArray(chat_history) || chat_history.length === 0) {
      return NextResponse.json({ error: "chat_history must be a non-empty array" }, { status: 400 })
    }

    // Determine which messages to process (only after the offset)
    const offset = previous_summary?.offset ?? 0
    const newMessages = chat_history.slice(offset)
    const newOffset = chat_history.length // New offset after processing all current messages

    if (newMessages.length === 0 && previous_summary?.text) {
      // Nothing new to summarize — return existing summary
      return NextResponse.json({
        summary: previous_summary.text,
        offset: previous_summary.offset,
      })
    }

    // Format new messages for summarization
    const formattedMessages = newMessages
      .map(formatMessageForSummary)
      .filter(Boolean)
      .join("\n")

    if (!formattedMessages && previous_summary?.text) {
      // No meaningful new messages (only events)
      return NextResponse.json({
        summary: previous_summary.text,
        offset: newOffset,
      })
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

    const summaryText = await callGemini(userPrompt, "gemini-3-flash-preview", systemPrompt)

    return NextResponse.json({
      lead_id,
      summary: summaryText.trim(),
      offset: newOffset,
    })
  } catch (error: any) {
    console.error("[Summarize Chat API] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to summarize chat history" },
      { status: 500 }
    )
  }
}
