"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, DollarSign, Play, Zap, MessageCircle, Loader2, Check, X, User, Copy, ChevronDown, ChevronUp, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Lead, BiddingHistory, WorkflowInstanceWithDetails, CustomFieldDefinition, WinCaseHistory, AiInsight, AiInsightHistory } from "../types"
import { formatPrice, parseShorthandPrice, formatPriceForEdit } from "../utils"
import { ActivateWorkflowDialog } from "../dialogs/ActivateWorkflowDialog"
import { SendScriptDialog } from "../dialogs/SendScriptDialog"
import { ExecuteConnectorDialog } from "../dialogs/ExecuteConnectorDialog"
import { UseFlowWizardDialog, FlowStep } from "../dialogs/UseFlowWizardDialog"
import { fetchAiInsights } from "@/hooks/use-leads"
import { AiThinkingChat } from "../common/AiThinkingChat"
import { SendFirstMessageAction } from "../actions/SendFirstMessageAction"
import { RenameLeadAction } from "../actions/RenameLeadAction"

// Custom fields configuration for each workflow
const getWorkflowCustomFields = (workflowName: string): CustomFieldDefinition[] => {
  switch (workflowName) {
    case "WF2":
      return [
        {
          name: "duration",
          label: "Duration",
          type: "number",
          required: true,
          placeholder: "Nhập thời lượng chiến dịch..."
        },
        {
          name: "minPrice",
          label: "Giá khách mong muốn (triệu)",
          type: "number",
          required: true,
          placeholder: "VD: 500 = 500 triệu"
        },
        {
          name: "maxPrice",
          label: "Giá bạn muốn trả khách khi kết phiên (triệu)",
          type: "number",
          required: true,
          placeholder: "VD: 600 = 600 triệu"
        },
        {
          name: "comment",
          label: "Bật comment",
          type: "select",
          required: false,
          options: ["true", "false"],
          default_value: "false",
          placeholder: "Chọn..."
        },
        {
          name: "numberOfComments",
          label: "Số lượng comments",
          type: "number",
          required: false,
          placeholder: "Nhập số lượng comments...",
          default_value: 0
        },
        {
          name: "bid",
          label: "Bật bidding",
          type: "select",
          required: false,
          options: ["true", "false"],
          default_value: "false",
          placeholder: "Chọn..."
        }
      ]

    case "WF2.1":
      return [
        {
          name: "meeting_date",
          label: "Ngày hẹn gặp khách",
          type: "date",
          required: true
        },
        {
          name: "customer_urgency",
          label: "Mức độ gấp của khách",
          type: "select",
          required: true,
          options: ["Rất gấp (< 1 tuần)", "Gấp (1-2 tuần)", "Không gấp (> 2 tuần)"],
          placeholder: "Chọn mức độ gấp..."
        }
      ]

    case "WF3":
      return [
        {
          name: "final_price_offered",
          label: "Giá cuối cùng đề xuất (VNĐ)",
          type: "number",
          required: true,
          placeholder: "Nhập giá cuối cùng..."
        },
        {
          name: "competitor_info",
          label: "Thông tin đối thủ cạnh tranh",
          type: "textarea",
          required: false,
          placeholder: "Khách có nhận giá từ đâu khác không? Giá bao nhiêu?"
        }
      ]

    case "WF3.1":
      return [
        {
          name: "payment_method",
          label: "Phương thức thanh toán",
          type: "select",
          required: true,
          options: ["Tiền mặt toàn bộ", "Chuyển khoản toàn bộ", "Kết hợp tiền mặt & CK", "Trả góp"],
          placeholder: "Chọn phương thức thanh toán..."
        },
        {
          name: "handover_notes",
          label: "Ghi chú bàn giao",
          type: "textarea",
          required: true,
          placeholder: "Ghi chú về lịch bàn giao, giấy tờ cần chuẩn bị..."
        }
      ]

    case "WFD5":
      return [
        {
          name: "minPrice",
          label: "Giá khách mong muốn (triệu)",
          type: "number",
          required: true,
          placeholder: "VD: 500 = 500 triệu"
        },
        {
          name: "maxPrice",
          label: "Giá bạn muốn trả khách khi kết phiên (triệu)",
          type: "number",
          required: true,
          placeholder: "VD: 600 = 600 triệu"
        },
        {
          name: "comment",
          label: "Bật comment",
          type: "select",
          required: false,
          options: ["true", "false"],
          default_value: "false",
          placeholder: "Chọn..."
        },
        {
          name: "numberOfComments",
          label: "Số lượng comments",
          type: "number",
          required: false,
          placeholder: "Nhập số lượng comments...",
          default_value: 0
        },
        {
          name: "bid",
          label: "Bật bidding",
          type: "select",
          required: false,
          options: ["true", "false"],
          default_value: "false",
          placeholder: "Chọn..."
        }
      ]

    case "WFD1":
      return [
        {
          name: "phone",
          label: "Số điện thoại",
          type: "text",
          required: true,
          placeholder: "Nhập số điện thoại khách hàng..."
        },
        {
          name: "first_message",
          label: "Tin nhắn đầu tiên",
          type: "textarea",
          required: true,
          placeholder: "Nhập tin nhắn đầu tiên gửi cho khách..."
        }
      ]

    default:
      return []
  }
}

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
  activeWorkflowView: string // Can be "purchase", "seeding", or workflow ID
  currentUserId: string | null
  onWorkflowViewChange: (view: string) => void

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

  // Beta Tracking Props
  workflowInstancesData?: {
    success: boolean
    data: WorkflowInstanceWithDetails[]
    allWorkflows: { id: string, name: string, description?: string, tooltip?: string | null }[]
    allTransitions: { from_workflow_id: string, to_workflow_id: string, to_workflow_name: string }[]
    allWorkflowSteps: Record<string, any[]>
    canActivateWF2: boolean
  }

  // Workflow activation callback
  onWorkflowActivated?: () => void
}

export function WorkflowTrackerTab({
  selectedLead,
  currentUserId,
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
  workflowInstancesData,
  onWorkflowActivated
}: WorkflowTrackerTabProps) {
  // Zalo action status (fetched on mount and after each action)
  const [firstMessageDone, setFirstMessageDone] = useState(false)
  const [firstMessageFailed, setFirstMessageFailed] = useState(false)
  const [renameDone, setRenameDone] = useState(false)
  const [loadingZaloStatus, setLoadingZaloStatus] = useState(false)
  const prevSendingMessage = useRef(sendingMessage)
  const prevRenamingLead = useRef(renamingLead)

  const fetchZaloActionStatuses = useCallback(async () => {
    if (!selectedLead?.car_id) return
    const carId = encodeURIComponent(selectedLead.car_id)
    setLoadingZaloStatus(true)
    try {
      const [firstMsg, rename] = await Promise.all([
        fetch(`/api/akabiz/check-zalo-action?car_id=${carId}&action_type=firstMessage`).then(r => r.json()),
        fetch(`/api/akabiz/check-zalo-action?car_id=${carId}&action_type=rename`).then(r => r.json()),
      ])
      setFirstMessageDone(firstMsg.success === true)
      setFirstMessageFailed(firstMsg.failed === true)
      setRenameDone(rename.success === true)
    } catch {
      // non-fatal
    } finally {
      setLoadingZaloStatus(false)
    }
  }, [selectedLead?.car_id])

  // Load on mount / lead change
  useEffect(() => {
    setFirstMessageDone(false)
    setFirstMessageFailed(false)
    setRenameDone(false)
    fetchZaloActionStatuses()
  }, [selectedLead?.car_id])

  // Re-fetch after sendingMessage or renamingLead finishes
  useEffect(() => {
    if (prevSendingMessage.current && !sendingMessage) {
      fetchZaloActionStatuses()
    }
    prevSendingMessage.current = sendingMessage
  }, [sendingMessage])

  useEffect(() => {
    if (prevRenamingLead.current && !renamingLead) {
      fetchZaloActionStatuses()
    }
    prevRenamingLead.current = renamingLead
  }, [renamingLead])

  // Local state for inline editing
  const [editingBidId, setEditingBidId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState("")
  const [savingBid, setSavingBid] = useState(false)

  // State for expand/collapse dealer bids
  const [isExpanded, setIsExpanded] = useState(false)
  // State for copy feedback
  const [copied, setCopied] = useState(false)

  // State for win case history
  const [winCaseHistory, setWinCaseHistory] = useState<WinCaseHistory[]>([])
  const [loadingWinHistory, setLoadingWinHistory] = useState(false)
  const [winHistoryError, setWinHistoryError] = useState<string | null>(null)
  const [winHistoryStats, setWinHistoryStats] = useState<{
    completedCount: number
    totalCount: number
    avgPrice: number | null
    winRate: string | null
  } | null>(null)
  const [activeHistoryTab, setActiveHistoryTab] = useState<'sales' | 'bids'>('sales')

  // State for workflow activation dialog
  const [activateDialogOpen, setActivateDialogOpen] = useState(false)
  const [selectedTransition, setSelectedTransition] = useState<{
    workflowId: string
    workflowName: string
    workflowTooltip?: string | null
    parentInstanceId: string
    isFromWF0?: boolean
  } | null>(null)

  // State for AI insights
  const [aiInsights, setAiInsights] = useState<any>(null)
  const [fetchingAiInsights, setFetchingAiInsights] = useState(false)

  // State for Send Script dialog
  const [sendScriptOpen, setSendScriptOpen] = useState(false)
  const [pendingScript, setPendingScript] = useState("")

  const handleSendScript = (scriptText: string) => {
    setPendingScript(scriptText)
    setSendScriptOpen(true)
  }

  // State for Execute Connector dialog
  const [executeConnectorOpen, setExecuteConnectorOpen] = useState(false)
  const [pendingConnector, setPendingConnector] = useState<{
    name: string
    defaultValues: Record<string, any>
    title: string
  } | null>(null)

  const handleExecuteConnector = (connectorName: string, defaultValues: Record<string, any>, title: string) => {
    setPendingConnector({ name: connectorName, defaultValues, title })
    setExecuteConnectorOpen(true)
  }

  // State for Use Flow wizard
  const [useFlowOpen, setUseFlowOpen] = useState(false)
  const [pendingFlowSteps, setPendingFlowSteps] = useState<FlowStep[]>([])

  const handleUseFlow = (steps: FlowStep[]) => {
    setPendingFlowSteps(steps)
    setUseFlowOpen(true)
  }

  // Track last selected lead to detect when to force reset the view
  const lastLeadIdRef = useRef<string | null>(null)

  // Auto-select workflow on load: Latest Completed > WF0
  useEffect(() => {
    if (!workflowInstancesData?.allWorkflows || workflowInstancesData.allWorkflows.length === 0 || !selectedLead) {
      return
    }

    const leadChanged = lastLeadIdRef.current !== selectedLead.id
    lastLeadIdRef.current = selectedLead.id

    // Only skip auto-selection if lead hasn't changed AND current view is valid
    if (!leadChanged) {
      const isValidView = activeWorkflowView === "purchase" ||
        activeWorkflowView === "seeding" ||
        workflowInstancesData.allWorkflows.some((w: any) => w.id === activeWorkflowView)
      if (isValidView) {
        return
      }
    }

    // Priority 1: Find the most recently completed workflow instance
    const completedWorkflows = (workflowInstancesData.data || [])
      .filter((i: any) => i.instance.status === "completed" && i.instance.completed_at)
      .sort((a: any, b: any) => {
        const dateA = new Date(a.instance.completed_at!).getTime()
        const dateB = new Date(b.instance.completed_at!).getTime()
        return dateB - dateA // Most recent first
      })

    if (completedWorkflows.length > 0) {
      const mostRecentCompleted = completedWorkflows[0]
      console.log(`[WorkflowTracker] Auto-selecting most recently completed workflow: ${mostRecentCompleted.instance.workflow_id}`)
      onWorkflowViewChange(mostRecentCompleted.instance.workflow_id)
      return
    }

    // Priority 2: Select WF0
    const wf0 = workflowInstancesData.allWorkflows.find((w: any) => w.name === "WF0")
    if (wf0) {
      console.log(`[WorkflowTracker] Auto-selecting WF0 as fallback`)
      onWorkflowViewChange(wf0.id)
      return
    }

    // Fallback: First available workflow
    if (workflowInstancesData.allWorkflows[0]) {
      onWorkflowViewChange(workflowInstancesData.allWorkflows[0].id)
    }
  }, [workflowInstancesData, activeWorkflowView, onWorkflowViewChange, selectedLead])

  // Join data
  const currentInstance = workflowInstancesData?.data?.find(i => i.instance.workflow_id === activeWorkflowView)

  // Shared polling ref for AI insights — accessible from both useEffect and feedback handler
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  // Track which car_id we've already started fetching insights for (prevents duplicate triggers)
  const insightsCarIdRef = useRef<string | null>(null)

  // Reusable function to load insights + poll on 202
  const loadAndPollInsights = useCallback((carId: string, phoneNumber: string, userFeedback?: string) => {
    if (!isMountedRef.current) return

    console.log(`[WorkflowTracker] Fetching AI insights for car ${carId}...${userFeedback ? ' (with feedback)' : ''}`)
    setFetchingAiInsights(true)

    fetchAiInsights(carId, phoneNumber, userFeedback)
      .then((result) => {
        if (!isMountedRef.current) return

        // Check if still processing — start polling
        if (result?.processing) {
          console.log("[WorkflowTracker] AI insights still processing, will check again in 3s")
          setFetchingAiInsights(true) // Keep loading state active

          if (!pollIntervalRef.current) {
            pollIntervalRef.current = setInterval(() => {
              loadAndPollInsights(carId, phoneNumber) // No feedback on subsequent polls
            }, 3000)
          }
          return
        }

        // Real result received — show it and stop polling
        setAiInsights(result)
        console.log("[WorkflowTracker] AI Insights fetched:", result)

        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        setFetchingAiInsights(false)
      })
      .catch((error) => {
        if (!isMountedRef.current) return
        console.error("[WorkflowTracker] Failed to fetch AI insights:", error)
        setFetchingAiInsights(false)
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
      })
  }, [])

  // Cleanup polling and mounted flag on unmount only (not on dep changes)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [])

  // Fetch AI insights — deduplicated per car_id
  // Switching workflow tabs (WF0→WF2) for the same car won't re-trigger
  useEffect(() => {
    // Reset when car actually changes
    if (insightsCarIdRef.current && insightsCarIdRef.current !== selectedLead.car_id) {
      setAiInsights(null)
      insightsCarIdRef.current = null
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }

    const isDynamicWorkflow = activeWorkflowView !== "purchase" && activeWorkflowView !== "seeding"
    if (!isDynamicWorkflow || !selectedLead.car_id) {
      return
    }

    const phoneNumber = selectedLead.phone || selectedLead.additional_phone
    if (!phoneNumber) return

    // Skip if already fetching/fetched for this car
    if (insightsCarIdRef.current === selectedLead.car_id) return

    insightsCarIdRef.current = selectedLead.car_id
    loadAndPollInsights(selectedLead.car_id, phoneNumber)
    // Note: cleanup is handled by the mount/unmount effect above
  }, [activeWorkflowView, selectedLead.car_id, selectedLead.phone, selectedLead.additional_phone, loadAndPollInsights])


  // Fetch win case history when car model is available
  useEffect(() => {
    // Only fetch if we have the required car model information
    if (!selectedLead.brand || !selectedLead.model) {
      setWinCaseHistory([])
      return
    }

    const fetchWinHistory = async () => {
      setLoadingWinHistory(true)
      setWinHistoryError(null)

      try {
        const response = await fetch('/api/e2e/win-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand: selectedLead.brand,
            model: selectedLead.model,
            variant: selectedLead.variant || null,
            type: activeHistoryTab
          })
        })

        if (!response.ok) {
          throw new Error('Failed to fetch win history')
        }

        const data = await response.json()

        if (data.success) {
          console.log(`[WorkflowTracker] Loaded ${data.count} ${activeHistoryTab} for ${selectedLead.brand} ${selectedLead.model}`)
          setWinCaseHistory(data.data || [])
          setWinHistoryStats(data.stats || null)
        } else {
          throw new Error(data.error || 'Unknown error')
        }
      } catch (error) {
        console.error('[WorkflowTracker] Failed to fetch win history:', error)
        setWinHistoryError(error instanceof Error ? error.message : 'Failed to load win history')
        setWinCaseHistory([])
        setWinHistoryStats(null)
      } finally {
        setLoadingWinHistory(false)
      }
    }

    fetchWinHistory()
  }, [selectedLead.brand, selectedLead.model, selectedLead.variant, activeHistoryTab])

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
    setEditingPrice(formatPriceForEdit(bid.price))
  }

  const handleCancelEdit = () => {
    setEditingBidId(null)
    setEditingPrice("")
  }

  const handleSaveEdit = async (bidId: string) => {
    if (!onUpdateBid || !editingPrice) return
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
      {/* AI Insight Thinking Chat - Above Workflow Tracker */}
      <AiThinkingChat
        insights={aiInsights}
        isLoading={fetchingAiInsights}
        onSendScript={handleSendScript}
        onExecuteConnector={handleExecuteConnector}
        onUseFlow={handleUseFlow}
        carId={selectedLead.car_id || undefined}
        currentUserId={currentUserId}
        leadPhone={selectedLead.phone || selectedLead.additional_phone || undefined}
        onSubmitFeedback={async (feedback) => {
          if (!selectedLead.car_id) return
          const phoneNumber = selectedLead.phone || selectedLead.additional_phone
          if (!phoneNumber) return

          // Stop any existing polling before starting feedback-triggered load
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }

          // Submit feedback and start polling — loading stays active until real result arrives
          loadAndPollInsights(selectedLead.car_id, phoneNumber, feedback)
        }}
        onRate={async (id, isHistory, isPositive) => {
          if (!aiInsights) return

          // Update parent state directly for sync
          setAiInsights((prev: AiInsight | null) => {
            if (!prev) return prev

            if (!isHistory && prev.aiInsightId === id) {
              return { ...prev, is_positive: isPositive }
            }

            if (prev.history) {
              const newHistory = prev.history.map((h: AiInsightHistory) =>
                h.id === id ? { ...h, is_positive: isPositive } : h
              )
              return { ...prev, history: newHistory }
            }

            return prev
          })
        }}
      />

      {/* Price Info & Stats */}
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
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                  Top Dealer Bids
                </h5>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCopy}
                    className={`p-1 rounded transition-colors ${copied ? "text-emerald-600 bg-emerald-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  {allValidBids.length > 5 && (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              {loadingBiddingHistory ? (
                <div className="flex items-center py-4 text-gray-400"><Loader2 className="h-3 w-3 animate-spin mr-2" /><span className="text-xs">Loading...</span></div>
              ) : displayBids.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">Chưa có giá</p>
              ) : (
                <div className={`space-y-0.5 ${isExpanded ? "max-h-[300px] overflow-y-auto scrollbar-thin" : ""}`}>
                  {displayBids.map((bid, index) => (
                    <div key={bid.id} className={`flex items-center justify-between py-1.5 px-2 rounded group transition-colors ${index === 0 ? "bg-blue-50/50" : "hover:bg-gray-50"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] w-4 h-4 flex items-center justify-center rounded-full ${index === 0 ? "bg-blue-100 text-blue-600 font-medium" : "text-gray-400"}`}>{index + 1}</span>
                        <span className="text-xs text-gray-700 truncate max-w-[100px]">{bid.dealer_name}</span>
                      </div>
                      {editingBidId === bid.id ? (
                        <div className="flex items-center gap-1">
                          <Input type="text" value={editingPrice} onChange={(e) => setEditingPrice(e.target.value)} className="h-5 w-16 text-[10px] text-right" autoFocus />
                          <p className="text-[9px] text-gray-400 whitespace-nowrap">Nhập 3-4 số</p>
                          <button onClick={() => handleSaveEdit(bid.id)} disabled={savingBid}>
                            {savingBid ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          </button>
                          <button onClick={handleCancelEdit}><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-medium ${index === 0 ? "text-blue-600" : "text-gray-600"}`}>{formatPrice(bid.price)}</span>
                          {onUpdateBid && <button className="opacity-0 group-hover:opacity-100 text-gray-300" onClick={() => handleStartEdit(bid)}><span className="text-[10px]">✎</span></button>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <h5 className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                  Đề xuất Dealer
                </h5>
              </div>
              <div className="space-y-1.5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between py-2 px-2.5 bg-gray-50 rounded-md">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px]">?</div>
                      <p className="text-xs text-gray-700">Dealer {i}</p>
                    </div>
                    <span className="text-xs font-medium text-emerald-600">--</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Win Case History Section */}
          <div className="mt-4 sm:mt-6">
            <div className="flex items-center gap-4 mb-3 border-b border-gray-100 pb-2">
              <button
                onClick={() => setActiveHistoryTab('sales')}
                className={`text-xs font-medium pb-1 relative transition-colors ${activeHistoryTab === 'sales' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Giá chốt
                {activeHistoryTab === 'sales' && <span className="absolute bottom-[-9px] left-0 w-full h-0.5 bg-blue-600 rounded-full"></span>}
              </button>
              <button
                onClick={() => setActiveHistoryTab('bids')}
                className={`text-xs font-medium pb-1 relative transition-colors ${activeHistoryTab === 'bids' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Lịch sử trả giá
                {activeHistoryTab === 'bids' && <span className="absolute bottom-[-9px] left-0 w-full h-0.5 bg-blue-600 rounded-full"></span>}
              </button>
            </div>

            {/* Aggregate Stats */}
            {winHistoryStats && !loadingWinHistory && (
              <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {activeHistoryTab === 'sales' ? 'GIÁ TB QUÁ KHỨ' : 'GIÁ BID TRUNG BÌNH'}
                  </span>
                  <span className="text-sm font-bold text-blue-700">
                    {winHistoryStats.avgPrice ? formatPrice(winHistoryStats.avgPrice) : '—'}
                  </span>
                </div>
                {activeHistoryTab === 'sales' && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      TỶ LỆ CHỐT (CVR)
                    </span>
                    <span className="text-sm font-bold text-emerald-600">
                      {winHistoryStats.completedCount}/{winHistoryStats.totalCount} xe
                      {winHistoryStats.winRate && <span className="ml-1 text-xs font-medium text-gray-500">{winHistoryStats.winRate}%</span>}
                    </span>
                  </div>
                )}
              </div>
            )}

            {loadingWinHistory ? (
              <div className="flex items-center py-4 text-gray-400">
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                <span className="text-xs">Đang tải lịch sử giao dịch...</span>
              </div>
            ) : winHistoryError ? (
              <p className="text-xs text-red-500 py-2">{winHistoryError}</p>
            ) : winCaseHistory.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">Chưa có lịch sử giao dịch cho mẫu xe này</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
                {winCaseHistory.map((winCase) => {
                  const soldDate = new Date(winCase.sold_date)
                  const formattedDate = soldDate.toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })

                  // Get negotiation ability badge color
                  const getNegotiationBadge = (ability: string | null) => {
                    if (!ability || ability === 'BID') return null
                    const lower = ability.toLowerCase()
                    if (lower === 'easy') return { bg: 'bg-red-100', text: 'text-red-700', label: 'EASY' }
                    if (lower === 'maybe') return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'MAYBE' }
                    if (lower === 'hard') return { bg: 'bg-green-100', text: 'text-green-700', label: 'HARD' }
                    return { bg: 'bg-gray-100', text: 'text-gray-700', label: ability }
                  }

                  // Get car condition badge color
                  const getConditionBadge = (condition: string | null) => {
                    if (!condition) return null
                    const lower = condition.toLowerCase()
                    if (lower === 'good' || lower === 'excellent') return { bg: 'bg-green-100', text: 'text-green-700', label: condition }
                    if (lower === 'bad' || lower === 'poor') return { bg: 'bg-red-100', text: 'text-red-700', label: condition }
                    return { bg: 'bg-gray-100', text: 'text-gray-700', label: condition }
                  }

                  const negotiationBadge = getNegotiationBadge(winCase.negotiation_ability)
                  const conditionBadge = getConditionBadge(winCase.car_condition)

                  const handleCrmClick = () => {
                    const phone = selectedLead.phone || selectedLead.additional_phone
                    if (phone) {
                      const crmUrl = `https://dashboard.vucar.vn/crm-v2?search=${encodeURIComponent(phone)}`
                      window.open(crmUrl, '_blank')
                    }
                  }

                  const leadPhone = selectedLead.phone || selectedLead.additional_phone

                  return (
                    <div
                      key={winCase.id}
                      onClick={handleCrmClick}
                      className={`grid grid-cols-2 gap-3 py-2.5 px-3 bg-gray-50 rounded-md ${leadPhone ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
                      title={leadPhone ? `Click để xem trong CRM: ${leadPhone}` : undefined}
                    >
                      {/* Left side: Dealer info + sold date + car info */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                            {winCase.dealer_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <p className="text-xs font-medium text-gray-800 truncate">{winCase.dealer_name}</p>
                            <p className="text-[10px] text-gray-500">
                              {formattedDate}
                            </p>
                          </div>
                        </div>
                        <p className="text-[10px] text-blue-600 ml-8 truncate">
                          {winCase.car_info.brand} {winCase.car_info.model} {winCase.car_info.variant || ''} {winCase.car_info.year || ''}
                          {winCase.car_info.mileage ? ` - ${winCase.car_info.mileage.toLocaleString()}km` : ''}
                        </p>
                      </div>

                      {/* Right side: Price + badges */}
                      <div className="flex flex-col gap-1 items-end">
                        <p className={`text-xs font-semibold ${activeHistoryTab === 'bids' ? 'text-orange-600' : 'text-emerald-600'}`}>
                          {winCase.price_sold ? formatPrice(winCase.price_sold) : '—'}
                        </p>
                        <div className="flex items-center gap-1">
                          {negotiationBadge && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${negotiationBadge.bg} ${negotiationBadge.text}`}>
                              {negotiationBadge.label}
                            </span>
                          )}
                          {conditionBadge && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${conditionBadge.bg} ${conditionBadge.text}`}>
                              {conditionBadge.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      {/* Workflow Tracker */}
      <div className="bg-white rounded-lg p-3 sm:p-5 shadow-sm mt-4 sm:mt-6">
        {/* Header - Stack on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h3 className="text-sm font-semibold text-gray-900">Tiến độ quy trình</h3>
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              {/* Dynamic Workflow Tabs */}
              {workflowInstancesData?.allWorkflows
                ?.slice()
                .sort((a, b) => {
                  // WF0 always first
                  if (a.name === "WF0") return -1
                  if (b.name === "WF0") return 1
                  // Then sort by name
                  return a.name.localeCompare(b.name)
                })
                .map(workflow => {
                  const isActive = activeWorkflowView === workflow.id
                  const instance = workflowInstancesData.data?.find(i => i.instance.workflow_id === workflow.id)

                  const buttonContent = (
                    <button
                      key={workflow.id}
                      onClick={() => onWorkflowViewChange(workflow.id)}
                      className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${isActive
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                      {instance?.instance.status === "completed" && <CheckCircle className="h-3 w-3 text-emerald-500" />}
                      {instance?.instance.status === "running" && <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />}
                      {workflow.name}
                    </button>
                  )

                  return workflow.tooltip ? (
                    <Tooltip key={workflow.id}>
                      <TooltipTrigger asChild>
                        {buttonContent}
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p className="whitespace-pre-wrap">{workflow.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : buttonContent
                })
              }
            </div>
          </div>
        </div>

        {/* Current Workflow Description Callout - Below the tabs */}
        {(() => {
          const currentWorkflow = workflowInstancesData?.allWorkflows?.find(w => w.id === activeWorkflowView)
          if (currentWorkflow?.tooltip) {
            return (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700 whitespace-pre-wrap">{currentWorkflow.tooltip}</p>
              </div>
            )
          }
          return null
        })()}

        {/* Workflow Steps - Horizontally scrollable on mobile */}
        {workflowInstancesData?.allWorkflows?.find(w => w.id === activeWorkflowView) ? (
          /* Dynamic Workflow View */
          (() => {
            const currentWorkflow = workflowInstancesData.allWorkflows.find(w => w.id === activeWorkflowView)!
            const currentInstance = workflowInstancesData.data?.find(i => i.instance.workflow_id === activeWorkflowView)
            const workflowSteps = workflowInstancesData.allWorkflowSteps?.[activeWorkflowView] || []

            // For WF0, allow transitions even without instance; for others, require completed status
            const isWF0 = currentWorkflow.name === "WF0"
            const availableTransitions = (isWF0 || currentInstance?.instance.status === "completed")
              ? workflowInstancesData.allTransitions.filter(t => t.from_workflow_id === activeWorkflowView)
              : []

            const visibleTransitions = availableTransitions.filter(transition => {
              const targetInstance = workflowInstancesData.data?.find(i => i.instance.workflow_id === transition.to_workflow_id)
              return !targetInstance || (targetInstance.instance.status !== "running" && targetInstance.instance.status !== "completed")
            })

            // Get step execution status
            const getStepStatus = (step: any) => {
              const execution = currentInstance?.steps?.find((s: any) => s.id === step.id)?.execution
              return {
                isCompleted: execution?.status === "success",
                isFailed: execution?.status === "failed",
                executedAt: execution?.executed_at,
                errorMessage: execution?.error_message
              }
            }

            return (
              <div className="overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-thin snap-x snap-mandatory">
                <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-8 w-max sm:w-full sm:justify-between px-1 sm:px-4">
                  {workflowSteps.length > 0 ? (
                    workflowSteps.map((step: any, idx: number) => {
                      const status = getStepStatus(step)
                      return (
                        <div
                          key={step.id}
                          className="flex flex-col items-center gap-2 sm:gap-3 snap-center shrink-0 w-[120px] sm:w-auto sm:flex-1"
                        >
                          <WorkflowStep
                            icon={
                              status.isCompleted ? (
                                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8" />
                              ) : status.isFailed ? (
                                <X className="w-6 h-6 sm:w-8 sm:h-8" />
                              ) : (
                                <Play className="w-6 h-6 sm:w-8 sm:h-8" />
                              )
                            }
                            title={step.step_name}
                            status={
                              status.isCompleted
                                ? "Hoàn thành"
                                : status.isFailed
                                  ? "Thất bại"
                                  : currentInstance
                                    ? "Chưa thực hiện"
                                    : "Chưa chạy"
                            }
                            isCompleted={status.isCompleted}
                          />
                          {step.is_automated && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-600 border-blue-200">
                              <Zap className="h-3 w-3 mr-0.5" />
                              Auto
                            </Badge>
                          )}
                          {status.executedAt && (
                            <span className="text-[10px] text-gray-400">
                              {new Date(status.executedAt).toLocaleTimeString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                          {status.isFailed && status.errorMessage && (
                            <p className="text-[10px] text-red-500 text-center italic max-w-[120px]">
                              {status.errorMessage}
                            </p>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="w-full text-center py-8 text-gray-400">
                      <p className="text-sm">Workflow này chưa có bước nào được cấu hình</p>
                    </div>
                  )}
                </div>

                {/* Activation Buttons - Same position as "Kích hoạt WF 2" */}
                {visibleTransitions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {visibleTransitions.map(transition => (
                      <Button
                        key={transition.to_workflow_id}
                        variant="default"
                        size="sm"
                        onClick={() => {
                          // For WF0, use null as parentInstanceId since there's no instance
                          const parentId = isWF0 ? null : currentInstance?.instance.id
                          // Get tooltip from allWorkflows
                          const targetWorkflow = workflowInstancesData.allWorkflows.find(w => w.id === transition.to_workflow_id)
                          if (isWF0 || currentInstance?.instance.id) {
                            setSelectedTransition({
                              workflowId: transition.to_workflow_id,
                              workflowName: transition.to_workflow_name,
                              workflowTooltip: targetWorkflow?.tooltip || null,
                              parentInstanceId: parentId || "",
                              isFromWF0: isWF0
                            })
                            setActivateDialogOpen(true)
                          }
                        }}
                        className={`${transition.to_workflow_id === aiInsights?.targetWorkflowId
                          ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-none"
                          : "bg-emerald-600 hover:bg-emerald-700"
                          } text-xs sm:text-sm`}
                      >
                        <Zap className="h-3.5 w-3.5 mr-1.5" />
                        Kích hoạt {transition.to_workflow_name}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Action Buttons - Send First Message & Rename Lead */}
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  <div className="flex flex-col items-start gap-1">
                    <SendFirstMessageAction
                      onClick={onSendFirstMessage}
                      disabled={sendingMessage || !selectedLead?.pic_id}
                      loading={sendingMessage}
                    />
                    {firstMessageDone && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle className="h-3 w-3" /> Đã gửi thành công
                      </span>
                    )}
                    {!firstMessageDone && firstMessageFailed && (
                      <span className="flex items-center gap-1 text-xs text-red-500">
                        <XCircle className="h-3 w-3" /> Gửi thất bại
                      </span>
                    )}
                    {!loadingZaloStatus && !firstMessageDone && !firstMessageFailed && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <X className="h-3 w-3" /> Chưa thực hiện
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <RenameLeadAction
                      onClick={onRenameLead}
                      disabled={renamingLead || !selectedLead?.pic_id}
                      loading={renamingLead}
                    />
                    {renameDone && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle className="h-3 w-3" /> Đã đổi tên thành công
                      </span>
                    )}
                    {!loadingZaloStatus && !renameDone && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <X className="h-3 w-3" /> Chưa thực hiện
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })()
        ) : null}
      </div>

      {/* Send Script Dialog */}
      <SendScriptDialog
        open={sendScriptOpen}
        onOpenChange={setSendScriptOpen}
        selectedLead={selectedLead}
        scriptText={pendingScript}
      />

      {/* Execute Connector Dialog */}
      {pendingConnector && (
        <ExecuteConnectorDialog
          open={executeConnectorOpen}
          onOpenChange={setExecuteConnectorOpen}
          connectorName={pendingConnector.name}
          defaultValues={pendingConnector.defaultValues}
          dialogTitle={pendingConnector.title}
        />
      )}

      {/* Workflow Activation Dialog */}
      {selectedTransition && (
        <ActivateWorkflowDialog
          open={activateDialogOpen}
          onOpenChange={setActivateDialogOpen}
          selectedLead={selectedLead}
          targetWorkflowId={selectedTransition.workflowId}
          targetWorkflowName={selectedTransition.workflowName}
          targetWorkflowTooltip={selectedTransition.workflowTooltip}
          parentInstanceId={selectedTransition.parentInstanceId}
          customFields={getWorkflowCustomFields(selectedTransition.workflowName)}
          aiInsightId={aiInsights?.aiInsightId || null}
          isAlignedWithAi={aiInsights?.targetWorkflowId === selectedTransition.workflowId}
          hideDefaultFields={selectedTransition.isFromWF0}
          workflowSteps={workflowInstancesData?.allWorkflowSteps?.[selectedTransition.workflowId] || []}
          onSuccess={() => {
            if (onWorkflowActivated) {
              onWorkflowActivated()
            }
          }}
        />
      )}

      {/* Use Flow Wizard Dialog */}
      <UseFlowWizardDialog
        open={useFlowOpen}
        onOpenChange={setUseFlowOpen}
        steps={pendingFlowSteps}
        carId={selectedLead.car_id || ''}
        onSuccess={() => {
          if (onWorkflowActivated) {
            onWorkflowActivated()
          }
        }}
      />
    </>
  )
}
