"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, MoreVertical, Clock, Zap, MapPin, Gauge, Activity, FileText, Hourglass, ArrowRight, Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatRelativeTime, getActivityFreshness, getActivityFreshnessClass } from "../utils"
import { useState, useEffect } from "react"
import { WorkflowInstanceForKanban } from "./CampaignKanbanView"
import { useToast } from "@/hooks/use-toast"

interface KanbanCardProps {
    instance: WorkflowInstanceForKanban
    onClick?: () => void
    onTransition?: (instanceId: string, transitionId: string, toWorkflowId: string) => void
    onNote?: (leadId: string, leadName: string) => void
    onNoteUpdate?: (leadId: string, notes: string) => Promise<void>
    onOpenTransitionDialog?: (instance: WorkflowInstanceForKanban) => void
}

export function KanbanCard({ instance, onClick, onTransition, onNote, onNoteUpdate, onOpenTransitionDialog }: KanbanCardProps) {
    const [timeRemaining, setTimeRemaining] = useState<string>("")
    const [progress, setProgress] = useState<number>(0)
    const [isOverdue, setIsOverdue] = useState<boolean>(false)

    // Inline note editing state
    const [isEditingNote, setIsEditingNote] = useState(false)
    const [noteValue, setNoteValue] = useState(instance.notes || "")
    const [savingNote, setSavingNote] = useState(false)

    // Calculate remaining time to SLA deadline and progress
    useEffect(() => {
        if (instance.status !== "running" || !instance.sla_deadline) {
            setTimeRemaining("")
            setProgress(0)
            setIsOverdue(false)
            return
        }

        const calculateTimeAndProgress = () => {
            const deadline = new Date(instance.sla_deadline!).getTime()
            const now = Date.now()
            const remaining = deadline - now

            // Calculate progress based on started_at and sla_deadline
            const startedAt = new Date(instance.started_at).getTime()
            const totalMs = deadline - startedAt
            const elapsedMs = now - startedAt

            let progressValue = 0
            if (totalMs > 0) {
                progressValue = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))
            }
            setProgress(Math.round(progressValue))

            if (remaining <= 0) {
                setIsOverdue(true)
                return "Quá hạn"
            }

            setIsOverdue(false)
            const hours = Math.floor(remaining / (1000 * 60 * 60))
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))

            if (hours > 24) {
                return `${hours}h còn lại`
            }

            return `${hours}h ${minutes}m còn lại`
        }

        setTimeRemaining(calculateTimeAndProgress())

        // Update every minute
        const interval = setInterval(() => {
            setTimeRemaining(calculateTimeAndProgress())
        }, 60000)

        return () => clearInterval(interval)
    }, [instance.sla_deadline, instance.status, instance.started_at])

    // Format car name: "Brand Model Year"
    const carName = [instance.car_brand, instance.car_model, instance.car_year]
        .filter(Boolean)
        .join(" ")

    // Format time from started_at
    const formatTime = (dateStr: string | null): string => {
        if (!dateStr) return "—"
        const date = new Date(dateStr)
        return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    }

    // Format date from started_at
    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return "—"
        const date = new Date(dateStr)
        return date.toLocaleDateString("vi-VN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        })
    }

    // Get first letter for avatar
    const getInitial = (name: string | null): string => {
        if (!name) return "?"
        return name.charAt(0).toUpperCase()
    }

    // Truncate car ID: show first 8 chars + "..." if longer than 12
    const truncateCarId = (carId: string | null): string => {
        if (!carId) return "—"
        if (carId.length > 12) {
            return carId.substring(0, 8) + "..."
        }
        return carId
    }

    // Copy car ID to clipboard
    const { toast } = useToast()
    const handleCopyCarId = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!instance.car_id) return

        try {
            await navigator.clipboard.writeText(instance.car_id)
            toast({
                title: "Đã sao chép",
                description: "Car ID đã được sao chép vào clipboard",
            })
        } catch (error) {
            console.error("[KanbanCard] Failed to copy car ID:", error)
            toast({
                title: "Lỗi",
                description: "Không thể sao chép Car ID",
                variant: "destructive",
            })
        }
    }

    // Handle workflow transition
    const handleTransition = (e: React.MouseEvent, transition: { id: string; to_workflow_id: string; to_workflow_name: string }) => {
        e.stopPropagation()
        onTransition?.(instance.id, transition.id, transition.to_workflow_id)
    }

    // Get status badge config
    const getStatusBadge = () => {
        const status = instance.lead_status?.toUpperCase()
        switch (status) {
            case "STRONG_QUALIFIED":
                return { label: "QUALIFIED", className: "bg-green-100 text-green-700 border-green-200" }
            case "WEAK_QUALIFIED":
                return { label: "QUALIFIED", className: "bg-yellow-100 text-yellow-700 border-yellow-200" }
            case "NON":
            case "NON_QUALIFIED":
                return { label: "NON", className: "bg-orange-100 text-orange-700 border-orange-200" }
            default:
                return null
        }
    }

    // Format price
    const formatPrice = (price: number | null): string => {
        if (!price) return "—"
        return new Intl.NumberFormat("vi-VN").format(price / 1000000) + " tr"
    }

    // Format mileage
    const formatMileage = (km: number | null): string => {
        if (!km) return ""
        return new Intl.NumberFormat("vi-VN").format(km) + " km"
    }

    // Calculate price gap
    const getPriceGap = () => {
        if (!instance.expected_price || !instance.dealer_price) return null
        const gap = instance.dealer_price - instance.expected_price
        return {
            value: gap,
            display: (gap >= 0 ? "+" : "") + new Intl.NumberFormat("vi-VN").format(gap / 1000000) + " tr"
        }
    }

    const statusBadge = getStatusBadge()
    const priceGap = getPriceGap()

    // Handle saving inline note
    const handleSaveNote = async () => {
        if (!instance.lead_id || !onNoteUpdate) return

        setSavingNote(true)
        try {
            await onNoteUpdate(instance.lead_id, noteValue)
            setIsEditingNote(false)
        } catch (error) {
            console.error("[KanbanCard] Error saving note:", error)
        } finally {
            setSavingNote(false)
        }
    }

    // Handle cancelling note edit
    const handleCancelEdit = () => {
        setNoteValue(instance.notes || "")
        setIsEditingNote(false)
    }

    // Render footer based on workflow status
    const renderFooter = () => {
        // Don't show workflow footer for leads without workflows
        if (!instance.workflow_id) {
            return (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-center">
                    <span className="text-xs text-gray-500 italic">
                        Chưa có workflow
                    </span>
                </div>
            )
        }

        // Show \"Awaiting Decision\" state only when ALL steps have been COMPLETED (executed successfully)
        if (instance.all_steps_complete) {
            const hasTransitions = instance.available_transitions.length > 0

            return (
                <div className="border-t border-amber-200 bg-amber-50">
                    {/* Status indicator */}
                    <div className="px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                                <Hourglass className="h-3.5 w-3.5 text-amber-600" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-amber-700">Chờ quyết định</span>
                                <span className="text-[10px] text-amber-600">Workflow hoàn thành</span>
                            </div>
                        </div>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>

                    {/* Action buttons */}
                    <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                        {hasTransitions ? (
                            // Show transition buttons if available
                            instance.available_transitions.slice(0, 3).map((transition) => (
                                <Button
                                    key={transition.id}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2.5 text-[10px] border-amber-300 bg-white hover:bg-amber-100 text-amber-700"
                                    onClick={(e) => handleTransition(e, transition)}
                                >
                                    <ArrowRight className="h-3 w-3 mr-1" />
                                    {transition.to_workflow_name}
                                </Button>
                            ))
                        ) : (
                            // Show default action buttons if no transitions
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2.5 text-[10px] border-amber-300 bg-white hover:bg-amber-100 text-amber-700"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onOpenTransitionDialog?.(instance)
                                    }}
                                >
                                    Chuyển WF
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2.5 text-[10px] border-gray-200 bg-white hover:bg-gray-100 text-gray-600"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Đóng lead
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )
        }

        // Running with pending steps
        if (instance.status === "running" && instance.pending_step_name) {
            return (
                <div className={cn(
                    "border-t",
                    isOverdue ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100"
                )}>
                    {/* Step info row */}
                    <div className="px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <div className={cn(
                                    "w-2 h-2 rounded-full animate-pulse",
                                    isOverdue ? "bg-red-500" : "bg-blue-500"
                                )} />
                            </div>
                            <div className="flex flex-col">
                                {instance.pending_step_order && instance.total_steps && (
                                    <span className={cn(
                                        "text-[10px] font-medium",
                                        isOverdue ? "text-red-500" : "text-blue-500"
                                    )}>
                                        Bước {instance.pending_step_order}/{instance.total_steps}
                                    </span>
                                )}
                                <span className={cn(
                                    "text-xs font-medium truncate",
                                    isOverdue ? "text-red-700" : "text-blue-700"
                                )}>
                                    {instance.pending_step_name}
                                </span>
                            </div>
                        </div>
                        {timeRemaining && (
                            <div className={cn(
                                "flex items-center gap-1 text-xs font-medium",
                                isOverdue ? "text-red-600" : "text-blue-600"
                            )}>
                                <Clock className="h-3 w-3" />
                                <span>{timeRemaining}</span>
                            </div>
                        )}
                    </div>
                    {/* Progress bar row */}
                    <div className="px-4 pb-2.5">
                        <div className="flex items-center gap-2">
                            <Progress
                                value={progress}
                                className={cn(
                                    "h-1.5 flex-1 bg-gray-200",
                                    isOverdue ? "[&>div]:bg-red-500" : "[&>div]:bg-blue-500"
                                )}
                            />
                            <span className={cn(
                                "text-[10px] font-medium tabular-nums min-w-[28px]",
                                isOverdue ? "text-red-500" : "text-blue-500"
                            )}>
                                {progress}%
                            </span>
                        </div>
                    </div>
                </div>
            )
        }

        // Default: running but no step info
        return (
            <div className="px-4 py-3 bg-blue-50 border-t border-blue-100 flex items-center justify-center">
                <span className="text-xs text-blue-600 font-medium">
                    Đang xử lý...
                </span>
            </div>
        )
    }

    return (
        <div
            className="bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
            onClick={onClick}
        >
            {/* Header - Lead Info */}
            <div className="p-4 pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        {/* Avatar with activity freshness ring */}
                        <div className={cn(
                            "w-9 h-9 rounded-full p-0.5",
                            {
                                'bg-gradient-to-br from-green-400 to-green-600': getActivityFreshness(instance.last_activity_at) === 'fresh',
                                'bg-gradient-to-br from-yellow-400 to-yellow-600': getActivityFreshness(instance.last_activity_at) === 'recent',
                                'bg-gradient-to-br from-red-400 to-red-600': getActivityFreshness(instance.last_activity_at) === 'stale',
                                'bg-gray-300': getActivityFreshness(instance.last_activity_at) === 'none',
                            }
                        )}>
                            <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium">
                                {getInitial(instance.lead_name)}
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-gray-900 text-sm">
                                    {instance.lead_name || "Chưa có tên"}
                                </span>
                                {statusBadge && (
                                    <Badge variant="outline" className={cn("text-xs px-1.5 py-0", statusBadge.className)}>
                                        {statusBadge.label}
                                    </Badge>
                                )}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                                {formatTime(instance.started_at)} • {formatDate(instance.started_at)}
                            </div>
                            {/* Last Activity Time */}
                            <div className={`flex items-center gap-1 mt-0.5 text-xs ${getActivityFreshnessClass(getActivityFreshness(instance.last_activity_at))}`}>
                                <Activity className="h-3 w-3" />
                                <span>{formatRelativeTime(instance.last_activity_at)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            className="p-1 hover:bg-blue-100 rounded transition-colors"
                            onClick={(e) => {
                                e.stopPropagation()
                                if (instance.lead_id) {
                                    onNote?.(instance.lead_id, instance.lead_name || "")
                                }
                            }}
                            title="Ghi chú"
                        >
                            <FileText className="h-4 w-4 text-blue-500" />
                        </button>
                        <button
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MoreVertical className="h-4 w-4 text-gray-400" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Car Info Section with Thumbnail */}
            <div className="px-4 pb-3 flex gap-3">
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 text-sm mb-0.5">
                        {carName || "Chưa có thông tin xe"}
                    </h4>
                    {(instance.car_plate || instance.car_id) && (
                        <div className="flex items-center gap-1.5 mb-1">
                            {instance.car_plate && (
                                <>
                                    <span className="text-xs text-gray-400 font-mono">
                                        {instance.car_plate}
                                    </span>
                                    {instance.car_id && (
                                        <span className="text-xs text-gray-300">•</span>
                                    )}
                                </>
                            )}
                            {instance.car_id && (
                                <>
                                    <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                        {truncateCarId(instance.car_id)}
                                    </span>
                                    <button
                                        onClick={handleCopyCarId}
                                        className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                                        title="Sao chép Car ID"
                                    >
                                        <Copy className="h-3 w-3 text-gray-500 hover:text-gray-700" />
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        {instance.car_mileage && (
                            <span className="flex items-center gap-1">
                                <Gauge className="h-3 w-3" /> {formatMileage(instance.car_mileage)}
                            </span>
                        )}
                        {instance.car_location && (
                            <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {instance.car_location}
                            </span>
                        )}
                    </div>
                </div>
                {/* Car Image Thumbnail */}
                {instance.car_image && (
                    <div className="w-16 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <img
                            src={instance.car_image}
                            alt={carName}
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}
            </div>

            {/* Pricing Section */}
            <div className="px-4 pb-3">
                <div className="flex items-center justify-between text-xs">
                    <div>
                        <span className="text-gray-400 uppercase tracking-wide">Mong muốn</span>
                        <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-gray-900">{formatPrice(instance.expected_price)}</p>
                            {priceGap && (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-[10px] px-1.5 py-0 font-semibold",
                                        priceGap.value >= 0
                                            ? "bg-green-50 text-green-600 border-green-200"
                                            : "bg-red-50 text-red-600 border-red-200"
                                    )}
                                >
                                    {priceGap.display}
                                </Badge>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-gray-400 uppercase tracking-wide">Dealer</span>
                        <p className={cn("font-semibold", instance.dealer_price ? "text-green-600" : "text-gray-400")}>
                            {formatPrice(instance.dealer_price)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Inline Note View */}
            <div className="px-4 pb-3">
                {isEditingNote ? (
                    // Edit Mode
                    <div
                        className="border border-yellow-400 rounded-lg bg-yellow-50 p-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <textarea
                            value={noteValue}
                            onChange={(e) => setNoteValue(e.target.value)}
                            className="w-full text-xs text-gray-700 bg-transparent border-none outline-none resize-none min-h-[60px] max-h-[100px]"
                            placeholder="Nhập ghi chú..."
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.ctrlKey) {
                                    e.preventDefault()
                                    handleSaveNote()
                                }
                                if (e.key === 'Escape') {
                                    handleCancelEdit()
                                }
                            }}
                        />
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-yellow-200">
                            <span className="text-[10px] text-gray-400">Ctrl+Enter để lưu</span>
                            <div className="flex gap-2">
                                <button
                                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                                    onClick={handleCancelEdit}
                                    disabled={savingNote}
                                >
                                    Hủy
                                </button>
                                <button
                                    className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded flex items-center gap-1"
                                    onClick={handleSaveNote}
                                    disabled={savingNote}
                                >
                                    {savingNote ? (
                                        <span className="animate-spin">⏳</span>
                                    ) : (
                                        <FileText className="h-3 w-3" />
                                    )}
                                    Lưu
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // View Mode - Always show so users can click to add notes
                    <div
                        className="group border border-transparent hover:border-yellow-300 rounded-lg bg-yellow-50/50 hover:bg-yellow-50 p-2 cursor-pointer transition-all"
                        onClick={(e) => {
                            e.stopPropagation()
                            setNoteValue(instance.notes || "")
                            setIsEditingNote(true)
                        }}
                    >
                        {instance.notes ? (
                            <div className="text-xs text-gray-600 max-h-[60px] overflow-y-auto whitespace-pre-wrap break-words">
                                {instance.notes.length > 150
                                    ? instance.notes.substring(0, 150) + "..."
                                    : instance.notes
                                }
                            </div>
                        ) : (
                            <div className="text-xs text-gray-400 italic">
                                Click để thêm ghi chú...
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Workflow Status Footer */}
            {renderFooter()}
        </div>
    )
}
