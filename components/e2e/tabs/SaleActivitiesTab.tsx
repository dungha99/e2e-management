"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Activity, ChevronLeft, ChevronRight, CheckCircle2, Zap, User, Clock, FileEdit, ArrowRight, Sparkles } from "lucide-react"

interface SaleActivity {
    id: string
    leadId?: string
    activityType: string
    metadata?: Record<string, any> | null
    actorId?: string | null
    actorType?: string
    createdAt: string
    actor?: { userName?: string } | null
}

interface SaleActivitiesTabProps {
    phone: string | null
    refreshKey?: number  // Increment this to trigger a refresh
}

// Vietnamese labels for activity types
const ACTIVITY_LABELS: Record<string, string> = {
    'STATUS_UPDATE': 'Cập nhật trạng thái',
    'STATUS_UPDATED': 'Cập nhật trạng thái',
    'STATUS UPDATED': 'Cập nhật trạng thái',
    'PRICE_UPDATE': 'Cập nhật giá',
    'NOTE_ADDED': 'Thêm ghi chú',
    'NOTE_UPDATE': 'Cập nhật ghi chú',
    'AUCTION_CREATED': 'Tạo phiên',
    'LEAD_CREATED': 'Tạo lead',
    'STAGE_UPDATE': 'Cập nhật giai đoạn',
    'CAR_DATA_ENRICH': 'Cập nhật xe',
    'DECOY_SUMMARY': 'Tạo Decoy',
}

// Vietnamese labels for field names
const FIELD_LABELS: Record<string, string> = {
    'priceHighestBid': 'Giá cao nhất (Dealer)',
    'priceCustomer': 'Giá mong muốn',
    'price_customer': 'Giá mong muốn',
    'price_highest_bid': 'Giá cao nhất',
    'stage': 'Giai đoạn',
    'intentionLead': 'Ý định bán',
    'intention_lead': 'Ý định bán',
    'qualified': 'Trạng thái Qualified',
    'negotiationAbility': 'Khả năng đàm phán',
    'notes': 'Ghi chú',
    'botStatus': 'Bot Status',
    'duration': 'Thời gian (ngày)',
    'decoy_web_chat': 'Tạo Decoy Web Chat',
    'decoy_zalo': 'Tạo Decoy Zalo',
}

// Get icon and color based on activity type
const getActivityStyle = (type: string) => {
    if (type.includes('DECOY')) {
        return {
            icon: Sparkles,
            bgColor: 'bg-violet-50',
            iconColor: 'text-violet-500',
            borderColor: 'border-l-violet-400',
            dotColor: 'bg-violet-500'  // Violet dot for decoy activities
        }
    }
    if (type.includes('AUCTION') || type.includes('CREATED')) {
        return {
            icon: Zap,
            bgColor: 'bg-rose-50',
            iconColor: 'text-rose-500',
            borderColor: 'border-l-rose-400',
            dotColor: 'bg-blue-500'  // Blue dot for created/auction
        }
    }
    if (type.includes('NOTE')) {
        return {
            icon: FileEdit,
            bgColor: 'bg-amber-50',
            iconColor: 'text-amber-500',
            borderColor: 'border-l-amber-400',
            dotColor: 'bg-amber-500'  // Orange/amber dot for notes
        }
    }
    // Default: status update
    return {
        icon: CheckCircle2,
        bgColor: 'bg-emerald-50',
        iconColor: 'text-emerald-500',
        borderColor: 'border-l-emerald-400',
        dotColor: 'bg-gray-400'  // Gray dot for status updates
    }
}

export function SaleActivitiesTab({ phone, refreshKey }: SaleActivitiesTabProps) {
    const [activities, setActivities] = useState<SaleActivity[]>([])
    const [loading, setLoading] = useState(false)
    const [page, setPage] = useState(1)
    const perPage = 8

    useEffect(() => {
        if (phone) {
            // Skip cache when refreshKey > 0 (triggered by a save action)
            const skipCache = (refreshKey ?? 0) > 0
            fetchActivities(phone, skipCache)
        } else {
            setActivities([])
        }
    }, [phone, refreshKey])

    async function fetchActivities(phone: string, skipCache: boolean = false) {
        setLoading(true)
        setPage(1)
        try {
            const url = skipCache
                ? `/api/e2e/sale-activities?phone=${encodeURIComponent(phone)}&nocache=1`
                : `/api/e2e/sale-activities?phone=${encodeURIComponent(phone)}`
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                setActivities(Array.isArray(data) ? data : [])
            } else {
                setActivities([])
            }
        } catch {
            setActivities([])
        } finally {
            setLoading(false)
        }
    }

    const totalPages = Math.ceil(activities.length / perPage)
    const paginated = activities.slice((page - 1) * perPage, page * perPage)

    // Relative time in Vietnamese
    const relativeTime = (date: string) => {
        const diff = Date.now() - new Date(date).getTime()
        const mins = Math.floor(diff / 60000)
        const hours = Math.floor(mins / 60)
        const days = Math.floor(hours / 24)
        if (mins < 1) return 'vừa xong'
        if (mins < 60) return `${mins} phút trước`
        if (hours < 24) return `${hours} giờ trước`
        return `${days} ngày trước`
    }

    // Get activity label
    const getActivityLabel = (type: string) => ACTIVITY_LABELS[type] || type.replace(/_/g, ' ')

    // Get field label
    const getFieldLabel = (field: string) => FIELD_LABELS[field] || field

    // Get actor name
    const getActor = (a: SaleActivity) => {
        if (a.actor?.userName) return a.actor.userName
        if (a.actorType === 'SYSTEM') return 'Hệ thống'
        return a.actorType || 'Unknown'
    }

    // Format value for display
    const formatValue = (v: any): string => {
        if (v === null || v === undefined || v === '' || v === '—') return '—'
        if (typeof v === 'number') return v.toLocaleString('vi-VN')
        if (typeof v === 'boolean') return v ? 'Có' : 'Không'
        return String(v)
    }

    // Truncated text component for long content
    const TruncatedText = ({ text, maxLength = 150 }: { text: string; maxLength?: number }) => {
        const [isExpanded, setIsExpanded] = useState(false)

        if (!text || text.length <= maxLength) {
            return <span>{text}</span>
        }

        return (
            <span>
                {isExpanded ? text : `${text.slice(0, maxLength)}...`}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="ml-1 text-blue-600 hover:text-blue-800 font-medium focus:outline-none"
                >
                    {isExpanded ? 'Thu gọn' : 'Xem thêm'}
                </button>
            </span>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        )
    }

    if (!activities.length) {
        return (
            <div className="text-center py-16 text-gray-400">
                <Activity className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-xs">Chưa có hoạt động nào</p>
            </div>
        )
    }

    return (
        <div className="relative">
            {paginated.map((activity, idx) => {
                const meta = activity.metadata || {}
                const fieldName = meta.field_name || meta.fieldName
                const prevValue = meta.previous_value ?? meta.previousValue ?? meta.old
                const newValue = meta.new_value ?? meta.newValue ?? meta.new
                const reason = meta.changed_reason || meta.changedReason || meta.reason
                const style = getActivityStyle(activity.activityType)
                const IconComponent = style.icon
                const isLast = idx === paginated.length - 1

                return (
                    <div
                        key={activity.id || idx}
                        className="relative flex gap-3 pb-4"
                    >
                        {/* Activity Icon */}
                        <div className={`w-8 h-8 rounded-full ${style.bgColor} flex items-center justify-center flex-shrink-0`}>
                            <IconComponent className={`h-4 w-4 ${style.iconColor}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 rounded-lg overflow-hidden hover:bg-gray-50 transition-all -mt-1">
                            {/* Header */}
                            <div className="p-3">
                                {/* Title */}
                                <h4 className="text-sm font-semibold text-gray-900">
                                    {getActivityLabel(activity.activityType)}
                                </h4>

                                {/* Actor & Time */}
                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                    <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {getActor(activity)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {relativeTime(activity.createdAt)}
                                    </span>
                                </div>
                            </div>

                            {/* Field name & Value Change */}
                            {(fieldName || prevValue !== undefined || newValue !== undefined) && (
                                <div className="px-3 pb-2">
                                    <div className="bg-gray-50 rounded-md">
                                        {/* Field Name */}
                                        {fieldName && (
                                            <p className="text-xs text-gray-600 mb-2 font-medium">
                                                {getFieldLabel(fieldName)}
                                            </p>
                                        )}

                                        {/* Value Change */}
                                        {(prevValue !== undefined || newValue !== undefined) && (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {/* Hide previous value for NOTE_ADDED */}
                                                {activity.activityType !== 'NOTE_ADDED' && (
                                                    <>
                                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${prevValue === null || prevValue === undefined || prevValue === '' || prevValue === '—'
                                                            ? 'bg-orange-100 text-orange-700'
                                                            : 'bg-red-100 text-red-600 line-through'
                                                            }`}>
                                                            {formatValue(prevValue)}
                                                        </span>
                                                        <ArrowRight className="h-3 w-3 text-gray-400" />
                                                    </>
                                                )}
                                                <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700">
                                                    {formatValue(newValue)}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Reason */}
                                    {reason && reason !== '—' && (
                                        <p className="text-xs text-gray-500 mt-2 italic">
                                            Lý do thay đổi: {reason}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Other metadata (if no field_name structure) */}
                            {!fieldName && Object.keys(meta).length > 0 && (
                                <div className="px-3 pb-3">
                                    {/* Note content - show directly without label */}
                                    {(meta.note_content || meta.noteContent || meta.content) && (
                                        <div className="bg-amber-50 rounded-md p-2.5 text-xs text-gray-800">
                                            <TruncatedText text={meta.note_content || meta.noteContent || meta.content} maxLength={150} />
                                        </div>
                                    )}

                                    {/* Other fields */}
                                    {Object.entries(meta).filter(([k]) =>
                                        !['id', 'leadId', 'carId', 'car_id', 'field_name', 'fieldName',
                                            'previous_value', 'previousValue', 'new_value', 'newValue',
                                            'changed_reason', 'changedReason', 'old', 'new', 'reason',
                                            'note_content', 'noteContent', 'content'].includes(k)
                                    ).length > 0 && (
                                            <div className="bg-gray-50 rounded-md p-2.5 space-y-1 mt-2">
                                                {Object.entries(meta).filter(([k]) =>
                                                    !['id', 'leadId', 'carId', 'car_id', 'field_name', 'fieldName',
                                                        'previous_value', 'previousValue', 'new_value', 'newValue',
                                                        'changed_reason', 'changedReason', 'old', 'new', 'reason',
                                                        'note_content', 'noteContent', 'content'].includes(k)
                                                ).map(([key, value]) => (
                                                    <div key={key} className="text-xs">
                                                        <span className="text-gray-500">{getFieldLabel(key)}: </span>
                                                        <span className="font-medium text-gray-800">
                                                            {typeof value === 'string' && value.length > 150
                                                                ? <TruncatedText text={value} maxLength={150} />
                                                                : formatValue(value)
                                                            }
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage(p => p - 1)}
                        disabled={page === 1}
                        className="h-7 px-2"
                    >
                        <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <span className="text-xs text-gray-500">
                        {page}/{totalPages}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={page === totalPages}
                        className="h-7 px-2"
                    >
                        <ChevronRight className="h-3 w-3" />
                    </Button>
                </div>
            )}
        </div>
    )
}

