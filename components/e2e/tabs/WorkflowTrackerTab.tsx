"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, DollarSign, Play, Zap, MessageCircle, Loader2, Check, X, User, Copy, ChevronDown, ChevronUp, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Lead, BiddingHistory, WorkflowInstanceWithDetails, CustomFieldDefinition, WinCaseHistory } from "../types"
import { formatPrice, parseShorthandPrice, formatPriceForEdit } from "../utils"
import { ActivateWorkflowDialog } from "../dialogs/ActivateWorkflowDialog"
import { fetchAiInsights } from "@/hooks/use-leads"

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

  // Auto-select first active/running workflow on load
  useEffect(() => {
    if (!workflowInstancesData?.data || workflowInstancesData.data.length === 0) {
      return
    }

    // Check if current view is already showing a valid workflow
    const currentWorkflow = workflowInstancesData.allWorkflows?.find(w => w.id === activeWorkflowView)
    if (currentWorkflow) {
      // Already viewing a valid workflow, don't override
      return
    }

    // Find first running workflow
    const runningWorkflow = workflowInstancesData.data.find(i => i.instance.status === "running")
    if (runningWorkflow) {
      console.log(`[WorkflowTracker] Auto-selecting running workflow: ${runningWorkflow.instance.workflow_id}`)
      onWorkflowViewChange(runningWorkflow.instance.workflow_id)
      return
    }

    // Fallback: Find first completed workflow
    const completedWorkflow = workflowInstancesData.data.find(i => i.instance.status === "completed")
    if (completedWorkflow) {
      console.log(`[WorkflowTracker] Auto-selecting completed workflow: ${completedWorkflow.instance.workflow_id}`)
      onWorkflowViewChange(completedWorkflow.instance.workflow_id)
      return
    }

    // Fallback: Select first available workflow if no running/completed ones
    if (workflowInstancesData.allWorkflows && workflowInstancesData.allWorkflows.length > 0) {
      const firstWorkflow = workflowInstancesData.allWorkflows[0]
      console.log(`[WorkflowTracker] Auto-selecting first available workflow: ${firstWorkflow.id}`)
      onWorkflowViewChange(firstWorkflow.id)
    }
  }, [workflowInstancesData, activeWorkflowView, onWorkflowViewChange])

  // Fetch AI insights when accessing a completed workflow instance
  useEffect(() => {
    // Only fetch for dynamic workflows (not "purchase" or "seeding")
    const isDynamicWorkflow = activeWorkflowView !== "purchase" && activeWorkflowView !== "seeding"
    if (!isDynamicWorkflow || !workflowInstancesData || !selectedLead.car_id) {
      return
    }

    // Find the current workflow instance being viewed
    const currentInstance = workflowInstancesData.data?.find(i => i.instance.workflow_id === activeWorkflowView)

    // Only fetch AI insights if this specific workflow instance is completed
    if (!currentInstance || currentInstance.instance.status !== "completed") {
      console.log(`[WorkflowTracker] Current workflow not completed, skipping AI insights`)
      return
    }

    // Use the current completed instance ID as source for AI insights
    const sourceInstanceId = currentInstance.instance.id

    // Fetch AI insights in background for this specific source instance
    const phoneNumber = selectedLead.phone || selectedLead.additional_phone
    if (!phoneNumber) {
      return
    }

    console.log(`[WorkflowTracker] Fetching AI insights for completed instance: ${sourceInstanceId}`)
    setFetchingAiInsights(true)
    fetchAiInsights(selectedLead.car_id, sourceInstanceId, phoneNumber)
      .then((insights) => {
        setAiInsights(insights)
        console.log("[WorkflowTracker] AI Insights fetched:", insights)
      })
      .catch((error) => {
        // Check if it's a 202 "still processing" response
        if (error.message.includes("still being processed")) {
          console.log("[WorkflowTracker] AI insights still processing, will retry on next render")
        } else {
          console.error("[WorkflowTracker] Failed to fetch AI insights:", error)
        }
      })
      .finally(() => {
        setFetchingAiInsights(false)
      })
  }, [activeWorkflowView, workflowInstancesData, selectedLead.car_id, selectedLead.phone, selectedLead.additional_phone])

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
      {/* Workflow Tracker */}
      <div className="bg-white rounded-lg p-3 sm:p-5 shadow-sm">
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
              <div className="overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-thin">
                <div className="flex items-start justify-between gap-3 sm:gap-4 mb-4 sm:mb-8 min-w-[500px] sm:min-w-0 px-1 sm:px-4">
                  {workflowSteps.length > 0 ? (
                    workflowSteps.map((step: any, idx: number) => {
                      const status = getStepStatus(step)
                      return (
                        <div key={step.id} className="flex flex-col items-center gap-2 sm:gap-3 flex-1">
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
                  <div className="flex items-center gap-2 mt-4">
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
                        className="bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm"
                      >
                        <Zap className="h-3.5 w-3.5 mr-1.5" />
                        Kích hoạt {transition.to_workflow_name}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Action Buttons - Send First Message & Rename Lead */}
                <div className="flex items-center gap-3 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSendFirstMessage}
                    disabled={sendingMessage || !selectedLead?.pic_id}
                    className="text-gray-700 text-xs sm:text-sm"
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                    {sendingMessage ? "Đang gửi..." : "Send First Message"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRenameLead}
                    disabled={renamingLead || !selectedLead?.pic_id}
                    className="text-gray-700 text-xs sm:text-sm"
                  >
                    {renamingLead ? "Đang đổi tên..." : "Đổi tên Lead"}
                  </Button>
                </div>
              </div>
            )
          })()
        ) : null}
      </div>

      {/* Additional Info Cards */}
      <div className="mt-4 sm:mt-6">
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

          {/* Win Case History Section - New */}
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
      </div>

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
    </>
  )
}
