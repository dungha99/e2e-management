"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Lead } from "../types"
import { formatCarInfo } from "../utils"

interface CreateSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedLead: Lead | null
  onSuccess: (sessionCreated: boolean) => void
}

export function CreateSessionDialog({
  open,
  onOpenChange,
  selectedLead,
  onSuccess
}: CreateSessionDialogProps) {
  const { toast } = useToast()
  const [creatingSession, setCreatingSession] = useState(false)

  async function handleCreateSession(version: 1 | 2) {
    if (!selectedLead) return

    const phone = selectedLead.phone || selectedLead.additional_phone
    if (!phone) {
      toast({
        title: "Lỗi",
        description: "Không có số điện thoại",
        variant: "destructive",
      })
      return
    }

    if (!selectedLead.car_id) {
      toast({
        title: "Lỗi",
        description: "Không có car_id để tạo phiên",
        variant: "destructive",
      })
      return
    }

    setCreatingSession(true)
    onOpenChange(false)

    try {
      const response = await fetch("https://n8n.vucar.vn/webhook/8214cf7a-8c4f-449d-83d5-1dc07b17c2ec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, version }),
      })

      if (!response.ok) {
        throw new Error("Failed to create session")
      }

      toast({
        title: "Thành công",
        description: `Đã tạo phiên thành công (Version ${version}: ${version === 1 ? "No Bid" : "Have Bid"})`,
      })

      // Fetch updated session status
      const leadDetails = await fetchLeadDetails(phone)
      onSuccess(leadDetails.session_created)
    } catch (error) {
      console.error("[E2E] Error creating session:", error)
      toast({
        title: "Lỗi",
        description: "Không thể tạo phiên",
        variant: "destructive",
      })
    } finally {
      setCreatingSession(false)
    }
  }

  async function fetchLeadDetails(phone: string): Promise<{ session_created: boolean }> {
    try {
      const response = await fetch("/api/e2e/lead-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })

      if (!response.ok) {
        return { session_created: false }
      }

      const data = await response.json()
      return { session_created: data.session_created || false }
    } catch (error) {
      console.error("Error fetching lead details:", error)
      return { session_created: false }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chọn phiên bản tạo phiên</DialogTitle>
          <DialogDescription>
            Bạn muốn tạo phiên cho xe {formatCarInfo(selectedLead || {} as Lead)} với phiên bản nào?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <Button
            variant="outline"
            className="w-full justify-start h-auto p-4"
            onClick={() => handleCreateSession(1)}
            disabled={creatingSession}
          >
            <div className="text-left">
              <div className="font-semibold">Version 1: No Bid</div>
              <div className="text-xs text-muted-foreground">Tạo phiên không có trả giá từ dealer</div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start h-auto p-4"
            onClick={() => handleCreateSession(2)}
            disabled={creatingSession}
          >
            <div className="text-left">
              <div className="font-semibold">Version 2: Have Bid</div>
              <div className="text-xs text-muted-foreground">Tạo phiên có trả giá từ dealer</div>
            </div>
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creatingSession}>
            Hủy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
