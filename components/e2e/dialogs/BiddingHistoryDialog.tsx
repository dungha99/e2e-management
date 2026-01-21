"use client"

import * as React from "react"
import { useState } from "react"
import { DateRange } from "react-day-picker"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Loader2, Plus, Check, ChevronsUpDown, CheckCircle } from "lucide-react"
import { BiddingHistory, Dealer, Lead } from "../types"
import { formatPrice, formatDate, formatCarInfo, parseShorthandPrice, formatPriceForEdit } from "../utils"
import { cn } from "@/lib/utils"
import { PriceInput } from "../common/PriceInput"
import { DateRangePickerWithPresets } from "../common/DateRangePickerWithPresets"

interface BiddingHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  biddingHistory: BiddingHistory[]
  loadingBiddingHistory: boolean
  dealers: Dealer[]
  selectedLead: Lead | null

  // Create Manual Bid Handlers
  onAddBid: () => void
  creatingBiddingManual: boolean
  newBidDealerId?: string
  setNewBidDealerId?: (id: string) => void
  newBidPrice?: string
  setNewBidPrice?: (price: string) => void
  newBidComment?: string
  setNewBidComment?: (comment: string) => void

  // Update Bid Handlers
  onUpdateBid?: (id: string) => void
  updatingBidding?: boolean
  editingBiddingId?: string | null
  setEditingBiddingId?: (id: string | null) => void
  editingPrice?: string
  setEditingPrice?: (price: string) => void

  // Send to dealer handler
  onOpenSendDealerDialog?: () => void
}

export function BiddingHistoryDialog({
  open,
  onOpenChange,
  biddingHistory,
  loadingBiddingHistory,
  dealers,
  selectedLead,
  onAddBid,
  creatingBiddingManual,
  onUpdateBid,
  updatingBidding,
  editingBiddingId,
  setEditingBiddingId,
  editingPrice,
  setEditingPrice,
  newBidDealerId: externalNewBidDealerId,
  setNewBidDealerId: externalSetNewBidDealerId,
  newBidPrice: externalNewBidPrice,
  setNewBidPrice: externalSetNewBidPrice,
  newBidComment: externalNewBidComment,
  setNewBidComment: externalSetNewBidComment,
  onOpenSendDealerDialog,
}: BiddingHistoryDialogProps) {
  // Local state if not provided by parent
  const [localNewBidDealerId, setLocalNewBidDealerId] = useState("")
  const [localNewBidPrice, setLocalNewBidPrice] = useState("")
  const [localNewBidComment, setLocalNewBidComment] = useState("")
  const [showAddBiddingForm, setShowAddBiddingForm] = useState(false)
  const [openCombobox, setOpenCombobox] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  const newBidDealerId = externalNewBidDealerId ?? localNewBidDealerId
  const setNewBidDealerId = externalSetNewBidDealerId ?? setLocalNewBidDealerId
  const newBidPrice = externalNewBidPrice ?? localNewBidPrice
  const setNewBidPrice = externalSetNewBidPrice ?? setLocalNewBidPrice
  const newBidComment = externalNewBidComment ?? localNewBidComment
  const setNewBidComment = externalSetNewBidComment ?? setLocalNewBidComment

  // Filter bidding history based on date range
  const filteredBiddingHistory = React.useMemo(() => {
    if (!dateRange?.from) return biddingHistory

    return biddingHistory.filter((bid) => {
      const bidDate = new Date(bid.created_at)
      const startOfDay = new Date(dateRange.from!)
      startOfDay.setHours(0, 0, 0, 0)

      const endOfDay = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from as Date)
      endOfDay.setHours(23, 59, 59, 999)

      return bidDate >= startOfDay && bidDate <= endOfDay
    })
  }, [biddingHistory, dateRange])

  const handleAddBid = () => {
    onAddBid()
  }

  const handleOpenSendDealerDialog = () => {
    if (onOpenSendDealerDialog) {
      onOpenSendDealerDialog()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] h-[85vh] flex flex-col sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[95rem]">
        <DialogHeader>
          <DialogTitle>Lịch sử trả giá - {selectedLead?.name}</DialogTitle>
          <DialogDescription>
            Danh sách các dealer đã trả giá cho xe {formatCarInfo(selectedLead || {} as Lead)}
          </DialogDescription>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddBiddingForm(!showAddBiddingForm)}
            >
              {showAddBiddingForm ? "Ẩn thêm giá" : "Thêm thông tin"}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleOpenSendDealerDialog}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Gửi thêm dealer
            </Button>
            <div className="ml-auto">
              <DateRangePickerWithPresets
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                placeholder="Lọc theo ngày"
              />
            </div>
          </div>
        </DialogHeader>

        {showAddBiddingForm && (
          <div className="flex items-end gap-2 p-4 bg-muted/20 rounded-lg border mb-4 mt-4">
            <div className="grid gap-2 flex-1">
              <Label>Chọn Dealer</Label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between"
                  >
                    {newBidDealerId
                      ? dealers.find((dealer) => dealer.id === newBidDealerId)?.name
                      : "Chọn dealer..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Tìm kiếm dealer..." />
                    <CommandList>
                      <CommandEmpty>Không tìm thấy dealer.</CommandEmpty>
                      <CommandGroup>
                        {dealers.map((dealer) => (
                          <CommandItem
                            key={dealer.id}
                            value={dealer.name}
                            onSelect={() => {
                              setNewBidDealerId(dealer.id === newBidDealerId ? "" : dealer.id)
                              setOpenCombobox(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                newBidDealerId === dealer.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {dealer.name} {dealer.group_zalo_name ? `(${dealer.group_zalo_name})` : ""}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2 w-48">
              <Label>Giá (triệu)</Label>
              <PriceInput
                placeholder="VD: 500"
                value={newBidPrice}
                onChange={(value) => setNewBidPrice(value)}
              />
            </div>
            <div className="grid gap-2 flex-1">
              <Label>Ghi chú</Label>
              <Input
                placeholder="Nhập ghi chú (tùy chọn)"
                value={newBidComment}
                onChange={(e) => setNewBidComment(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAddBid}
              disabled={creatingBiddingManual || !newBidDealerId || !newBidPrice}
            >
              {creatingBiddingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Thêm giá
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loadingBiddingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Đang tải lịch sử...</span>
            </div>
          ) : filteredBiddingHistory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{dateRange?.from ? "Không có kết quả trong khoảng thời gian đã chọn" : "Chưa có dealer nào trả giá"}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">STT</th>
                    <th className="px-4 py-3 text-left font-medium">Tên Dealer</th>
                    <th className="px-4 py-3 text-left font-medium">Giá trả</th>
                    <th className="px-4 py-3 text-left font-medium">Thời gian</th>
                    <th className="px-4 py-3 text-left font-medium">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredBiddingHistory.map((bid, index) => (
                    <tr key={bid.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-3 font-medium">{bid.dealer_name}</td>
                      <td className="px-4 py-3">
                        {editingBiddingId === bid.id ? (
                          <div className="flex items-center gap-2">
                            <PriceInput
                              placeholder="VD: 500"
                              value={editingPrice || ""}
                              onChange={(value) => setEditingPrice?.(value)}
                              className="h-8 w-40"
                              autoFocus
                              showDescription={false}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => onUpdateBid?.(bid.id)}
                              disabled={updatingBidding}
                            >
                              {updatingBidding ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setEditingBiddingId?.(null)}
                              disabled={updatingBidding}
                            >
                              <div className="h-4 w-4 flex items-center justify-center font-bold">✕</div>
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <div className={`font-semibold ${bid.price < 2 ? "text-muted-foreground italic" : "text-primary"}`}>
                              {bid.price < 2 ? "Chưa có giá" : formatPrice(bid.price)}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setEditingBiddingId?.(bid.id)
                                // Use shorthand format for editing (e.g., 500000000 -> "500")
                                setEditingPrice?.(formatPriceForEdit(bid.price))
                              }}
                            >
                              <div className="h-3 w-3">✎</div>
                            </Button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(bid.created_at)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {bid.price < 2 ? "Đã gửi thông tin xe" : (bid.comment || "-")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {dateRange?.from ? (
                <>
                  Hiển thị: <span className="font-semibold">{filteredBiddingHistory.length}</span> / {biddingHistory.length} dealer trả giá
                </>
              ) : (
                <>Tổng số: <span className="font-semibold">{biddingHistory.length}</span> dealer trả giá</>
              )}
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
