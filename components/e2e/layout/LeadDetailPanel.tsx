"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Loader2, User, PhoneCall, Pencil, Clock, RefreshCw, Star, Zap, MessageSquare, Car, Images } from "lucide-react"
import { Lead } from "../types"
import { formatCarInfo, formatPrice, formatDate } from "../utils"
import { WorkflowTrackerTab } from "../tabs/WorkflowTrackerTab"
import { DecoyWebTab } from "../tabs/DecoyWebTab"
import { RecentActivityTab } from "../tabs/RecentActivityTab"
import { DecoyHistoryTab } from "../tabs/DecoyHistoryTab"
import { Workflow2Dialog } from "../dialogs/Workflow2Dialog"
import { ImageGalleryModal } from "../dialogs/ImageGalleryModal"

interface LeadDetailPanelProps {
  selectedAccount: string | null
  selectedLead: Lead | null
  isMobile: boolean
  mobileView: "list" | "detail"

  // Tab State
  activeDetailView: "workflow" | "decoy-web" | "recent-activity" | "decoy-history"
  onActiveDetailViewChange: (view: "workflow" | "decoy-web" | "recent-activity" | "decoy-history") => void

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


  // Dealer Bidding Props
  biddingHistory?: any[]
  onUpdateBid?: (bidId: string, newPrice: number) => Promise<void>
  loadingBiddingHistory?: boolean

  // Notes editing
  onUpdateNotes?: (notes: string) => Promise<void>
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

  // Dealer Bidding
  biddingHistory,
  onUpdateBid,
  loadingBiddingHistory,
  // Notes editing
  onUpdateNotes
}: LeadDetailPanelProps) {
  // Gallery state
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // Collect all car images for gallery
  const galleryImages = useMemo(() => {
    const images: string[] = []
    if (!selectedLead) return images

    // Add direct image first
    if (selectedLead.image) {
      images.push(selectedLead.image)
    }

    // Add additional_images from all categories
    if (selectedLead.additional_images) {
      const imgCategories = selectedLead.additional_images
      // Order: outside, inside, paper, then any other categories
      const categoryOrder = ['outside', 'inside', 'paper']

      for (const category of categoryOrder) {
        const categoryImages = imgCategories[category]
        if (categoryImages) {
          for (const img of categoryImages) {
            if (img.url && !images.includes(img.url)) {
              images.push(img.url)
            }
          }
        }
      }

      // Add any other categories not in the order
      for (const [category, categoryImages] of Object.entries(imgCategories)) {
        if (!categoryOrder.includes(category) && categoryImages) {
          for (const img of categoryImages) {
            if (img.url && !images.includes(img.url)) {
              images.push(img.url)
            }
          }
        }
      }
    }

    return images
  }, [selectedLead])

  // Handle thumbnail click to open gallery
  const handleThumbnailClick = () => {
    if (galleryImages.length > 0) {
      setSelectedImageIndex(0)
      setGalleryOpen(true)
    }
  }

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
          <div className="flex flex-wrap items-start gap-4 mb-4">
            <div className="flex items-center gap-4">
              {/* Car Image Thumbnail */}
              <div
                className={`w-40 aspect-[3/2] rounded-lg border-2 border-gray-200 bg-gray-100 overflow-hidden flex items-center justify-center shadow-sm relative group ${galleryImages.length > 0 ? 'cursor-pointer hover:border-blue-400 transition-colors' : ''}`}
                onClick={handleThumbnailClick}
                title={galleryImages.length > 0 ? "Nhấn để xem tất cả ảnh" : undefined}
              >
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
                      <>
                        <img
                          src={carImageUrl}
                          alt={`${selectedLead.brand || ''} ${selectedLead.model || ''}`}
                          className="w-full h-full object-cover"
                          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                            // Replace with placeholder on error
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        {/* Hover overlay */}
                        {galleryImages.length > 0 && (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="flex flex-col items-center text-white">
                              <Images className="h-6 w-6 mb-1" />
                              <span className="text-xs font-medium">Xem ảnh</span>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  }
                  return null;
                })()}
                <div className={`flex flex-col items-center justify-center ${selectedLead.image || selectedLead.additional_images ? 'hidden' : ''}`}>
                  <Car className="h-8 w-8 text-gray-400" />
                  <span className="text-[10px] text-gray-400 mt-1">No image</span>
                </div>
                {/* Image count badge */}
                {galleryImages.length > 1 && (
                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 rounded text-white text-[10px] font-medium">
                    {galleryImages.length} ảnh
                  </div>
                )}
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
                {/* Sale Status Badges */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {selectedLead.stage && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${selectedLead.stage === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      selectedLead.stage === 'DEPOSIT_PAID' ? 'bg-emerald-100 text-emerald-800' :
                        selectedLead.stage === 'CAR_VIEW' ? 'bg-blue-100 text-blue-800' :
                          selectedLead.stage === 'NEGOTIATION' ? 'bg-yellow-100 text-yellow-800' :
                            selectedLead.stage === 'CONTACTED' ? 'bg-purple-100 text-purple-800' :
                              selectedLead.stage === 'CANNOT_CONTACT' ? 'bg-orange-100 text-orange-800' :
                                selectedLead.stage === 'FAILED' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-700'
                      }`}>
                      {selectedLead.stage}
                    </span>
                  )}
                  {selectedLead.qualified && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${selectedLead.qualified === 'STRONG_QUALIFIED' ? 'bg-green-100 text-green-800' :
                      selectedLead.qualified === 'WEAK_QUALIFIED' ? 'bg-red-100 text-red-800' :
                        selectedLead.qualified === 'NON_QUALIFIED' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-700'
                      }`}>
                      {selectedLead.qualified}
                    </span>
                  )}
                  {selectedLead.intentionLead && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${selectedLead.intentionLead === 'FAST' ? 'bg-green-100 text-green-800' :
                      selectedLead.intentionLead === 'SLOW' ? 'bg-yellow-100 text-yellow-800' :
                        selectedLead.intentionLead === 'DELAY' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-700'
                      }`}>
                      {selectedLead.intentionLead}
                    </span>
                  )}
                  {selectedLead.negotiationAbility && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${selectedLead.negotiationAbility === 'HARD' ? 'bg-green-100 text-green-800' :
                      selectedLead.negotiationAbility === 'MAYBE' ? 'bg-yellow-100 text-yellow-800' :
                        selectedLead.negotiationAbility === 'EASY' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-700'
                      }`}>
                      {selectedLead.negotiationAbility}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeDetailView === "recent-activity"
                ? "text-purple-600 border-purple-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              onClick={() => onActiveDetailViewChange("recent-activity")}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hoạt động trên website
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

              // Notes editing
              onUpdateNotes={onUpdateNotes}
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

        {/* Image Gallery Modal */}
        <ImageGalleryModal
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          images={galleryImages}
          initialIndex={selectedImageIndex}
          onIndexChange={setSelectedImageIndex}
        />
      </div>
    </div>
  )
}
