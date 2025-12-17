"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, DollarSign, Play, Zap, Search, MessageCircle, Loader2, ChevronRight, Check, X, Car, User, Phone, FileText, Pencil } from "lucide-react"
import { Lead, BiddingHistory } from "../types"
import { formatPrice } from "../utils"
import { maskPhone } from "@/lib/utils"

interface WorkflowStepProps {
  icon: React.ReactNode
  title: string
  status: string
  isCompleted?: boolean
  onClick?: () => void
}

function WorkflowStep({ icon, title, status, isCompleted = false, onClick }: WorkflowStepProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
      onClick={onClick}
    >
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isCompleted
          ? "bg-emerald-100 text-emerald-600 border-2 border-emerald-600"
          : "bg-gray-100 text-gray-400 border-2 border-gray-300"
          }`}
      >
        {icon}
      </div>
      <div className="text-center">
        <p className="font-medium text-sm text-gray-900">{title}</p>
        <p className={`text-xs mt-1 ${isCompleted ? "text-emerald-600" : "text-gray-500"}`}>
          {status}
        </p>
      </div>
    </div>
  )
}

interface WorkflowTrackerTabProps {
  selectedLead: Lead
  activeWorkflowView: "purchase" | "seeding"
  onWorkflowViewChange: (view: "purchase" | "seeding") => void

  // Purchase workflow handlers
  onSendFirstMessage: () => void
  sendingMessage: boolean
  onViewBiddingHistory: () => void
  onCreateSession: () => void
  creatingSession: boolean
  onBotToggle: (active: boolean) => void
  togglingBot: boolean
  onViewDecoyWeb: () => void
  onRenameLead: () => void
  renamingLead: boolean

  // Seeding/WF2 Props
  workflow2Data?: any
  onOpenWorkflow2: () => void
  onOpenDecoyDialog: () => void

  // Dealer Bidding Props
  biddingHistory?: BiddingHistory[]
  onUpdateBid?: (bidId: string, newPrice: number) => Promise<void>
  loadingBiddingHistory?: boolean

  // Notes editing
  onUpdateNotes?: (notes: string) => Promise<void>
}

export function WorkflowTrackerTab({
  selectedLead,
  activeWorkflowView,
  onWorkflowViewChange,
  onSendFirstMessage,
  sendingMessage,
  onViewBiddingHistory,
  onCreateSession,
  creatingSession,
  onBotToggle,
  togglingBot,
  onViewDecoyWeb,
  onRenameLead,
  renamingLead,
  onOpenWorkflow2,
  onOpenDecoyDialog,
  biddingHistory = [],
  onUpdateBid,
  loadingBiddingHistory = false,
  onUpdateNotes
}: WorkflowTrackerTabProps) {
  // Local state for inline editing
  const [editingBidId, setEditingBidId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState("")
  const [savingBid, setSavingBid] = useState(false)

  // Notes editing state
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [editedNotes, setEditedNotes] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)

  // Get top 5 bids sorted by price (descending)
  const topBids = [...biddingHistory]
    .filter(bid => bid.price > 1) // Filter out "sent but no price" entries
    .sort((a, b) => b.price - a.price)
    .slice(0, 5)

  const handleStartEdit = (bid: BiddingHistory) => {
    setEditingBidId(bid.id)
    setEditingPrice(bid.price.toString())
  }

  const handleCancelEdit = () => {
    setEditingBidId(null)
    setEditingPrice("")
  }

  const handleSaveEdit = async (bidId: string) => {
    if (!onUpdateBid || !editingPrice) return

    const newPrice = parseInt(editingPrice.replace(/\D/g, ""), 10)
    if (isNaN(newPrice) || newPrice < 1) return

    setSavingBid(true)
    try {
      await onUpdateBid(bidId, newPrice)
      setEditingBidId(null)
      setEditingPrice("")
    } finally {
      setSavingBid(false)
    }
  }

  // Notes editing handlers
  const handleStartEditNotes = () => {
    setEditedNotes(selectedLead.notes || "")
    setIsEditingNotes(true)
  }

  const handleCancelEditNotes = () => {
    setIsEditingNotes(false)
    setEditedNotes("")
  }

  const handleSaveNotes = async () => {
    if (!onUpdateNotes) return

    setSavingNotes(true)
    try {
      await onUpdateNotes(editedNotes)
      setIsEditingNotes(false)
      setEditedNotes("")
    } finally {
      setSavingNotes(false)
    }
  }

  return (
    <>
      {/* Workflow Tracker */}
      <div className="bg-white rounded-lg p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">Tiến độ quy trình</h3>
            {(selectedLead.bidding_session_count || 0) > 0 && (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm text-gray-600">Đang xem:</span>
                <button
                  onClick={() => onWorkflowViewChange("purchase")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeWorkflowView === "purchase"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  Quy trình Thu Mua
                </button>
                <button
                  onClick={() => onWorkflowViewChange("seeding")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeWorkflowView === "seeding"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  Quy trình Seeding (WF2)
                </button>
              </div>
            )}
          </div>
          {selectedLead.session_created && selectedLead.workflow2_is_active === false && (
            <Button
              variant="default"
              size="sm"
              onClick={onOpenWorkflow2}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Kích hoạt WF 2
            </Button>
          )}
        </div>

        {/* Workflow Steps */}
        {activeWorkflowView === "purchase" ? (
          <div className="flex items-center justify-between gap-2 mb-8 px-4">
            {/* Tin nhắn đầu */}
            <div className="flex flex-col items-center gap-3 flex-1">
              <WorkflowStep
                icon={<CheckCircle className="w-8 h-8" />}
                title="Tin nhắn đầu"
                status={selectedLead.has_enough_images ? "Đã có ảnh" : "Chưa có ảnh"}
                isCompleted={selectedLead.has_enough_images || false}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={onSendFirstMessage}
                disabled={sendingMessage || selectedLead.first_message_sent}
                className="text-xs"
              >
                {sendingMessage ? "Đang gửi..." : selectedLead.first_message_sent ? "Đã gửi" : "Gửi tin nhắn đầu"}
              </Button>
            </div>

            {/* Chào Dealer */}
            <div className="flex flex-col items-center gap-3 flex-1">
              <WorkflowStep
                icon={<DollarSign className="w-8 h-8" />}
                title="Chào Dealer"
                status={selectedLead.dealer_bidding?.status === "got_price" ? "Đã có giá Dealer" : "Chưa có giá"}
                isCompleted={selectedLead.dealer_bidding?.status === "got_price"}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={onViewBiddingHistory}
                disabled={!selectedLead.car_id}
                className="text-xs"
              >
                Xem lịch sử giá
              </Button>
            </div>

            {/* Tạo Phiên */}
            <div className="flex flex-col items-center gap-3 flex-1">
              <WorkflowStep
                icon={<Play className="w-8 h-8" />}
                title="Tạo Phiên"
                status={selectedLead.session_created ? "Phiên đã tạo" : "Chưa tạo phiên"}
                isCompleted={selectedLead.session_created || false}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={onCreateSession}
                disabled={creatingSession || selectedLead.session_created}
                className="text-xs"
              >
                {creatingSession ? "Đang tạo..." : selectedLead.session_created ? "Đã tạo" : "Tạo Phiên"}
              </Button>
            </div>

            {/* Decoy Web */}
            <div className="flex flex-col items-center gap-3">
              <WorkflowStep
                icon={<Search className="w-8 h-8" />}
                title="Decoy Web"
                status={`${selectedLead.decoy_thread_count || 0} threads`}
                isCompleted={(selectedLead.decoy_thread_count || 0) > 0}
                onClick={onViewDecoyWeb}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-8 mb-8 px-4">
            {/* Tạo Phiên 2 */}
            <div className="flex flex-col items-center gap-3">
              <WorkflowStep
                icon={<Play className={`w-8 h-8 ${selectedLead.has_active_campaigns ? "text-green-600" : selectedLead.workflow2_is_active ? "text-green-600" : "text-gray-400"}`} />}
                title="Tạo Phiên 2"
                status={selectedLead.has_active_campaigns ? "Có campaign đang chạy" : selectedLead.workflow2_is_active ? "Đã kích hoạt" : "Chưa kích hoạt"}
                isCompleted={selectedLead.has_active_campaigns || selectedLead.workflow2_is_active === true}
              />
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled
              >
                Chạy ngay
              </Button>
            </div>

            {/* Decoy Zalo */}
            <div className="flex flex-col items-center gap-3">
              <WorkflowStep
                icon={<MessageCircle className="w-8 h-8" />}
                title="Decoy Zalo"
                status="Tương tác Zalo ảo"
                isCompleted={false}
              />
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={onOpenDecoyDialog}
              >
                Mở Zalo Decoy
              </Button>
            </div>
          </div>
        )}

        {/* Other Action Buttons - Only for purchase workflow */}
        {activeWorkflowView === "purchase" && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onRenameLead}
              disabled={renamingLead || !selectedLead?.pic_id}
              className="text-gray-700"
            >
              {renamingLead ? "Đang đổi tên..." : "Đổi tên Lead"}
            </Button>
          </div>
        )}
      </div>

      {/* Additional Info Cards */}
      <div className="grid grid-cols-2 gap-6 mt-6">
        {/* Notes Section */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Ghi chú
            </h4>
            {!isEditingNotes && onUpdateNotes && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-gray-500 hover:text-blue-600"
                onClick={handleStartEditNotes}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Sửa
              </Button>
            )}
          </div>

          {isEditingNotes ? (
            <div className="space-y-3">
              <Textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                placeholder="Nhập ghi chú..."
                className="min-h-[120px] text-sm resize-none"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEditNotes}
                  disabled={savingNotes}
                  className="h-8"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Hủy
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="h-8 bg-blue-600 hover:bg-blue-700"
                >
                  {savingNotes ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Lưu
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="min-h-[80px]">
              {selectedLead.notes ? (
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedLead.notes}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">Chưa có ghi chú</p>
              )}
            </div>
          )}
        </div>

        {/* Price Info - Enhanced */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Thông tin giá
          </h4>

          {/* Main Price Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-emerald-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Giá khách mong muốn</p>
              <p className="text-lg font-bold text-emerald-600">
                {selectedLead.price_customer ? formatPrice(selectedLead.price_customer) : "N/A"}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Giá cao nhất (Dealer)</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-blue-600">
                  {selectedLead.dealer_bidding?.maxPrice ? formatPrice(selectedLead.dealer_bidding.maxPrice) : "N/A"}
                </p>
                {selectedLead.dealer_bidding?.status === "got_price" &&
                  selectedLead.price_customer &&
                  selectedLead.dealer_bidding?.maxPrice &&
                  selectedLead.dealer_bidding.maxPrice > selectedLead.price_customer && (
                    <Badge variant="destructive" className="text-xs">Override</Badge>
                  )}
              </div>
            </div>
          </div>

          {/* Dealer Bidding Details */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Chi tiết giá Dealer
              </h5>
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewBiddingHistory}
                disabled={!selectedLead.car_id}
                className="text-xs text-blue-600 hover:text-blue-700 h-6 px-2"
              >
                Xem tất cả
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>

            {loadingBiddingHistory ? (
              <div className="flex items-center justify-center py-4 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-xs">Đang tải...</span>
              </div>
            ) : topBids.length === 0 ? (
              <div className="text-center py-4 text-gray-400">
                <p className="text-xs">Chưa có dealer nào trả giá</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onViewBiddingHistory}
                  disabled={!selectedLead.car_id}
                  className="mt-2 text-xs"
                >
                  Xem lịch sử giá
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {topBids.map((bid, index) => (
                  <div
                    key={bid.id}
                    className={`flex items-center justify-between py-2 px-3 rounded-lg ${index === 0 ? "bg-blue-50 border border-blue-100" : "bg-gray-50"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      {index === 0 && (
                        <span className="text-xs font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                          TOP
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-900">{bid.dealer_name}</span>
                    </div>

                    {editingBidId === bid.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="text"
                          value={editingPrice}
                          onChange={(e) => setEditingPrice(e.target.value)}
                          className="h-7 w-28 text-sm text-right"
                          placeholder="Nhập giá"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => handleSaveEdit(bid.id)}
                          disabled={savingBid}
                        >
                          {savingBid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={handleCancelEdit}
                          disabled={savingBid}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 group">
                        <span className={`text-sm font-semibold ${index === 0 ? "text-blue-600" : "text-gray-700"}`}>
                          {formatPrice(bid.price)}
                        </span>
                        {onUpdateBid && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleStartEdit(bid)}
                          >
                            <span className="text-xs">✏️</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
