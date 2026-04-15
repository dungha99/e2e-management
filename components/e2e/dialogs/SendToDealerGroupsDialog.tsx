"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Search, X, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Lead, DealerGroup } from "../types"
import { formatCarInfo } from "../utils"

interface ConnectionPartner {
  b_user_id: string
  user_name: string
}

interface SendToDealerGroupsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedLead: Lead | null
  onSuccess?: () => void
}

type Step = "select" | "review"

export function SendToDealerGroupsDialog({
  open,
  onOpenChange,
  selectedLead,
  onSuccess,
}: SendToDealerGroupsDialogProps) {
  const { toast } = useToast()

  const [connectionPartners, setConnectionPartners] = useState<ConnectionPartner[]>([])
  const [loadingPartners, setLoadingPartners] = useState(false)
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("")

  const [dealerGroups, setDealerGroups] = useState<DealerGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)

  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [groupSearch, setGroupSearch] = useState("")

  // Review step state
  const [step, setStep] = useState<Step>("select")
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [editedMessage, setEditedMessage] = useState("")
  const [editedImageUrls, setEditedImageUrls] = useState<string[]>([])
  const [sendingToGroups, setSendingToGroups] = useState(false)

  // Fetch connection partners when dialog opens
  useEffect(() => {
    if (!open || !selectedLead?.pic_id) return

    setConnectionPartners([])
    setSelectedPartnerId("")
    setDealerGroups([])
    setSelectedGroupIds([])
    setGroupSearch("")
    setStep("select")

    setLoadingPartners(true)
    fetch(`/api/e2e/staff-connections?pic_id=${selectedLead.pic_id}`)
      .then(r => r.json())
      .then(data => {
        setConnectionPartners(data.partners || [])
      })
      .catch(err => {
        console.error("[SendToDealerGroups] Error fetching partners:", err)
        toast({ title: "Lỗi", description: "Không thể tải danh sách kết nối", variant: "destructive" })
      })
      .finally(() => setLoadingPartners(false))
  }, [open, selectedLead?.pic_id])

  // Fetch dealer groups when a partner is selected
  useEffect(() => {
    if (!selectedPartnerId) {
      setDealerGroups([])
      return
    }

    setDealerGroups([])
    setSelectedGroupIds([])
    setLoadingGroups(true)

    fetch(`/api/e2e/vucar-dealer-groups?b_user_id=${selectedPartnerId}`)
      .then(r => r.json())
      .then(data => {
        setDealerGroups(data.groups || [])
      })
      .catch(err => {
        console.error("[SendToDealerGroups] Error fetching groups:", err)
        toast({ title: "Lỗi", description: "Không thể tải danh sách nhóm dealer", variant: "destructive" })
      })
      .finally(() => setLoadingGroups(false))
  }, [selectedPartnerId])

  async function handleProceedToReview() {
    if (!selectedLead?.car_id || selectedGroupIds.length === 0) return

    setLoadingPreview(true)
    try {
      const res = await fetch(`/api/e2e/dealer-message-preview?car_id=${selectedLead.car_id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load preview")

      setEditedMessage(data.message)
      setEditedImageUrls(data.image_urls || [])
      setStep("review")
    } catch (err) {
      console.error("[SendToDealerGroups] Error loading preview:", err)
      toast({ title: "Lỗi", description: "Không thể tải xem trước nội dung", variant: "destructive" })
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleSendToGroups() {
    if (!selectedLead?.car_id || selectedGroupIds.length === 0) return

    const selectedGroups = dealerGroups.filter(g => selectedGroupIds.includes(g.groupId))

    setSendingToGroups(true)
    try {
      // Send directly via Vucar API using the chosen partner
      const sendResponse = await fetch("/api/e2e/send-dealer-groups-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          b_user_id: selectedPartnerId,
          group_names: selectedGroups.map(g => g.groupName),
          message: editedMessage,
          image_url: editedImageUrls,
        }),
      })

      const sendResult = await sendResponse.json()
      const queuedCount = sendResult.successCount ?? 0

      // Create bidding records for groups that match a dealer
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
              comment: "Đã gửi thông tin xe",
            }),
          })
        )

      await Promise.all(biddingPromises)

      if (queuedCount > 0) {
        toast({
          title: "Thành công",
          description: `Đã gửi thông tin xe và ${editedImageUrls.length} ảnh đến ${queuedCount}/${selectedGroups.length} nhóm dealer`,
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
      console.error("[SendToDealerGroups] Error:", error)
      toast({ title: "Lỗi", description: "Không thể gửi thông tin xe", variant: "destructive" })
    } finally {
      setSendingToGroups(false)
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setSelectedGroupIds([])
      setGroupSearch("")
      setSelectedPartnerId("")
      setStep("select")
      setEditedMessage("")
      setEditedImageUrls([])
    }
    onOpenChange(newOpen)
  }

  const filteredGroups = dealerGroups
    .filter(group => group.dealerId)
    .filter(group => group.groupName.toLowerCase().includes(groupSearch.toLowerCase()))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gửi thông tin xe đến nhóm dealer</DialogTitle>
          <DialogDescription>
            {step === "select"
              ? `Chọn các nhóm dealer để gửi thông tin xe ${formatCarInfo(selectedLead || {} as Lead)}`
              : `Xem trước và chỉnh sửa nội dung trước khi gửi đến ${selectedGroupIds.length} nhóm`}
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <>
            {/* Partner selector */}
            <div className="px-6 pb-2">
              {loadingPartners ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang tải danh sách kết nối...
                </div>
              ) : connectionPartners.length === 0 ? (
                <p className="text-sm text-muted-foreground">Không có kết nối nào cho PIC này</p>
              ) : (
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Gửi từ tài khoản</Label>
                  <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn người gửi..." />
                    </SelectTrigger>
                    <SelectContent>
                      {connectionPartners.map(p => (
                        <SelectItem key={p.b_user_id} value={p.b_user_id}>
                          {p.user_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Group search */}
            {selectedPartnerId && (
              <div className="px-6 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm kiếm nhóm dealer..."
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            )}

            {/* Group list */}
            <div className="flex-1 overflow-y-auto px-6">
              {!selectedPartnerId ? null : loadingGroups ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-3 text-muted-foreground">Đang tải danh sách nhóm...</span>
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>{groupSearch ? "Không tìm thấy nhóm phù hợp" : "Không tìm thấy nhóm dealer nào"}</p>
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
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Hủy
                  </Button>
                  <Button
                    onClick={handleProceedToReview}
                    disabled={selectedGroupIds.length === 0 || !selectedPartnerId || loadingPreview}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {loadingPreview ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang tải...
                      </>
                    ) : (
                      "Xem trước & Gửi"
                    )}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Review step */}
            <div className="flex-1 overflow-y-auto px-6 space-y-4">
              {/* Message editor */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">Nội dung tin nhắn</Label>
                <Textarea
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  rows={12}
                  className="font-mono text-sm resize-none"
                />
              </div>

              {/* Image list */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Ảnh đính kèm ({editedImageUrls.length})
                </Label>
                {editedImageUrls.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Không có ảnh</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {editedImageUrls.map((url, idx) => (
                      <div key={idx} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Ảnh ${idx + 1}`}
                          className="w-full h-24 object-cover rounded-lg border"
                        />
                        <button
                          onClick={() =>
                            setEditedImageUrls(editedImageUrls.filter((_, i) => i !== idx))
                          }
                          className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Xóa ảnh"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <div className="flex items-center justify-between w-full">
                <Button
                  variant="ghost"
                  onClick={() => setStep("select")}
                  disabled={sendingToGroups}
                  className="gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Quay lại
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sendingToGroups}>
                    Hủy
                  </Button>
                  <Button
                    onClick={handleSendToGroups}
                    disabled={!editedMessage.trim() || sendingToGroups}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
