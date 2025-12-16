"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Loader2, User, PhoneCall, Pencil, Clock, RefreshCw, Star, Zap, MessageSquare, Car } from "lucide-react"
import { Lead } from "../types"
import { formatCarInfo, formatPrice, formatDate } from "../utils"
import { WorkflowTrackerTab } from "../tabs/WorkflowTrackerTab"
import { ZaloChatTab } from "../tabs/ZaloChatTab"
import { DecoyWebTab } from "../tabs/DecoyWebTab"
import { RecentActivityTab } from "../tabs/RecentActivityTab"
import { DecoyHistoryTab } from "../tabs/DecoyHistoryTab"
import { Workflow2Dialog } from "../dialogs/Workflow2Dialog"

interface LeadDetailPanelProps {
  selectedAccount: string | null
  selectedLead: Lead | null
  isMobile: boolean
  mobileView: "list" | "detail"

  // Tab State
  activeDetailView: "workflow" | "decoy-web" | "zalo-chat" | "recent-activity" | "decoy-history"
  onActiveDetailViewChange: (view: "workflow" | "decoy-web" | "zalo-chat" | "recent-activity" | "decoy-history") => void

  // Actions
  onTogglePrimary: (lead: Lead, e: React.MouseEvent) => Promise<void>
  updatingPrimary: boolean

  onSyncLead: () => Promise<void>
  syncing: boolean

  onShowDetail: () => void

  onCallBot: (action: 'CHECK_VAR' | 'FIRST_CALL') => Promise<void>
  callingBot: boolean

  onQuickEdit: (lead: Lead, e: React.MouseEvent) => void
  onOpenInspection: () => void

  // Workflow Tab Props
  workflow2Data: any
  workflow2Open: boolean
  setWorkflow2Open: (open: boolean) => void
  onDecoyDialog: () => void
  onOpenWorkflowDialog: () => void

  // Workflow Props
  onSendFirstMessage: (message: string) => Promise<void>
  sendingMessage: boolean

  onViewBiddingHistory: () => void

  onCreateSession: () => void
  creatingSession: boolean

  onBotToggle: (active: boolean) => Promise<void>
  togglingBot: boolean

  onRenameLead: () => void
  renamingLead: boolean

  onOpenCreateThread: () => void

  // Workflow View State
  activeWorkflowView: "purchase" | "seeding"
  onWorkflowViewChange: (view: "purchase" | "seeding") => void

  // ZaloChatTab Props
  chatMessages: any[]
  onUpdateLeadBotStatus: (botActive: boolean) => void

  // Dealer Bidding Props
  biddingHistory?: any[]
  onUpdateBid?: (bidId: string, newPrice: number) => Promise<void>
  loadingBiddingHistory?: boolean
}

export function LeadDetailPanel({
  selectedAccount,
  selectedLead,
  isMobile,
  mobileView,
  activeDetailView,
  onActiveDetailViewChange,
  onTogglePrimary,
  updatingPrimary,
  onQuickEdit,
  onSyncLead,
  syncing,
  onShowDetail,
  onCallBot,
  callingBot,
  onOpenInspection,
  workflow2Data,
  workflow2Open,
  setWorkflow2Open,
  onDecoyDialog,
  onOpenCreateThread,
  onOpenWorkflowDialog,

  // Workflow handlers
  onSendFirstMessage,
  sendingMessage,
  onViewBiddingHistory,
  onCreateSession,
  creatingSession,
  onBotToggle,
  togglingBot,
  onRenameLead,
  renamingLead,
  activeWorkflowView,
  onWorkflowViewChange,
  chatMessages,
  onUpdateLeadBotStatus,
  // Dealer Bidding
  biddingHistory,
  onUpdateBid,
  loadingBiddingHistory
}: LeadDetailPanelProps) {

  // If hidden on mobile list view
  if (!(!isMobile || mobileView === 'detail')) {
    return null
  }

  if (!selectedAccount) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
        <User className="h-24 w-24 text-gray-300 mb-4" />
        <p className="text-lg font-medium">Chọn tài khoản để bắt đầu</p>
        <p className="text-sm mt-2">Vui lòng chọn tài khoản từ menu phía trên</p>
      </div>
    )
  }

  if (!selectedLead) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
        <User className="h-24 w-24 text-gray-300 mb-4" />
        <p className="text-lg font-medium">Chọn lead để xem chi tiết</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col ">
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-8 pt-6 pb-6 border-b sticky top-0 z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {/* Car Image Thumbnail */}
              <div className="w-40 aspect-[3/2] rounded-lg border-2 border-gray-200 bg-gray-100 overflow-hidden flex items-center justify-center shadow-sm">
                {(() => {
                  // Try to get the first available car image
                  let carImageUrl: string | null = null;

                  // First priority: direct image field
                  if (selectedLead.image) {
                    carImageUrl = selectedLead.image;
                  }
                  // Second priority: first image from additional_images
                  else if (selectedLead.additional_images) {
                    const images = selectedLead.additional_images;
                    // Try outside images first (usually exterior shots)
                    if (images.outside && images.outside.length > 0) {
                      carImageUrl = images.outside[0].url;
                    }
                    // Then try other categories
                    else {
                      for (const category of ['inside', 'paper'] as const) {
                        if (images[category] && images[category]!.length > 0) {
                          carImageUrl = images[category]![0].url;
                          break;
                        }
                      }
                    }
                  }

                  if (carImageUrl) {
                    return (
                      <img
                        src={carImageUrl}
                        alt={`${selectedLead.brand || ''} ${selectedLead.model || ''}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Replace with placeholder on error
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    );
                  }
                  return null;
                })()}
                <div className={`flex flex-col items-center justify-center ${selectedLead.image || selectedLead.additional_images ? 'hidden' : ''}`}>
                  <Car className="h-8 w-8 text-gray-400" />
                  <span className="text-[10px] text-gray-400 mt-1">No image</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{selectedLead.name}</h2>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 border border-gray-200">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 hover:bg-transparent"
                      onClick={(e) => onTogglePrimary(selectedLead, e)}
                      disabled={updatingPrimary || !selectedLead.car_id}
                      title={selectedLead.is_primary ? "Bỏ đánh dấu Primary" : "Đánh dấu là Primary"}
                    >
                      {updatingPrimary ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      ) : (
                        <Star
                          className={`h-4 w-4 ${selectedLead.is_primary
                            ? "fill-purple-600 text-purple-600"
                            : "text-gray-400 hover:text-gray-500"
                            }`}
                        />
                      )}
                    </Button>
                    <span className={`text-xs font-medium ${selectedLead.is_primary
                      ? "text-purple-600"
                      : "text-gray-600"
                      }`}>
                      {selectedLead.is_primary ? "Ưu tiên" : "Nuôi dưỡng"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-transparent text-gray-400 hover:text-blue-600"
                    onClick={(e) => onQuickEdit(selectedLead, e)}
                    title="Chỉnh sửa nhanh"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {formatDate(selectedLead.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-base font-medium text-gray-700">
                    {formatCarInfo(selectedLead)}
                  </p>
                  {selectedLead.price_customer && (
                    <span className="text-emerald-600 font-semibold">
                      {formatPrice(selectedLead.price_customer)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onSyncLead}
                disabled={syncing}
                className="text-gray-600"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Đang đồng bộ..." : "Đồng bộ"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onShowDetail}
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
              >
                Chi tiết
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={callingBot}
                    className="text-orange-600 border-orange-600 hover:bg-orange-50"
                  >
                    {callingBot ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <PhoneCall className="h-4 w-4 mr-2" />
                        GỌI BOT
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => onCallBot('CHECK_VAR')}>
                    Check Var (Còn bán không?)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCallBot('FIRST_CALL')}>
                    First Call (Lấy thông tin)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={onOpenInspection}
              >
                Đặt lịch KD
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 border-b -mb-6">
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeDetailView === "workflow"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              onClick={() => onActiveDetailViewChange("workflow")}
            >
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Workflow Tracker
              </div>
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeDetailView === "decoy-web"
                ? "text-orange-600 border-orange-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              onClick={() => onActiveDetailViewChange("decoy-web")}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Decoy Web Chat
                {(selectedLead.decoy_thread_count || 0) > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 text-xs">
                    {selectedLead.decoy_thread_count}
                  </span>
                )}
              </div>
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeDetailView === "zalo-chat"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              onClick={() => onActiveDetailViewChange("zalo-chat")}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Zalo Chat
              </div>
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeDetailView === "recent-activity"
                ? "text-purple-600 border-purple-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              onClick={() => onActiveDetailViewChange("recent-activity")}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hoạt động gần đây
              </div>
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeDetailView === "decoy-history"
                ? "text-orange-600 border-orange-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              onClick={() => onActiveDetailViewChange("decoy-history")}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Lịch sử Quây khách
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeDetailView === "workflow" && (
          <div className="p-6">
            <WorkflowTrackerTab
              selectedLead={selectedLead}
              activeWorkflowView={activeWorkflowView}
              onWorkflowViewChange={onWorkflowViewChange}
              onSendFirstMessage={() => onSendFirstMessage("Hello")}
              sendingMessage={sendingMessage}
              onViewZaloChat={() => onActiveDetailViewChange("zalo-chat")}
              onViewBiddingHistory={onViewBiddingHistory}
              onCreateSession={onCreateSession}
              creatingSession={creatingSession}
              onBotToggle={onBotToggle}
              togglingBot={togglingBot}
              onViewDecoyWeb={() => onActiveDetailViewChange("decoy-web")}
              onRenameLead={onRenameLead}
              renamingLead={renamingLead}

              workflow2Data={workflow2Data}
              onOpenWorkflow2={onOpenWorkflowDialog}
              onOpenDecoyDialog={onDecoyDialog}

              // Dealer Bidding Props
              biddingHistory={biddingHistory}
              onUpdateBid={onUpdateBid}
              loadingBiddingHistory={loadingBiddingHistory}
            />
          </div>
        )}

        {activeDetailView === "zalo-chat" && (
          <div className="flex-1 flex flex-col h-[calc(100vh-250px)]">
            <ZaloChatTab
              selectedLead={selectedLead}
              chatMessages={chatMessages}
              selectedAccount={selectedAccount || ""}
              onUpdateLeadBotStatus={onUpdateLeadBotStatus}
              onOpenCreateThread={onOpenCreateThread}
            />
          </div>
        )}

        {activeDetailView === "decoy-web" && (
          <div className="h-[calc(100vh-250px)]">
            <DecoyWebTab
              selectedLead={selectedLead}
              onCreateThread={onOpenCreateThread}
            />
          </div>
        )}

        {activeDetailView === "recent-activity" && (
          <div className="h-[calc(100vh-250px)] bg-gray-50/50 p-4 overflow-y-auto">
            <RecentActivityTab phone={selectedLead?.phone || selectedLead?.additional_phone || null} />
          </div>
        )}

        {activeDetailView === "decoy-history" && (
          <div className="h-[calc(100vh-250px)] bg-gray-50/50 overflow-y-auto">
            <DecoyHistoryTab phone={selectedLead?.phone || selectedLead?.additional_phone || null} />
          </div>
        )}

        {/* Dialogs needed for Workflow Tab */}
        <Workflow2Dialog
          open={workflow2Open}
          onOpenChange={setWorkflow2Open}
          selectedLead={selectedLead}
          defaultData={workflow2Data}
          onSuccess={() => { }}
          onOpenDecoyDialog={onDecoyDialog}
        />
      </div>
    </div>
  )
}
