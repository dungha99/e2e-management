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
import { Loader2, MessageCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Lead } from "../types"

interface ActivateWF1DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedLead: Lead
  targetWorkflowId: string
  parentInstanceId: string | null
  onSuccess: () => void
}

const DEFAULT_MESSAGE =
  "Anh/chị ơi, bên em đã tạo phiên đấu giá cho xe của mình rồi ạ! Phiên sẽ kéo dài khoảng 6 tiếng để nhiều Dealer cùng trả giá.\n\nKhi phiên kết thúc, nếu giá Dealer trả thấp hơn giá kỳ vọng của mình, anh/chị có thể xem xét điều chỉnh giá xuống một chút để bán được xe nhanh hơn ạ. Em sẽ cập nhật kết quả phiên cho mình sớm nhất nhé!"

export function ActivateWF1Dialog({
  open,
  onOpenChange,
  selectedLead,
  targetWorkflowId,
  parentInstanceId,
  onSuccess,
}: ActivateWF1DialogProps) {
  const { toast } = useToast()
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset message khi mở lại dialog
  useEffect(() => {
    if (open) setMessage(DEFAULT_MESSAGE)
  }, [open])

  const phone = selectedLead.phone || selectedLead.additional_phone

  async function handleConfirm() {
    if (!phone) {
      toast({ title: "Lỗi", description: "Không tìm thấy số điện thoại khách hàng", variant: "destructive" })
      return
    }
    if (!message.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập nội dung tin nhắn", variant: "destructive" })
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Kích hoạt WF1 (tạo workflow instance)
      const activateRes = await fetch("/api/e2e/activate-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId: selectedLead.car_id,
          targetWorkflowId,
          parentInstanceId: parentInstanceId || null,
          finalOutcome: null,
          transitionProperties: { custom_fields: {} },
          aiInsightId: null,
          isAlignedWithAi: null,
          phoneNumber: phone,
          workflowPayload: {},
        }),
      })

      if (!activateRes.ok) {
        const err = await activateRes.json().catch(() => ({}))
        throw new Error(err.error || "Không thể kích hoạt WF1")
      }

      // 2. Gửi tin nhắn cho khách
      const msgRes = await fetch("/api/akabiz/send-customer-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_phone: phone,
          messages: [message.trim()],
          picId: selectedLead.pic_id,
          car_id: selectedLead.car_id,
        }),
      })

      if (!msgRes.ok) {
        // Workflow đã tạo thành công, chỉ cảnh báo về message
        toast({
          title: "WF1 đã kích hoạt",
          description: "Workflow đã tạo nhưng không thể gửi tin nhắn. Vui lòng gửi thủ công.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Thành công",
          description: "Đã kích hoạt WF1 và gửi tin nhắn cho khách",
        })
      }

      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error("[ActivateWF1Dialog] Error:", error)
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Kích hoạt WF1</DialogTitle>
          <DialogDescription>
            Hệ thống sẽ kích hoạt WF1 và gửi tin nhắn dưới đây cho{" "}
            <strong>{selectedLead.name}</strong> qua Zalo ({phone ?? "—"}).
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
            rows={7}
            className="text-sm resize-none"
            disabled={isSubmitting}
          />
          <p className="text-[11px] text-gray-400">
            Bạn có thể chỉnh sửa nội dung trước khi gửi.
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
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              "Kích hoạt & Gửi tin"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
