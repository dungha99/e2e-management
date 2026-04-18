"use client"

import { useEffect, useRef, useMemo } from "react"
import { format, isSameDay, parseISO } from "date-fns"
import { Phone, FileText, ImageIcon, User, ShieldCheck, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface ZaloMessage {
  type: "text" | "image" | "file" | "event" | string
  content?: string
  text?: string
  message?: string
  img?: string
  uidFrom?: string
  fromMe?: boolean
  timestamp?: number | string
  dateAction?: string
}

interface ZaloChatViewerProps {
  messages: ZaloMessage[]
  customerName?: string
  carDisplayName?: string
  className?: string
}

export function ZaloChatViewer({ 
  messages, 
  customerName = "Khách hàng", 
  carDisplayName,
  className 
}: ZaloChatViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // 1. Process & Sort Messages
  const getNormalizedTime = (m: ZaloMessage) => {
    let ts = 0
    if (m.timestamp !== undefined && m.timestamp !== null) {
      ts = typeof m.timestamp === 'string' ? Number(m.timestamp) : m.timestamp
      if (!isNaN(ts) && ts > 0) {
        // Normalize seconds to milliseconds
        if (ts < 1000000000000) ts = ts * 1000
      } else {
        ts = 0
      }
    }
    
    if (!ts && m.dateAction) {
      const parsed = parseISO(m.dateAction)
      if (!isNaN(parsed.getTime())) ts = parsed.getTime()
    }
    
    return ts || Date.now()
  }

  const processedMessages = useMemo(() => {
    if (!messages || !Array.isArray(messages)) return []

    return [...messages].map(m => ({
      ...m,
      _normalizedTime: getNormalizedTime(m)
    })).sort((a, b) => a._normalizedTime - b._normalizedTime)
  }, [messages])

  // 2. Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [processedMessages])

  // Group messages by date
  const groupedData = useMemo(() => {
    const groups: { date: string, messages: ZaloMessage[] }[] = []
    
    processedMessages.forEach((msg: any) => {
      const msgDate = new Date(msg._normalizedTime)
      const dateStr = format(msgDate, "yyyy-MM-dd")
      
      const lastGroup = groups[groups.length - 1]
      if (lastGroup && lastGroup.date === dateStr) {
        lastGroup.messages.push(msg)
      } else {
        groups.push({ date: dateStr, messages: [msg] })
      }
    })
    
    return groups
  }, [processedMessages])

  // Render individual message content
  const renderMessageContent = (msg: ZaloMessage) => {
    const type = msg.type?.toLowerCase() || "text"
    const content = msg.content || msg.message || msg.text || ""

    if (type === 'image' || msg.img) {
      return (
        <div className="space-y-2">
          {msg.img && (
            <a href={msg.img} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border bg-gray-100 hover:opacity-90 transition-opacity">
              <img src={msg.img} alt="Zalo image" className="max-w-full max-h-[300px] object-contain mx-auto" />
            </a>
          )}
          {content && <p className="text-sm whitespace-pre-wrap">{content}</p>}
        </div>
      )
    }

    if (type === 'file') {
      return (
        <div className="flex items-center gap-3 p-3 bg-white/10 rounded-lg border border-white/20">
          <div className="h-10 w-10 flex items-center justify-center bg-white/20 rounded">
            <FileText className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{content || "Tập tin đính kèm"}</p>
            <p className="text-[10px] opacity-70 uppercase">FILE</p>
          </div>
        </div>
      )
    }

    if (type === 'event') {
      return (
        <div className="text-center italic text-gray-500 text-[11px] py-1 px-8 leading-tight">
          {content}
        </div>
      )
    }

    // Default text
    const isPhoneCall = content.includes("[Cuộc gọi thoại...]")
    return (
      <div className="flex items-start gap-2">
        {isPhoneCall && <Phone className="h-4 w-4 mt-0.5 shrink-0" />}
        <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
          {content}
        </p>
      </div>
    )
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-12">
        <MessageSquare className="h-12 w-12 opacity-20" />
        <p className="italic text-sm">Chưa có nội dung hội thoại</p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col bg-[#e2e8f0] h-full overflow-hidden", className)}>
      {/* Scrollable Container */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scroll-smooth"
      >
        {groupedData.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-4">
            {/* Date Separator */}
            <div className="flex justify-center">
              <div className="px-4 py-1 rounded-full bg-black/5 text-[11px] font-medium text-gray-500 flex items-center gap-2">
                <span className="h-px w-4 bg-gray-300" />
                {format(parseISO(group.date), "dd/MM/yyyy")}
                <span className="h-px w-4 bg-gray-300" />
              </div>
            </div>

            {group.messages.map((msg, msgIdx) => {
              const isEvent = msg.type?.toLowerCase() === 'event'
              if (isEvent) return <div key={msgIdx}>{renderMessageContent(msg)}</div>

              const isSale = msg.uidFrom === "0" || msg.fromMe === true
              const msgDate = new Date((msg as any)._normalizedTime)
              const timeStr = format(msgDate, "HH:mm")

              return (
                <div 
                  key={msgIdx} 
                  className={cn(
                    "flex flex-col max-w-[85%] sm:max-w-[75%]",
                    isSale ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      {isSale ? "Sale" : "Khách"}
                    </span>
                  </div>

                  <div className={cn(
                    "relative px-3.5 py-2.5 rounded-2xl shadow-sm transition-all",
                    isSale 
                      ? "bg-[#0068ff] text-white rounded-tr-none" 
                      : "bg-white text-gray-800 border-gray-200 border rounded-tl-none"
                  )}>
                    {renderMessageContent(msg)}
                    <div className={cn(
                      "text-[9px] mt-1.5 font-medium opacity-60 text-right",
                      isSale ? "text-white" : "text-gray-500"
                    )}>
                      {timeStr}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
