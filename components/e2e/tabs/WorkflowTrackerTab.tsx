"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, DollarSign, Play, Zap, Search, MessageCircle, Loader2, ChevronRight, Check, X, Car, User, Phone, Copy, ChevronDown, ChevronUp } from "lucide-react"
import { Lead, BiddingHistory } from "../types"
import { formatPrice, parseShorthandPrice, formatPriceForEdit } from "../utils"
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
      className={`flex flex-col items-center gap-2 sm:gap-3 ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
      onClick={onClick}
    >
      <div
        className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-colors ${isCompleted
          ? "bg-emerald-100 text-emerald-600 border-2 border-emerald-600"
          : "bg-gray-100 text-gray-400 border-2 border-gray-300"
          }`}
      >
        {icon}
      </div>
      <div className="text-center">
        <p className="font-medium text-xs sm:text-sm text-gray-900">{title}</p>
        <p className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 ${isCompleted ? "text-emerald-600" : "text-gray-500"}`}>
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
  loadingBiddingHistory = false
}: WorkflowTrackerTabProps) {
  // Local state for inline editing
  const [editingBidId, setEditingBidId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState("")
  const [savingBid, setSavingBid] = useState(false)

  // State for expand/collapse dealer bids
  const [isExpanded, setIsExpanded] = useState(false)
  // State for copy feedback
  const [copied, setCopied] = useState(false)

  // Get top 5 bids sorted by price (descending)
  const topBids = [...biddingHistory]
    .filter(bid => bid.price > 1) // Filter out "sent but no price" entries
    .sort((a, b) => b.price - a.price)
    .slice(0, 5)

  // Get all valid bids for expanded view
  const allValidBids = [...biddingHistory]
    .filter(bid => bid.price > 1)
    .sort((a, b) => b.price - a.price)

  // Bids to display based on expand state
  const displayBids = isExpanded ? allValidBids : topBids

  // Generate copy content with car information and dealer bids
  const generateCopyContent = (): string => {
    const now = new Date()
    const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    const dateStr = now.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })

    // Build car info parts
    const carInfoParts = []
    if (selectedLead.brand) carInfoParts.push(selectedLead.brand)
    if (selectedLead.model) carInfoParts.push(selectedLead.model)
    if (selectedLead.year) carInfoParts.push(selectedLead.year.toString())
    const carInfo = carInfoParts.join(" ") || "N/A"

    // Build odo string
    const odoStr = selectedLead.mileage ? `${selectedLead.mileage.toLocaleString("vi-VN")} km` : "N/A"

    // Build region - currently using default since Lead doesn't have region field
    const region = "TP.HCM"

    // Build price
    const priceStr = selectedLead.price_customer
      ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(selectedLead.price_customer)
      : "N/A"

    // Build dealer bids list
    const dealerBidsStr = allValidBids
      .map(bid => {
        const priceInMillion = Math.round(bid.price / 1000000)
        return `${bid.dealer_name} - ${priceInMillion}tr`
      })
      .join("\n")

    return `Thời gian nhận thông tin: ${timeStr} ${dateStr}
Thông tin chi tiết xe: ${carInfo.toLowerCase()}
Số km đã đi (Odo): ${odoStr}
Khu vực:  - ${region}
Car_id: ${selectedLead.car_id || "N/A"}
Giá mong muốn: ${priceStr}

${dealerBidsStr}`
  }

  const handleCopy = async () => {
    const content = generateCopyContent()
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handleStartEdit = (bid: BiddingHistory) => {
    setEditingBidId(bid.id)
    // Display as shorthand (e.g., 500000000 -> "500")
    setEditingPrice(formatPriceForEdit(bid.price))
  }

  const handleCancelEdit = () => {
    setEditingBidId(null)
    setEditingPrice("")
  }

  const handleSaveEdit = async (bidId: string) => {
    if (!onUpdateBid || !editingPrice) return

    // Parse shorthand price (e.g., 500 -> 500000000)
    const newPrice = parseShorthandPrice(editingPrice)
    if (newPrice === undefined || newPrice < 1) return

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
      <div className="bg-white rounded-lg p-3 sm:p-5 shadow-sm">
        {/* Header - Stack on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h3 className="text-sm font-semibold text-gray-900">Tiến độ quy trình</h3>
            {(selectedLead.bidding_session_count || 0) > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-gray-600 hidden sm:inline">Đang xem:</span>
                <button
                  onClick={() => onWorkflowViewChange("purchase")}
                  className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-colors ${activeWorkflowView === "purchase"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  Thu Mua
                </button>
                <button
                  onClick={() => onWorkflowViewChange("seeding")}
                  className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-colors ${activeWorkflowView === "seeding"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  Seeding
                </button>
              </div>
            )}
          </div>
          {selectedLead.session_created && selectedLead.workflow2_is_active === false && (
            <Button
              variant="default"
              size="sm"
              onClick={onOpenWorkflow2}
              className="bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm w-full sm:w-auto"
            >
              Kích hoạt WF 2
            </Button>
          )}
        </div>

        {/* Workflow Steps */}
        {/* Workflow Steps - Horizontally scrollable on mobile */}
        {activeWorkflowView === "purchase" ? (
          <div className="overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-thin">
            <div className="flex items-start justify-between gap-3 sm:gap-4 mb-4 sm:mb-8 min-w-[500px] sm:min-w-0 px-1 sm:px-4">
              {/* Tin nhắn đầu */}
              <div className="flex flex-col items-center gap-2 sm:gap-3 flex-1">
                <WorkflowStep
                  icon={<CheckCircle className="w-6 h-6 sm:w-8 sm:h-8" />}
                  title="Tin nhắn đầu"
                  status={selectedLead.has_enough_images ? "Đã có ảnh" : "Chưa có ảnh"}
                  isCompleted={selectedLead.has_enough_images || false}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSendFirstMessage}
                  disabled={sendingMessage || selectedLead.first_message_sent}
                  className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                >
                  {sendingMessage ? "Đang gửi..." : selectedLead.first_message_sent ? "Đã gửi" : "Gửi tin nhắn đầu"}
                </Button>
              </div>

              {/* Chào Dealer */}
              <div className="flex flex-col items-center gap-2 sm:gap-3 flex-1">
                <WorkflowStep
                  icon={<DollarSign className="w-6 h-6 sm:w-8 sm:h-8" />}
                  title="Chào Dealer"
                  status={selectedLead.dealer_bidding?.status === "got_price" ? "Đã có giá" : "Chưa có giá"}
                  isCompleted={selectedLead.dealer_bidding?.status === "got_price"}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onViewBiddingHistory}
                  disabled={!selectedLead.car_id}
                  className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                >
                  Xem lịch sử giá
                </Button>
              </div>

              {/* Tạo Phiên */}
              <div className="flex flex-col items-center gap-2 sm:gap-3 flex-1">
                <WorkflowStep
                  icon={<Play className="w-6 h-6 sm:w-8 sm:h-8" />}
                  title="Tạo Phiên"
                  status={selectedLead.session_created ? "Phiên đã tạo" : "Chưa tạo phiên"}
                  isCompleted={selectedLead.session_created || false}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCreateSession}
                  disabled={creatingSession || selectedLead.session_created}
                  className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                >
                  {creatingSession ? "Đang tạo..." : selectedLead.session_created ? "Đã tạo" : "Tạo Phiên"}
                </Button>
              </div>

              {/* Decoy Web */}
              <div className="flex flex-col items-center gap-2 sm:gap-3">
                <WorkflowStep
                  icon={<Search className="w-6 h-6 sm:w-8 sm:h-8" />}
                  title="Decoy Web"
                  status={`${selectedLead.decoy_thread_count || 0} threads`}
                  isCompleted={(selectedLead.decoy_thread_count || 0) > 0}
                  onClick={onViewDecoyWeb}
                />
              </div>
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
          <div className="flex items-center gap-3 mt-2 sm:mt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onRenameLead}
              disabled={renamingLead || !selectedLead?.pic_id}
              className="text-gray-700 text-xs sm:text-sm w-full sm:w-auto"
            >
              {renamingLead ? "Đang đổi tên..." : "Đổi tên Lead"}
            </Button>
          </div>
        )}
      </div>

      {/* Additional Info Cards */}
      <div className="mt-4 sm:mt-6">
        {/* Price Info - Minimal Style with Subtle Decorations */}
        <div className="bg-white rounded-lg p-3 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-medium text-gray-900">Thông tin giá & Thống kê</h4>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewBiddingHistory}
              disabled={!selectedLead.car_id}
              className="text-[10px] sm:text-xs text-gray-500 hover:text-gray-700 h-6 px-1.5 sm:px-2"
            >
              Xem chi tiết →
            </Button>
          </div>

          {/* Stats Row - 2 cols on mobile, 4 cols on larger screens */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-5 pb-4 sm:pb-5 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
                <User className="h-3 w-3 text-gray-400" />
                <p className="text-[10px] sm:text-xs text-gray-400">Đã gửi</p>
              </div>
              <p className="text-lg sm:text-xl font-semibold text-gray-900">{biddingHistory.length}</p>
              <p className="text-[10px] text-gray-400">dealers</p>
            </div>
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
                <Zap className="h-3 w-3 text-gray-400" />
                <p className="text-[10px] sm:text-xs text-gray-400">Tỷ lệ phản hồi</p>
              </div>
              <p className="text-lg sm:text-xl font-semibold text-gray-900">
                {biddingHistory.length > 0
                  ? `${Math.round((topBids.length / biddingHistory.length) * 100)}%`
                  : "—"}
              </p>
              <p className="text-[10px] text-gray-400">{topBids.length}/{biddingHistory.length} có giá</p>
            </div>
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
                <DollarSign className="h-3 w-3 text-emerald-500" />
                <p className="text-[10px] sm:text-xs text-gray-400">Giá khách</p>
              </div>
              <p className="text-lg sm:text-xl font-semibold text-emerald-700">
                {selectedLead.price_customer ? formatPrice(selectedLead.price_customer) : "—"}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
                <DollarSign className="h-3 w-3 text-blue-500" />
                <p className="text-[10px] sm:text-xs text-gray-400">Giá cao nhất</p>
              </div>
              <div className="flex items-center gap-1">
                <p className="text-lg sm:text-xl font-semibold text-blue-700">
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

          {/* Two Column Layout - Stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Top Bids */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                  Top Dealer Bids
                  {allValidBids.length > 5 && (
                    <span className="text-[10px] text-gray-400">({allValidBids.length})</span>
                  )}
                </h5>
                <div className="flex items-center gap-1">
                  {/* Copy button */}
                  <button
                    onClick={handleCopy}
                    className={`p-1 rounded transition-colors ${copied
                      ? "text-emerald-600 bg-emerald-50"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      }`}
                    title={copied ? "Đã copy!" : "Copy thông tin"}
                    disabled={allValidBids.length === 0}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  {/* Expand/Collapse button */}
                  {allValidBids.length > 5 && (
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      title={isExpanded ? "Thu gọn" : "Xem tất cả"}
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              {loadingBiddingHistory ? (
                <div className="flex items-center py-4 text-gray-400">
                  <Loader2 className="h-3 w-3 animate-spin mr-2" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : displayBids.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">Chưa có giá</p>
              ) : (
                <div className={`space-y-0.5 ${isExpanded ? "max-h-[300px] overflow-y-auto scrollbar-thin" : ""}`}>
                  {displayBids.map((bid, index) => (
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
