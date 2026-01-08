"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useIsMobile } from "@/components/ui/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, User, CalendarIcon } from "lucide-react"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

// Extracted component imports
import { Lead, BiddingHistory, Dealer, ITEMS_PER_PAGE, DealerBiddingStatus } from "./e2e/types"
import { formatPriceForEdit, parseShorthandPrice } from "./e2e/utils"
import { useAccounts } from "@/contexts/AccountsContext"
import {
  useLeadsCounts, useLeads,
  useDealerBiddings,
  useLeadSources
} from "@/hooks/use-leads"
import { useQueryClient } from "@tanstack/react-query"

// Dialog components
import { SendToDealerGroupsDialog } from "./e2e/dialogs/SendToDealerGroupsDialog"
import { CreateBiddingDialog } from "./e2e/dialogs/CreateBiddingDialog"
import { CreateSessionDialog } from "./e2e/dialogs/CreateSessionDialog"
import { Workflow2Dialog } from "./e2e/dialogs/Workflow2Dialog"
import { DecoyTriggerDialog } from "./e2e/dialogs/DecoyTriggerDialog"
import { ImageGalleryModal } from "./e2e/dialogs/ImageGalleryModal"
import { BiddingHistoryDialog } from "./e2e/dialogs/BiddingHistoryDialog"
import { CreateThreadDialog } from "./e2e/dialogs/CreateThreadDialog"
import { EditLeadDialog } from "./e2e/dialogs/EditLeadDialog"
import { LeadDetailPanel } from "./e2e/layout/LeadDetailPanel"
import { SaleActivitiesPanel } from "./e2e/layout/SaleActivitiesPanel"

// Tab components

// Layout components
import { AccountSelector } from "./e2e/layout/AccountSelector"
import { LeadListSidebar } from "./e2e/layout/LeadListSidebar"
import { ViewModeToggle } from "./e2e/layout/ViewModeToggle"
import { CampaignKanbanView } from "./e2e/kanban/CampaignKanbanView"

// Local interfaces for component-specific types not in shared types
interface DealerGroup {
  groupId: string
  groupName: string
  dealerId: string | null
}

interface ActivityLogItem {
  created_at: string
  action: string
  description: string
}

function WorkflowStep({ icon, title, status, isCompleted, onClick }: {
  icon: React.ReactNode
  title: string
  status: string
  isCompleted: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${onClick ? "cursor-pointer hover:bg-gray-50" : ""
        } ${isCompleted ? "bg-emerald-50 border-emerald-100" : "bg-white border-gray-100"}`}
    >
      <div className={`${isCompleted ? "text-emerald-600" : "text-gray-400"}`}>
        {icon}
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-gray-900">{title}</p>
        <p className={`text-[10px] ${isCompleted ? "text-emerald-600" : "text-gray-500"}`}>
          {status}
        </p>
      </div>
    </div>
  )
}

interface E2EManagementProps {
  userId?: string
  initialTab?: "priority" | "nurture"
  initialPage?: number
  initialSearch?: string
  initialSources?: string[]
  initialViewMode?: "list" | "kanban"
  onViewModeChange?: (mode: "list" | "kanban") => void
}

export function E2EManagement({
  userId: propUserId,
  initialViewMode,
  onViewModeChange
}: E2EManagementProps = {}) {
  const { toast } = useToast()
  const { accounts: ACCOUNTS } = useAccounts()
  const queryClient = useQueryClient()

  // Phase 1: URL sync layer (non-breaking)
  const searchParams = useSearchParams()
  const router = useRouter()

  // Use userId from props (URL param) or fallback to localStorage for backwards compatibility
  const selectedAccount = propUserId || (() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('e2e-selectedAccount') || ""
    }
    return ""
  })()
  const [callingBot, setCallingBot] = useState(false)
  const loadingCarIds = false // Replaced by React Query loading state

  // Phase 2: Use URL as single source of truth - no duplicate state
  const [searchPhone, setSearchPhone] = useState<string>("")
  const [editingBiddingId, setEditingBiddingId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState<string>("")
  const [updatingBidding, setUpdatingBidding] = useState(false)
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [creatingBiddingManual, setCreatingBiddingManual] = useState(false)
  const [newBidDealerId, setNewBidDealerId] = useState<string>("")
  const [newBidPrice, setNewBidPrice] = useState<string>("")
  const [newBidComment, setNewBidComment] = useState<string>("")

  // Selected lead state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  // Decoy Chat state removed (handled by component)

  // Create bidding state

  const [confirmBiddingOpen, setConfirmBiddingOpen] = useState(false)

  // Sale Activities refresh key - increment to trigger refresh
  const [activitiesRefreshKey, setActivitiesRefreshKey] = useState(0)

  // Decoy Web refresh key - increment to trigger refresh after creating thread
  const [decoyWebRefreshKey, setDecoyWebRefreshKey] = useState(0)

  // Right panel collapse state (for tablet)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)


  // Bidding history state
  const [biddingHistoryOpen, setBiddingHistoryOpen] = useState(false)
  const [biddingHistory, setBiddingHistory] = useState<BiddingHistory[]>([])

  const [loadingBiddingHistory, setLoadingBiddingHistory] = useState(false)

  // Bot toggle loading state
  const [togglingBot, setTogglingBot] = useState(false)

  // E2E messages dialog state (removed)

  // Decoy Web dialog state


  // Create thread state
  const [createThreadOpen, setCreateThreadOpen] = useState(false)
  const [createThreadLoading, setCreateThreadLoading] = useState(false)
  const [fourDigitsInput, setFourDigitsInput] = useState("")
  const [firstMessageInput, setFirstMessageInput] = useState("Hello")
  const [sendZns, setSendZns] = useState(false)




  // Sync state
  const [syncing, setSyncing] = useState(false)

  // Create session state

  const [confirmSessionOpen, setConfirmSessionOpen] = useState(false)

  // Rename lead state
  const [renamingLead, setRenamingLead] = useState(false)

  // Send first message state
  const [sendingMessage, setSendingMessage] = useState(false)

  // Inspection system iframe state
  const [inspectionSystemOpen, setInspectionSystemOpen] = useState(false)

  // Update primary status state
  const [updatingPrimary, setUpdatingPrimary] = useState(false)

  // Cache busting key for leads list
  const [refreshKey, setRefreshKey] = useState(0)

  // Phase 2: React Query hooks for data fetching (server-side)
  // Read params directly from URL - URL is the single source of truth
  const activeTab = (searchParams.get("tab") as "priority" | "nurture") || "priority"
  const currentPage = parseInt(searchParams.get("page") || "1")
  const appliedSearchPhone = searchParams.get("search") || ""
  const sourceFilter = searchParams.get("sources")?.split(",").filter(Boolean) || []

  const tab = activeTab
  const page = currentPage
  const search = appliedSearchPhone
  const sources = sourceFilter

  // Helper function to build URLs with proper path structure
  const buildUrl = useCallback((queryParams: URLSearchParams): string => {
    if (propUserId) {
      // When userId is in path, use /e2e/[userId]?params structure
      return `/e2e/${propUserId}?${queryParams.toString()}`
    } else {
      // Backwards compatibility: just query params
      return `?${queryParams.toString()}`
    }
  }, [propUserId])

  // Fetch counts with filters
  const { data: countsData, isLoading: loadingCounts, refetch: refetchCounts } = useLeadsCounts({
    uid: selectedAccount,
    search,
    sources,
    refreshKey
  })
  const counts = countsData || { priority: 0, nurture: 0, total: 0 }

  // Fetch leads with server-side filtering
  const {
    data: leadsData,
    isLoading: loading,
    refetch: refetchLeads,
  } = useLeads({
    uid: selectedAccount,
    tab,
    page,
    per_page: ITEMS_PER_PAGE,
    search,
    sources,
    refreshKey,
  })

  // Extract leads from response
  const leads = leadsData?.leads || []

  // Extract car IDs for dealer biddings (memoized to prevent unnecessary refetches)
  const carIds = useMemo(() =>
    leads.filter((l: Lead) => l.car_id).map((l: Lead) => l.car_id!),
    [leads]
  )

  // Fetch dealer biddings in background (progressive loading)
  const { data: dealerBiddingsMap } = useDealerBiddings({ car_ids: carIds })

  // Fetch distinct lead sources for filtering
  const { data: sourceData } = useLeadSources(selectedAccount)

  // Enrich leads with dealer biddings
  const enrichedLeads = useMemo(() => {
    if (!dealerBiddingsMap) return leads

    return leads.map((lead: Lead) => {
      if (!lead.car_id || !dealerBiddingsMap[lead.car_id]) {
        return lead
      }

      const biddings = dealerBiddingsMap[lead.car_id]
      if (biddings.length > 0) {
        const maxPrice = Math.max(...biddings.map((b: any) => b.price))
        return {
          ...lead,
          dealer_bidding: { status: "got_price" as const, maxPrice },
        }
      }

      return lead
    })
  }, [leads, dealerBiddingsMap])

  // Mobile view state
  const isMobile = useIsMobile()
  const [mobileView, setMobileView] = useState<"list" | "detail">("list")

  // View mode state (list vs kanban) - can be controlled externally
  const [internalViewMode, setInternalViewMode] = useState<"list" | "kanban">(initialViewMode || "list")
  const viewMode = initialViewMode !== undefined ? initialViewMode : internalViewMode
  const setViewMode = onViewModeChange || setInternalViewMode

  // Detail view tab state
  const [activeDetailView, setActiveDetailView] = useState<"workflow" | "decoy-web" | "recent-activity" | "decoy-history">("workflow")

  // Workflow 2 activation state
  const [workflow2Open, setWorkflow2Open] = useState(false)
  const [workflow2Data, setWorkflow2Data] = useState({
    duration: "",
    minPrice: "",
    maxPrice: "",
    comment: false,
    numberOfComments: "",
    bid: false
  })

  const [workflow2Activated, setWorkflow2Activated] = useState(false)
  const [activeWorkflowView, setActiveWorkflowView] = useState<string>("WF1")

  // Decoy trigger state
  const [decoyDialogOpen, setDecoyDialogOpen] = useState(false)




  // Send to dealer groups state
  const [sendDealerDialogOpen, setSendDealerDialogOpen] = useState(false)
  const [dealerGroups, setDealerGroups] = useState<Array<{ groupId: string, groupName: string, dealerId: string | null }>>([])
  const [loadingDealerGroups, setLoadingDealerGroups] = useState(false)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [sendingToGroups, setSendingToGroups] = useState(false)
  const [dealerGroupSearch, setDealerGroupSearch] = useState("")

  // Detail dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  // Edit mode state for detail dialog
  const [editMode, setEditMode] = useState(false)
  const [editedStage, setEditedStage] = useState<string>("")
  const [editedPriceCustomer, setEditedPriceCustomer] = useState<string>("")
  const [editedPriceHighestBid, setEditedPriceHighestBid] = useState<string>("")
  const [editedQualified, setEditedQualified] = useState<string>("")
  const [editedIntentionLead, setEditedIntentionLead] = useState<string>("")
  const [editedNegotiationAbility, setEditedNegotiationAbility] = useState<string>("")
  const [editedNotes, setEditedNotes] = useState<string>("")
  const [updatingSaleStatus, setUpdatingSaleStatus] = useState(false)

  // Image gallery state
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [galleryImages, setGalleryImages] = useState<string[]>([])

  // Summary report state
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [summaryReport, setSummaryReport] = useState<any>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  // Handler for account changes - navigate to new user URL
  const handleAccountChange = (newUserId: string) => {
    if (propUserId) {
      // When using URL-based routing, navigate to new user URL
      router.push(`/e2e/${newUserId}?tab=priority&page=1`)
    } else {
      // Backwards compatibility: update localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('e2e-selectedAccount', newUserId)
      }
      // Force page reload to apply new account
      window.location.reload()
    }
  }

  // Keyboard navigation for gallery
  useEffect(() => {
    if (!galleryOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && selectedImageIndex > 0) {
        setSelectedImageIndex(prev => prev - 1);
      } else if (e.key === 'ArrowRight' && selectedImageIndex < galleryImages.length - 1) {
        setSelectedImageIndex(prev => prev + 1);
      } else if (e.key === 'Escape') {
        setGalleryOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [galleryOpen, selectedImageIndex, galleryImages.length]);

  // Fetch bidding history when a lead is selected (without opening dialog)
  useEffect(() => {
    if (selectedLead?.car_id) {
      fetchBiddingHistory(selectedLead.car_id, false) // false = don't open dialog
    } else {
      setBiddingHistory([])
    }
  }, [selectedLead?.car_id])

  // Memoize processed images to avoid re-processing on every render
  const processedImages = useMemo(() => {
    try {
      if (!selectedLead?.additional_images) {
        return [];
      }

      // Handle both string and object types
      let imagesData;
      if (typeof selectedLead.additional_images === 'string') {
        imagesData = JSON.parse(selectedLead.additional_images);
      } else {
        imagesData = selectedLead.additional_images;
      }

      // Extract all image URLs from all categories
      const allImages: string[] = [];

      if (imagesData && typeof imagesData === 'object') {
        // Iterate through all categories (paper, inside, outside, thumbnail)
        Object.entries(imagesData).forEach(([, categoryData]: [string, any]) => {
          if (Array.isArray(categoryData)) {
            categoryData.forEach((img: any) => {
              if (img && img.url) {
                allImages.push(img.url);
              }
            });
          }
        });
      }

      return allImages;
    } catch (e) {
      return [];
    }
  }, [selectedLead?.additional_images]);

  // Memoize image count
  const imageCount = useMemo(() => {
    try {
      if (!selectedLead?.additional_images) return 0;
      const images = typeof selectedLead.additional_images === 'string'
        ? JSON.parse(selectedLead.additional_images)
        : selectedLead.additional_images;

      // Count all images across all categories
      if (typeof images === 'object' && !Array.isArray(images)) {
        return Object.values(images).reduce((count: number, category) => {
          return count + (Array.isArray(category) ? category.length : 0);
        }, 0 as number);
      }
      return Array.isArray(images) ? images.length : 0;
    } catch {
      return 0;
    }
  }, [selectedLead?.additional_images]);

  // Phase 2: React Query handles all data fetching and URL param changes automatically
  // Account changes are handled by handleAccountChange which sets default URL params

  async function fetchMessagesZalo(car_id: string): Promise<boolean> {
    try {
      const response = await fetch("/api/e2e/messages-zalo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id }),
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()
      const messages = data.messages_zalo || []

      // Return true if we have messages, false otherwise
      return Array.isArray(messages) && messages.length > 0
    } catch (error) {
      console.error("[E2E] Error fetching messages_zalo for car_id:", car_id, error)
      return false
    }
  }

  async function fetchLeadDetails(phone: string): Promise<{
    car_id: string | null
    price_customer: number | null
    brand: string | null
    model: string | null
    variant: string | null
    year: number | null
    plate: string | null
    stage: string | null
    has_enough_images: boolean
    bot_status: boolean
    price_highest_bid: number | null
    first_message_sent: boolean
    session_created: boolean
    notes: string | null
    pic_id: string | null
    pic_name: string | null
    location: string | null
    mileage: number | null
    is_primary: boolean
    workflow2_is_active: boolean | null
    additional_images?: any
    sku: string | null
    car_created_at: string | null
    image: string | null
    qualified: string | null
    intentionLead: string | null
    negotiationAbility: string | null
  }> {
    try {
      const response = await fetch("/api/e2e/lead-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })

      if (!response.ok) {
        return {
          car_id: null,
          price_customer: null,
          brand: null,
          model: null,
          variant: null,
          year: null,
          plate: null,
          stage: null,
          has_enough_images: false,
          bot_status: false,
          price_highest_bid: null,
          first_message_sent: false,
          session_created: false,
          notes: null,
          pic_id: null,
          pic_name: null,
          location: null,
          mileage: null,
          is_primary: false,
          workflow2_is_active: null,
          sku: null,
          car_created_at: null,
          image: null,
          additional_images: null,
          qualified: null,
          intentionLead: null,
          negotiationAbility: null,
        }
      }

      const data = await response.json()

      return {
        car_id: data.sale_status?.car_id || null,
        price_customer: data.sale_status?.price_customer || null,
        brand: data.car_info?.brand || null,
        model: data.car_info?.model || null,
        variant: data.car_info?.variant || null,
        year: data.car_info?.year || null,
        plate: data.car_info?.plate || null,
        stage: data.sale_status?.stage || null,
        has_enough_images: data.car_info?.has_enough_images || false,
        bot_status: data.sale_status?.bot_status || false,
        price_highest_bid: data.sale_status?.price_highest_bid || null,
        first_message_sent: data.sale_status?.first_message_sent || false,
        session_created: data.sale_status?.session_created || false,
        notes: data.sale_status?.notes || null,
        pic_id: data.lead?.pic_id || null,
        pic_name: data.lead?.pic_name || null,
        location: data.car_info?.location || null,
        mileage: data.car_info?.mileage || null,
        is_primary: data.car_info?.is_primary || false,
        workflow2_is_active: data.car_info?.workflow2_is_active ?? null,
        additional_images: data.car_info?.additional_images || null,
        sku: data.car_info?.sku || null,
        car_created_at: data.car_info?.created_at || null,
        image: data.car_info?.image || null,
        qualified: data.sale_status?.qualified || null,
        intentionLead: data.sale_status?.intentionLead || null,
        negotiationAbility: data.sale_status?.negotiationAbility || null,
      }
    } catch (error) {
      console.error("[E2E] Error fetching lead details for phone:", phone, error)
      return {
        car_id: null,
        price_customer: null,
        brand: null,
        model: null,
        variant: null,
        year: null,
        plate: null,
        stage: null,
        has_enough_images: false,
        bot_status: false,
        price_highest_bid: null,
        first_message_sent: false,
        session_created: false,
        notes: null,
        pic_id: null,
        pic_name: null,
        location: null,
        mileage: null,
        is_primary: false,
        workflow2_is_active: null,
        sku: null,
        car_created_at: null,
        image: null,
        additional_images: null,
        qualified: null,
        intentionLead: null,
        negotiationAbility: null,
      }
    }
  }

  async function checkDealerBidding(car_id: string): Promise<DealerBiddingStatus> {
    try {
      const response = await fetch("/api/e2e/dealer-bidding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id }),
      })

      if (!response.ok) {
        return { status: "not_sent" }
      }

      const data = await response.json()

      // If no data or empty array, not sent
      if (!Array.isArray(data) || data.length === 0) {
        return { status: "not_sent" }
      }

      // Find the maximum price
      const maxPrice = Math.max(...data.map((bid: any) => bid.price || 0))

      // If max price is 1, it means sent but no real price yet
      if (maxPrice === 1) {
        return { status: "sent" }
      }

      // If max price > 1, we got a real price
      return { status: "got_price", maxPrice }
    } catch (error) {
      console.error("[E2E] Error checking dealer bidding for car_id:", car_id, error)
      return { status: "not_sent" }
    }
  }







  async function fetchDealerGroups() {
    setLoadingDealerGroups(true)
    try {
      const response = await fetch("/api/e2e/dealer-groups")

      if (!response.ok) {
        throw new Error("Failed to fetch dealer groups")
      }

      const data = await response.json()
      console.log("[E2E] Dealer groups data:", data)

      setDealerGroups(data.groups || [])
    } catch (error) {
      console.error("[E2E] Error fetching dealer groups:", error)
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách nhóm dealer",
        variant: "destructive",
      })
      setDealerGroups([])
    } finally {
      setLoadingDealerGroups(false)
    }
  }

  function handleOpenSendDealerDialog() {
    setSendDealerDialogOpen(true)
    setSelectedGroupIds([])
    setDealerGroupSearch("")
    fetchDealerGroups()
  }

  async function handleSendToGroups() {
    if (!selectedLead?.car_id || selectedGroupIds.length === 0) return

    setSendingToGroups(true)
    try {
      // Get selected groups with dealer IDs
      const selectedGroups = dealerGroups.filter(g => selectedGroupIds.includes(g.groupId))

      // Get current time
      const now = new Date()
      const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`

      // Prepare car information message using the template
      const carInfo = `Thời gian nhận thông tin: ${timeString}\n` +
        `Thông tin chi tiết xe: ${selectedLead.brand || ''} ${selectedLead.model || ''} ${selectedLead.year || ''}\n` +
        `Số km đã đi (Odo): ${selectedLead.mileage ? selectedLead.mileage.toLocaleString() : 'N/A'} km\n` +
        `Khu vực: ${selectedLead.location || 'N/A'}\n` +
        `Giá mong muốn: ${selectedLead.price_customer || 'N/A'}\n` +
        `Car_id: ${selectedLead.car_id}\n` +
        `Vucar hỗ trợ tài chính: 80% giá trị xe, lãi suất từ 500đ/ngày/1 triệu đồng.`

      // Extract image URLs from additional_images
      const imageUrls: string[] = []
      console.log("[E2E] selectedLead.additional_images:", selectedLead.additional_images)

      if (selectedLead.additional_images) {
        // Get images from all categories (paper, inside, outside, etc.)
        Object.values(selectedLead.additional_images).forEach(images => {
          if (Array.isArray(images)) {
            images.forEach(img => {
              if (img.url) {
                imageUrls.push(img.url)
              }
            })
          }
        })
      }

      console.log("[E2E] Extracted imageUrls:", imageUrls)
      console.log("[E2E] Number of images:", imageUrls.length)

      // Send messages and images to groups via Zalo API
      const sendResponse = await fetch("/api/e2e/send-to-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupIds: selectedGroupIds,
          message: carInfo,
          imageUrls: imageUrls, // Send all images
          phone: selectedLead.phone || "0986755669"
        }),
      })

      const sendResult = await sendResponse.json()

      // Create bidding records for groups that have dealer IDs
      const biddingPromises = selectedGroups
        .filter(group => group.dealerId) // Only groups with matching dealers
        .map(group =>
          fetch("/api/e2e/bidding-history/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              car_id: selectedLead.car_id,
              dealer_id: group.dealerId,
              price: 1, // Price 1 means "sent info only"
              comment: "Đã gửi thông tin xe"
            }),
          })
        )

      const biddingResults = await Promise.all(biddingPromises)

      // Check results
      const sendSuccess = sendResult.successCount || 0

      if (sendSuccess > 0) {
        toast({
          title: "Thành công",
          description: `Đã gửi thông tin xe và ${imageUrls.length} ảnh đến ${sendSuccess} nhóm dealer`,
        })
      } else {
        toast({
          title: "Gửi thất bại",
          description: "Không thể gửi tin nhắn đến các nhóm",
          variant: "destructive",
        })
      }

      // Refresh bidding history
      if (selectedLead.car_id) {
        fetchBiddingHistory(selectedLead.car_id)
      }

      // Close dialog
      setSendDealerDialogOpen(false)
      setSelectedGroupIds([])
    } catch (error) {
      console.error("[E2E] Error sending to groups:", error)
      toast({
        title: "Lỗi",
        description: "Không thể gửi thông tin xe",
        variant: "destructive",
      })
    } finally {
      setSendingToGroups(false)
    }
  }



  async function handleLeadClick(lead: Lead) {
    setSelectedLead(lead)
    setActiveDetailView("workflow")
    setActiveWorkflowView("purchase") // Reset to default workflow view

    // Switch to detail view on mobile
    if (isMobile) {
      setMobileView('detail')
    }

    // Reset Decoy Chat state




    // Fetch fresh lead details to get workflow2_is_active and other updated info
    const phone = lead.phone || lead.additional_phone
    if (phone) {
      const leadDetails = await fetchLeadDetails(phone)

      // Update selected lead with fresh data, only merging non-null values
      // This prevents overwriting good data when the API call fails
      const nonNullDetails = Object.fromEntries(
        Object.entries(leadDetails).filter(([, value]) => value !== null && value !== undefined)
      )

      const updatedLead = {
        ...lead,
        ...nonNullDetails
      }
      setSelectedLead(updatedLead)
    }



    // Fetch Activity Log - Legacy functionality removed
    if (phone) {
      console.log("[E2E] Lead selected:", phone)
    }
  }


  async function handleBotToggle(lead: Lead, newStatus: boolean) {
    const phone = lead.phone || lead.additional_phone
    if (!phone) {
      toast({
        title: "Lỗi",
        description: "Không có số điện thoại",
        variant: "destructive",
      })
      return
    }

    setTogglingBot(true)

    try {
      const response = await fetch("/api/e2e/bot-status/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_status: newStatus, phone }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        toast({
          title: "Cập nhật bot thất bại",
          description: newStatus
            ? "Không thể kích hoạt bot. Vui lòng thử lại."
            : "Không thể tắt bot. Vui lòng thử lại.",
          variant: "destructive",
        })
        return
      }

      // Update selected lead if it's the same
      if (selectedLead?.id === lead.id) {
        setSelectedLead({ ...selectedLead, bot_active: newStatus })
      }

      // Refetch leads to get updated data from server
      refetchLeads()

      toast({
        title: "Thành công",
        description: newStatus ? "Đã kích hoạt bot" : "Đã tắt bot",
      })
    } catch (error) {
      console.error("[E2E] Error updating bot status:", error)
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật trạng thái bot",
        variant: "destructive",
      })
    } finally {
      setTogglingBot(false)
    }
  }




  async function fetchDecoyThreadCount(lead_id: string): Promise<number> {
    try {
      const response = await fetch("/api/e2e/decoy-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id }),
      })

      if (!response.ok) {
        return 0
      }

      const data = await response.json()
      const threads = data.threads || []
      return threads.length
    } catch (error) {
      console.error("[E2E] Error fetching decoy thread count:", error)
      return 0
    }
  }

  async function fetchBiddingSessionCount(car_id: string): Promise<{ count: number; hasActiveCampaigns: boolean }> {
    try {
      const response = await fetch("/api/e2e/bidding-session-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id }),
      })

      if (!response.ok) {
        return { count: 0, hasActiveCampaigns: false }
      }

      const data = await response.json()
      return {
        count: data.bidding_session_count || 0,
        hasActiveCampaigns: data.has_active_campaigns || false
      }
    } catch (error) {
      console.error("[E2E] Error fetching bidding session count:", error)
      return { count: 0, hasActiveCampaigns: false }
    }
  }



  async function handleSendZns(phone: string, leadId?: string) {
    if (!phone) return

    try {
      const response = await fetch("/api/e2e/send-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: "499943",
          phoneNumbers: [phone],
          leadId: leadId // Pass leadId for sale activity logging
        })
      })

      const data = await response.json()

      if (data.success && (!data.failedSends || data.failedSends === 0)) {
        toast({
          title: "ZNS Thành công",
          description: "Gửi thành công toàn bộ",
          className: "bg-green-50 border-green-200 text-green-900"
        })
        return
      }

      if (data.results && data.results.length > 0) {
        data.results.forEach((result: any) => {
          const status = result.value?.status
          const errorMsg = result.value?.error || result.reason || ""

          if (status === 'success') {
            toast({
              title: "ZNS Thành công",
              description: `Đã gửi đến ${result.phone}`,
              className: "bg-green-50 border-green-200 text-green-900"
            })
          } else {
            let msg = `Lỗi: ${errorMsg}`
            if (errorMsg.includes('-118') || errorMsg.includes('not existed')) {
              msg = "SĐT chưa đăng ký Zalo"
            } else if (errorMsg.includes('-119') || errorMsg.includes('user blocked')) {
              msg = "Khách chặn tin từ OA"
            } else if (errorMsg.includes('Quota') || errorMsg.includes('hết hạn mức')) {
              msg = "Hết hạn mức trong ngày"
            }
            toast({
              title: "ZNS Thất bại",
              description: msg,
              variant: "destructive",
            })
          }
        })
      } else {
        toast({
          title: "ZNS Lỗi hệ thống",
          description: "Không thể gửi tin nhắn ZNS",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[E2E] Error sending ZNS:", error)
      toast({
        title: "ZNS Lỗi",
        description: "Lỗi kết nối đến server ZNS",
        variant: "destructive",
      })
    }
  }

  // Create new chat thread
  async function handleCreateThread() {
    if (!selectedLead) return

    // Validate 4 digits
    if (!/^\d{4}$/.test(fourDigitsInput)) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập đúng 4 số cuối điện thoại",
        variant: "destructive",
      })
      return
    }

    setCreateThreadLoading(true)
    try {
      const response = await fetch("/api/e2e/create-thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: selectedLead.id,
          fourDigits: fourDigitsInput,
          firstMessage: firstMessageInput || "Hello"
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Lỗi",
          description: data.error || "Không thể tạo thread",
          variant: "destructive",
        })

        // Send ZNS as fallback when thread creation fails
        if (sendZns && selectedLead.phone) {
          await handleSendZns(selectedLead.phone, selectedLead.id)
        }

        // Close dialog and reset input even on failure
        setCreateThreadOpen(false)
        setFourDigitsInput("")
        setFirstMessageInput("Hello")
        setSendZns(false)
        return
      }

      if (data.success) {
        toast({
          title: "Thành công",
          description: "Đã tạo thread mới",
        })

        // Log sale activity for decoy web chat creation
        console.log("[DECOY_WEB_CHAT] Logging activity for lead:", selectedLead.id)
        try {
          const activityPayload = {
            leadId: selectedLead.id,
            activityType: "DECOY_SUMMARY",
            metadata: {
              field_name: "decoy_web_chat",
              previous_value: null,
              new_value: "Đã tạo thread mới",
              channel: "WEB"
            },
            actorType: "USER",
            field: "decoy_web_chat",
          }
          console.log("[DECOY_WEB_CHAT] Sending activity payload:", JSON.stringify(activityPayload))

          const activityResponse = await fetch("/api/e2e/log-activity", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(activityPayload),
          })

          const responseData = await activityResponse.json()
          console.log("[DECOY_WEB_CHAT] Activity API response:", activityResponse.status, responseData)

          // Trigger Sale Activities panel refresh
          setActivitiesRefreshKey(prev => prev + 1)
        } catch (err) {
          console.error("[E2E] Error logging decoy web chat activity:", err)
        }

        // Send ZNS if toggle is on
        if (sendZns && selectedLead.phone) {
          await handleSendZns(selectedLead.phone, selectedLead.id)
        }

        // Trigger Decoy Web Tab refresh
        console.log("[handleCreateThread] Triggering decoyWebRefreshKey increment")
        setDecoyWebRefreshKey(prev => {
          console.log("[handleCreateThread] decoyWebRefreshKey will change from", prev, "to", prev + 1)
          return prev + 1
        })

        // Close create modal and reset input
        setCreateThreadOpen(false)
        setFourDigitsInput("")
        setFirstMessageInput("Hello")
        setSendZns(false)
      }
    } catch (error) {
      console.error("[E2E] Error creating thread:", error)
      toast({
        title: "Lỗi",
        description: "Không thể tạo thread mới",
        variant: "destructive",
      })
    } finally {
      setCreateThreadLoading(false)
    }
  }



  async function handleSyncCurrentLead() {
    if (!selectedLead) return

    const phone = selectedLead.phone || selectedLead.additional_phone
    if (!phone) {
      toast({
        title: "Lỗi",
        description: "Không có số điện thoại để đồng bộ",
        variant: "destructive",
      })
      return
    }

    setSyncing(true)

    try {
      // Fetch updated lead details
      const leadDetails = await fetchLeadDetails(phone)

      // Fetch dealer bidding status
      const dealerBiddingStatus = leadDetails.car_id
        ? await checkDealerBidding(leadDetails.car_id)
        : { status: "not_sent" as const }

      // Fetch decoy thread count
      const decoyThreadCount = await fetchDecoyThreadCount(selectedLead.id)

      // Fetch bidding session count and active campaigns
      const { count: biddingSessionCount, hasActiveCampaigns } = leadDetails.car_id
        ? await fetchBiddingSessionCount(leadDetails.car_id)
        : { count: 0, hasActiveCampaigns: false }

      // Update selected lead with all new data
      const updatedLead: Lead = {
        ...selectedLead,
        car_id: leadDetails.car_id,
        car_auction_id: leadDetails.car_id,
        price_customer: leadDetails.price_customer,
        brand: leadDetails.brand,
        model: leadDetails.model,
        variant: leadDetails.variant,
        year: leadDetails.year,
        plate: leadDetails.plate,
        stage: leadDetails.stage,
        has_enough_images: leadDetails.has_enough_images,
        bot_active: leadDetails.bot_status,
        price_highest_bid: leadDetails.price_highest_bid,
        first_message_sent: leadDetails.first_message_sent,
        session_created: leadDetails.session_created,
        notes: leadDetails.notes,
        pic_id: leadDetails.pic_id || selectedLead.pic_id,
        pic_name: leadDetails.pic_name,
        location: leadDetails.location,
        mileage: leadDetails.mileage,
        is_primary: leadDetails.is_primary,
        dealer_bidding: dealerBiddingStatus,
        decoy_thread_count: decoyThreadCount,
        bidding_session_count: biddingSessionCount,
        has_active_campaigns: hasActiveCampaigns,
        workflow2_is_active: leadDetails.workflow2_is_active,
      }

      setSelectedLead(updatedLead)

      // Refetch leads to get updated data from server
      refetchLeads()

      // Invalidate workflow instances query to refetch E2E database data
      if (updatedLead.car_id) {
        queryClient.invalidateQueries({ queryKey: ["workflow-instances", updatedLead.car_id] })
      }

      toast({
        title: "Đã đồng bộ",
        description: "Dữ liệu đã được cập nhật",
      })
    } catch (error) {
      console.error("[E2E] Error syncing lead data:", error)
      toast({
        title: "Lỗi",
        description: "Không thể đồng bộ dữ liệu",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  async function handleWorkflowActivated() {
    // Invalidate workflow instances query to refetch E2E database data
    if (selectedLead?.car_id) {
      queryClient.invalidateQueries({ queryKey: ["workflow-instances", selectedLead.car_id] })
    }

    toast({
      title: "Thành công",
      description: "Workflow đã được kích hoạt thành công",
    })
  }

  async function handleRenameLead() {
    if (!selectedLead) return

    const phone_number = selectedLead.phone || selectedLead.additional_phone
    const pic_id = selectedLead.pic_id

    if (!phone_number) {
      toast({
        title: "Lỗi",
        description: "Không có số điện thoại",
        variant: "destructive",
      })
      return
    }

    if (!pic_id) {
      toast({
        title: "Lỗi",
        description: "Không có PIC ID",
        variant: "destructive",
      })
      return
    }

    setRenamingLead(true)

    try {
      const response = await fetch("/api/akabiz/rename-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number, pic_id }),
      })

      if (!response.ok) {
        throw new Error("Failed to rename lead")
      }

      const data = await response.json()

      toast({
        title: "Thành công",
        description: "Đã đổi tên lead thành công",
      })

      // Optionally sync the lead data to get updated info
      await handleSyncCurrentLead()
    } catch (error) {
      console.error("[E2E] Error renaming lead:", error)
      toast({
        title: "Lỗi",
        description: "Không thể đổi tên lead",
        variant: "destructive",
      })
    } finally {
      setRenamingLead(false)
    }
  }

  async function handleSendFirstMessage() {
    if (!selectedLead) return

    const customer_phone = selectedLead.phone || selectedLead.additional_phone

    if (!selectedLead.pic_id) {
      toast({
        title: "Lỗi",
        description: "Không có PIC ID",
        variant: "destructive",
      })
      return
    }

    // Build car details message
    const carParts = []
    if (selectedLead.brand) carParts.push(selectedLead.brand)
    if (selectedLead.model) carParts.push(selectedLead.model)
    if (selectedLead.variant) carParts.push(selectedLead.variant)
    if (selectedLead.year) carParts.push(selectedLead.year.toString())

    const carInfo = carParts.length > 0 ? carParts.join(" ") : "xe"

    // Build location and mileage text
    const mileageText = selectedLead.mileage ? `${selectedLead.mileage.toLocaleString('vi-VN')} km` : "Đang cập nhật"
    const locationText = selectedLead.location || "TP. Hồ Chí Minh"

    const messages = [
      "Dạ em là nhân viên từ Vucar. Em liên hệ hỗ trợ mình để bán xe TP. Hồ Chí Minh ạ. Em đang có 2-3 người mua sẵn quan tâm dòng này ạ",
      `Thông tin chi tiết xe: ${carInfo}\nSố km đã đi (Odo): ${mileageText}\nKhu vực: ${locationText}`,
      "Mình cho em xin vài hình ảnh xe + hình ảnh giấy tờ đăng kiểm để em xác nhận lại thông tin xe và kết nối xe mình đến người mua phù hợp nhất nha."
    ]

    setSendingMessage(true)

    try {
      const response = await fetch("/api/akabiz/send-customer-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_phone, messages, picId: selectedLead.pic_id }),
      })

      if (!response.ok) {
        throw new Error("Failed to send message")
      }

      const data = await response.json()

      toast({
        title: "Thành công",
        description: "Đã gửi tin nhắn đầu tiên cho khách hàng",
      })

      // Optionally sync the lead data to get updated info
      await handleSyncCurrentLead()
    } catch (error) {
      console.error("[E2E] Error sending first message:", error)
      toast({
        title: "Lỗi",
        description: "Không thể gửi tin nhắn",
        variant: "destructive",
      })
    } finally {
      setSendingMessage(false)
    }
  }

  async function handleTogglePrimary() {
    if (!selectedLead || !selectedLead.car_id) {
      toast({
        title: "Lỗi",
        description: "Không có car_id để cập nhật",
        variant: "destructive",
      })
      return
    }

    setUpdatingPrimary(true)

    try {
      const newPrimaryStatus = !selectedLead.is_primary

      const response = await fetch("/api/e2e/update-primary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          car_id: selectedLead.car_id,
          is_primary: newPrimaryStatus
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update primary status")
      }



      // Update local state
      const updatedLead = {
        ...selectedLead,
        is_primary: newPrimaryStatus
      }

      setSelectedLead(updatedLead)

      // Refetch leads to get updated data from server (with cache busting)
      setRefreshKey(prev => prev + 1)
      refetchCounts()

      toast({
        title: "Thành công",
        description: newPrimaryStatus
          ? "Đã đánh dấu xe là Primary"
          : "Đã bỏ đánh dấu Primary",
      })
    } catch (error) {
      console.error("[E2E] Error updating primary status:", error)
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật trạng thái Primary",
        variant: "destructive",
      })
    } finally {
      setUpdatingPrimary(false)
    }
  }



  async function fetchDealers() {
    try {
      const response = await fetch("/api/e2e/dealers")
      if (response.ok) {
        const data = await response.json()
        setDealers(data.dealers || [])
      }
    } catch (error) {
      console.error("[E2E] Error fetching dealers:", error)
    }
  }

  async function handleCreateBiddingManual() {
    if (!selectedLead?.car_id || !newBidDealerId || !newBidPrice) return

    // Parse shorthand price (e.g., 500 -> 500000000)
    const price = parseShorthandPrice(newBidPrice)
    if (price === undefined || price < 1) {
      toast({
        title: "Lỗi",
        description: "Giá không hợp lệ",
        variant: "destructive",
      })
      return
    }

    setCreatingBiddingManual(true)
    try {
      const response = await fetch("/api/e2e/bidding-history/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          car_id: selectedLead.car_id,
          dealer_id: newBidDealerId,
          price: price,
          comment: newBidComment
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create bidding")
      }

      toast({
        title: "Thành công",
        description: "Đã thêm giá thành công",
      })

      // Reset form
      setNewBidDealerId("")
      setNewBidPrice("")
      setNewBidComment("")

      // Refresh list
      fetchBiddingHistory(selectedLead.car_id)
    } catch (error) {
      console.error("[E2E] Error creating bidding:", error)
      toast({
        title: "Lỗi",
        description: "Không thể thêm giá",
        variant: "destructive",
      })
    } finally {
      setCreatingBiddingManual(false)
    }
  }

  async function handleCopyLeadInfo() {
    if (!selectedLead) return;

    try {
      // Build car details
      const carName = [selectedLead.brand, selectedLead.model, selectedLead.variant, selectedLead.year]
        .filter(Boolean)
        .join(" ") || "N/A";

      // Format mileage
      const mileageText = selectedLead.mileage
        ? `${selectedLead.mileage.toLocaleString('vi-VN')} km`
        : "N/A";

      // Format location
      const locationText = selectedLead.location || "N/A";

      // Format date and time
      const now = new Date();
      const timeString = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const dateString = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

      // Build the copy text
      const copyText = `Thời gian nhận thông tin: ${timeString} ${dateString}
Thông tin chi tiết xe: ${carName}
Số km đã đi (Odo): ${mileageText}
Khu vực:  - ${locationText}
Car_id: ${selectedLead.car_id || "N/A"}
Tình trạng pháp lý: Chưa rõ - Chưa rõ
Phí hoa hồng trả Vucar: Tổng chi hoặc <điền vào đây>`;

      await navigator.clipboard.writeText(copyText);

      toast({
        title: "Đã sao chép!",
        description: "Thông tin xe đã được sao chép vào clipboard",
      });
    } catch (error) {
      console.error('[COPY] Error copying to clipboard:', error);
      toast({
        title: "Lỗi",
        description: "Không thể sao chép thông tin",
        variant: "destructive",
      });
    }
  }

  async function fetchBiddingHistory(car_id: string, openDialog: boolean = true) {
    setLoadingBiddingHistory(true)
    if (openDialog) {
      setBiddingHistoryOpen(true)
      setEditingBiddingId(null) // Reset editing state
      fetchDealers() // Fetch dealers when opening history
    }

    try {
      const response = await fetch("/api/e2e/bidding-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.details || "Failed to fetch bidding history")
      }

      const data = await response.json()
      setBiddingHistory(data.biddings || [])
    } catch (error) {
      console.error("[E2E] Error fetching bidding history:", error)
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tải lịch sử trả giá",
        variant: "destructive",
      })
      setBiddingHistory([])
    } finally {
      setLoadingBiddingHistory(false)
    }
  }

  async function handleUpdateBiddingPrice(id: string) {
    if (!editingPrice) return

    // Parse shorthand price (e.g., 500 -> 500000000)
    const price = parseShorthandPrice(editingPrice)
    if (price === undefined || price < 1) {
      toast({
        title: "Lỗi",
        description: "Giá không hợp lệ",
        variant: "destructive",
      })
      return
    }

    setUpdatingBidding(true)
    try {
      const response = await fetch("/api/e2e/bidding-history/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          price: price
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update price")
      }

      toast({
        title: "Thành công",
        description: "Đã cập nhật giá thành công",
      })

      setEditingBiddingId(null)
      // Refresh list
      if (selectedLead?.car_id) {
        fetchBiddingHistory(selectedLead.car_id)
      }
    } catch (error) {
      console.error("[E2E] Error updating bidding price:", error)
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật giá",
        variant: "destructive",
      })
    } finally {
      setUpdatingBidding(false)
    }
  }

  // Handler for inline bid price update (from WorkflowTrackerTab)
  async function handleUpdateBidPriceInline(bidId: string, newPrice: number): Promise<void> {
    try {
      const response = await fetch("/api/e2e/bidding-history/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: bidId,
          price: newPrice
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update price")
      }

      toast({
        title: "Thành công",
        description: "Đã cập nhật giá thành công",
      })

      // Refresh bidding history
      if (selectedLead?.car_id) {
        await fetchBiddingHistory(selectedLead.car_id)
      }
    } catch (error) {
      console.error("[E2E] Error updating bidding price:", error)
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật giá",
        variant: "destructive",
      })
      throw error
    }
  }

  // Handler for inline notes update (from WorkflowTrackerTab)
  async function handleUpdateNotesInline(notes: string): Promise<void> {
    if (!selectedLead?.car_id) {
      toast({
        title: "Lỗi",
        description: "Không tìm thấy Car ID",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/e2e/update-sale-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId: selectedLead.car_id,
          leadId: selectedLead.id,
          notes: notes,
          previousValues: {
            notes: selectedLead.notes,
          }
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update notes")
      }

      // Update local state
      const updatedLead = {
        ...selectedLead,
        notes: notes,
      }

      setSelectedLead(updatedLead)

      // Refetch leads to get updated data from server
      refetchLeads()

      toast({
        title: "Thành công",
        description: "Đã cập nhật ghi chú",
      })

      // Trigger Sale Activities panel refresh
      setActivitiesRefreshKey(prev => prev + 1)
    } catch (error) {
      console.error("[E2E] Error updating notes:", error)
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể cập nhật ghi chú",
        variant: "destructive",
      })
      throw error
    }
  }


  async function searchLeadByPhone() {
    // Phase 2: Update URL only, React Query will automatically refetch
    const params = new URLSearchParams(searchParams.toString())

    if (!searchPhone.trim()) {
      // If search is cleared, remove search param and reset to page 1
      params.delete("search")
      params.set("page", "1")
    } else {
      // Add search param and reset to page 1
      params.set("search", searchPhone)
      params.set("page", "1")
    }

    router.push(buildUrl(params), { scroll: false })
  }

  // Phase 2: Manual fetch functions removed - replaced by React Query hooks
  // DEPRECATED: fetchPageData is no longer needed as batch endpoint returns all enriched data
  // Keeping this commented for reference during migration
  // async function fetchPageData(pageLeadsToFetch: Lead[]) {
  //   ... (function body removed)
  // }

  function formatDate(dateString: string | number) {
    const date = new Date(dateString)
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function getDisplayPhone(lead: Lead): string {
    return lead.phone || lead.additional_phone || "N/A"
  }

  function formatPrice(price: number): string {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price)
  }

  function getDealerBiddingDisplay(status?: DealerBiddingStatus): string {
    if (!status) return "Not Sent"
    switch (status.status) {
      case "not_sent":
        return "Not Sent"
      case "sent":
        return "Sent"
      case "got_price":
        return status.maxPrice ? formatPrice(status.maxPrice) : "Got Price"
      default:
        return "Not Sent"
    }
  }

  function formatCarInfo(lead: Lead): string {
    const parts = []
    if (lead.brand) parts.push(lead.brand)
    if (lead.model) parts.push(lead.model)
    if (lead.variant) parts.push(lead.variant)
    if (lead.year) parts.push(lead.year.toString())
    if (lead.mileage) parts.push(`${lead.mileage.toLocaleString()}km`)
    return parts.length > 0 ? parts.join(" ") : "N/A"
  }

  function getStageStyle(stage: string | null | undefined): string {
    if (!stage) return "bg-gray-100 text-gray-800"

    const stageLower = stage.toLowerCase()

    // Stage color mapping
    if (stageLower === 'undefined') {
      return "bg-white-100 text-white-800"
    }
    if (stageLower === 'cannot_contact') {
      return "bg-white-100 text-white-800"
    }
    if (stageLower === 'contacted') {
      return "bg-cyan-100 text-cyan-800"
    }
    if (stageLower === 'negotiation') {
      return "bg-purple-100 text-purple-800"
    }
    if (stageLower === 'car_view') {
      return "bg-emerald-100 text-emerald-800"
    }
    if (stageLower === 'deposit_view') {
      return "bg-blue-100 text-blue-800"
    }
    if (stageLower === 'completed') {
      return "bg-green-100 text-green-800"
    }
    if (stageLower === 'failed') {
      return "bg-green-100 text-green-800"
    }

    // Default color for unknown stages
    return "bg-white-100 text-white-800"
  }


  // Get unique sources from database for filter dropdown
  const availableSources: string[] = sourceData?.sources || []

  // Phase 2: All filtering is now done on backend (tab, search, sources)
  // Server returns already filtered and paginated results

  // Use counts from backend for tab badges
  const priorityCount = counts.priority
  const nurtureCount = counts.nurture

  // Pagination calculations based on backend counts
  const currentTabCount = activeTab === "priority" ? priorityCount : nurtureCount
  const totalPages = Math.ceil(currentTabCount / ITEMS_PER_PAGE)

  // Leads are already filtered and paginated from backend, display them directly
  const currentPageLeads = enrichedLeads

  const handleTabChange = (tab: "priority" | "nurture") => {
    // Phase 2: Update URL only, React Query will automatically refetch
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tab)
    params.set("page", "1") // Reset to first page when tab changes

    router.push(buildUrl(params), { scroll: false })
  }

  // Phase 2: Unified handlers that update URL only
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(newPage))

    router.push(buildUrl(params), { scroll: false })
  }

  const handleSourceFilterChange = (newSources: string[]) => {
    const params = new URLSearchParams(searchParams.toString())

    if (newSources.length > 0) {
      params.set("sources", newSources.join(","))
    } else {
      params.delete("sources")
    }
    params.set("page", "1") // Reset to first page when filtering

    router.push(buildUrl(params), { scroll: false })
  }

  const handleClearSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("search")
    params.set("page", "1") // Reset to first page when clearing search
    setSearchPhone("") // Clear the search input as well
    router.push(buildUrl(params), { scroll: false })
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1)
    }
  }

  const handleCallTrigger = async (actionType: 'CHECK_VAR' | 'FIRST_CALL') => {
    // 1. Validation
    const phoneNumber = selectedLead?.phone || selectedLead?.additional_phone
    if (!phoneNumber) {
      toast({
        title: "Lỗi",
        description: "Không tìm thấy số điện thoại của Lead này.",
        variant: "destructive"
      });
      return;
    }

    // 2. Define Endpoint based on Action
    let endpoint = actionType === 'FIRST_CALL'
      ? 'https://n8n.vucar.vn/webhook/firstcall-chotot'
      : 'https://n8n.vucar.vn/webhook/checkvar-lead';

    setCallingBot(true);

    try {
      // 3. Call API
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber })
      });

      if (response.ok) {
        // 4. Success Feedback
        toast({
          title: "Thành công",
          description: "Đã kích hoạt action gọi thành công, hãy đợi phản hồi bên slack"
        });
      } else {
        toast({
          title: "Lỗi",
          description: "Lỗi: Không thể kích hoạt Bot.",
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error(error);
      toast({
        title: "Lỗi",
        description: "Lỗi kết nối hệ thống.",
        variant: "destructive"
      });
    } finally {
      setCallingBot(false);
    }
  };

  // Handler functions for edit mode in detail dialog
  function handleEditToggle() {
    if (!selectedLead) return

    setEditMode(true)
    setEditedStage(selectedLead.stage || "")
    // Use shorthand format for prices (e.g., 500000000 -> "500")
    setEditedPriceCustomer(formatPriceForEdit(selectedLead.price_customer))
    setEditedPriceHighestBid(formatPriceForEdit(selectedLead.price_highest_bid))
    setEditedQualified(selectedLead.qualified || "")
    setEditedIntentionLead(selectedLead.intentionLead || "")
    setEditedNegotiationAbility(selectedLead.negotiationAbility || "")
    setEditedNotes(selectedLead.notes || "")
  }

  function handleCancelEdit() {
    setEditMode(false)
    setEditedStage("")
    setEditedPriceCustomer("")
    setEditedPriceHighestBid("")
    setEditedQualified("")
    setEditedIntentionLead("")
    setEditedNegotiationAbility("")
    setEditedNotes("")
  }

  function handleQuickEdit(lead: Lead, e: React.MouseEvent) {
    e.stopPropagation()
    if (!lead) return

    setSelectedLead(lead)
    setEditMode(true)
    setEditedStage(lead.stage || "")
    // Use shorthand format for prices (e.g., 500000000 -> "500")
    setEditedPriceCustomer(formatPriceForEdit(lead.price_customer))
    setEditedPriceHighestBid(formatPriceForEdit(lead.price_highest_bid))
    setEditedQualified(lead.qualified || "")
    setEditedIntentionLead(lead.intentionLead || "")
    setEditedNegotiationAbility(lead.negotiationAbility || "")
    setEditedNotes(lead.notes || "")
    setDetailDialogOpen(true)
  }

  async function handleSaveChanges() {
    if (!selectedLead) return

    // Validate prices
    // Remove dots (thousands separators) before parsing
    const cleanPrice = (priceStr: string) => {
      if (!priceStr) return undefined
      // Remove all dots and commas before parsing
      const cleaned = priceStr.replace(/[.,]/g, "")
      let val = parseFloat(cleaned)

      // If value < 10,000, assume it's a shortcut for millions (e.g. 350 -> 350,000,000)
      if (!isNaN(val) && val < 10000) {
        val *= 1000000
      }
      return val
    }

    const priceCustomer = cleanPrice(editedPriceCustomer)
    const priceHighestBid = cleanPrice(editedPriceHighestBid)

    if (priceCustomer !== undefined && (isNaN(priceCustomer) || priceCustomer < 0)) {
      toast({
        title: "Lỗi",
        description: "Giá mong muốn phải là số >= 0",
        variant: "destructive",
      })
      return
    }

    if (priceHighestBid !== undefined && (isNaN(priceHighestBid) || priceHighestBid < 0)) {
      toast({
        title: "Lỗi",
        description: "Giá cao nhất phải là số >= 0",
        variant: "destructive",
      })
      return
    }

    setUpdatingSaleStatus(true)

    try {
      // Use existing car_id from selectedLead - no need to fetch again
      const carId = selectedLead.car_id

      if (!carId) {
        toast({
          title: "Lỗi",
          description: "Không tìm thấy Car ID",
          variant: "destructive",
        })
        setUpdatingSaleStatus(false)
        return
      }

      // Build payload with required carId - upsert API will create or update based on carId
      const payload: any = {
        carId,
        leadId: selectedLead.id,
        previousValues: {
          stage: selectedLead.stage,
          price_customer: selectedLead.price_customer,
          price_highest_bid: selectedLead.price_highest_bid,
          qualified: selectedLead.qualified,
          intentionLead: selectedLead.intentionLead,
          negotiationAbility: selectedLead.negotiationAbility,
          notes: selectedLead.notes,
        }
      }

      let hasChanges = false

      if (editedStage && editedStage !== selectedLead.stage) {
        payload.stage = editedStage
        hasChanges = true
      }

      if (priceCustomer !== undefined && priceCustomer !== selectedLead.price_customer) {
        payload.price_customer = priceCustomer
        hasChanges = true
      }

      if (priceHighestBid !== undefined && priceHighestBid !== selectedLead.price_highest_bid) {
        payload.price_highest_bid = priceHighestBid
        hasChanges = true
      }

      if (editedQualified && editedQualified !== selectedLead.qualified) {
        payload.qualified = editedQualified
        hasChanges = true
      }

      if (editedIntentionLead && editedIntentionLead !== selectedLead.intentionLead) {
        payload.intentionLead = editedIntentionLead
        hasChanges = true
      }

      if (editedNegotiationAbility && editedNegotiationAbility !== selectedLead.negotiationAbility) {
        payload.negotiationAbility = editedNegotiationAbility
        hasChanges = true
      }

      if (editedNotes !== undefined && editedNotes !== (selectedLead.notes || "")) {
        payload.notes = editedNotes
        hasChanges = true
      }

      // Check if there are any changes
      if (!hasChanges) {
        toast({
          title: "Thông báo",
          description: "Không có thay đổi nào",
        })
        setUpdatingSaleStatus(false)
        return
      }

      // Call update API
      const response = await fetch("/api/e2e/update-sale-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update")
      }

      // Update local state
      const updatedLead = {
        ...selectedLead,
        stage: editedStage || selectedLead.stage,
        price_customer: priceCustomer !== undefined ? priceCustomer : selectedLead.price_customer,
        price_highest_bid: priceHighestBid !== undefined ? priceHighestBid : selectedLead.price_highest_bid,
        qualified: editedQualified || selectedLead.qualified,
        intentionLead: editedIntentionLead || selectedLead.intentionLead,
        negotiationAbility: editedNegotiationAbility || selectedLead.negotiationAbility,
        notes: editedNotes !== undefined ? editedNotes : selectedLead.notes,
      }

      setSelectedLead(updatedLead)

      // Refetch leads to get updated data from server
      refetchLeads()

      toast({
        title: "Thành công",
        description: "Đã cập nhật thông tin",
      })

      // Trigger Sale Activities panel refresh
      setActivitiesRefreshKey(prev => prev + 1)

      // Exit edit mode
      setEditMode(false)
      setEditedStage("")
      setEditedPriceCustomer("")
      setEditedPriceHighestBid("")
      setEditedQualified("")
      setEditedIntentionLead("")
      setEditedNegotiationAbility("")
      setEditedNotes("")
    } catch (error) {
      console.error("[E2E] Error updating sale status:", error)
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể cập nhật thông tin",
        variant: "destructive",
      })
    } finally {
      setUpdatingSaleStatus(false)
    }
  }

  async function fetchSummaryReport() {
    if (!selectedAccount) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn tài khoản trước",
        variant: "destructive",
      })
      return
    }

    if (!selectedDate) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn ngày",
        variant: "destructive",
      })
      return
    }

    setLoadingSummary(true)
    setSummaryError(null)
    setSummaryReport(null)

    try {
      // Format date as YYYY-MM-DD-HH-MM
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')

      // Get current time for the request
      const now = new Date()
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')

      const formattedDate = `${year}-${month}-${day}-${hours}-${minutes}`

      const response = await fetch(
        `https://n8n.vucar.vn/webhook/summarye2e?pic_id=${selectedAccount}&created_at=${formattedDate}`,
        {
          method: "GET",
        }
      )

      if (!response.ok) {
        throw new Error("Không thể tải báo cáo")
      }

      const data = await response.json()

      if (Array.isArray(data) && data.length > 0) {
        setSummaryReport(data[0])
        toast({
          title: "Thành công",
          description: "Đã tải báo cáo",
        })
      } else {
        setSummaryError("Không có dữ liệu cho ngày này")
        toast({
          title: "Thông báo",
          description: "Không có dữ liệu cho ngày này",
        })
      }
    } catch (error) {
      console.error("[E2E] Error fetching summary report:", error)
      setSummaryError(error instanceof Error ? error.message : "Không thể tải báo cáo")
      toast({
        title: "Lỗi",
        description: "Không thể tải báo cáo",
        variant: "destructive",
      })
    } finally {
      setLoadingSummary(false)
    }
  }

  // Handler for updating primary status from LeadListSidebar
  const handleUpdatePrimary = async (leadId: string, carId: string, isPrimary: boolean) => {
    const response = await fetch("/api/e2e/update-primary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        car_id: carId,
        is_primary: isPrimary
      }),
    })
    const data = await response.json()

    if (data.success) {
      if (selectedLead?.id === leadId) {
        setSelectedLead({ ...selectedLead, is_primary: isPrimary })
      }
      // Refetch leads to get updated data from server (with cache busting)
      setRefreshKey(prev => prev + 1)
      refetchCounts()
    } else {
      throw new Error("Failed to update primary status")
    }
  }

  return (
    <div className={`w-full ${isMobile ? 'h-dvh overflow-hidden' : ''}`}>
      {/* Account Selector - Mobile rendering disabled since MobileNavigationHeader handles it */}
      <AccountSelector
        selectedAccount={selectedAccount}
        onAccountChange={handleAccountChange}
        loading={loading}
        loadingCarIds={loadingCarIds}
        isMobile={false}
        mobileView={mobileView}
        onBackToList={() => {
          setMobileView('list')
          setSelectedLead(null)
        }}
      />

      {/* View Mode Toggle - Uses portal to render in header beside AccountSelector */}
      <ViewModeToggle
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isMobile={isMobile}
      />

      {/* Main Content - Conditional based on view mode */}
      {viewMode === "kanban" ? (
        <div className="p-4 bg-gray-50 h-[calc(100vh-150px)]">
          <CampaignKanbanView picId={selectedAccount} />
        </div>
      ) : (
        /* Split View Layout - Mobile uses full height with safe areas */
        <div className={`flex ${isMobile ? 'flex-col h-[calc(100dvh-56px)]' : 'gap-4 h-[calc(100vh-100px)]'} bg-gray-50 scroll-touch`}>
          {/* Lead List Sidebar */}
          {(!isMobile || mobileView === 'list') && (
            <LeadListSidebar
              isMobile={isMobile}
              mobileView={mobileView}
              selectedAccount={selectedAccount}
              loading={loading}
              loadingCarIds={loadingCarIds}
              searchPhone={searchPhone}
              appliedSearch={search}
              onSearchChange={setSearchPhone}
              onSearch={searchLeadByPhone}
              onClearSearch={handleClearSearch}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              priorityCount={priorityCount}
              nurtureCount={nurtureCount}
              currentPageLeads={currentPageLeads}
              selectedLead={selectedLead}
              onLeadClick={handleLeadClick}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              onSummaryOpen={() => setSummaryDialogOpen(true)}
              onUpdatePrimary={handleUpdatePrimary}
              updatingPrimary={updatingPrimary}
              sourceFilter={sourceFilter}
              onSourceFilterChange={handleSourceFilterChange}
              availableSources={availableSources}
            />
          )}



          {/* Right Panel - Lead Details */}
          <LeadDetailPanel
            selectedAccount={selectedAccount}
            selectedLead={selectedLead}
            isMobile={isMobile}
            mobileView={mobileView}


            activeDetailView={activeDetailView}
            onActiveDetailViewChange={setActiveDetailView}


            onTogglePrimary={handleTogglePrimary}
            updatingPrimary={updatingPrimary}

            onQuickEdit={handleQuickEdit}
            onSyncLead={handleSyncCurrentLead}
            syncing={syncing}

            activeWorkflowView={activeWorkflowView}
            onWorkflowViewChange={setActiveWorkflowView}

            onShowDetail={() => setDetailDialogOpen(true)}

            onCallBot={(action) => handleCallTrigger(action)}
            callingBot={callingBot}

            onOpenInspection={() => setInspectionSystemOpen(true)}

            onBackToList={() => {
              setMobileView('list')
              setSelectedLead(null)
            }}

            workflow2Data={workflow2Data}
            workflow2Open={workflow2Open}
            setWorkflow2Open={setWorkflow2Open}
            onDecoyDialog={() => setDecoyDialogOpen(true)}

            onOpenCreateThread={() => setCreateThreadOpen(true)}
            onOpenWorkflowDialog={() => setWorkflow2Open(true)}

            // Workflow Handlers
            onSendFirstMessage={handleSendFirstMessage}
            sendingMessage={sendingMessage}
            onViewBiddingHistory={() => {
              if (selectedLead?.car_id) {
                fetchBiddingHistory(selectedLead.car_id)
              }
            }}
            onCreateSession={() => setConfirmSessionOpen(true)}
            creatingSession={false}
            onBotToggle={(active) => {
              if (selectedLead) handleBotToggle(selectedLead, active)
              return Promise.resolve()
            }}
            togglingBot={false}
            onRenameLead={handleRenameLead}
            renamingLead={renamingLead}

            // Dealer Bidding Props
            biddingHistory={biddingHistory}
            onUpdateBid={handleUpdateBidPriceInline}
            loadingBiddingHistory={loadingBiddingHistory}

            // Notes editing
            onUpdateNotes={handleUpdateNotesInline}

            // Decoy Web refresh
            decoyWebRefreshKey={decoyWebRefreshKey}

            // Workflow activation
            onWorkflowActivated={handleWorkflowActivated}
          />

          {/* Sale Activities Panel - Right Side */}
          <SaleActivitiesPanel
            selectedLead={selectedLead}
            isMobile={isMobile}
            mobileView={mobileView}
            refreshKey={activitiesRefreshKey}
            onUpdateNotes={handleUpdateNotesInline}
            isCollapsed={rightPanelCollapsed}
            onToggleCollapse={() => setRightPanelCollapsed(!rightPanelCollapsed)}
          />
        </div>
      )}

      {/* Create Bidding Confirmation Dialog */}
      <CreateBiddingDialog
        open={confirmBiddingOpen}
        onOpenChange={setConfirmBiddingOpen}
        lead={selectedLead}
        onSuccess={() => {
          // Phase 2: React Query will automatically refetch when we call refetch
          refetchLeads()
        }}
      />

      {/* Create Session Confirmation Dialog */}
      <CreateSessionDialog
        open={confirmSessionOpen}
        onOpenChange={setConfirmSessionOpen}
        selectedLead={selectedLead}
        onSuccess={(sessionCreated) => {
          setSelectedLead(prev => prev ? { ...prev, session_created: sessionCreated } : null)
          // Phase 2: React Query will automatically refetch when we call refetch
          refetchLeads()
        }}
      />

      {/* Workflow 2 Activation Dialog */}
      <Workflow2Dialog
        open={workflow2Open}
        onOpenChange={setWorkflow2Open}
        selectedLead={selectedLead}
        defaultData={workflow2Data}
        onSuccess={(workflow2Active) => {
          setSelectedLead(prev => prev ? { ...prev, workflow2_is_active: workflow2Active } : null)
          // Phase 2: React Query will automatically refetch when we call refetch
          refetchLeads()
        }}
        onOpenDecoyDialog={() => setDecoyDialogOpen(true)}
      />

      {/* Bidding History Dialog */}
      <BiddingHistoryDialog
        open={biddingHistoryOpen}
        onOpenChange={setBiddingHistoryOpen}
        biddingHistory={biddingHistory}
        loadingBiddingHistory={loadingBiddingHistory}
        dealers={dealers}
        selectedLead={selectedLead}
        onAddBid={handleCreateBiddingManual}
        creatingBiddingManual={creatingBiddingManual}
        onUpdateBid={handleUpdateBiddingPrice}
        updatingBidding={updatingBidding}
        onOpenSendDealerDialog={handleOpenSendDealerDialog}
        newBidDealerId={newBidDealerId}
        setNewBidDealerId={setNewBidDealerId}
        newBidPrice={newBidPrice}
        setNewBidPrice={setNewBidPrice}
        newBidComment={newBidComment}
        setNewBidComment={setNewBidComment}
        editingBiddingId={editingBiddingId}
        setEditingBiddingId={setEditingBiddingId}
        editingPrice={editingPrice}
        setEditingPrice={setEditingPrice}
      />





      {/* Decoy Trigger Dialog */}
      {/* Decoy Trigger Dialog */}
      <DecoyTriggerDialog
        open={decoyDialogOpen}
        onOpenChange={setDecoyDialogOpen}
        selectedLead={selectedLead}
        onSuccess={() => setActivitiesRefreshKey(prev => prev + 1)}
      />


      {/* Edit Lead Dialog (formerly DetailDialog) */}
      <EditLeadDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        lead={selectedLead}

        // Edit Mode State
        editMode={editMode}
        setEditMode={setEditMode}

        // Form State
        editedPriceCustomer={editedPriceCustomer}
        setEditedPriceCustomer={setEditedPriceCustomer}
        editedPriceHighestBid={editedPriceHighestBid}
        setEditedPriceHighestBid={setEditedPriceHighestBid}
        editedStage={editedStage}
        setEditedStage={setEditedStage}
        editedQualified={editedQualified}
        setEditedQualified={setEditedQualified}
        editedIntentionLead={editedIntentionLead}
        setEditedIntentionLead={setEditedIntentionLead}
        editedNegotiationAbility={editedNegotiationAbility}
        setEditedNegotiationAbility={setEditedNegotiationAbility}
        editedNotes={editedNotes}
        setEditedNotes={setEditedNotes}

        // Gallery State
        processedImages={processedImages}
        onImageClick={(images, index) => {
          setGalleryImages(images)
          setSelectedImageIndex(index)
          setGalleryOpen(true)
        }}

        // Handlers
        onSave={handleSaveChanges}
        saving={updatingSaleStatus}

        // Helper
        getStageStyle={getStageStyle}
      />

      {/* Inspection System Dialog */}
      < Dialog open={inspectionSystemOpen} onOpenChange={setInspectionSystemOpen} >
        <DialogContent className="w-[95vw] h-[85vh] flex flex-col sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[95rem]">
          <DialogHeader>
            <DialogTitle>Inspection System</DialogTitle>
            <DialogDescription>
              Hệ thống kiểm tra xe - {selectedLead ? formatCarInfo(selectedLead) : ""}
              <br />
              View key: FOj9A9bloEZAIpe119ec76
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <iframe
              src="https://inspectionsystem.vucar.vn/"
              className="w-full h-full border-0"
              title="Inspection System"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInspectionSystemOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Send to Dealer Groups Dialog */}
      <SendToDealerGroupsDialog
        open={sendDealerDialogOpen}
        onOpenChange={setSendDealerDialogOpen}
        selectedLead={selectedLead}
        onSuccess={refetchLeads}
        dealerGroups={dealerGroups}
        loadingDealerGroups={loadingDealerGroups}
      />

      {/* Image Gallery Modal */}
      <ImageGalleryModal
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        images={galleryImages}
        initialIndex={selectedImageIndex}
        onIndexChange={setSelectedImageIndex}
      />

      {/* Summary Report Dialog */}
      <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Báo Cáo Tổng Hợp</DialogTitle>
            <DialogDescription>
              Xem báo cáo tổng hợp theo ngày và người phụ trách
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Filter Section */}
            <div className="grid grid-cols-2 gap-4">
              {/* Date Picker */}
              <div className="space-y-2">
                <Label>Chọn ngày</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? (
                        new Intl.DateTimeFormat('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        }).format(selectedDate)
                      ) : (
                        <span>Chọn ngày</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Account Display */}
              <div className="space-y-2">
                <Label>Người phụ trách</Label>
                <div className="flex items-center h-10 px-3 py-2 border rounded-md bg-gray-50">
                  <User className="mr-2 h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    {selectedAccount
                      ? ACCOUNTS.find((acc) => acc.uid === selectedAccount)?.name || "Chưa chọn"
                      : "Chưa chọn tài khoản"}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <Button
              onClick={fetchSummaryReport}
              disabled={!selectedAccount || !selectedDate || loadingSummary}
              className="w-full"
            >
              {loadingSummary ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tải...
                </>
              ) : (
                "Xem Báo Cáo"
              )}
            </Button>

            {/* Report Display Section */}
            {loadingSummary && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            )}

            {!loadingSummary && summaryError && (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">{summaryError}</p>
              </div>
            )}

            {!loadingSummary && summaryReport && (
              <div className="border rounded-lg p-6 bg-gray-50 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between border-b pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {summaryReport.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {summaryReport.created_at}
                    </p>
                  </div>
                  {summaryReport.row_number && (
                    <Badge variant="secondary">#{summaryReport.row_number}</Badge>
                  )}
                </div>

                {/* Report Content */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">Nội dung báo cáo:</Label>
                  <div
                    className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-white p-4 rounded border"
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {summaryReport.reports}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>



      {/* Summary Report Dialog */}
      {/* <SummaryReportDialog
        open={summaryDialogOpen}
        onOpenChange={setSummaryDialogOpen}
        selectedAccount={selectedAccount}
        selectedDate={selectedDate}
        setSelectedDate={(date) => setSelectedDate(date || new Date())}
        fetchSummaryReport={fetchSummaryReport}
        loadingSummary={loadingSummary}
        summaryReport={summaryReport}
        summaryError={summaryError}
      /> */}

      {/* Create Thread Dialog */}
      <CreateThreadDialog
        open={createThreadOpen}
        onOpenChange={setCreateThreadOpen}
        fourDigitsInput={fourDigitsInput}
        setFourDigitsInput={setFourDigitsInput}
        firstMessageInput={firstMessageInput}
        setFirstMessageInput={setFirstMessageInput}
        sendZns={sendZns}
        setSendZns={setSendZns}
        handleCreateThread={handleCreateThread}
        createThreadLoading={createThreadLoading}
      />


    </div>

  )
}
