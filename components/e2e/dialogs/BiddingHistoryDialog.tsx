"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Pencil, Save, Plus } from "lucide-react"
import { BiddingHistory, Dealer, Lead } from "../types"
import { formatPrice, formatDate, formatCarInfo } from "../utils"

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

  // Optional: internal state management can be moved here if not passed
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
}: BiddingHistoryDialogProps) {
  // Local state if not provided by parent (for simpler integration if preferred, 
  // though parent control is better for strict state lifting)
  const [localNewBidDealerId, setLocalNewBidDealerId] = useState("")
  const [localNewBidPrice, setLocalNewBidPrice] = useState("")
  const [localNewBidComment, setLocalNewBidComment] = useState("")

  const newBidDealerId = externalNewBidDealerId ?? localNewBidDealerId
  const setNewBidDealerId = externalSetNewBidDealerId ?? setLocalNewBidDealerId
  const newBidPrice = externalNewBidPrice ?? localNewBidPrice
  const setNewBidPrice = externalSetNewBidPrice ?? setLocalNewBidPrice
  const newBidComment = externalNewBidComment ?? localNewBidComment
  const setNewBidComment = externalSetNewBidComment ?? setLocalNewBidComment

  const handleAddBid = () => {
    // If using local state, we might need to wrap the handler to pass data, 
    // but the parent handler in e2e-management.tsx reads from parent state.
    // Assuming parent manages state for now based on previous refactor context.
    onAddBid()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lịch sử trả giá</DialogTitle>
          <DialogDescription>
            {selectedLead ? formatCarInfo(selectedLead) : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Add New Bid Section */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h4 className="font-medium text-sm">Thêm giá thủ công</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Dealer</Label>
                <Select value={newBidDealerId} onValueChange={setNewBidDealerId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Chọn dealer" />
                  </SelectTrigger>
                  <SelectContent>
                    {dealers.map((dealer) => (
                      <SelectItem key={dealer.id} value={dealer.id}>
                        {dealer.name} {dealer.group_zalo_name ? `(${dealer.group_zalo_name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Giá (k)</Label>
                <Input
                  type="number"
                  placeholder="VD: 500000"
                  value={newBidPrice}
                  onChange={(e) => setNewBidPrice(e.target.value)}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Input
                  placeholder="Ghi chú..."
                  value={newBidComment}
                  onChange={(e) => setNewBidComment(e.target.value)}
                  className="bg-white"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleAddBid}
                  disabled={!newBidDealerId || !newBidPrice || creatingBiddingManual}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {creatingBiddingManual ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Thêm
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dealer</TableHead>
                  <TableHead>Giá</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingBiddingHistory ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : biddingHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      Chưa có lịch sử trả giá
                    </TableCell>
                  </TableRow>
                ) : (
                  biddingHistory.map((bid) => (
                    <TableRow key={bid.id}>
                      <TableCell className="font-medium">
                        <div>{bid.dealer_name}</div>
                        <div className="text-xs text-gray-500">
                          {dealers.find((d) => d.id === bid.dealer_id)?.group_zalo_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingBiddingId === bid.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={editingPrice}
                              onChange={(e) => setEditingPrice?.(e.target.value)}
                              className="w-32 h-8"
                            />
                            <Button
                              size="sm"
                              onClick={() => onUpdateBid?.(bid.id)}
                              disabled={updatingBidding}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="font-semibold text-orange-600">
                            {formatPrice(bid.price)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatDate(bid.created_at)}
                      </TableCell>
                      <TableCell>
                        {bid.comment || "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (editingBiddingId === bid.id) {
                              setEditingBiddingId?.(null)
                            } else {
                              setEditingBiddingId?.(bid.id)
                              setEditingPrice?.(bid.price.toString())
                            }
                          }}
                        >
                          <Pencil className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
