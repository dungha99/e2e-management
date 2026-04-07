"use client"

import { useState } from "react"
import { MessageSquare, MessageCircle, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { ChatMessage } from "../types"
import { ZaloChatViewer } from "../common/ZaloChatViewer"

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
      <DialogContent className="sm:max-w-[500px] h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-4 border-b shrink-0 bg-white relative">
          <div className="pr-8">
            <DialogTitle className="text-base font-bold text-gray-900 truncate">
              {customerName || "Khách hàng"}
            </DialogTitle>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Lịch sử tin nhắn Zalo
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-3 top-3 h-8 w-8 rounded-full hover:bg-gray-100"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4 text-gray-500" />
          </Button>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 bg-gray-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-muted-foreground">Đang tải tin nhắn...</p>
            </div>
          ) : (
            <ZaloChatViewer messages={messages} customerName={customerName} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
