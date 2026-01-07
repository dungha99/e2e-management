"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, User, PhoneCall, Pencil, Clock, RefreshCw, Star, Zap, MessageSquare, Car, Images, MapPin, Send, Activity } from "lucide-react"
import { Lead } from "../types"
import { formatCarInfo, formatPrice, formatDate, formatRelativeTime, getActivityFreshness, getActivityFreshnessClass } from "../utils"
import { WorkflowTrackerTab } from "../tabs/WorkflowTrackerTab"
import { DecoyWebTab } from "../tabs/DecoyWebTab"
import { RecentActivityTab } from "../tabs/RecentActivityTab"
import { DecoyHistoryTab } from "../tabs/DecoyHistoryTab"
import { Workflow2Dialog } from "../dialogs/Workflow2Dialog"
import { ImageGalleryModal } from "../dialogs/ImageGalleryModal"
import { useToast } from "@/hooks/use-toast"
import { useWorkflowInstances } from "@/hooks/use-leads"
import { useDecoySignals } from "@/hooks/use-decoy-signals"

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
  activeWorkflowView: string // Can be "purchase", "seeding", or workflow ID
  onWorkflowViewChange: (view: string) => void


  // Dealer Bidding Props
  biddingHistory?: any[]
  onUpdateBid?: (bidId: string, newPrice: number) => Promise<void>
  loadingBiddingHistory?: boolean

  // Notes editing
  onUpdateNotes?: (notes: string) => Promise<void>

  // Decoy Web refresh
  decoyWebRefreshKey?: number

  // Workflow activation callback
  onWorkflowActivated?: () => void
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
  onUpdateNotes,
  // Decoy Web refresh
  decoyWebRefreshKey,
  // Workflow activation callback
  onWorkflowActivated
}: LeadDetailPanelProps) {
  // Debug log to track refreshKey
  console.log("[LeadDetailPanel] decoyWebRefreshKey:", decoyWebRefreshKey, "activeDetailView:", activeDetailView)

  // Gallery state
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // Toast notifications
  const { toast } = useToast()

  // Fetch workflow instances for beta tracking
  const { data: workflowInstancesData } = useWorkflowInstances(selectedLead?.car_id)

  // Set default view to WF0 (or WF1 if WF0 doesn't exist) when workflow data loads
  useEffect(() => {
    if (workflowInstancesData?.allWorkflows && workflowInstancesData.allWorkflows.length > 0) {
      // Try to find WF0 first, then fall back to WF1
      const wf0 = workflowInstancesData.allWorkflows.find(w => w.name === "WF0")
      const wf1 = workflowInstancesData.allWorkflows.find(w => w.name === "WF1")
      const defaultWorkflow = wf0 || wf1

      if (defaultWorkflow && activeWorkflowView !== defaultWorkflow.id) {
        // Only set if current view is not already a valid workflow ID
        const isValidView = workflowInstancesData.allWorkflows.some(w => w.id === activeWorkflowView)
        if (!isValidView) {
          onWorkflowViewChange(defaultWorkflow.id)
        }
      }
    }
  }, [workflowInstancesData, activeWorkflowView, onWorkflowViewChange])

  // Decoy signals for new reply detection
  const { hasNewReplies, markAsRead } = useDecoySignals()
  const hasNewDecoyReplies = selectedLead ? hasNewReplies(selectedLead.id, selectedLead.total_decoy_messages) : false

  // ZNS notification state
  interface ZnsTemplate {
    code: string
    name: string
    description?: string
  }
  const [znsTemplates, setZnsTemplates] = useState<ZnsTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [sendingZns, setSendingZns] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ZnsTemplate | null>(null)
  const [templatesDropdownOpen, setTemplatesDropdownOpen] = useState(false)
  const [templatesFetched, setTemplatesFetched] = useState(false)

  // Fetch templates when dropdown opens (only once)
  useEffect(() => {
    if (templatesDropdownOpen && !templatesFetched && !loadingTemplates) {
      setLoadingTemplates(true)
      fetch('/api/e2e/notification-templates')
        .then(res => res.json())
        .then(response => {
          // API returns { success: true, data: [...], count: N }
          if (response.success && Array.isArray(response.data)) {
            setZnsTemplates(response.data)
          } else if (Array.isArray(response)) {
            // Fallback in case API returns array directly
            setZnsTemplates(response)
          }
          setTemplatesFetched(true)
        })
        .catch(err => {
          console.error('[ZNS Templates] Failed to fetch:', err)
          toast({
            title: "Lỗi",
            description: "Không thể tải danh sách template ZNS",
            variant: "destructive",
          })
          setTemplatesFetched(true) // Mark as fetched even on error to prevent retry spam
        })
        .finally(() => setLoadingTemplates(false))
    }
  }, [templatesDropdownOpen, templatesFetched, loadingTemplates, toast])

  // Handle template selection - show confirmation
  const handleTemplateSelect = (template: ZnsTemplate) => {
    setSelectedTemplate(template)
    setConfirmDialogOpen(true)
  }

  // Handle ZNS send confirmation
  const handleSendZns = async () => {
    if (!selectedTemplate || !selectedLead) return

    const phone = selectedLead.phone || selectedLead.additional_phone
    if (!phone) {
      toast({
        title: "Lỗi",
        description: "Không tìm thấy số điện thoại của lead",
        variant: "destructive",
      })
      setConfirmDialogOpen(false)
      return
    }

    setSendingZns(true)
    try {
      const response = await fetch('/api/e2e/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: selectedTemplate.code,
          phoneNumbers: [phone],
          leadId: selectedLead.id,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Thành công",
          description: `Đã gửi ZNS "${selectedTemplate.name}" thành công`,
        })
      } else {
        throw new Error(data.error || 'Gửi ZNS thất bại')
      }
    } catch (error) {
      console.error('[ZNS Send] Error:', error)
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Gửi ZNS thất bại",
        variant: "destructive",
      })
    } finally {
      setSendingZns(false)
      setConfirmDialogOpen(false)
      setSelectedTemplate(null)
    }
  }

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
    <div className={`flex-1 overflow-hidden flex flex-col ${isMobile ? 'h-full' : ''}`}>
      <div className={`flex-1 overflow-y-auto scroll-touch scrollbar-hide ${isMobile ? 'has-bottom-bar' : ''}`}>
        {/* Header - Optimized for mobile: reduced padding, NOT sticky on mobile to allow scroll */}
        <div className={`px-2 sm:px-4 md:px-6 lg:px-8 pt-2 sm:pt-4 md:pt-6 pb-2 sm:pb-4 md:pb-6 border-b bg-gray-50  ${isMobile ? 'bg-white' : 'sticky top-0 z-10'}`}>
          {/* Mobile: Stacked layout, Desktop: Side by side */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start gap-3 md:gap-4 mb-3 md:mb-4">
            {/* Car Image + Lead Info Container */}
            <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4 w-full sm:w-auto sm:flex-1">
              {/* Car Image Thumbnail - Full width on mobile */}
              <div
                className={`w-full sm:w-28 md:w-40 aspect-[3/2] rounded-lg border-2 border-gray-200 bg-gray-100 overflow-hidden flex items-center justify-center shadow-sm relative group flex-shrink-0 ${galleryImages.length > 0 ? 'cursor-pointer hover:border-blue-400 transition-colors' : ''}`}
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

              {/* Lead Info */}
              <div className="flex-1 min-w-0">
                {/* Name Row - Stacked on mobile */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{selectedLead.name}</h2>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-gray-50 border border-gray-200">
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
                    <div className="flex items-center gap-1 text-gray-500">
                      <Clock className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                      <span className="text-xs sm:text-sm">
                        {formatDate(selectedLead.created_at)}
                      </span>
                    </div>
                    {/* Last Activity Time */}
                    <div className={`flex items-center gap-1 ${getActivityFreshnessClass(getActivityFreshness(selectedLead.last_activity_at))}`}>
                      <Activity className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                      <span className="text-xs sm:text-sm">
                        {formatRelativeTime(selectedLead.last_activity_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Car Info Row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                  <p className="text-sm sm:text-base font-medium text-gray-700 truncate">
                    {formatCarInfo(selectedLead)}
                  </p>
                  {selectedLead.price_customer && (
                    <span className="text-sm sm:text-base text-emerald-600 font-semibold">
                      {formatPrice(selectedLead.price_customer)}
                    </span>
                  )}
                </div>

                {/* Location Row */}
                {selectedLead.location && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <MapPin className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-gray-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-600 truncate">
                      {selectedLead.location}
                    </span>
                  </div>
                )}

                {/* Sale Status Badges - Scrollable on mobile */}
                <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-hide">
                  {selectedLead.stage && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap ${selectedLead.stage === 'COMPLETED' ? 'bg-green-100 text-green-800' :
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
                    <span className={`px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap ${selectedLead.qualified === 'STRONG_QUALIFIED' ? 'bg-green-100 text-green-800' :
                      selectedLead.qualified === 'WEAK_QUALIFIED' ? 'bg-red-100 text-red-800' :
                        selectedLead.qualified === 'NON_QUALIFIED' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-700'
                      }`}>
                      {selectedLead.qualified}
                    </span>
                  )}
                  {selectedLead.intentionLead && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap ${selectedLead.intentionLead === 'FAST' ? 'bg-green-100 text-green-800' :
                      selectedLead.intentionLead === 'SLOW' ? 'bg-yellow-100 text-yellow-800' :
                        selectedLead.intentionLead === 'DELAY' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-700'
                      }`}>
                      {selectedLead.intentionLead}
                    </span>
                  )}
                  {selectedLead.negotiationAbility && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap ${selectedLead.negotiationAbility === 'HARD' ? 'bg-green-100 text-green-800' :
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

            {/* Action Buttons - Full width on mobile, stacked in grid */}
            {/* Hierarchy: Primary (filled) > Secondary (colored bg) > Tertiary (ghost) */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Tertiary Actions - Icon-only utility buttons */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onSyncLead}
                disabled={syncing}
                className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                title="Đồng bộ"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onShowDetail}
                className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                title="Chi tiết"
              >
                <User className="h-4 w-4" />
              </Button>

              {/* Secondary Actions - Important actions with colored background */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={callingBot}
                    className="bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 hover:border-orange-300 text-xs sm:text-sm"
                  >
                    {callingBot ? (
                      <Loader2 className="h-3.5 sm:h-4 w-3.5 sm:w-4 animate-spin" />
                    ) : (
                      <>
                        <PhoneCall className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1.5 sm:mr-2" />
                        <span className="hidden sm:inline">GỌI BOT</span>
                        <span className="sm:hidden">Gọi</span>
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

              {/* Primary Action - Main CTA with prominent styling */}
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm shadow-sm"
                onClick={onOpenInspection}
              >
                <span className="hidden sm:inline">Đặt lịch KD</span>
                <span className="sm:hidden">Lịch KD</span>
              </Button>

              {/* Secondary Action - ZNS Notification Button */}
              <DropdownMenu open={templatesDropdownOpen} onOpenChange={setTemplatesDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sendingZns}
                    className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 text-xs sm:text-sm"
                  >
                    {sendingZns ? (
                      <Loader2 className="h-3.5 sm:h-4 w-3.5 sm:w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1.5 sm:mr-2" />
                        <span className="hidden sm:inline">Gửi noti</span>
                        <span className="sm:hidden">Noti</span>
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                  {loadingTemplates ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm text-gray-500">Đang tải...</span>
                    </div>
                  ) : znsTemplates.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500 text-center">
                      Không có template nào
                    </div>
                  ) : (
                    znsTemplates.map((template) => (
                      <DropdownMenuItem
                        key={template.code}
                        onClick={() => handleTemplateSelect(template)}
                        className="cursor-pointer"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{template.name}</span>
                          {template.description && (
                            <span className="text-xs text-gray-500">{template.description}</span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Tabs - Horizontally scrollable on mobile */}
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 border-b -mb-3 sm:-mb-4 md:-mb-6 overflow-x-auto scrollbar-none pb-px bg-gray-50">
            <button
              type="button"
              className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${activeDetailView === "workflow"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              onClick={() => onActiveDetailViewChange("workflow")}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Zap className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                <span className="hidden sm:inline">Workflow Tracker</span>
                <span className="sm:hidden">Workflow</span>
              </div>
            </button>
            <button
              type="button"
              className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${activeDetailView === "decoy-web"
                ? "text-orange-600 border-orange-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              onClick={() => onActiveDetailViewChange("decoy-web")}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Icon with new reply indicator */}
                <span className="relative">
                  <MessageSquare className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                  {hasNewDecoyReplies && activeDetailView !== "decoy-web" && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </span>
                <span className="hidden sm:inline">Decoy Web Chat</span>
                <span className="sm:hidden">Decoy</span>
                {(selectedLead.decoy_thread_count || 0) > 0 && (
                  <span className="ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 text-[10px] sm:text-xs">
                    {selectedLead.decoy_thread_count}
                  </span>
                )}
              </div>
            </button>

            <button
              type="button"
              className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${activeDetailView === "recent-activity"
                ? "text-purple-600 border-purple-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              onClick={() => onActiveDetailViewChange("recent-activity")}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Clock className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                <span className="hidden sm:inline">Hoạt động trên website</span>
                <span className="sm:hidden">Hoạt động</span>
              </div>
            </button>
            <button
              type="button"
              className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${activeDetailView === "decoy-history"
                ? "text-orange-600 border-orange-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              onClick={() => onActiveDetailViewChange("decoy-history")}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <MessageSquare className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                <span className="hidden sm:inline">Lịch sử Quây khách</span>
                <span className="sm:hidden">Lịch sử</span>
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

              // Beta Tracking Props
              workflowInstancesData={workflowInstancesData}
              onWorkflowActivated={onWorkflowActivated}
            />
          </div>
        )}


        {activeDetailView === "decoy-web" && (
          <div className="h-[calc(100vh-250px)]">
            <DecoyWebTab
              selectedLead={selectedLead}
              onCreateThread={onOpenCreateThread}
              refreshKey={decoyWebRefreshKey}
            />
          </div>
        )}

        {activeDetailView === "recent-activity" && (
          <div className="h-[calc(100vh-250px)] bg-gray-50/50 p-4 overflow-y-auto scrollbar-hide">
            <RecentActivityTab phone={selectedLead?.phone || selectedLead?.additional_phone || null} />
          </div>
        )}

        {activeDetailView === "decoy-history" && (
          <div className="h-[calc(100vh-250px)] bg-gray-50/50 overflow-y-auto scrollbar-hide">
            <DecoyHistoryTab phone={selectedLead?.phone || selectedLead?.additional_phone || null} leadId={selectedLead?.id} />
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

        {/* ZNS Send Confirmation Dialog */}
        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận gửi ZNS</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn gửi ZNS <strong>"{selectedTemplate?.name}"</strong> đến số điện thoại <strong>{selectedLead?.phone || selectedLead?.additional_phone}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={sendingZns}>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSendZns}
                disabled={sendingZns}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {sendingZns ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Đang gửi...
                  </>
                ) : (
                  'Gửi'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Mobile Bottom Action Bar - App-like navigation */}
      {isMobile && (
        <div className="mobile-bottom-bar">
          <Button
            variant="outline"
            size="sm"
            onClick={onSyncLead}
            disabled={syncing}
            className="flex-1 text-gray-600"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
            <span className="text-xs">Đồng bộ</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={callingBot}
            onClick={() => onCallBot('FIRST_CALL')}
            className="flex-1 text-orange-600 border-orange-600"
          >
            <PhoneCall className="h-4 w-4 mr-1.5" />
            <span className="text-xs">Gọi Bot</span>
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={onOpenInspection}
          >
            <span className="text-xs">Đặt lịch KD</span>
          </Button>
        </div>
      )}
    </div>
  )
}
