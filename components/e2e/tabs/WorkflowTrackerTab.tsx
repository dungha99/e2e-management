"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, DollarSign, Play, Zap, Search, MessageCircle } from "lucide-react"
import { Lead } from "../types"
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
  onViewZaloChat: () => void
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
}

export function WorkflowTrackerTab({
  selectedLead,
  activeWorkflowView,
  onWorkflowViewChange,
  onSendFirstMessage,
  sendingMessage,
  onViewZaloChat,
  onViewBiddingHistory,
  onCreateSession,
  creatingSession,
  onBotToggle,
  togglingBot,
  onViewDecoyWeb,
  onRenameLead,
  renamingLead,
  onOpenWorkflow2,
  onOpenDecoyDialog
}: WorkflowTrackerTabProps) {
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
          <div className="flex items-start justify-around mb-8">
            {/* Tin nhắn đầu */}
            <div className="flex flex-col items-center gap-3">
              <WorkflowStep
                icon={<CheckCircle className="w-8 h-8" />}
                title="Tin nhắn đầu"
                status={selectedLead.has_enough_images ? "Đã có ảnh" : "Chưa có ảnh"}
                isCompleted={selectedLead.has_enough_images || false}
                onClick={onViewZaloChat}
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
            <div className="flex flex-col items-center gap-3">
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
            <div className="flex flex-col items-center gap-3">
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

            {/* E2E Bot */}
            <div className="flex flex-col items-center gap-3">
              <WorkflowStep
                icon={<Zap className="w-8 h-8" />}
                title="E2E Bot"
                status={selectedLead.bot_active ? "Bot đang chạy" : "Bot chưa chạy"}
                isCompleted={selectedLead.bot_active || false}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBotToggle(!selectedLead.bot_active)}
                disabled={togglingBot}
                className={`text-xs ${selectedLead.bot_active ? "bg-red-50 text-red-600 hover:bg-red-100" : ""}`}
              >
                {togglingBot ? "Đang xử lý..." : selectedLead.bot_active ? "Tắt Bot" : "Bật Bot"}
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
          <div className="flex items-start justify-around mb-8">
            {/* Tạo Phiên 2 */}
            <div className="flex flex-col items-center gap-3">
              <WorkflowStep
                icon={<Play className={`w-8 h-8 ${selectedLead.workflow2_is_active ? "text-green-600" : "text-gray-400"}`} />}
                title="Tạo Phiên 2"
                status={selectedLead.workflow2_is_active ? "Đã kích hoạt" : "Chưa kích hoạt"}
                isCompleted={selectedLead.workflow2_is_active === true}
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
      <div className="grid grid-cols-2 gap-4">
        {/* Contact Info */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Thông tin liên hệ</h4>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-gray-500">Số điện thoại</p>
              <p className="text-sm font-medium text-gray-900">
                {selectedLead.phone ? maskPhone(selectedLead.phone) : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Biển số xe</p>
              <p className="text-sm font-medium text-gray-900">{selectedLead.plate || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">SKU</p>
              <p className="text-sm font-medium text-gray-900">{selectedLead.sku || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Số km</p>
              <p className="text-sm font-medium text-gray-900">
                {selectedLead.mileage ? `${selectedLead.mileage.toLocaleString()} km` : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Ngày tạo xe</p>
              <p className="text-sm font-medium text-gray-900">
                {selectedLead.car_created_at ? new Date(selectedLead.car_created_at).toLocaleDateString("vi-VN") : "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Price Info */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Thông tin giá</h4>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-gray-500">Giá khách mong muốn</p>
              <p className="text-sm font-semibold text-emerald-600">
                {selectedLead.price_customer ? formatPrice(selectedLead.price_customer) : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Giá cao nhất (Dealer)</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-blue-600">
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
        </div>
      </div>
    </>
  )
}
