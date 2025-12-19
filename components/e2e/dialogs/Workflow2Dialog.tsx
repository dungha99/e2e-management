"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Lead } from "../types"
import { formatCarInfo, parseShorthandPrice } from "../utils"

interface Workflow2DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedLead: Lead | null
  defaultData?: {
    duration: string
    minPrice: string
    maxPrice: string
    comment: boolean
    numberOfComments: string
    bid: boolean
  }
  onSuccess: (workflow2Active: boolean) => void
  onOpenDecoyDialog?: () => void
}

export function Workflow2Dialog({
  open,
  onOpenChange,
  selectedLead,
  defaultData,
  onSuccess,
  onOpenDecoyDialog
}: Workflow2DialogProps) {
  const { toast } = useToast()
  const [activatingWorkflow2, setActivatingWorkflow2] = useState(false)
  const [workflow2Data, setWorkflow2Data] = useState(defaultData || {
    duration: "",
    minPrice: "",
    maxPrice: "",
    comment: false,
    numberOfComments: "",
    bid: false
  })

  async function handleActivateWorkflow2() {
    const phone = selectedLead?.phone || selectedLead?.additional_phone
    if (!phone) {
      toast({
        title: "Lỗi",
        description: "Không tìm thấy số điện thoại",
        variant: "destructive",
      })
      return
    }

    setActivatingWorkflow2(true)

    try {
      const response = await fetch("https://n8n.vucar.vn/webhook/8214cf7a-8c4f-1dc07b17c2ec-449d-83d5", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone,
          duration: parseInt(workflow2Data.duration) || 0,
          // Parse shorthand prices (e.g., 500 -> 500000000)
          minPrice: parseShorthandPrice(workflow2Data.minPrice) || 0,
          maxPrice: parseShorthandPrice(workflow2Data.maxPrice) || 0,
          comment: workflow2Data.comment,
          numberOfComments: parseInt(workflow2Data.numberOfComments) || 0,
          bid: workflow2Data.bid,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to activate workflow 2")
      }

      toast({
        title: "Thành công",
        description: "Đã kích hoạt Workflow 2",
      })

      onSuccess(true)
      onOpenChange(false)

      // Open decoy dialog after successful activation
      if (onOpenDecoyDialog) {
        onOpenDecoyDialog()
      }

      // Reset form
      setWorkflow2Data({
        duration: "",
        minPrice: "",
        maxPrice: "",
        comment: false,
        numberOfComments: "",
        bid: false
      })
    } catch (error) {
      console.error("[E2E] Error activating workflow 2:", error)
      toast({
        title: "Lỗi",
        description: "Không thể kích hoạt Workflow 2",
        variant: "destructive",
      })
    } finally {
      setActivatingWorkflow2(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-sm:max-w-full max-sm:h-[90vh] max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-y-0 max-sm:translate-x-0">
        <DialogHeader>
          <DialogTitle>Kích hoạt Workflow 2</DialogTitle>
          <DialogDescription>
            Nhập các thông số để kích hoạt workflow 2 cho xe {formatCarInfo(selectedLead || {} as Lead)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="duration">Duration</Label>
            <Input
              id="duration"
              type="number"
              placeholder="Nhập duration"
              value={workflow2Data.duration}
              onChange={(e) => setWorkflow2Data({ ...workflow2Data, duration: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="minPrice">Min Price (triệu)</Label>
            <Input
              id="minPrice"
              type="text"
              placeholder="VD: 500 = 500 triệu"
              value={workflow2Data.minPrice}
              onChange={(e) => setWorkflow2Data({ ...workflow2Data, minPrice: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="maxPrice">Max Price (triệu)</Label>
            <Input
              id="maxPrice"
              type="text"
              placeholder="VD: 600 = 600 triệu"
              value={workflow2Data.maxPrice}
              onChange={(e) => setWorkflow2Data({ ...workflow2Data, maxPrice: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="numberOfComments">Number of Comments</Label>
            <Input
              id="numberOfComments"
              type="number"
              placeholder="Nhập số lượng comments"
              value={workflow2Data.numberOfComments}
              onChange={(e) => setWorkflow2Data({ ...workflow2Data, numberOfComments: e.target.value })}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="comment"
              checked={workflow2Data.comment}
              onCheckedChange={(checked) => setWorkflow2Data({ ...workflow2Data, comment: checked === true })}
            />
            <Label htmlFor="comment" className="text-sm font-normal cursor-pointer">
              Comment
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="bid"
              checked={workflow2Data.bid}
              onCheckedChange={(checked) => setWorkflow2Data({ ...workflow2Data, bid: checked === true })}
            />
            <Label htmlFor="bid" className="text-sm font-normal cursor-pointer">
              Bid
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={activatingWorkflow2}
          >
            Hủy
          </Button>
          <Button
            onClick={handleActivateWorkflow2}
            disabled={activatingWorkflow2}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {activatingWorkflow2 ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang kích hoạt...
              </>
            ) : (
              "Kích hoạt"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
