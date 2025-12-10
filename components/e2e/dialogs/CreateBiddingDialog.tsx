"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Lead } from "../types"
import { maskPhone } from "@/lib/utils"

interface CreateBiddingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: Lead | null
  onSuccess: () => void
}

export function CreateBiddingDialog({
  open,
  onOpenChange,
  lead,
  onSuccess
}: CreateBiddingDialogProps) {
  const { toast } = useToast()
  const [creatingBidding, setCreatingBidding] = useState(false)

  async function confirmCreateBidding() {
    if (!lead) return

    const phone = lead.phone || lead.additional_phone
    if (!phone) return

    setCreatingBidding(true)
    onOpenChange(false)

    try {
      const response = await fetch("https://n8n.vucar.vn/webhook/8214cf7a-8c4f-449d-83d5-1dc07b17c2ec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })

      if (!response.ok) {
        throw new Error("Failed to create bidding")
      }

      toast({
        title: "Thành công",
        description: "Đã tạo bidding thành công",
      })

      // Wait a bit then refresh
      setTimeout(() => {
        onSuccess()
      }, 2000)
    } catch (error) {
      console.error("[E2E] Error creating bidding:", error)
      toast({
        title: "Lỗi",
        description: "Không thể tạo bidding",
        variant: "destructive",
      })
    } finally {
      setCreatingBidding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Xác nhận tạo Bidding</DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn tạo bidding cho lead <strong>{lead?.name}</strong>?
            <br />
            <span className="text-xs text-muted-foreground">
              SĐT: {lead?.phone ? maskPhone(lead.phone) : maskPhone(lead?.additional_phone || "")}
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creatingBidding}
          >
            Hủy
          </Button>
          <Button
            onClick={confirmCreateBidding}
            disabled={creatingBidding}
          >
            {creatingBidding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang tạo...
              </>
            ) : (
              "Xác nhận"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
