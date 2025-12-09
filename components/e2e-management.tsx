"use client"

import { useState, useEffect, useMemo } from "react"
import { useIsMobile } from "@/components/ui/use-mobile"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SearchInput } from "@/components/ui/search-input"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, User, ChevronLeft, ChevronRight, MessageCircle, RefreshCw, Star, CheckCircle, DollarSign, Play, Zap, Search, Clock, Plus, FileText, Pencil, Copy, CalendarIcon, PhoneCall } from "lucide-react"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { maskPhone } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Switch } from "@/components/ui/switch"

interface DealerBiddingStatus {
  status: "not_sent" | "sent" | "got_price"
  maxPrice?: number
}

interface ChatMessage {
  _id: string
  content: string
  uidFrom: string
  timestamp: number
  dateAction: string
  type: string
  img?: string
}

interface Lead {
  id: string
  name: string
  phone: string | null
  identify_number: string | null
  bank_account_number: string | null
  otp_verified: string
  created_at: string
  pic_id: string | null
  pic_og: string
  source: string | null
  url: string | null
  additional_phone: string | null
  qx_qc_scoring: string | null
  customer_feedback: string | null
  is_referral: boolean
  car_id?: string | null
  dealer_bidding?: DealerBiddingStatus
  bot_active?: boolean
  price_customer?: number | null
  brand?: string | null
  model?: string | null
  variant?: string | null
  year?: number | null
  plate?: string | null
  stage?: string | null
  has_enough_images?: boolean
  first_message_sent?: boolean
  session_created?: boolean
  decoy_thread_count?: number
  notes?: string | null
  price_highest_bid?: number | null
  pic_name?: string | null
  location?: string | null
  mileage?: number | null
  is_primary?: boolean
  bidding_session_count?: number
  workflow2_is_active?: boolean | null
  additional_images?: {
    paper?: Array<{ key: string, url: string, name: string, type: string }>
    inside?: Array<{ key: string, url: string, name: string, type: string }>
    outside?: Array<{ key: string, url: string, name: string, type: string }>
    [key: string]: Array<{ key: string, url: string, name: string, type: string }> | undefined
  }
  sku?: string | null
  car_created_at?: string | null
  image?: string | null
}

interface DecoyMessage {
  content: string
  sender: string
  displayed_at: string
}

interface DecoyThread {
  id: string
  bot_name: string
  created_at: string
  messages: DecoyMessage[]
}

interface BiddingHistory {
  id: string
  dealer_id: string
  dealer_name: string
  car_id: string
  price: number
  created_at: string
  comment: string | null
}

interface Dealer {
  id: string
  name: string
  group_zalo_name: string | null
}

const ACCOUNTS = [
  { name: "Dũng", uid: "9ee91b08-448b-4cf4-8b3d-79c6f1c71fef" },
  { name: "Trường", uid: "286af2a8-a866-496a-8ed0-da30df3120ec" },
  { name: "Thư", uid: "2ffa8389-2641-4d8b-98a6-5dc2dd2d20a4" },
  { name: "PTr", uid: "3c9c5780-5e95-44b5-8b9a-ae5b9f8c9053" },
  { name: "Huân Đạt", uid: "0ae61721-214f-49f7-8514-f64ee8438c4f" },
  { name: "Minh Châu", uid: "456cf5f7-2b77-4be4-87bb-43038216dacb" },
  { name: "Bảo Ngân", uid: "d4a2fc3a-2212-4299-b8bb-7ebded7e77c0" },
  { name: "Thanh Hòa", uid: "00d0d47e-2041-4857-a828-83e0c28cb615" },
  { name: "Phát", uid: "4cb28319-9dd0-4951-b9c9-e35e1e8dd578" },
  { name: "Thành Đạt", uid: "66d484b5-91ae-4f27-bf5d-93a8993ab6d7" },
  { name: "Xuân Mai", uid: "b8dec215-1fd3-41e8-8ff0-6d5c103849a8" },
]

const DECOY_ACCOUNTS = [
  {
    name: "Minh Anh",
    account: "MA",
    shop_id: "68f5f0f907039cf6ae4581e8",
    default_message: "em dc bên kết nối chào xe. xe nhà mình còn hong. gđ e xin thêm thông tin á anh",
  },
  {
    name: "Huy Hồ",
    account: "HH",
    shop_id: "68c11ae4b7f53ee376145cc2",
    default_message:
      "Em được giới thiệu mình có nhu cầu bán xe em kết bạn để hỏi thêm ít thông tin được không ạ? Xe còn ko a",
  },
]

const SEGMENT_TO_REASON_MAP: Record<string, string> = {
  negotiation: "Đàm phán/Cứng giá",
  ghost: "Ghost/Lead nguội",
  check_sold: "Check var đã bán chưa",
}

const ITEMS_PER_PAGE = 10

const handlePriceFormat = (
  value: string,
  setter: (value: string) => void
) => {
  // Remove non-digits
  const rawValue = value.replace(/\D/g, "")
  if (rawValue === "") {
    setter("")
    return
  }

  let numValue = parseFloat(rawValue)

  // Format with dots for thousands (standard vi-VN)
  setter(numValue.toLocaleString("vi-VN"))
}


// New Workflow Step Component
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

export function E2EManagement() {
  const { toast } = useToast()
  const [selectedAccount, setSelectedAccount] = useState<string>("")
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [callingBot, setCallingBot] = useState(false)
  const [loadingCarIds, setLoadingCarIds] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchPhone, setSearchPhone] = useState<string>("")
  const [appliedSearchPhone, setAppliedSearchPhone] = useState<string>("")
  const [editingBiddingId, setEditingBiddingId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState<string>("")
  const [updatingBidding, setUpdatingBidding] = useState(false)
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [creatingBiddingManual, setCreatingBiddingManual] = useState(false)
  const [newBidDealerId, setNewBidDealerId] = useState<string>("")
  const [newBidPrice, setNewBidPrice] = useState<string>("")
  const [newBidComment, setNewBidComment] = useState<string>("")
  const [showAddBiddingForm, setShowAddBiddingForm] = useState(false)
  const [openCombobox, setOpenCombobox] = useState(false)

  // Selected lead state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [runningE2E, setRunningE2E] = useState(false)

  // Decoy Chat state
  const [decoyThreads, setDecoyThreads] = useState<DecoyThread[]>([])
  const [loadingDecoyChat, setLoadingDecoyChat] = useState(false)
  const [selectedDecoyThreadId, setSelectedDecoyThreadId] = useState<string | null>(null)

  // Create bidding state
  const [creatingBidding, setCreatingBidding] = useState(false)
  const [confirmBiddingOpen, setConfirmBiddingOpen] = useState(false)
  const [leadToCreateBidding, setLeadToCreateBidding] = useState<Lead | null>(null)

  // Bidding history state
  const [biddingHistoryOpen, setBiddingHistoryOpen] = useState(false)
  const [biddingHistory, setBiddingHistory] = useState<BiddingHistory[]>([])
  const [loadingBiddingHistory, setLoadingBiddingHistory] = useState(false)

  // Bot toggle loading state
  const [togglingBot, setTogglingBot] = useState(false)

  // E2E messages dialog state
  const [e2eMessagesOpen, setE2eMessagesOpen] = useState(false)
  const [e2eMessages, setE2eMessages] = useState<ChatMessage[]>([])
  const [loadingE2eMessages, setLoadingE2eMessages] = useState(false)

  // Decoy Web dialog state
  const [decoyWebOpen, setDecoyWebOpen] = useState(false)
  const [decoyWebThreads, setDecoyWebThreads] = useState<DecoyThread[]>([])
  const [selectedDecoyWebThreadId, setSelectedDecoyWebThreadId] = useState<string | null>(null)
  const [loadingDecoyWeb, setLoadingDecoyWeb] = useState(false)

  // Create thread state
  const [createThreadOpen, setCreateThreadOpen] = useState(false)
  const [createThreadLoading, setCreateThreadLoading] = useState(false)
  const [fourDigitsInput, setFourDigitsInput] = useState("")
  const [firstMessageInput, setFirstMessageInput] = useState("Hello")
  const [sendZns, setSendZns] = useState(false)




  // Sync state
  const [syncing, setSyncing] = useState(false)

  // Create session state
  const [creatingSession, setCreatingSession] = useState(false)
  const [confirmSessionOpen, setConfirmSessionOpen] = useState(false)

  // Rename lead state
  const [renamingLead, setRenamingLead] = useState(false)

  // Send first message state
  const [sendingMessage, setSendingMessage] = useState(false)

  // Inspection system iframe state
  const [inspectionSystemOpen, setInspectionSystemOpen] = useState(false)

  // Update primary status state
  const [updatingPrimary, setUpdatingPrimary] = useState(false)

  // Filter tab state
  const [activeTab, setActiveTab] = useState<"priority" | "nurture">("priority")

  // Mobile view state
  const isMobile = useIsMobile()
  const [mobileView, setMobileView] = useState<"list" | "detail">("list")

  // Detail view tab state
  const [activeDetailView, setActiveDetailView] = useState<"workflow" | "decoy-web" | "zalo-chat" | "recent-activity">("workflow")

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
  const [activatingWorkflow2, setActivatingWorkflow2] = useState(false)
  const [workflow2Activated, setWorkflow2Activated] = useState(false)
  const [activeWorkflowView, setActiveWorkflowView] = useState<"purchase" | "seeding">("purchase")

  // Decoy trigger state
  const [decoyDialogOpen, setDecoyDialogOpen] = useState(false)
  const [decoySegment, setDecoySegment] = useState("")
  const [decoyMinutes, setDecoyMinutes] = useState("")
  const [sendingDecoy, setSendingDecoy] = useState(false)

  // Activity log state
  const [activityLog, setActivityLog] = useState<Array<{ event_name: string, time: string }>>([])
  const [loadingActivity, setLoadingActivity] = useState(false)

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

  useEffect(() => {
    if (selectedAccount) {
      setCurrentPage(1) // Reset to first page when account changes
      setSearchPhone("") // Clear search
      setAppliedSearchPhone("") // Clear applied search
      setActiveTab("priority") // Reset to priority tab
      fetchLeads(selectedAccount, true)
    }
  }, [selectedAccount])

  useEffect(() => {
    // Fetch additional data when page changes or leads change
    // We need to calculate currentPageLeads here to pass to fetchPageData
    const filtered = leads.filter((lead) => {
      if (appliedSearchPhone) {
        const phone = lead.phone || lead.additional_phone || ""
        if (!phone.includes(appliedSearchPhone)) return false
      }
      if (activeTab === "priority") {
        return lead.is_primary === true
      } else {
        return lead.is_primary !== true
      }
    })

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const pageLeads = filtered.slice(startIndex, endIndex)

    if (pageLeads.length > 0) {
      fetchPageData(pageLeads)
    }
  }, [currentPage, leads.length, appliedSearchPhone, activeTab])

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

  async function fetchChatMessages(car_id: string): Promise<ChatMessage[]> {
    try {
      const response = await fetch("/api/e2e/messages-zalo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id }),
      })

      if (!response.ok) {
        return []
      }

      const data = await response.json()
      return data.messages_zalo || []
    } catch (error) {
      console.error("[E2E] Error fetching chat messages for car_id:", car_id, error)
      return []
    }
  }

  async function fetchDecoyChat(leadId: string) {
    setLoadingDecoyChat(true)
    try {
      const response = await fetch("/api/e2e/decoy-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      })

      if (!response.ok) {
        setDecoyThreads([])
        return
      }

      const data = await response.json()
      const threads = data.threads || []
      setDecoyThreads(threads)

      // Select the first thread by default if available
      if (threads.length > 0) {
        setSelectedDecoyThreadId(threads[0].id)
      }
    } catch (error) {
      console.error("[E2E] Error fetching decoy chat:", error)
      setDecoyThreads([])
    } finally {
      setLoadingDecoyChat(false)
    }
  }

  async function fetchActivityLog(phone: string) {
    setLoadingActivity(true)
    try {
      console.log("[E2E] Fetching activity log for phone:", phone)
      const response = await fetch(`https://n8n.vucar.vn/webhook/824be9f2-9b69-4ca7-ac29-ffb91fe41cf4/824be9f2-9b69-4ca7-ac29-ffb91fe41cf4/${phone}`)

      console.log("[E2E] Activity log response status:", response.status)

      if (!response.ok) {
        console.log("[E2E] Activity log response not OK")
        setActivityLog([])
        return
      }

      const data = await response.json()
      console.log("[E2E] Activity log data received:", data)
      setActivityLog(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("[E2E] Error fetching activity log:", error)
      setActivityLog([])
    } finally {
      setLoadingActivity(false)
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

  async function handleViewZaloChat(lead: Lead) {
    if (!lead.car_id) {
      toast({
        title: "Lỗi",
        description: "Không tìm thấy thông tin xe",
        variant: "destructive",
      })
      return
    }

    setLoadingE2eMessages(true)

    try {
      const messages = await fetchChatMessages(lead.car_id)
      setE2eMessages(messages)
    } catch (error) {
      console.error("Error fetching Zalo messages", error)
      setE2eMessages([])
    } finally {
      setLoadingE2eMessages(false)
    }
  }

  async function handleViewDecoyWebChat(lead: Lead) {
    setLoadingDecoyWeb(true)
    setDecoyWebThreads([])
    setSelectedDecoyWebThreadId(null)

    try {
      const response = await fetch("/api/e2e/decoy-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id }),
      })

      if (!response.ok) {
        setDecoyWebThreads([])
      } else {
        const data = await response.json()
        const threads = data.threads || []
        setDecoyWebThreads(threads)
        if (threads.length > 0) {
          setSelectedDecoyWebThreadId(threads[0].id)
        }
      }
    } catch (error) {
      console.error("Error fetching decoy web chat", error)
      setDecoyWebThreads([])
    } finally {
      setLoadingDecoyWeb(false)
    }
  }

  async function handleLeadClick(lead: Lead) {
    setSelectedLead(lead)
    setActiveDetailView("workflow")
    setActiveWorkflowView("purchase") // Reset to default workflow view
    setLoadingMessages(true)
    setChatMessages([])

    // Switch to detail view on mobile
    if (isMobile) {
      setMobileView('detail')
    }

    // Reset Decoy Chat state
    setDecoyThreads([])
    setSelectedDecoyThreadId(null)

    // Reset Decoy Web dialog state
    setDecoyWebThreads([])
    setSelectedDecoyWebThreadId(null)

    // Reset Activity Log state
    setActivityLog([])
    setLoadingActivity(false)

    // Fetch fresh lead details to get workflow2_is_active and other updated info
    const phone = lead.phone || lead.additional_phone
    if (phone) {
      const leadDetails = await fetchLeadDetails(phone)

      // Update selected lead with fresh data
      const updatedLead = {
        ...lead,
        ...leadDetails
      }
      setSelectedLead(updatedLead)
    }

    // Fetch E2E messages if car_id exists
    if (lead.car_id) {
      const messages = await fetchChatMessages(lead.car_id)
      setChatMessages(messages)
      setLoadingMessages(false)

      // Fetch Decoy Chat
      fetchDecoyChat(lead.id)
    } else {
      setLoadingMessages(false)
    }

    // Fetch Activity Log if phone exists
    if (phone) {
      console.log("[E2E] Calling fetchActivityLog with phone:", phone)
      fetchActivityLog(phone)
    } else {
      console.log("[E2E] No phone available for activity log")
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

      // Update the lead in state
      setLeads((prevLeads) =>
        prevLeads.map((l) => (l.id === lead.id ? { ...l, bot_active: newStatus } : l))
      )

      // Update selected lead if it's the same
      if (selectedLead?.id === lead.id) {
        setSelectedLead({ ...selectedLead, bot_active: newStatus })
      }

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

  async function handleRunE2E() {
    if (!selectedLead) return

    const phone = selectedLead.phone || selectedLead.additional_phone
    if (!phone) {
      toast({
        title: "Lỗi",
        description: "Không có số điện thoại",
        variant: "destructive",
      })
      return
    }

    setRunningE2E(true)

    try {
      // Step 1: Check and update bot status if needed
      if (!selectedLead.bot_active) {
        console.log("[E2E] Bot is not active, activating...")
        const updateResponse = await fetch("/api/e2e/bot-status/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot_status: true, phone }),
        })

        const updateData = await updateResponse.json()

        if (!updateResponse.ok || !updateData.success) {
          toast({
            title: "Không thể kích hoạt bot",
            description: "Vui lòng kích hoạt bot trước khi chạy E2E",
            variant: "destructive",
          })
          setRunningE2E(false)
          return
        }

        // Update the lead in state
        setLeads((prevLeads) => prevLeads.map((l) => (l.id === selectedLead.id ? { ...l, bot_active: true } : l)))
        setSelectedLead({ ...selectedLead, bot_active: true })
      }

      // Step 2: Call E2E webhook
      console.log("[E2E] Calling E2E webhook...")
      const e2eResponse = await fetch("https://n8n.vucar.vn/webhook/bdb8f9b8-4b12-4a08-9a94-d0406e0d16b0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          chat_history: chatMessages,
        }),
      })

      if (!e2eResponse.ok) {
        throw new Error("E2E webhook failed")
      }

      const e2eData = await e2eResponse.json()

      // Step 3: Check if there are message suggestions and send them
      if (Array.isArray(e2eData) && e2eData.length > 0) {
        const firstResult = e2eData[0]
        const messageSuggestions = firstResult?.output?.message_suggestions

        if (Array.isArray(messageSuggestions) && messageSuggestions.length > 0) {

          const sendMessageResponse = await fetch("https://crm-vucar-api.vucar.vn/api/v1/akabiz/send-customer-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_phone: phone,
              messages: messageSuggestions,
              picId: selectedAccount,
            }),
          })

          if (!sendMessageResponse.ok) {
            console.error("[E2E] Failed to send messages")
            toast({
              title: "Cảnh báo",
              description: "E2E hoàn thành nhưng không thể gửi tin nhắn gợi ý",
              variant: "destructive",
            })
            return
          }

          toast({
            title: "Thành công",
            description: `E2E hoàn thành và đã gửi ${messageSuggestions.length} tin nhắn`,
          })
        } else {
          toast({
            title: "Thành công",
            description: "E2E hoàn thành, không có tin nhắn gợi ý",
          })
        }
      } else {
        toast({
          title: "Thành công",
          description: "E2E đã được khởi chạy",
        })
      }
    } catch (error) {
      console.error("[E2E] Error running E2E:", error)
      toast({
        title: "Lỗi",
        description: "Không thể chạy E2E",
        variant: "destructive",
      })
    } finally {
      setRunningE2E(false)
    }
  }

  function openCreateBiddingConfirm(lead: Lead) {
    const phone = lead.phone || lead.additional_phone
    if (!phone) {
      toast({
        title: "Lỗi",
        description: "Không có số điện thoại",
        variant: "destructive",
      })
      return
    }
    setLeadToCreateBidding(lead)
    setConfirmBiddingOpen(true)
  }

  async function confirmCreateBidding() {
    if (!leadToCreateBidding) return

    const phone = leadToCreateBidding.phone || leadToCreateBidding.additional_phone
    if (!phone) return

    setCreatingBidding(true)
    setConfirmBiddingOpen(false)

    try {
      const response = await fetch("https://n8n.vucar.vn/webhook/8214cf7a-8c4f-449d-83d5-1dc07b17c2ec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })

      if (!response.ok) {
        throw new Error("Failed to create bidding")
      }

      toast({
        title: "Thành công",
        description: "Đã tạo bidding thành công",
      })

      // Refresh the lead's bidding status
      if (leadToCreateBidding.car_id) {
        const updatedBidding = await checkDealerBidding(leadToCreateBidding.car_id)
        setLeads((prevLeads) =>
          prevLeads.map((l) => (l.id === leadToCreateBidding.id ? { ...l, dealer_bidding: updatedBidding } : l))
        )
      }
    } catch (error) {
      console.error("[E2E] Error creating bidding:", error)
      toast({
        title: "Lỗi",
        description: "Không thể tạo bidding",
        variant: "destructive",
      })
    } finally {
      setCreatingBidding(false)
      setLeadToCreateBidding(null)
    }
  }

  async function viewE2eMessages(car_id: string) {
    setLoadingE2eMessages(true)
    setE2eMessagesOpen(true)
    setE2eMessages([])

    try {
      const response = await fetch("/api/e2e/messages-zalo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id }),
      })

      if (!response.ok) {
        toast({
          title: "Lỗi",
          description: "Không thể tải tin nhắn",
          variant: "destructive",
        })
        return
      }

      const data = await response.json()
      setE2eMessages(data.messages_zalo || [])
    } catch (error) {
      console.error("[E2E] Error fetching E2E messages:", error)
      toast({
        title: "Lỗi",
        description: "Không thể tải tin nhắn E2E",
        variant: "destructive",
      })
    } finally {
      setLoadingE2eMessages(false)
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

  async function fetchBiddingSessionCount(car_id: string): Promise<number> {
    try {
      const response = await fetch("/api/e2e/bidding-session-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id }),
      })

      if (!response.ok) {
        return 0
      }

      const data = await response.json()
      return data.bidding_session_count || 0
    } catch (error) {
      console.error("[E2E] Error fetching bidding session count:", error)
      return 0
    }
  }

  async function viewDecoyWebThreads(lead_id: string) {
    setLoadingDecoyWeb(true)
    setDecoyWebOpen(true)
    setDecoyWebThreads([])
    setSelectedDecoyWebThreadId(null)

    try {
      const response = await fetch("/api/e2e/decoy-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id }),
      })

      if (!response.ok) {
        toast({
          title: "Lỗi",
          description: "Không thể tải threads",
          variant: "destructive",
        })
        return
      }

      const data = await response.json()
      const threads = data.threads || []
      setDecoyWebThreads(threads)

      // Select first thread by default
      if (threads.length > 0) {
        setSelectedDecoyWebThreadId(threads[0].id)
      }
    } catch (error) {
      console.error("[E2E] Error fetching decoy web threads:", error)
      toast({
        title: "Lỗi",
        description: "Không thể tải Decoy Web threads",
        variant: "destructive",
      })
    } finally {
      setLoadingDecoyWeb(false)
    }
  }

  async function handleSendZns(phone: string) {
    if (!phone) return

    try {
      const response = await fetch("https://api.vucar.vn/notifications/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": "vucar-rest-api-secret-2025-f8a3c9d1e4b6"
        },
        body: JSON.stringify({
          code: "499943",
          phoneNumbers: [phone]
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
        return
      }

      if (data.success) {
        toast({
          title: "Thành công",
          description: "Đã tạo thread mới",
        })

        // Send ZNS if toggle is on
        if (sendZns && selectedLead.phone) {
          await handleSendZns(selectedLead.phone)
        }

        // Refresh thread list
        await viewDecoyWebThreads(selectedLead.id)
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

  async function handleCreateSession(version: 1 | 2) {
    if (!selectedLead) return

    const phone = selectedLead.phone || selectedLead.additional_phone
    if (!phone) {
      toast({
        title: "Lỗi",
        description: "Không có số điện thoại",
        variant: "destructive",
      })
      return
    }

    if (!selectedLead.car_id) {
      toast({
        title: "Lỗi",
        description: "Không có car_id để tạo phiên",
        variant: "destructive",
      })
      return
    }

    setCreatingSession(true)
    setConfirmSessionOpen(false)

    try {
      // Use the same webhook as create bidding, with version parameter
      const response = await fetch("https://n8n.vucar.vn/webhook/8214cf7a-8c4f-449d-83d5-1dc07b17c2ec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, version }),
      })

      if (!response.ok) {
        throw new Error("Failed to create session")
      }

      toast({
        title: "Thành công",
        description: `Đã tạo phiên thành công (Version ${version}: ${version === 1 ? "No Bid" : "Have Bid"})`,
      })

      // Refresh the lead's session status
      const leadDetails = await fetchLeadDetails(phone)
      setSelectedLead((prev) => prev ? {
        ...prev,
        session_created: leadDetails.session_created
      } : null)

      // Also update in the leads list
      setLeads((prevLeads) =>
        prevLeads.map((l) =>
          l.id === selectedLead.id
            ? { ...l, session_created: leadDetails.session_created }
            : l
        )
      )
    } catch (error) {
      console.error("[E2E] Error creating session:", error)
      toast({
        title: "Lỗi",
        description: "Không thể tạo phiên",
        variant: "destructive",
      })
    } finally {
      setCreatingSession(false)
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

      // Fetch bidding session count
      const biddingSessionCount = leadDetails.car_id
        ? await fetchBiddingSessionCount(leadDetails.car_id)
        : 0

      // Update selected lead with all new data
      const updatedLead: Lead = {
        ...selectedLead,
        car_id: leadDetails.car_id,
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
        workflow2_is_active: leadDetails.workflow2_is_active,
      }

      setSelectedLead(updatedLead)

      // Also update in leads list
      setLeads((prevLeads) =>
        prevLeads.map((l) =>
          l.id === selectedLead.id ? updatedLead : l
        )
      )

      // Refresh E2E messages if car_id exists
      if (leadDetails.car_id) {
        const messages = await fetchChatMessages(leadDetails.car_id)
        setChatMessages(messages)

        // Refresh Decoy Chat threads
        await fetchDecoyChat(selectedLead.id)
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

  async function handleActivateWorkflow2() {
    const phone = selectedLead?.phone || selectedLead?.additional_phone
    if (!phone) {
      toast({
        title: "Lỗi",
        description: "Không tìm thấy số điện thoại",
        variant: "destructive",
      })
      return
    }

    setActivatingWorkflow2(true)

    try {
      const response = await fetch("https://n8n.vucar.vn/webhook/8214cf7a-8c4f-1dc07b17c2ec-449d-83d5", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone,
          duration: parseInt(workflow2Data.duration) || 0,
          minPrice: parseFloat(workflow2Data.minPrice) || 0,
          maxPrice: parseFloat(workflow2Data.maxPrice) || 0,
          comment: workflow2Data.comment,
          numberOfComments: parseInt(workflow2Data.numberOfComments) || 0,
          bid: workflow2Data.bid,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to activate workflow 2")
      }

      toast({
        title: "Thành công",
        description: "Đã kích hoạt Workflow 2",
      })

      // Update selected lead's workflow2_is_active status
      if (selectedLead) {
        setSelectedLead({
          ...selectedLead,
          workflow2_is_active: true
        })
        // Also update in leads list
        setLeads(prevLeads => prevLeads.map(lead =>
          lead.id === selectedLead.id ? { ...lead, workflow2_is_active: true } : lead
        ))
      }

      setWorkflow2Open(false)
      setActiveWorkflowView("seeding")
      setWorkflow2Open(false)
      setWorkflow2Activated(true)

      // Open decoy dialog after successful activation
      setDecoyDialogOpen(true)

      // Reset form
      setWorkflow2Data({
        duration: "",
        minPrice: "",
        maxPrice: "",
        comment: false,
        numberOfComments: "",
        bid: false
      })
    } catch (error) {
      console.error("[E2E] Error activating workflow 2:", error)
      toast({
        title: "Lỗi",
        description: "Không thể kích hoạt Workflow 2",
        variant: "destructive",
      })
    } finally {
      setActivatingWorkflow2(false)
    }
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
    const picId = selectedLead.pic_id

    if (!customer_phone) {
      toast({
        title: "Lỗi",
        description: "Không có số điện thoại",
        variant: "destructive",
      })
      return
    }

    if (!picId) {
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
        body: JSON.stringify({ customer_phone, messages, picId }),
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

      const data = await response.json()

      if (!data.success) {
        throw new Error("Update was not successful")
      }

      // Update local state
      const updatedLead = {
        ...selectedLead,
        is_primary: newPrimaryStatus
      }

      setSelectedLead(updatedLead)

      // Also update in leads list
      setLeads((prevLeads) =>
        prevLeads.map((l) =>
          l.id === selectedLead.id ? { ...l, is_primary: newPrimaryStatus } : l
        )
      )

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

  async function handleSendDecoy() {
    if (!selectedLead || !selectedLead.phone) {
      toast({
        title: "Lỗi",
        description: "Không có số điện thoại",
        variant: "destructive",
      })
      return
    }

    if (!decoySegment) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn lý do quây",
        variant: "destructive",
      })
      return
    }

    setSendingDecoy(true)

    try {
      // Randomly select between Minh Anh (index 0) and Huy Hồ (index 1)
      const randomIndex = Math.floor(Math.random() * 2)
      const selectedAccount = DECOY_ACCOUNTS[randomIndex]

      console.log("[E2E] Sending decoy with account:", selectedAccount.name)

      // Step 1: Create job in database
      const createResponse = await fetch("/api/decoy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedLead.phone,
          shop_id: selectedAccount.shop_id,
          first_message: selectedAccount.default_message,
          account: selectedAccount.account,
          segment: decoySegment,
          is_sent: false,
        }),
      })

      const createdJob = await createResponse.json()
      console.log("[E2E] Decoy job created:", createdJob)

      if (!createdJob.id) {
        throw new Error("Failed to create decoy job")
      }

      // Step 2: Trigger n8n webhook
      await fetch("https://n8n.vucar.vn/webhook/60362b14-0e05-4849-b3cd-ebbbdb854b49", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: createdJob.id,
          phone: selectedLead.phone,
          shop_id: selectedAccount.shop_id,
          first_message: selectedAccount.default_message,
          account: selectedAccount.account,
          segment: decoySegment,
          minutes: parseInt(decoyMinutes) || 0,
        }),
      })

      // Step 3: Update reason in database
      const reasonText = SEGMENT_TO_REASON_MAP[decoySegment] || decoySegment
      await fetch("/api/decoy/update-reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedLead.phone,
          reason: reasonText,
        }),
      })

      toast({
        title: "✓ Đã nhận được yêu cầu",
        description: `Đã gửi decoy bằng tài khoản ${selectedAccount.name}. Hãy check tình trạng sau 1 phút.`,
        className: "bg-green-50 border-green-200",
        duration: 5000,
      })

      // Close dialog and reset
      setDecoyDialogOpen(false)
      setDecoySegment("")
      setDecoyMinutes("")
    } catch (error) {
      console.error("[E2E] Error sending decoy:", error)
      toast({
        title: "✗ Gửi thất bại",
        description: "Không thể gửi decoy. Vui lòng thử lại.",
        variant: "destructive",
      })
    } finally {
      setSendingDecoy(false)
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

    setCreatingBiddingManual(true)
    try {
      const response = await fetch("/api/e2e/bidding-history/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          car_id: selectedLead.car_id,
          dealer_id: newBidDealerId,
          price: parseFloat(newBidPrice),
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

  async function fetchBiddingHistory(car_id: string) {
    setLoadingBiddingHistory(true)
    setBiddingHistoryOpen(true)
    setEditingBiddingId(null) // Reset editing state
    fetchDealers() // Fetch dealers when opening history

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

    setUpdatingBidding(true)
    try {
      const response = await fetch("/api/e2e/bidding-history/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          price: parseFloat(editingPrice)
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





  async function searchLeadByPhone() {
    if (!searchPhone.trim()) {
      // If search is cleared, reset filter and refetch current page
      setAppliedSearchPhone("")
      setCurrentPage(1)
      if (selectedAccount) {
        await fetchLeads(selectedAccount, true)
      }
      return
    }

    setAppliedSearchPhone(searchPhone) // Apply the search filter

    console.log("[E2E] Searching for lead with phone:", searchPhone)
    setLoadingCarIds(true)
    setCurrentPage(1)

    // Filter leads that match the search
    const matchingLeads = leads.filter(
      (lead: Lead) =>
        lead.phone?.includes(searchPhone) ||
        lead.additional_phone?.includes(searchPhone)
    )

    if (matchingLeads.length === 0) {
      toast({
        title: "Không tìm thấy",
        description: "Không tìm thấy lead với số điện thoại này",
        variant: "destructive",
      })
      setLoadingCarIds(false)
      return
    }

    console.log("[E2E] Found", matchingLeads.length, "matching lead(s), fetching details...")

    try {
      // Fetch all details for matching leads
      const enrichedLeads = await Promise.all(
        matchingLeads.map(async (lead) => {
          // If lead has both phone and additional_phone, fetch details for both
          const phonesToSearch = []
          if (lead.phone) phonesToSearch.push(lead.phone)
          if (lead.additional_phone && lead.additional_phone !== lead.phone) {
            phonesToSearch.push(lead.additional_phone)
          }

          if (phonesToSearch.length === 0) {
            return {
              ...lead,
              car_id: null,
              dealer_bidding: { status: "not_sent" as const },
              bot_active: false,
              price_customer: null,
              brand: null,
              model: null,
              variant: null,
              year: null,
              has_enough_images: false,
              first_message_sent: false,
              decoy_thread_count: 0,
            }
          }

          // Fetch details for all phone numbers and merge results
          const allLeadDetails = await Promise.all(
            phonesToSearch.map(phone => fetchLeadDetails(phone))
          )

          // Use the first non-null result or merge data from multiple sources
          const leadDetails = allLeadDetails.reduce((merged, current) => {
            return {
              car_id: merged.car_id || current.car_id,
              price_customer: merged.price_customer || current.price_customer,
              brand: merged.brand || current.brand,
              model: merged.model || current.model,
              variant: merged.variant || current.variant,
              year: merged.year || current.year,
              plate: merged.plate || current.plate,
              stage: merged.stage || current.stage,
              has_enough_images: merged.has_enough_images || current.has_enough_images,
              bot_status: merged.bot_status || current.bot_status,
              price_highest_bid: merged.price_highest_bid || current.price_highest_bid,
              first_message_sent: merged.first_message_sent || current.first_message_sent,
              session_created: merged.session_created || current.session_created,
              notes: merged.notes || current.notes,
              pic_id: merged.pic_id || current.pic_id,
              pic_name: merged.pic_name || current.pic_name,
              location: merged.location || current.location,
              mileage: merged.mileage || current.mileage,
              is_primary: merged.is_primary || current.is_primary,
              workflow2_is_active: merged.workflow2_is_active ?? current.workflow2_is_active,
              sku: merged.sku || current.sku,
              car_created_at: merged.car_created_at || current.car_created_at,
              image: merged.image || current.image,
              additional_images: merged.additional_images || current.additional_images,
            }
          }, allLeadDetails[0])

          let dealer_bidding: DealerBiddingStatus = { status: "not_sent" }

          // Priority 1: Check price_highest_bid from sale_status
          if (leadDetails.price_highest_bid) {
            dealer_bidding = {
              status: "got_price",
              maxPrice: leadDetails.price_highest_bid
            }
          }
          // Priority 2: Check dealer_biddings table if we have car_id
          else if (leadDetails.car_id) {
            dealer_bidding = await checkDealerBidding(leadDetails.car_id)
          }

          // Fetch decoy thread count
          const decoyThreadCount = await fetchDecoyThreadCount(lead.id)

          // Fetch bidding session count
          const biddingSessionCount = leadDetails.car_id
            ? await fetchBiddingSessionCount(leadDetails.car_id)
            : 0

          return {
            ...lead,
            car_id: leadDetails.car_id,
            dealer_bidding,
            bot_active: leadDetails.bot_status,
            price_customer: leadDetails.price_customer,
            brand: leadDetails.brand,
            model: leadDetails.model,
            variant: leadDetails.variant,
            year: leadDetails.year,
            plate: leadDetails.plate,
            stage: leadDetails.stage,
            has_enough_images: leadDetails.has_enough_images,
            first_message_sent: leadDetails.first_message_sent,
            session_created: leadDetails.session_created,
            decoy_thread_count: decoyThreadCount,
            notes: leadDetails.notes,
            location: leadDetails.location,
            mileage: leadDetails.mileage,
            is_primary: leadDetails.is_primary,
            bidding_session_count: biddingSessionCount,
          }
        })
      )

      // Update only the matching leads in the full leads array
      const updatedLeads = leads.map(
        (lead) => enrichedLeads.find((el) => el.id === lead.id) || lead
      )

      setLeads(updatedLeads)
      setLoadingCarIds(false)

      console.log("[E2E] Successfully fetched details for matching leads")
    } catch (err) {
      console.error("[E2E] Error fetching lead details:", err)
      toast({
        title: "Lỗi",
        description: "Không thể tải thông tin chi tiết",
        variant: "destructive",
      })
      setLoadingCarIds(false)
    }
  }

  async function fetchLeads(uid: string, forceFetchDetails = false) {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/e2e/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch leads: ${response.status}`)
      }

      const data = await response.json()

      // Remove duplicates based on lead ID
      const uniqueLeads = data.reduce((acc: Lead[], current: Lead) => {
        const exists = acc.find(item => item.id === current.id)
        if (!exists) {
          acc.push(current)
        }
        return acc
      }, [])

      // Batch fetch primary status for all leads
      const car_ids = uniqueLeads.map((lead: Lead) => lead.car_id).filter((id: string | null) => id != null)

      if (car_ids.length > 0) {
        try {
          const primaryResponse = await fetch("/api/e2e/batch-primary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ car_ids }),
          })

          const primaryData = await primaryResponse.json()
          const primaryStatuses = primaryData.primary_statuses || {}

          // Merge primary status into leads
          const leadsWithPrimary = uniqueLeads.map((lead: Lead) => ({
            ...lead,
            is_primary: lead.car_id ? (primaryStatuses[lead.car_id] || false) : false
          }))

          setLeads(leadsWithPrimary)

          setLoading(false)

          // Fetch data for the first page only if not searching or forced
          if (leadsWithPrimary.length > 0 && (!appliedSearchPhone || forceFetchDetails)) {
            // Get first page leads
            const firstPageLeads = leadsWithPrimary.slice(0, ITEMS_PER_PAGE)
            await fetchPageData(firstPageLeads)
          }
        } catch (error) {
          console.error("[E2E] Error fetching batch primary:", error)
          // Set default is_primary to false if batch fetch fails
          const leadsWithPrimary = uniqueLeads.map((lead: Lead) => ({
            ...lead,
            is_primary: false
          }))
          setLeads(leadsWithPrimary)
          setLoading(false)

          if (leadsWithPrimary.length > 0 && (!appliedSearchPhone || forceFetchDetails)) {
            const firstPageLeads = leadsWithPrimary.slice(0, ITEMS_PER_PAGE)
            await fetchPageData(firstPageLeads)
          }
        }
      } else {
        setLeads(uniqueLeads)
        setLoading(false)

        if (uniqueLeads.length > 0 && (!appliedSearchPhone || forceFetchDetails)) {
          const firstPageLeads = uniqueLeads.slice(0, ITEMS_PER_PAGE)
          await fetchPageData(firstPageLeads)
        }
      }
    } catch (err) {
      console.error("[E2E] Error fetching leads:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch leads")
      setLoading(false)
      setLoadingCarIds(false)
    }
  }

  async function fetchPageData(pageLeadsToFetch: Lead[]) {
    if (pageLeadsToFetch.length === 0) return

    // Check if we already have data for these leads
    // car_id comes from /api/e2e/leads, so we check for enriched fields instead
    const needsFetch = pageLeadsToFetch.some((lead) =>
      lead.brand === undefined ||
      lead.price_customer === undefined ||
      lead.bot_active === undefined
    )

    if (!needsFetch) {
      return
    }

    setLoadingCarIds(true)

    // Fetch car_ids, car details, image status, dealer bidding, and bot status for current page leads
    const updatedPageLeads = await Promise.all(
      pageLeadsToFetch.map(async (lead: Lead) => {
        const phone = lead.phone || lead.additional_phone
        if (!phone) {
          return {
            ...lead,
            car_id: null,
            has_enough_images: false,
            dealer_bidding: { status: "not_sent" as const },
            bot_active: false,
            price_customer: null,
            brand: null,
            model: null,
            variant: null,
            year: null,
            first_message_sent: false,
            decoy_thread_count: 0,
          }
        }

        // Fetch lead details (includes bot_status)
        const leadDetails = await fetchLeadDetails(phone)

        // If we have car_id, fetch dealer bidding
        let dealer_bidding: DealerBiddingStatus = { status: "not_sent" }

        // Priority 1: Check price_highest_bid from sale_status
        if (leadDetails.price_highest_bid) {
          dealer_bidding = {
            status: "got_price",
            maxPrice: leadDetails.price_highest_bid
          }
        }
        // Priority 2: Check dealer_biddings table if we have car_id
        else if (leadDetails.car_id) {
          dealer_bidding = await checkDealerBidding(leadDetails.car_id)
        }

        // Fetch decoy thread count
        const decoyThreadCount = await fetchDecoyThreadCount(lead.id)

        // Fetch bidding session count
        const biddingSessionCount = leadDetails.car_id
          ? await fetchBiddingSessionCount(leadDetails.car_id)
          : 0

        return {
          ...lead,
          car_id: leadDetails.car_id,
          has_enough_images: leadDetails.has_enough_images,
          dealer_bidding,
          bot_active: leadDetails.bot_status,
          price_customer: leadDetails.price_customer,
          brand: leadDetails.brand,
          model: leadDetails.model,
          variant: leadDetails.variant,
          year: leadDetails.year,
          plate: leadDetails.plate,
          stage: leadDetails.stage,
          first_message_sent: leadDetails.first_message_sent,
          session_created: leadDetails.session_created,
          decoy_thread_count: decoyThreadCount,
          notes: leadDetails.notes,
          location: leadDetails.location,
          mileage: leadDetails.mileage,
          sku: leadDetails.sku,
          car_created_at: leadDetails.car_created_at,
          additional_images: leadDetails.additional_images,
          is_primary: leadDetails.is_primary,
          bidding_session_count: biddingSessionCount,
        }
      })
    )

    // Update the leads array by matching IDs instead of using indices
    setLeads((prevLeads) =>
      prevLeads.map((lead) => {
        const updated = updatedPageLeads.find((ul) => ul.id === lead.id)
        if (updated) {
          return updated
        }
        return lead
      })
    )
    setLoadingCarIds(false)
  }

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

  // Filter leads by phone search and tab (client-side filtering)
  const filteredLeads = leads.filter((lead) => {
    // Filter by phone search
    if (appliedSearchPhone) {
      const phone = lead.phone || lead.additional_phone || ""
      if (!phone.includes(appliedSearchPhone)) return false
    }

    // Filter by tab (priority vs nurture)
    if (activeTab === "priority") {
      return lead.is_primary === true
    } else {
      return lead.is_primary !== true
    }
  })

  // Count for tabs - undefined is_primary is treated as "Nuôi dưỡng"
  const priorityCount = leads.filter(lead => lead.is_primary === true).length
  const nurtureCount = leads.filter(lead => lead.is_primary !== true).length

  // Pagination calculations
  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentPageLeads = filteredLeads.slice(startIndex, endIndex)

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
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
    // Currently both use the same endpoint as per requirements, but keeping structure for future scale
    let endpoint = 'https://n8n.vucar.vn/webhook/checkvar-lead';

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
    setEditedPriceCustomer(selectedLead.price_customer?.toLocaleString("vi-VN") || "")
    setEditedPriceHighestBid(selectedLead.price_highest_bid?.toLocaleString("vi-VN") || "")
  }

  function handleCancelEdit() {
    setEditMode(false)
    setEditedStage("")
    setEditedPriceCustomer("")
    setEditedPriceHighestBid("")
  }

  function handleQuickEdit(lead: Lead, e: React.MouseEvent) {
    e.stopPropagation()
    if (!lead) return

    setSelectedLead(lead)
    setEditMode(true)
    setEditedStage(lead.stage || "")
    setEditedPriceCustomer(lead.price_customer?.toLocaleString("vi-VN") || "")
    setEditedPriceHighestBid(lead.price_highest_bid?.toLocaleString("vi-VN") || "")
    setDetailDialogOpen(true)
  }

  async function handleSaveChanges() {
    if (!selectedLead) return

    // Get sale_status_id from the lead details
    const phone = selectedLead.phone || selectedLead.additional_phone
    if (!phone) {
      toast({
        title: "Lỗi",
        description: "Không có số điện thoại",
        variant: "destructive",
      })
      return
    }

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
      // First, fetch the sale_status_id
      const detailsResponse = await fetch("/api/e2e/lead-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })

      if (!detailsResponse.ok) {
        throw new Error("Failed to fetch lead details")
      }

      const detailsData = await detailsResponse.json()
      const saleStatusId = detailsData.sale_status?.id

      if (!saleStatusId) {
        throw new Error("Sale status ID not found")
      }

      // Build payload with only changed fields
      const payload: any = { saleStatusId }

      if (editedStage && editedStage !== selectedLead.stage) {
        payload.stage = editedStage
      }

      if (priceCustomer !== undefined && priceCustomer !== selectedLead.price_customer) {
        payload.price_customer = priceCustomer
      }

      if (priceHighestBid !== undefined && priceHighestBid !== selectedLead.price_highest_bid) {
        payload.price_highest_bid = priceHighestBid
      }

      // Check if there are any changes
      if (Object.keys(payload).length === 1) {
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
      }

      setSelectedLead(updatedLead)
      setLeads((prevLeads) =>
        prevLeads.map((l) => (l.id === selectedLead.id ? updatedLead : l))
      )

      toast({
        title: "Thành công",
        description: "Đã cập nhật thông tin",
      })

      // Exit edit mode
      setEditMode(false)
      setEditedStage("")
      setEditedPriceCustomer("")
      setEditedPriceHighestBid("")
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



  return (
    <div className="w-full">
      {/* Top Header - Account Selector */}
      <div className={`bg-white border-b ${isMobile ? 'px-4 py-3' : 'px-8 py-4'}`}>
        <div className="flex items-center justify-between">
          <h1 className={`font-bold text-gray-900 ${isMobile ? 'text-lg' : 'text-2xl'}`}>
            {isMobile && mobileView === 'detail' ? (
              <button
                onClick={() => {
                  setMobileView('list')
                  setSelectedLead(null)
                }}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="h-5 w-5" />
                <span>Lead OS</span>
              </button>
            ) : (
              isMobile ? 'Lead OS' : 'Quản lý E2E'
            )}
          </h1>
          <div className="flex items-center gap-2">
            {!isMobile && <Label className="text-sm font-medium text-gray-700">Chọn tài khoản:</Label>}
            <Select value={selectedAccount} onValueChange={setSelectedAccount} disabled={loading || loadingCarIds}>
              <SelectTrigger className={isMobile ? 'w-32' : 'w-48'}>
                <SelectValue placeholder={isMobile ? 'Chọn...' : 'Chọn tài khoản...'} />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNTS.map((account) => (
                  <SelectItem key={account.uid} value={account.uid}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {account.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Split View Layout */}
      <div className={`flex h-[calc(100vh-${isMobile ? '64px' : '100px'})] bg-gray-50`}>
        {/* Left Sidebar - Leads List - Hidden on mobile when viewing detail */}
        {(!isMobile || mobileView === 'list') && (
          <div className={`${isMobile ? 'w-full' : 'w-80'} border-r flex flex-col bg-white`}>

            <div className="p-4 border-b bg-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">LeadOS</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSummaryDialogOpen(true)}
                  title="Xem báo cáo tổng hợp"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
              <SearchInput
                placeholder="Tìm kiếm danh sách..."
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading && !loadingCarIds && selectedAccount) {
                    searchLeadByPhone()
                  }
                }}
                disabled={loading || loadingCarIds || !selectedAccount}
              />
            </div>

            {/* Filter Tabs */}
            <div className="px-4 py-3 border-b flex gap-4">
              <button
                onClick={() => {
                  setActiveTab("priority")
                  setCurrentPage(1)
                }}
                className={`flex items-center gap-2 text-sm font-medium pb-2 transition-colors ${activeTab === "priority"
                  ? "text-purple-600 border-b-2 border-purple-600"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                <Zap className="h-4 w-4" />
                Ưu tiên
                <Badge className={activeTab === "priority" ? "bg-purple-600 text-white text-xs" : "bg-gray-200 text-gray-700 text-xs"}>
                  {priorityCount}
                </Badge>
              </button>
              <button
                onClick={() => {
                  setActiveTab("nurture")
                  setCurrentPage(1)
                }}
                className={`flex items-center gap-2 text-sm font-medium pb-2 transition-colors ${activeTab === "nurture"
                  ? "text-emerald-600 border-b-2 border-emerald-600"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                <MessageCircle className="h-4 w-4" />
                Nuôi dưỡng
                <Badge className={activeTab === "nurture" ? "bg-emerald-600 text-white text-xs" : "bg-gray-200 text-gray-700 text-xs"}>
                  {nurtureCount}
                </Badge>
              </button>
            </div>

            {/* Leads List in Sidebar */}
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-gray-100">
                {!selectedAccount ? (
                  <div className="flex flex-col items-center justify-center py-20 px-6">
                    <User className="h-16 w-16 text-gray-300 mb-4" />
                    <p className="text-gray-500 text-center text-sm">
                      Vui lòng chọn tài khoản ở trên để xem danh sách leads
                    </p>
                  </div>
                ) : loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : currentPageLeads.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    <p>Không có leads nào</p>
                  </div>
                ) : (
                  currentPageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className={`p-4 transition-colors ${loading || loadingCarIds
                        ? "cursor-not-allowed opacity-50"
                        : "hover:bg-blue-50"
                        } ${selectedLead?.id === lead.id ? "bg-blue-50 border-l-4 border-blue-600" : ""}`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          onClick={() => {
                            if (!loading && !loadingCarIds) {
                              handleLeadClick(lead)
                            }
                          }}
                          className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0 cursor-pointer"
                        >
                          {lead.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div
                          onClick={() => {
                            if (!loading && !loadingCarIds) {
                              handleLeadClick(lead)
                            }
                          }}
                          className="flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-gray-900 truncate">{lead.name}</p>
                            {lead.source && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {lead.source === "zalo" ? "Zalo" : lead.source === "facebook" ? "Facebook" : lead.source}
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 ml-auto shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (lead.car_id && !updatingPrimary) {
                                  const newPrimaryStatus = !lead.is_primary
                                  setUpdatingPrimary(true)
                                  fetch("/api/e2e/update-primary", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      car_id: lead.car_id,
                                      is_primary: newPrimaryStatus
                                    }),
                                  })
                                    .then(res => res.json())
                                    .then(data => {
                                      if (data.success) {
                                        setLeads((prevLeads) =>
                                          prevLeads.map((l) =>
                                            l.id === lead.id ? { ...l, is_primary: newPrimaryStatus } : l
                                          )
                                        )
                                        if (selectedLead?.id === lead.id) {
                                          setSelectedLead({ ...lead, is_primary: newPrimaryStatus })
                                        }
                                        toast({
                                          title: "Thành công",
                                          description: newPrimaryStatus
                                            ? "Đã đánh dấu xe là Primary"
                                            : "Đã bỏ đánh dấu Primary",
                                        })
                                      }
                                    })
                                    .catch(() => {
                                      toast({
                                        title: "Lỗi",
                                        description: "Không thể cập nhật trạng thái Primary",
                                        variant: "destructive",
                                      })
                                    })
                                    .finally(() => setUpdatingPrimary(false))
                                }
                              }}
                              disabled={!lead.car_id || updatingPrimary}
                              title={lead.is_primary ? "Bỏ đánh dấu Primary" : "Đánh dấu là Primary"}
                            >
                              {updatingPrimary && selectedLead?.id === lead.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                              ) : (
                                <Star
                                  className={`h-4 w-4 ${lead.is_primary
                                    ? "fill-blue-600 text-blue-600"
                                    : "text-gray-300 hover:text-gray-500"
                                    }`}
                                />
                              )}
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-700 truncate">
                              {formatCarInfo(lead)}
                            </p>
                            {lead.car_created_at && (
                              <p className="text-xs text-gray-500 shrink-0">
                                {new Date(lead.car_created_at).toLocaleString("vi-VN", {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-emerald-600 font-semibold mt-1">
                            {lead.price_customer ? formatPrice(lead.price_customer) : "Chưa có giá"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pagination in Sidebar */}
            {totalPages > 1 && (
              <div className="border-t p-3 bg-gray-50">
                <div className="flex items-center justify-center gap-1 mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className="h-7 px-2 text-gray-600"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`h-7 w-7 p-0 text-xs ${currentPage === pageNum
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                            }`}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="h-7 px-2 text-gray-600"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-center text-xs text-gray-500">
                  Trang {currentPage} / {totalPages}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right Panel - Lead Details - Hidden on mobile when in list view */}
        {(!isMobile || mobileView === 'detail') && (
          <>
            {!selectedAccount ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                <User className="h-24 w-24 text-gray-300 mb-4" />
                <p className="text-lg font-medium">Chọn tài khoản để bắt đầu</p>
                <p className="text-sm mt-2">Vui lòng chọn tài khoản từ menu phía trên</p>
              </div>
            ) : selectedLead ? (
              <div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
                {/* Details content will go here - we'll move the modal content */}
                <div className="flex-1 overflow-y-auto">
                  {/* Header */}
                  <div className="px-8 pt-6 pb-6 bg-gray-100 border-b sticky top-0 z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold">
                          {selectedLead.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-gray-900">{selectedLead.name}</h2>
                            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 border border-gray-200">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 hover:bg-transparent"
                                onClick={handleTogglePrimary}
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
                              onClick={(e) => selectedLead && handleQuickEdit(selectedLead, e)}
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
                          onClick={handleSyncCurrentLead}
                          disabled={syncing}
                          className="text-gray-600"
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                          {syncing ? "Đang đồng bộ..." : "Đồng bộ"}
                        </Button>                    <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDetailDialogOpen(true)}
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
                            <DropdownMenuItem onClick={() => handleCallTrigger('CHECK_VAR')}>
                              Check Var (Còn bán không?)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCallTrigger('FIRST_CALL')}>
                              First Call (Lấy thông tin)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => setInspectionSystemOpen(true)}
                        >
                          Đặt lịch KD
                        </Button>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-6 border-b -mb-6">
                      <button
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeDetailView === "workflow"
                          ? "text-blue-600 border-blue-600"
                          : "text-gray-500 border-transparent hover:text-gray-700"
                          }`}
                        onClick={() => setActiveDetailView("workflow")}
                      >
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          Workflow Tracker
                        </div>
                      </button>
                      <button
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeDetailView === "decoy-web"
                          ? "text-orange-600 border-orange-600"
                          : "text-gray-500 border-transparent hover:text-gray-700"
                          }`}
                        onClick={() => {
                          setActiveDetailView("decoy-web")
                          if (selectedLead) handleViewDecoyWebChat(selectedLead)
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" />
                          Decoy Web Chat
                        </div>
                      </button>
                      <button
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeDetailView === "zalo-chat"
                          ? "text-purple-600 border-purple-600"
                          : "text-gray-500 border-transparent hover:text-gray-700"
                          }`}
                        onClick={() => {
                          setActiveDetailView("zalo-chat")
                          if (selectedLead) handleViewZaloChat(selectedLead)
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" />
                          Zalo Chat
                          <Badge variant="outline" className="text-xs">Kênh chính</Badge>
                        </div>
                      </button>
                      <button
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeDetailView === "recent-activity"
                          ? "text-emerald-600 border-emerald-600"
                          : "text-gray-500 border-transparent hover:text-gray-700"
                          }`}
                        onClick={() => setActiveDetailView("recent-activity")}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Hoạt động gần đây
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Content sections - same as before */}
                  <div className="px-8 py-6 space-y-6">
                    {activeDetailView === "workflow" && (
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
                                    onClick={() => setActiveWorkflowView("purchase")}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeWorkflowView === "purchase"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                      }`}
                                  >
                                    Quy trình Thu Mua
                                  </button>
                                  <button
                                    onClick={() => setActiveWorkflowView("seeding")}
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
                            {selectedLead.session_created && (selectedLead.workflow2_is_active === false) && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  // Populate default values
                                  setWorkflow2Data({
                                    duration: "6",
                                    minPrice: selectedLead?.price_customer?.toString() || "",
                                    maxPrice: selectedLead?.price_highest_bid?.toString() || "",
                                    comment: true,
                                    numberOfComments: "20",
                                    bid: true
                                  })
                                  setWorkflow2Open(true)
                                }}
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
                                  onClick={() => {
                                    setActiveDetailView("zalo-chat")
                                    handleViewZaloChat(selectedLead)
                                  }}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleSendFirstMessage}
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
                                  onClick={() => selectedLead.car_id && fetchBiddingHistory(selectedLead.car_id)}
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
                                  onClick={() => setConfirmSessionOpen(true)}
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
                                  onClick={() => handleBotToggle(selectedLead, !selectedLead.bot_active)}
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
                                  onClick={() => {
                                    setActiveDetailView("decoy-web")
                                    handleViewDecoyWebChat(selectedLead)
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-around mb-8">
                              {/* Tạo Phiên 2 */}
                              <div className="flex flex-col items-center gap-3">
                                <WorkflowStep
                                  icon={<Play className={`w-8 h-8 ${selectedLead.workflow2_is_active ? "" : "text-gray-400"}`} />}
                                  title={`Tạo Phiên 2`}
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
                                  onClick={() => setDecoyDialogOpen(true)}
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
                                onClick={handleRenameLead}
                                disabled={renamingLead || !selectedLead?.pic_id}
                                className="text-gray-700"
                              >
                                {renamingLead ? "Đang đổi tên..." : "Đổi tên Lead"}
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Additional Info Cards */}
                        <div className="grid grid-cols-3 gap-4">
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

                          {/* Activity Log */}
                          <div className="bg-white rounded-lg p-6 shadow-sm">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Hoạt động gần đây</h4>
                            {loadingActivity ? (
                              <div className="text-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                                <p className="text-sm text-gray-400 mt-2">Đang tải...</p>
                              </div>
                            ) : activityLog.length === 0 ? (
                              <div className="text-center py-8 text-gray-400">
                                <p className="text-sm">Chưa có hoạt động nào</p>
                              </div>
                            ) : (
                              <div className="max-h-96 overflow-y-auto space-y-3">
                                {activityLog.map((activity, index) => (
                                  <div
                                    key={index}
                                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                                  >
                                    <div className="flex-shrink-0 w-2 h-2 bg-purple-500 rounded-full mt-1.5" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900">{activity.event_name}</p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {new Date(activity.time).toLocaleString('vi-VN', {
                                          year: 'numeric',
                                          month: '2-digit',
                                          day: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          second: '2-digit'
                                        })}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {activeDetailView === "decoy-web" && (
                      <div className="bg-white rounded-lg shadow-sm h-[600px] flex flex-col overflow-hidden">
                        <div className="flex-1 flex gap-4 overflow-hidden">
                          {/* Left Panel - Thread List */}
                          <div className="w-80 border-r overflow-y-auto flex flex-col">
                            {/* Create Thread Button */}
                            <div className="p-3 border-b bg-gray-50">
                              <Button
                                onClick={() => setCreateThreadOpen(true)}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                                size="sm"
                              >
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Tạo thread mới
                              </Button>
                            </div>
                            <div className="flex-1 p-4 overflow-y-auto">
                              {loadingDecoyWeb ? (
                                <div className="flex items-center justify-center h-full">
                                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                              ) : decoyWebThreads.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                  Chưa có threads
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {decoyWebThreads.map((thread) => (
                                    <button
                                      key={thread.id}
                                      onClick={() => setSelectedDecoyWebThreadId(thread.id)}
                                      className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedDecoyWebThreadId === thread.id
                                        ? "bg-orange-100 text-orange-900 border-orange-300"
                                        : "bg-muted/30 hover:bg-muted/50"
                                        }`}
                                    >
                                      <div className="font-semibold text-sm mb-1">
                                        Bot: {thread.bot_name || "Unknown"}
                                      </div>
                                      <div className="text-xs opacity-70">
                                        {new Date(thread.created_at).toLocaleString("vi-VN")}
                                      </div>
                                      <div className="text-xs opacity-70 mt-1">
                                        {thread.messages.length} tin nhắn
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Panel - Messages */}
                          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/30">
                            {/* CRM Banner */}
                            {selectedDecoyWebThreadId && (
                              <div className="bg-blue-50 border-b border-blue-100 p-3 px-4 flex items-center justify-between shrink-0 animate-in fade-in slide-in-from-top-1">
                                <div className="flex items-center gap-2 text-sm text-blue-700">
                                  <MessageCircle className="h-4 w-4" />
                                  <span>Để chat tiếp hãy vào đường link bên CRM</span>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="bg-white hover:bg-blue-50 text-blue-600 border-blue-200 h-8 text-xs font-medium shadow-sm transition-all hover:shadow"
                                  onClick={() => {
                                    const phone = selectedLead.phone || selectedLead.additional_phone || ""
                                    if (selectedDecoyWebThreadId && phone) {
                                      const crmUrl = `https://dashboard.vucar.vn/gui-tin/tin-da-gui?threadId=${selectedDecoyWebThreadId}&phone=${phone}`
                                      window.open(crmUrl, '_blank')
                                    }
                                  }}
                                >
                                  Chat trên CRM (Tab mới)
                                </Button>
                              </div>
                            )}

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-4">
                              {!selectedDecoyWebThreadId ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                  Chọn một thread để xem tin nhắn
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {decoyWebThreads
                                    .find((t) => t.id === selectedDecoyWebThreadId)
                                    ?.messages.map((msg, index) => {
                                      const isBot = msg.sender === "bot" || msg.sender === "system"
                                      const timestamp = msg.displayed_at
                                        ? new Date(msg.displayed_at).toLocaleString("vi-VN")
                                        : ""

                                      return (
                                        <div
                                          key={index}
                                          className={`flex ${isBot ? "justify-end" : "justify-start"}`}
                                        >
                                          <div
                                            className={`max-w-[70%] rounded-lg p-3 ${isBot
                                              ? "bg-orange-500 text-white"
                                              : "bg-gray-200 text-gray-900"
                                              }`}
                                          >
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-xs font-semibold">
                                                {isBot ? "Decoy Bot" : "Khách hàng"}
                                              </span>
                                              <span className="text-xs opacity-70">{timestamp}</span>
                                            </div>
                                            <p className="text-sm whitespace-pre-wrap break-words">
                                              {msg.content}
                                            </p>
                                          </div>
                                        </div>
                                      )
                                    })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeDetailView === "zalo-chat" && (
                      <div className="bg-white rounded-lg shadow-sm h-[600px] flex flex-col overflow-hidden">
                        {/* E2E Action Button - Fixed at top */}
                        <div className="border-b p-4 bg-purple-50">
                          <Button
                            onClick={handleRunE2E}
                            disabled={runningE2E}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            {runningE2E ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Đang chạy E2E...
                              </>
                            ) : (
                              "Chạy E2E"
                            )}
                          </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          {loadingE2eMessages ? (
                            <div className="flex items-center justify-center h-full">
                              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                              <span className="ml-2 text-muted-foreground">Đang tải tin nhắn...</span>
                            </div>
                          ) : e2eMessages.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                              Chưa có tin nhắn
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {e2eMessages.map((msg: ChatMessage, index: number) => {
                                const isVuCar = msg.uidFrom === "0" || msg.uidFrom === "bot" || msg.uidFrom === "system"
                                const timestamp = msg.timestamp
                                  ? new Date(msg.timestamp).toLocaleString("vi-VN")
                                  : msg.dateAction || ""

                                return (
                                  <div
                                    key={msg._id || index}
                                    className={`flex ${isVuCar ? "justify-end" : "justify-start"}`}
                                  >
                                    <div
                                      className={`max-w-[70%] rounded-lg p-3 ${isVuCar
                                        ? "bg-purple-500 text-white"
                                        : "bg-gray-200 text-gray-900"
                                        }`}
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-semibold">
                                          {isVuCar ? "VuCar" : "Khách hàng"}
                                        </span>
                                        <span className="text-xs opacity-70">{timestamp}</span>
                                      </div>
                                      {msg.img && (
                                        <img
                                          src={msg.img}
                                          alt="Message image"
                                          className="max-w-[200px] max-h-[200px] object-cover rounded mb-2"
                                        />
                                      )}
                                      <p className="text-sm whitespace-pre-wrap break-words">
                                        {msg.content}
                                      </p>
                                      {msg.type && msg.type !== "text" && (
                                        <span className="text-xs opacity-70 mt-1 block">
                                          Type: {msg.type}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {activeDetailView === "recent-activity" && (
                      <div className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">Hoạt động gần đây</h3>
                        <div className="text-center py-12 text-gray-400">
                          <Clock className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                          <p className="text-sm">Chưa có hoạt động nào</p>
                          <p className="text-xs mt-2">Các hoạt động của lead sẽ được hiển thị ở đây</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                <MessageCircle className="h-24 w-24 text-gray-300 mb-4" />
                <p className="text-lg font-medium">Chọn một lead để xem chi tiết</p>
                <p className="text-sm mt-2">Nhấp vào lead bên trái để xem thông tin chi tiết</p>
              </div>
            )
            }
          </>
        )}
      </div>

      {/* Create Bidding Confirmation Dialog */}
      < Dialog open={confirmBiddingOpen} onOpenChange={setConfirmBiddingOpen} >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận tạo Bidding</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn tạo bidding cho lead <strong>{leadToCreateBidding?.name}</strong>?
              <br />
              <span className="text-xs text-muted-foreground">
                SĐT: {leadToCreateBidding?.phone ? maskPhone(leadToCreateBidding.phone) : maskPhone(leadToCreateBidding?.additional_phone || "")}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmBiddingOpen(false)
                setLeadToCreateBidding(null)
              }}
              disabled={creatingBidding}
            >
              Hủy
            </Button>
            <Button
              onClick={confirmCreateBidding}
              disabled={creatingBidding}
            >
              {creatingBidding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                "Xác nhận"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Create Session Confirmation Dialog */}
      < Dialog open={confirmSessionOpen} onOpenChange={setConfirmSessionOpen} >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chọn phiên bản tạo phiên</DialogTitle>
            <DialogDescription>
              Bạn muốn tạo phiên cho xe {formatCarInfo(selectedLead || {} as Lead)} với phiên bản nào?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => handleCreateSession(1)}
              disabled={creatingSession}
            >
              <div className="text-left">
                <div className="font-semibold">Version 1: No Bid</div>
                <div className="text-xs text-muted-foreground">Tạo phiên không có trả giá từ dealer</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => handleCreateSession(2)}
              disabled={creatingSession}
            >
              <div className="text-left">
                <div className="font-semibold">Version 2: Have Bid</div>
                <div className="text-xs text-muted-foreground">Tạo phiên có trả giá từ dealer</div>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSessionOpen(false)} disabled={creatingSession}>
              Hủy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Workflow 2 Activation Dialog */}
      < Dialog open={workflow2Open} onOpenChange={setWorkflow2Open} >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Kích hoạt Workflow 2</DialogTitle>
            <DialogDescription>
              Nhập các thông số để kích hoạt workflow 2 cho xe {formatCarInfo(selectedLead || {} as Lead)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                type="number"
                placeholder="Nhập duration"
                value={workflow2Data.duration}
                onChange={(e) => setWorkflow2Data({ ...workflow2Data, duration: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="minPrice">Min Price</Label>
              <Input
                id="minPrice"
                type="number"
                placeholder="Nhập giá tối thiểu"
                value={workflow2Data.minPrice}
                onChange={(e) => setWorkflow2Data({ ...workflow2Data, minPrice: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxPrice">Max Price</Label>
              <Input
                id="maxPrice"
                type="number"
                placeholder="Nhập giá tối đa"
                value={workflow2Data.maxPrice}
                onChange={(e) => setWorkflow2Data({ ...workflow2Data, maxPrice: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="numberOfComments">Number of Comments</Label>
              <Input
                id="numberOfComments"
                type="number"
                placeholder="Nhập số lượng comments"
                value={workflow2Data.numberOfComments}
                onChange={(e) => setWorkflow2Data({ ...workflow2Data, numberOfComments: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="comment"
                checked={workflow2Data.comment}
                onCheckedChange={(checked) => setWorkflow2Data({ ...workflow2Data, comment: checked === true })}
              />
              <Label htmlFor="comment" className="text-sm font-normal cursor-pointer">
                Comment
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="bid"
                checked={workflow2Data.bid}
                onCheckedChange={(checked) => setWorkflow2Data({ ...workflow2Data, bid: checked === true })}
              />
              <Label htmlFor="bid" className="text-sm font-normal cursor-pointer">
                Bid
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWorkflow2Open(false)}
              disabled={activatingWorkflow2}
            >
              Hủy
            </Button>
            <Button
              onClick={handleActivateWorkflow2}
              disabled={activatingWorkflow2}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {activatingWorkflow2 ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang kích hoạt...
                </>
              ) : (
                "Kích hoạt"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Bidding History Dialog */}
      < Dialog open={biddingHistoryOpen} onOpenChange={setBiddingHistoryOpen} >
        <DialogContent className="w-[95vw] h-[85vh] flex flex-col sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[95rem]">
          <DialogHeader>
            <DialogTitle>Lịch sử trả giá - {selectedLead?.name}</DialogTitle>
            <DialogDescription>
              Danh sách các dealer đã trả giá cho xe {formatCarInfo(selectedLead || {} as Lead)}
            </DialogDescription>
            <div className="mt-2 flex gap-2">
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
              <div className="grid gap-2 w-32">
                <Label>Giá (VNĐ)</Label>
                <Input
                  type="number"
                  placeholder="Nhập giá"
                  value={newBidPrice}
                  onChange={(e) => setNewBidPrice(e.target.value)}
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
                onClick={handleCreateBiddingManual}
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
            ) : biddingHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Chưa có dealer nào trả giá</p>
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
                    {biddingHistory.map((bid, index) => (
                      <tr key={bid.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                        <td className="px-4 py-3 font-medium">{bid.dealer_name}</td>
                        <td className="px-4 py-3">
                          {editingBiddingId === bid.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                                className="h-8 w-32"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleUpdateBiddingPrice(bid.id)}
                                disabled={updatingBidding}
                              >
                                {updatingBidding ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setEditingBiddingId(null)}
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
                                  setEditingBiddingId(bid.id)
                                  setEditingPrice(bid.price.toString())
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
                Tổng số: <span className="font-semibold">{biddingHistory.length}</span> dealer trả giá
              </div>
              <Button variant="outline" onClick={() => setBiddingHistoryOpen(false)}>
                Đóng
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* E2E Messages Dialog */}
      < Dialog open={e2eMessagesOpen} onOpenChange={setE2eMessagesOpen} >
        <DialogContent className="w-[95vw] h-[85vh] flex flex-col sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[95rem]">
          <DialogHeader>
            <DialogTitle>Tin nhắn E2E - {selectedLead?.name}</DialogTitle>
            <DialogDescription>
              Lịch sử tin nhắn Zalo cho xe {formatCarInfo(selectedLead || {} as Lead)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingE2eMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Đang tải tin nhắn...</span>
              </div>
            ) : e2eMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Chưa có tin nhắn
              </div>
            ) : (
              <div className="space-y-3">
                {e2eMessages.map((msg: ChatMessage, index: number) => {
                  const isVuCar = msg.uidFrom === "0" || msg.uidFrom === "bot" || msg.uidFrom === "system"
                  const timestamp = msg.timestamp
                    ? new Date(msg.timestamp).toLocaleString("vi-VN")
                    : msg.dateAction || ""

                  return (
                    <div
                      key={msg._id || index}
                      className={`flex ${isVuCar ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${isVuCar
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold">
                            {isVuCar ? "VuCar" : "Khách hàng"}
                          </span>
                          <span className="text-xs opacity-70">{timestamp}</span>
                        </div>
                        {msg.img && (
                          <img
                            src={msg.img}
                            alt="Message image"
                            className="max-w-[200px] max-h-[200px] object-cover rounded mb-2"
                          />
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                        {msg.type && msg.type !== "text" && (
                          <span className="text-xs opacity-70 mt-1 block">
                            Type: {msg.type}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-muted-foreground">
                Tổng số: <span className="font-semibold">{e2eMessages.length}</span> tin nhắn
              </div>
              <Button variant="outline" onClick={() => setE2eMessagesOpen(false)}>
                Đóng
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Decoy Web Dialog */}
      < Dialog open={decoyWebOpen} onOpenChange={setDecoyWebOpen} >
        <DialogContent className="w-[95vw] h-[85vh] flex flex-col sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[95rem]">
          <DialogHeader>
            <DialogTitle>Decoy Web Threads - {selectedLead?.name}</DialogTitle>
            <DialogDescription>
              Danh sách các cuộc trò chuyện Decoy Web cho {formatCarInfo(selectedLead || {} as Lead)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Left Panel - Thread List */}
            <div className="w-80 border-r overflow-y-auto">
              {loadingDecoyWeb ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : decoyWebThreads.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Chưa có threads
                </div>
              ) : (
                <div className="space-y-2 p-2">
                  {decoyWebThreads.map((thread) => (
                    <button
                      key={thread.id}
                      onClick={() => setSelectedDecoyWebThreadId(thread.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedDecoyWebThreadId === thread.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/30 hover:bg-muted/50"
                        }`}
                    >
                      <div className="font-semibold text-sm mb-1">
                        Bot: {thread.bot_name || "Unknown"}
                      </div>
                      <div className="text-xs opacity-70">
                        {new Date(thread.created_at).toLocaleString("vi-VN")}
                      </div>
                      <div className="text-xs opacity-70 mt-1">
                        {thread.messages.length} tin nhắn
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Panel - Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              {!selectedDecoyWebThreadId ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Chọn một thread để xem tin nhắn
                </div>
              ) : (
                <div className="space-y-3">
                  {decoyWebThreads
                    .find((t) => t.id === selectedDecoyWebThreadId)
                    ?.messages.map((msg, index) => {
                      const isBot = msg.sender === "bot" || msg.sender === "system"
                      const timestamp = msg.displayed_at
                        ? new Date(msg.displayed_at).toLocaleString("vi-VN")
                        : ""

                      return (
                        <div
                          key={index}
                          className={`flex ${isBot ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${isBot
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                              }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold">
                                {isBot ? "Decoy Bot" : "Khách hàng"}
                              </span>
                              <span className="text-xs opacity-70">{timestamp}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-muted-foreground">
                Tổng số: <span className="font-semibold">{decoyWebThreads.length}</span> threads
              </div>
              <Button variant="outline" onClick={() => setDecoyWebOpen(false)}>
                Đóng
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Decoy Trigger Dialog */}
      <Dialog open={decoyDialogOpen} onOpenChange={setDecoyDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Gửi Decoy Zalo</DialogTitle>
            <DialogDescription>
              Chọn lý do quây để gửi tin nhắn decoy cho khách hàng {selectedLead?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="segment">Lý do quây</Label>
              <Select value={decoySegment} onValueChange={setDecoySegment}>
                <SelectTrigger id="segment">
                  <SelectValue placeholder="Chọn lý do..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="negotiation">Đàm phán / Cứng giá</SelectItem>
                  <SelectItem value="ghost">Ghost / Lead nguội</SelectItem>
                  <SelectItem value="check_sold">Check var đã bán chưa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="minutes">Số phút trước khi bot chat</Label>
              <Input
                id="minutes"
                type="number"
                placeholder="Nhập số phút..."
                value={decoyMinutes || "30"}
                onChange={(e) => setDecoyMinutes(e.target.value)}
                min="0"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Hệ thống sẽ tự động chọn ngẫu nhiên tài khoản:</p>
              <ul className="list-disc list-inside mt-1">
                <li>Minh Anh</li>
                <li>Huy Hồ</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecoyDialogOpen(false)} disabled={sendingDecoy}>
              Hủy
            </Button>
            <Button onClick={handleSendDecoy} disabled={!decoySegment || sendingDecoy} className="bg-emerald-600 hover:bg-emerald-700">
              {sendingDecoy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang gửi...
                </>
              ) : (
                "Gửi Decoy"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <DialogTitle className="text-base">Thông tin xe chi tiết</DialogTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLeadInfo}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Sao chép
              </Button>
            </div>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4">
              {/* Car Title and Price */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {[selectedLead.brand, selectedLead.model, selectedLead.variant]
                      .filter(Boolean)
                      .join(" ") || "N/A"}
                  </h2>
                  <div className="flex items-center gap-2">
                    {selectedLead.year && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded">
                        {selectedLead.year}
                      </span>
                    )}
                    {selectedLead.location && (
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                        {selectedLead.location}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase mb-1">Giá mong muốn</p>
                  {editMode ? (
                    <Input
                      type="text"
                      value={editedPriceCustomer}
                      onChange={(e) => setEditedPriceCustomer(e.target.value)}
                      onBlur={(e) => handlePriceFormat(e.target.value, setEditedPriceCustomer)}
                      className="text-right text-xl font-bold text-emerald-600 h-12"
                      placeholder="Nhập giá"
                    />
                  ) : (
                    <p className="text-2xl font-bold text-emerald-600">
                      {selectedLead.price_customer ? formatPrice(selectedLead.price_customer) : "N/A"}
                    </p>
                  )}
                </div>
              </div>

              {/* Car Images - Now in 2nd position */}
              {selectedLead.additional_images && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Hình ảnh thực tế ({imageCount})
                    </h3>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {processedImages.length > 0 ? (
                      processedImages.slice(0, 8).map((imgUrl, idx) => (
                        <div
                          key={idx}
                          className="aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                          onClick={() => {
                            setGalleryImages(processedImages);
                            setSelectedImageIndex(idx);
                            setGalleryOpen(true);
                          }}
                        >
                          <img
                            src={imgUrl}
                            alt={`Car ${idx}`}
                            className="w-full h-full object-cover hover:scale-110 transition-transform"
                            onError={(e) => {
                              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af"%3ENo Image%3C/text%3E%3C/svg%3E';
                            }}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="col-span-4 text-center py-8 text-gray-400">
                        <p className="text-sm">Chưa có ảnh</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Car Details Grid */}
              <div className="grid grid-cols-2 gap-4 py-4 border-y">
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">ODO</p>
                  <p className="text-base font-semibold text-gray-900">
                    {selectedLead.mileage ? `${selectedLead.mileage.toLocaleString()} km` : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Phiên bản</p>
                  <p className="text-base font-semibold text-gray-900">
                    {selectedLead.variant || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Màu sắc</p>
                  <p className="text-base font-semibold text-gray-900">N/A</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Động cơ</p>
                  <p className="text-base font-semibold text-gray-900">N/A</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Hộp số</p>
                  <p className="text-base font-semibold text-gray-900">N/A</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Biển số</p>
                  <p className="text-base font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded inline-block">
                    {selectedLead.plate || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Giai đoạn</p>
                  {editMode ? (
                    <Select value={editedStage} onValueChange={setEditedStage}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn giai đoạn..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CANNOT_CONTACT">Không liên lạc được</SelectItem>
                        <SelectItem value="CONTACTED">Đã liên hệ</SelectItem>
                        <SelectItem value="NEGOTIATION">Đang đàm phán</SelectItem>
                        <SelectItem value="CAR_VIEW">Xem xe</SelectItem>
                        <SelectItem value="DEPOSIT_PAID">Đã đặt cọc</SelectItem>
                        <SelectItem value="COMPLETED">Hoàn thành</SelectItem>
                        <SelectItem value="FAILED">Thất bại</SelectItem>
                        <SelectItem value="UNDEFINED">Chưa xác định</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={`text-base font-semibold px-3 py-1 ${getStageStyle(selectedLead.stage)} border-0`}>
                      {selectedLead.stage || "N/A"}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">SKU</p>
                  <p className="text-sm font-medium text-gray-900">{selectedLead.sku || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Ngày tạo xe</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedLead.car_created_at ? new Date(selectedLead.car_created_at).toLocaleDateString("vi-VN") : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tên khách hàng</p>
                  <p className="text-sm font-medium text-gray-900">{selectedLead.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Số điện thoại</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedLead.phone ? maskPhone(selectedLead.phone) : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">PIC</p>
                  <p className="text-sm font-medium text-gray-900">{selectedLead.pic_name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Giá cao nhất (Dealer)</p>
                  {editMode ? (
                    <Input
                      type="text"
                      value={editedPriceHighestBid}
                      onChange={(e) => setEditedPriceHighestBid(e.target.value)}
                      onBlur={(e) => handlePriceFormat(e.target.value, setEditedPriceHighestBid)}
                      className="text-sm font-semibold text-blue-600"
                      placeholder="Nhập giá"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-blue-600">
                      {selectedLead.price_highest_bid ? formatPrice(selectedLead.price_highest_bid) :
                        (selectedLead.dealer_bidding?.maxPrice ? formatPrice(selectedLead.dealer_bidding.maxPrice) : "N/A")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setDetailDialogOpen(false)
              setEditMode(false)
            }}>
              Đóng
            </Button>
            {editMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={updatingSaleStatus}
                >
                  Hủy
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleSaveChanges}
                  disabled={updatingSaleStatus}
                >
                  {updatingSaleStatus ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    "Lưu"
                  )}
                </Button>
              </>
            ) : (
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleEditToggle}
              >
                Chỉnh sửa
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <Dialog open={sendDealerDialogOpen} onOpenChange={setSendDealerDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Gửi thông tin xe đến nhóm dealer</DialogTitle>
            <DialogDescription>
              Chọn các nhóm dealer để gửi thông tin xe {formatCarInfo(selectedLead || {} as Lead)}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm nhóm dealer..."
                value={dealerGroupSearch}
                onChange={(e) => setDealerGroupSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6">
            {loadingDealerGroups ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Đang tải danh sách nhóm...</span>
              </div>
            ) : (() => {
              // Only show groups that have matching dealers
              const filteredGroups = dealerGroups
                .filter(group => group.dealerId) // Only groups with dealer ID
                .filter(group =>
                  group.groupName.toLowerCase().includes(dealerGroupSearch.toLowerCase())
                )

              return filteredGroups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>{dealerGroupSearch ? "Không tìm thấy nhóm phù hợp" : "Không tìm thấy nhóm dealer nào"}</p>
                </div>
              ) : (
                <div className="space-y-2 pb-4">
                  {filteredGroups.map((group) => (
                    <div
                      key={group.groupId}
                      className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                    >
                      <Checkbox
                        id={group.groupId}
                        checked={selectedGroupIds.includes(group.groupId)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedGroupIds([...selectedGroupIds, group.groupId])
                          } else {
                            setSelectedGroupIds(selectedGroupIds.filter(id => id !== group.groupId))
                          }
                        }}
                      />
                      <Label
                        htmlFor={group.groupId}
                        className="flex-1 cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {group.groupName}
                      </Label>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-muted-foreground">
                Đã chọn: <span className="font-semibold">{selectedGroupIds.length}</span> nhóm
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSendDealerDialogOpen(false)}
                  disabled={sendingToGroups}
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleSendToGroups}
                  disabled={selectedGroupIds.length === 0 || sendingToGroups}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {sendingToGroups ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang gửi...
                    </>
                  ) : (
                    `Gửi đến ${selectedGroupIds.length} nhóm`
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Gallery Modal */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95">
          <div className="relative w-full h-[95vh] flex items-center justify-center">
            {/* Close Button */}
            <button
              onClick={() => setGalleryOpen(false)}
              className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Image Counter */}
            <div className="absolute top-4 left-4 z-50 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium">
              {selectedImageIndex + 1} / {galleryImages.length}
            </div>

            {/* Previous Button */}
            {selectedImageIndex > 0 && (
              <button
                onClick={() => setSelectedImageIndex(prev => prev - 1)}
                className="absolute left-4 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}

            {/* Main Image */}
            <div className="w-full h-full flex items-center justify-center p-16">
              <img
                src={galleryImages[selectedImageIndex]}
                alt={`Car image ${selectedImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23374151" width="400" height="400"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="20"%3EImage not available%3C/text%3E%3C/svg%3E';
                }}
              />
            </div>

            {/* Next Button */}
            {selectedImageIndex < galleryImages.length - 1 && (
              <button
                onClick={() => setSelectedImageIndex(prev => prev + 1)}
                className="absolute right-4 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}

            {/* Thumbnail Strip */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 flex gap-2 max-w-[90vw] overflow-x-auto px-4 py-2 bg-black/50 rounded-lg">
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all ${idx === selectedImageIndex
                    ? 'border-white scale-110'
                    : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Create Thread Dialog */}
      <Dialog open={createThreadOpen} onOpenChange={setCreateThreadOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Tạo thread mới</DialogTitle>
            <DialogDescription>
              Nhập 4 số cuối điện thoại của khách hàng để tạo thread chat mới.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fourDigits" className="text-right">
                4 số cuối SĐT
              </Label>
              <Input
                id="fourDigits"
                value={fourDigitsInput}
                onChange={(e) => {
                  // Only allow digits and max 4 characters
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setFourDigitsInput(value)
                }}
                placeholder="1234"
                className="col-span-3"
                maxLength={4}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="firstMessage" className="text-right">
                Tin nhắn đầu
              </Label>
              <Input
                id="firstMessage"
                value={firstMessageInput}
                onChange={(e) => setFirstMessageInput(e.target.value)}
                placeholder="Hello"
                className="col-span-3"
              />
            </div>
            <p className="text-xs text-gray-500 text-center">
              Tên hiển thị: ******{fourDigitsInput || "XXXX"}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateThreadOpen(false)
                setFourDigitsInput("")
                setFirstMessageInput("Hello")
              }}
            >
              Hủy
            </Button>
            <Button
              onClick={handleCreateThread}
              disabled={createThreadLoading || fourDigitsInput.length !== 4}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {createThreadLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                "Bắt đầu"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Create Thread Dialog */}
      <Dialog open={createThreadOpen} onOpenChange={setCreateThreadOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Tạo thread mới</DialogTitle>
            <DialogDescription>
              Nhập 4 số cuối điện thoại của khách hàng để tạo thread chat mới.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fourDigits" className="text-right">
                4 số cuối SĐT
              </Label>
              <Input
                id="fourDigits"
                value={fourDigitsInput}
                onChange={(e) => {
                  // Only allow digits and max 4 characters
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setFourDigitsInput(value)
                }}
                placeholder="1234"
                className="col-span-3"
                maxLength={4}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="firstMessage" className="text-right">
                Tin nhắn đầu
              </Label>
              <Input
                id="firstMessage"
                value={firstMessageInput}
                onChange={(e) => setFirstMessageInput(e.target.value)}
                placeholder="Hello"
                className="col-span-3"
              />
            </div>
            <p className="text-xs text-gray-500 text-center">
              Tên hiển thị: ******{fourDigitsInput || "XXXX"}
            </p>
            <div className="flex items-center space-x-2 pt-2 border-t">
              <Switch
                id="send-zns"
                checked={sendZns}
                onCheckedChange={setSendZns}
              />
              <Label htmlFor="send-zns" className="cursor-pointer">Gửi ZNS thông báo cho user</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateThreadOpen(false)
                setFourDigitsInput("")
                setFirstMessageInput("Hello")
                setSendZns(false)
              }}
            >
              Hủy
            </Button>
            <Button
              onClick={handleCreateThread}
              disabled={createThreadLoading || fourDigitsInput.length !== 4}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {createThreadLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                "Bắt đầu"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >

  )
}
