"use client"

import { useState, useEffect } from "react"
import { Gavel, Loader2, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Lead } from "../types"

interface CreateBiddingActionProps {
  lead: Lead
  className?: string
}

function buildDefaultMessage(lead: Lead): string {
  const displayName =
    lead.display_name ||
    [lead.brand, lead.model, lead.year].filter(Boolean).join(" ")
  const location = lead.location || ""
  const mileage = lead.mileage != null ? lead.mileage.toLocaleString("vi-VN") : ""

  return [
    "dạ e gửi link phiên kết nối để mình tiện theo dõi tương tác của ng mua ạ. Mình có thể tương tác với ng mua thông qua cách đăng ký tài khoản trên Vucar bằng số điện thoại đã để lại thông tin bán xe nha. Có vấn đề cần hỗ trợ thì cứ nhắn e ạ, e cảm ơn.",
    displayName ? `Phiên đấu giá xe ${displayName}` : null,
    "Thông tin xe:",
    location ? `🚗 Khu vực: ${location}` : null,
    mileage ? `🚗 Odo: ${mileage} km` : null,
    "Link phiên: [tự động điền]",
  ]
    .filter(Boolean)
    .join("\n")
}

export function CreateBiddingAction({ lead, className }: CreateBiddingActionProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) setMessage(buildDefaultMessage(lead))
  }, [open, lead])

  async function handleConfirm() {
    if (!lead.car_id) {
      toast({ title: "Lỗi", description: "Không tìm thấy Car ID", variant: "destructive" })
      return
    }
    if (!message.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập nội dung tin nhắn", variant: "destructive" })
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Tạo bidding session
      const biddingRes = await fetch("/api/vucar/bidding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId: lead.car_id,
          duration: 6,
          minPrice: Number(lead.price_customer ?? 0),
          shouldGenerateMetadata: {
            comment: false,
            numberOfComments: 0,
            bid: false,
          },
        }),
      })

      if (!biddingRes.ok) {
        const err = await biddingRes.json().catch(() => ({}))
        console.error("[CreateBiddingAction] Bidding API error:", biddingRes.status, JSON.stringify(err))
        const errMsg =
          typeof err.error === "string" ? err.error :
          typeof err.message === "string" ? err.message :
          `HTTP ${biddingRes.status}`
        throw new Error(`Không thể tạo bidding: ${errMsg}`)
      }

      // 2. Gửi tin nhắn qua Vucar Zalo API (tự động lấy slug + zalo_account từ car_id)
      // Strip the placeholder "Link phiên:" line — the server appends the real link
      const messageBody = message
        .split("\n")
        .filter((line) => !line.startsWith("Link phiên:"))
        .join("\n")
        .trim()

      const msgRes = await fetch("/api/zalo/send-bidding-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          car_id: lead.car_id,
          message_body: messageBody,
        }),
      })

      if (!msgRes.ok) {
        const msgErr = await msgRes.json().catch(() => ({}))
        toast({
          title: "Bidding đã tạo",
          description: `Phiên đã tạo nhưng gửi tin nhắn thất bại: ${msgErr.error || "Lỗi không xác định"}. Vui lòng gửi thủ công.`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Thành công",
          description: "Đã tạo phiên đấu giá và gửi link cho khách qua Zalo",
        })
      }

      setOpen(false)
    } catch (error) {
      console.error("[CreateBiddingAction] Error:", error)
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const carLabel = lead.display_name || [lead.brand, lead.model].filter(Boolean).join(" ") || lead.car_id || ""

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!lead.car_id}
        className={`bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 text-xs sm:text-sm ${className ?? ""}`}
        title="Tạo phiên đấu giá và gửi link cho khách"
      >
        <Gavel className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1.5 sm:mr-2" />
        <span className="hidden sm:inline">Tạo phiên nhanh</span>
        <span className="sm:hidden">Tạo phiên</span>
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!isSubmitting) setOpen(v) }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-blue-600" />
              Tạo Bidding & Gửi Khách
            </DialogTitle>
            <DialogDescription>
              Hệ thống sẽ tạo phiên đấu giá (6 tiếng) cho xe{" "}
              <strong>{carLabel}</strong> và gửi tin nhắn kèm link phiên cho{" "}
              <strong>{lead.name}</strong> qua Zalo.
              Link phiên sẽ được tự động tạo từ slug xe.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-blue-500 shrink-0" />
              <Label className="text-sm font-medium">Tin nhắn gửi cho khách</Label>
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="text-sm resize-none"
              disabled={isSubmitting}
            />
            <p className="text-[11px] text-gray-400">
              Dòng "Link phiên: [tự động điền]" sẽ được thay bằng link thực của xe khi gửi.
              Bạn có thể chỉnh sửa phần nội dung còn lại trước khi gửi.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting || !message.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Gavel className="h-4 w-4 mr-2" />
                  Tạo Bidding & Gửi tin
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
