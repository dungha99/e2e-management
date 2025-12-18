"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, DollarSign, Play, Zap, Search, MessageCircle, Loader2, ChevronRight, Check, X, Car, User, Phone } from "lucide-react"
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
  loadingBiddingHistory = false
}: WorkflowTrackerTabProps) {
  // Local state for inline editing
  const [editingBidId, setEditingBidId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState("")
  const [savingBid, setSavingBid] = useState(false)



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



  return (
    <>
      {/* Workflow Tracker */}
      <div className="bg-white rounded-lg p-5 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900">Tiến độ quy trình</h3>
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
      <div className="mt-6">
        {/* Price Info - Minimal Style with Subtle Decorations */}
        <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-gray-900">Thông tin giá & Thống kê</h4>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewBiddingHistory}
              disabled={!selectedLead.car_id}
              className="text-xs text-gray-500 hover:text-gray-700 h-6 px-2"
            >
              Xem chi tiết →
            </Button>
          </div>

          {/* Stats Row - Minimal with icons */}
          <div className="grid grid-cols-4 gap-4 mb-5 pb-5 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <User className="h-3 w-3 text-gray-400" />
                <p className="text-xs text-gray-400">Đã gửi</p>
              </div>
              <p className="text-xl font-semibold text-gray-900">{biddingHistory.length}</p>
              <p className="text-[10px] text-gray-400">dealers</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="h-3 w-3 text-gray-400" />
                <p className="text-xs text-gray-400">Tỷ lệ phản hồi</p>
              </div>
              <p className="text-xl font-semibold text-gray-900">
                {biddingHistory.length > 0
                  ? `${Math.round((topBids.length / biddingHistory.length) * 100)}%`
                  : "—"}
              </p>
              <p className="text-[10px] text-gray-400">{topBids.length}/{biddingHistory.length} có giá</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="h-3 w-3 text-emerald-500" />
                <p className="text-xs text-gray-400">Giá khách</p>
              </div>
              <p className="text-xl font-semibold text-emerald-700">
                {selectedLead.price_customer ? formatPrice(selectedLead.price_customer) : "—"}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="h-3 w-3 text-blue-500" />
                <p className="text-xs text-gray-400">Giá cao nhất</p>
              </div>
              <div className="flex items-center gap-1">
                <p className="text-xl font-semibold text-blue-700">
                  {selectedLead.dealer_bidding?.maxPrice ? formatPrice(selectedLead.dealer_bidding.maxPrice) : "—"}
                </p>
                {selectedLead.dealer_bidding?.status === "got_price" &&
                  selectedLead.price_customer &&
                  selectedLead.dealer_bidding?.maxPrice &&
                  selectedLead.dealer_bidding.maxPrice > selectedLead.price_customer && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 rounded">↑</span>
                  )}
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-2 gap-6">
            {/* Top Bids */}
            <div>
              <h5 className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                Top Dealer Bids
              </h5>
              {loadingBiddingHistory ? (
                <div className="flex items-center py-4 text-gray-400">
                  <Loader2 className="h-3 w-3 animate-spin mr-2" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : topBids.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">Chưa có giá</p>
              ) : (
                <div className="space-y-0.5">
                  {topBids.map((bid, index) => (
                    <div
                      key={bid.id}
                      className={`flex items-center justify-between py-1.5 px-2 rounded group transition-colors ${index === 0 ? "bg-blue-50/50" : "hover:bg-gray-50"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] w-4 h-4 flex items-center justify-center rounded-full ${index === 0 ? "bg-blue-100 text-blue-600 font-medium" : "text-gray-400"
                          }`}>
                          {index + 1}
                        </span>
                        <span className="text-xs text-gray-700 truncate max-w-[100px]">{bid.dealer_name}</span>
                      </div>
                      {editingBidId === bid.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="text"
                            value={editingPrice}
                            onChange={(e) => setEditingPrice(e.target.value)}
                            className="h-5 w-16 text-[10px] text-right border-gray-200"
                            autoFocus
                          />
                          <button
                            className="text-gray-400 hover:text-emerald-600 transition-colors"
                            onClick={() => handleSaveEdit(bid.id)}
                            disabled={savingBid}
                          >
                            {savingBid ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          </button>
                          <button
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-medium ${index === 0 ? "text-blue-600" : "text-gray-600"}`}>
                            {formatPrice(bid.price)}
                          </span>
                          {onUpdateBid && (
                            <button
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500 transition-all"
                              onClick={() => handleStartEdit(bid)}
                            >
                              <span className="text-[10px]">✎</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Suggested Dealers */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h5 className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                  Đề xuất Dealer
                </h5>
                <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1">beta</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between py-2 px-2.5 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600 group-hover:bg-gray-300 transition-colors">A</div>
                    <div>
                      <p className="text-xs text-gray-700">Auto Dealer Hà Nội</p>
                      <p className="text-[10px] text-gray-400">Thường mua dòng này</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-emerald-600">+5-10%</span>
                </div>
                <div className="flex items-center justify-between py-2 px-2.5 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600 group-hover:bg-gray-300 transition-colors">B</div>
                    <div>
                      <p className="text-xs text-gray-700">Bình Minh Motors</p>
                      <p className="text-[10px] text-gray-400">Đang tìm xe tương tự</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-emerald-600">+3-8%</span>
                </div>
                <div className="flex items-center justify-between py-2 px-2.5 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600 group-hover:bg-gray-300 transition-colors">C</div>
                    <div>
                      <p className="text-xs text-gray-700">Car Center Q7</p>
                      <p className="text-[10px] text-gray-400">Mới hoạt động mạnh</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-emerald-600">+2-5%</span>
                </div>
              </div>
              <p className="text-[9px] text-gray-300 mt-2 italic">* Dựa trên lịch sử giao dịch</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
