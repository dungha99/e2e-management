"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Gavel, MessageCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { HITLLead } from "./types"

interface CreateBiddingAndSendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: HITLLead
  onSuccess?: () => void
}

function buildDefaultMessage(car: HITLLead["car"]): string {
  const displayName = [car.model, car.year].filter(Boolean).join(" ")
  const location = car.location || ""
  const mileage = car.odo != null ? car.odo.toLocaleString("vi-VN") : ""

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

export function CreateBiddingAndSendDialog({
  open,
  onOpenChange,
  lead,
  onSuccess,
}: CreateBiddingAndSendDialogProps) {
  const { toast } = useToast()
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) setMessage(buildDefaultMessage(lead.car))
  }, [open, lead.car])

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
          minPrice: Number(lead.car.price_expected ?? 0),
          shouldGenerateMetadata: {
            comment: false,
            numberOfComments: 0,
            bid: false,
          },
        }),
      })

      if (!biddingRes.ok) {
        const err = await biddingRes.json().catch(() => ({}))
        throw new Error(err.error || err.message || "Không thể tạo bidding")
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

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error("[CreateBiddingAndSendDialog] Error:", error)
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSubmitting) onOpenChange(v) }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-blue-600" />
            Tạo Bidding & Gửi Khách
          </DialogTitle>
          <DialogDescription>
            Hệ thống sẽ tạo phiên đấu giá (6 tiếng) cho xe{" "}
            <strong>{lead.car.model || lead.car_id}</strong> và gửi tin nhắn kèm
            link phiên cho <strong>{lead.customer.name}</strong> qua Zalo.
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
            onClick={() => onOpenChange(false)}
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
  )
}
