"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Lead, DECOY_ACCOUNTS, SEGMENT_TO_REASON_MAP } from "../types"

interface DecoyTriggerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedLead: Lead | null
}

export function DecoyTriggerDialog({
  open,
  onOpenChange,
  selectedLead
}: DecoyTriggerDialogProps) {
  const { toast } = useToast()
  const [decoySegment, setDecoySegment] = useState("")
  const [decoyMinutes, setDecoyMinutes] = useState("30")
  const [sendingDecoy, setSendingDecoy] = useState(false)

  async function handleSendDecoy() {
    if (!selectedLead || !selectedLead.phone) {
      toast({
        title: "Lỗi",
        description: "Không có số điện thoại",
        variant: "destructive",
      })
      return
    }

    if (!decoySegment) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn lý do quây",
        variant: "destructive",
      })
      return
    }

    setSendingDecoy(true)

    try {
      // Randomly select between Minh Anh (index 0) and Huy Hồ (index 1)
      const randomIndex = Math.floor(Math.random() * 2)
      const selectedAccount = DECOY_ACCOUNTS[randomIndex]

      console.log("[E2E] Sending decoy with account:", selectedAccount.name)

      // Step 1: Create job in database
      const createResponse = await fetch("/api/decoy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedLead.phone,
          shop_id: selectedAccount.shop_id,
          first_message: selectedAccount.default_message,
          account: selectedAccount.account,
          segment: decoySegment,
          is_sent: false,
        }),
      })

      const createdJob = await createResponse.json()
      console.log("[E2E] Decoy job created:", createdJob)

      if (!createdJob.id) {
        throw new Error("Failed to create decoy job")
      }

      // Step 2: Trigger n8n webhook
      await fetch("https://n8n.vucar.vn/webhook/60362b14-0e05-4849-b3cd-ebbbdb854b49", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: createdJob.id,
          phone: selectedLead.phone,
          shop_id: selectedAccount.shop_id,
          first_message: selectedAccount.default_message,
          account: selectedAccount.account,
          segment: decoySegment,
          minutes: parseInt(decoyMinutes) || 0,
        }),
      })

      // Step 3: Update reason in database
      const reasonText = SEGMENT_TO_REASON_MAP[decoySegment] || decoySegment
      await fetch("/api/decoy/update-reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedLead.phone,
          reason: reasonText,
        }),
      })

      toast({
        title: "✓ Đã nhận được yêu cầu",
        description: `Đã gửi decoy bằng tài khoản ${selectedAccount.name}. Hãy check tình trạng sau 1 phút.`,
        className: "bg-green-50 border-green-200",
        duration: 5000,
      })

      // Close dialog and reset
      onOpenChange(false)
      setDecoySegment("")
      setDecoyMinutes("30")
    } catch (error) {
      console.error("[E2E] Error sending decoy:", error)
      toast({
        title: "✗ Gửi thất bại",
        description: "Không thể gửi decoy. Vui lòng thử lại.",
        variant: "destructive",
      })
    } finally {
      setSendingDecoy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Gửi Decoy Zalo</DialogTitle>
          <DialogDescription>
            Chọn lý do quây để gửi tin nhắn decoy cho khách hàng {selectedLead?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="segment">Lý do quây</Label>
            <Select value={decoySegment} onValueChange={setDecoySegment}>
              <SelectTrigger id="segment">
                <SelectValue placeholder="Chọn lý do..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="negotiation">Đàm phán / Cứng giá</SelectItem>
                <SelectItem value="ghost">Ghost / Lead nguội</SelectItem>
                <SelectItem value="check_sold">Check var đã bán chưa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="minutes">Số phút trước khi bot chat</Label>
            <Input
              id="minutes"
              type="number"
              placeholder="Nhập số phút..."
              value={decoyMinutes}
              onChange={(e) => setDecoyMinutes(e.target.value)}
              min="0"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Hệ thống sẽ tự động chọn ngẫu nhiên tài khoản:</p>
            <ul className="list-disc list-inside mt-1">
              <li>Minh Anh</li>
              <li>Huy Hồ</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sendingDecoy}>
            Hủy
          </Button>
          <Button onClick={handleSendDecoy} disabled={!decoySegment || sendingDecoy} className="bg-emerald-600 hover:bg-emerald-700">
            {sendingDecoy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang gửi...
              </>
            ) : (
              "Gửi Decoy"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
