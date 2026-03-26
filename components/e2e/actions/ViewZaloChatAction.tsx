"use client"

import { useState } from "react"
import { MessageCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { ChatMessage } from "../types"

interface ViewZaloChatActionProps {
  carId: string | null | undefined
  customerName?: string
  className?: string
  /** Render as an icon-only button (used in card footers) */
  iconOnly?: boolean
}

export function ViewZaloChatAction({ carId, customerName, className, iconOnly = false }: ViewZaloChatActionProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleOpen = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (!carId) {
      toast({ title: "Lỗi", description: "Không có Car ID", variant: "destructive" })
      return
    }
    setOpen(true)
    setLoading(true)
    toast({ title: "Đang lấy tin nhắn", description: "Đang tải tin nhắn Zalo..." })
    try {
      const res = await fetch("/api/e2e/messages-zalo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: carId }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages_zalo || [])
      } else {
        setMessages([])
      }
    } catch {
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  if (iconOnly) {
    return (
      <>
        <button
          onClick={handleOpen}
          className={`flex items-center justify-center text-gray-500 border border-gray-200 bg-gray-50 hover:bg-gray-600 hover:text-white p-1.5 rounded-lg transition-all duration-150 shrink-0 ${className || ''}`}
          title="Xem tin nhắn Zalo"
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </button>
        <ChatDialog open={open} onOpenChange={setOpen} loading={loading} messages={messages} customerName={customerName} />
      </>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        disabled={!carId}
        className={`bg-green-50 text-green-600 border-green-200 hover:bg-green-100 hover:border-green-300 text-xs sm:text-sm ${className || ''}`}
      >
        <MessageCircle className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1.5 sm:mr-2" />
        <span className="hidden sm:inline">Xem chat Zalo</span>
        <span className="sm:hidden">Zalo</span>
      </Button>
      <ChatDialog open={open} onOpenChange={setOpen} loading={loading} messages={messages} customerName={customerName} />
    </>
  )
}

function ChatDialog({ open, onOpenChange, loading, messages, customerName }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  loading: boolean
  messages: ChatMessage[]
  customerName?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-500" />
            Tin nhắn Zalo{customerName ? ` — ${customerName}` : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-[200px] max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center h-full py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-400">Đang tải tin nhắn...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full py-12 text-gray-400 text-sm">
              Chưa có tin nhắn
            </div>
          ) : (
            messages.map((msg: any, index) => {
              const isVuCar = msg.fromMe === true || msg.uidFrom === "0" || msg.uidFrom === "bot" || msg.uidFrom === "system"
              const content = msg.content || msg.text || msg.body || ""
              const timestamp = msg.timestamp
                ? (typeof msg.timestamp === 'number' ? new Date(msg.timestamp).toLocaleString("vi-VN") : msg.timestamp)
                : msg.dateAction || ""

              return (
                <div
                  key={msg._id || index}
                  className={`flex ${isVuCar ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-xl px-3 py-2 ${isVuCar
                      ? "bg-purple-500 text-white"
                      : "bg-gray-100 text-gray-900"
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-semibold">
                        {isVuCar ? "VuCar" : "Khách hàng"}
                      </span>
                      <span className="text-[10px] opacity-70">{timestamp}</span>
                    </div>
                    {msg.img && (
                      <img
                        src={msg.img}
                        alt="Message image"
                        className="max-w-[180px] max-h-[180px] object-cover rounded mb-1.5"
                      />
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
                    {msg.type && msg.type !== "text" && (
                      <span className="text-[10px] opacity-60 mt-0.5 block">
                        Type: {msg.type}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
