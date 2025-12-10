"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Lead, DealerGroup } from "../types"
import { formatCarInfo } from "../utils"

interface SendToDealerGroupsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedLead: Lead | null
  onSuccess?: () => void
}

export function SendToDealerGroupsDialog({
  open,
  onOpenChange,
  selectedLead,
  onSuccess
}: SendToDealerGroupsDialogProps) {
  const { toast } = useToast()
  const [dealerGroups, setDealerGroups] = useState<DealerGroup[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [loadingDealerGroups, setLoadingDealerGroups] = useState(false)
  const [sendingToGroups, setSendingToGroups] = useState(false)
  const [dealerGroupSearch, setDealerGroupSearch] = useState("")

  async function fetchDealerGroups() {
    setLoadingDealerGroups(true)
    try {
      const response = await fetch("/api/e2e/dealer-groups")

      if (!response.ok) {
        throw new Error("Failed to fetch dealer groups")
      }

      const data = await response.json()
      setDealerGroups(data.groups || [])
    } catch (error) {
      console.error("[E2E] Error fetching dealer groups:", error)
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách nhóm dealer",
        variant: "destructive",
      })
      setDealerGroups([])
    } finally {
      setLoadingDealerGroups(false)
    }
  }

  async function handleSendToGroups() {
    if (!selectedLead?.car_id || selectedGroupIds.length === 0) return

    setSendingToGroups(true)
    try {
      const selectedGroups = dealerGroups.filter(g => selectedGroupIds.includes(g.groupId))

      const now = new Date()
      const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`

      const carInfo = `Thời gian nhận thông tin: ${timeString}\n` +
        `Thông tin chi tiết xe: ${selectedLead.brand || ''} ${selectedLead.model || ''} ${selectedLead.year || ''}\n` +
        `Số km đã đi (Odo): ${selectedLead.mileage ? selectedLead.mileage.toLocaleString() : 'N/A'} km\n` +
        `Khu vực: ${selectedLead.location || 'N/A'}\n` +
        `Giá mong muốn: ${selectedLead.price_customer || 'N/A'}\n` +
        `Car_id: ${selectedLead.car_id}\n` +
        `Vucar hỗ trợ tài chính: 80% giá trị xe, lãi suất từ 500đ/ngày/1 triệu đồng.`

      const imageUrls: string[] = []
      if (selectedLead.additional_images) {
        Object.values(selectedLead.additional_images).forEach(images => {
          if (Array.isArray(images)) {
            images.forEach(img => {
              if (img.url) {
                imageUrls.push(img.url)
              }
            })
          }
        })
      }

      const sendResponse = await fetch("/api/e2e/send-to-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupIds: selectedGroupIds,
          message: carInfo,
          imageUrls: imageUrls,
          phone: selectedLead.phone || "0986755669"
        }),
      })

      const sendResult = await sendResponse.json()

      const biddingPromises = selectedGroups
        .filter(group => group.dealerId)
        .map(group =>
          fetch("/api/e2e/bidding-history/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              car_id: selectedLead.car_id,
              dealer_id: group.dealerId,
              price: 1,
              comment: "Đã gửi thông tin xe"
            }),
          })
        )

      await Promise.all(biddingPromises)

      const sendSuccess = sendResult.successCount || 0

      if (sendSuccess > 0) {
        toast({
          title: "Thành công",
          description: `Đã gửi thông tin xe và ${imageUrls.length} ảnh đến ${sendSuccess} nhóm dealer`,
        })
      } else {
        toast({
          title: "Gửi thất bại",
          description: "Không thể gửi tin nhắn đến các nhóm",
          variant: "destructive",
        })
      }

      onSuccess?.()
      onOpenChange(false)
      setSelectedGroupIds([])
    } catch (error) {
      console.error("[E2E] Error sending to groups:", error)
      toast({
        title: "Lỗi",
        description: "Không thể gửi thông tin xe",
        variant: "destructive",
      })
    } finally {
      setSendingToGroups(false)
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (newOpen) {
      setSelectedGroupIds([])
      setDealerGroupSearch("")
      fetchDealerGroups()
    }
    onOpenChange(newOpen)
  }

  const filteredGroups = dealerGroups
    .filter(group => group.dealerId)
    .filter(group =>
      group.groupName.toLowerCase().includes(dealerGroupSearch.toLowerCase())
    )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gửi thông tin xe đến nhóm dealer</DialogTitle>
          <DialogDescription>
            Chọn các nhóm dealer để gửi thông tin xe {formatCarInfo(selectedLead || {} as Lead)}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm nhóm dealer..."
              value={dealerGroupSearch}
              onChange={(e) => setDealerGroupSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          {loadingDealerGroups ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Đang tải danh sách nhóm...</span>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{dealerGroupSearch ? "Không tìm thấy nhóm phù hợp" : "Không tìm thấy nhóm dealer nào"}</p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filteredGroups.map((group) => (
                <div
                  key={group.groupId}
                  className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    id={group.groupId}
                    checked={selectedGroupIds.includes(group.groupId)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedGroupIds([...selectedGroupIds, group.groupId])
                      } else {
                        setSelectedGroupIds(selectedGroupIds.filter(id => id !== group.groupId))
                      }
                    }}
                  />
                  <Label
                    htmlFor={group.groupId}
                    className="flex-1 cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {group.groupName}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              Đã chọn: <span className="font-semibold">{selectedGroupIds.length}</span> nhóm
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={sendingToGroups}
              >
                Hủy
              </Button>
              <Button
                onClick={handleSendToGroups}
                disabled={selectedGroupIds.length === 0 || sendingToGroups}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {sendingToGroups ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  `Gửi đến ${selectedGroupIds.length} nhóm`
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
