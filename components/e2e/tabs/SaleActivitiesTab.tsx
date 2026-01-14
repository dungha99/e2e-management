"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Activity, ChevronLeft, ChevronRight, CheckCircle2, Zap, User, Clock, FileEdit, ArrowRight, Sparkles, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react"

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

// Aggregate metrics by activity type
interface ActivityMetrics {
    type: string
    count: number
    label: string
}

// Price metrics interface
interface PriceMetrics {
    customer: {
        decreaseCount: number
        totalDecrease: number
        timeline: number[]
        current: number | null
    }
    dealer: {
        increaseCount: number
        totalIncrease: number
        timeline: number[]
        current: number | null
    }
    gap: number | null
    lastUpdate: string | null
}

const ITEMS_PER_PAGE = 10

// Price section components helpers
interface PriceSectionProps {
    priceMetrics: PriceMetrics
    formatPrice: (price: number) => string
}

// Customer Price Section with expandable history
function CustomerPriceSection({ priceMetrics, formatPrice }: PriceSectionProps) {
    const [showHistory, setShowHistory] = useState(false)
    const latestPrice = priceMetrics.customer.current

    return (
        <div>
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">KH (Customer)</span>
                <div className="flex items-center gap-2">
                    {priceMetrics.customer.decreaseCount > 0 && (
                        <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" />
                            Giảm {formatPrice(priceMetrics.customer.totalDecrease)} ({priceMetrics.customer.decreaseCount} lần)
                        </span>
                    )}
                    <span className="text-sm font-bold text-red-600">{latestPrice ? formatPrice(latestPrice) : '—'}</span>
                    {priceMetrics.customer.timeline.length > 1 && (
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Xem lịch sử giá"
                        >
                            <Clock className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Expandable History */}
            {showHistory && priceMetrics.customer.timeline.length > 1 && (
                <div className="mt-2 pl-2 border-l-2 border-red-200">
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        {priceMetrics.customer.timeline.map((price, idx) => (
                            <span key={idx} className="flex items-center gap-1">
                                <span className={`font-medium ${idx === priceMetrics.customer.timeline.length - 1 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                                    {formatPrice(price)}
                                </span>
                                {idx < priceMetrics.customer.timeline.length - 1 && (
                                    <span className="text-gray-400">→</span>
                                )}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// Dealer Price Section with expandable history
function DealerPriceSection({ priceMetrics, formatPrice }: PriceSectionProps) {
    const [showHistory, setShowHistory] = useState(false)
    const latestPrice = priceMetrics.dealer.current

    return (
        <div>
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Dealer</span>
                <div className="flex items-center gap-2">
                    {priceMetrics.dealer.increaseCount > 0 && (
                        <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Tăng {formatPrice(priceMetrics.dealer.totalIncrease)} ({priceMetrics.dealer.increaseCount} lần)
                        </span>
                    )}
                    <span className="text-sm font-bold text-green-600">{latestPrice ? formatPrice(latestPrice) : '—'}</span>
                    {priceMetrics.dealer.timeline.length > 1 && (
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Xem lịch sử giá"
                        >
                            <Clock className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Expandable History */}
            {showHistory && priceMetrics.dealer.timeline.length > 1 && (
                <div className="mt-2 pl-2 border-l-2 border-green-200">
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        {priceMetrics.dealer.timeline.map((price, idx) => (
                            <span key={idx} className="flex items-center gap-1">
                                <span className={`font-medium ${idx === priceMetrics.dealer.timeline.length - 1 ? 'text-green-600 font-bold' : 'text-gray-500'}`}>
                                    {formatPrice(price)}
                                </span>
                                {idx < priceMetrics.dealer.timeline.length - 1 && (
                                    <span className="text-gray-400">→</span>
                                )}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// E2E Workflow Tracking Types
export type OutcomeType = "discount" | "original_price" | "lost"
export type InstanceStatus = "running" | "completed" | "terminated"
export type StepStatus = "pending" | "success" | "failed"

export function SaleActivitiesTab({ phone, refreshKey }: SaleActivitiesTabProps) {
    const [activities, setActivities] = useState<SaleActivity[]>([])
    const [loading, setLoading] = useState(false)
    const [page, setPage] = useState(1)
    const perPage = 8

    // Filter state: track which activity types are selected
    type FilterType = 'status' | 'price' | 'decoy' | 'zns'
    const [activeFilters, setActiveFilters] = useState<FilterType[]>([])


    // Compute simplified overview metrics for "Tổng quan"
    const computeOverviewMetrics = (activities: SaleActivity[]) => {
        const statusCount = activities.filter(a =>
            a.activityType.includes('STATUS') || a.activityType.includes('STAGE')
        ).length
        const priceCount = activities.filter(a => {
            if (a.activityType !== 'STATUS_UPDATED') return false
            const meta = a.metadata || {}
            const fieldName = meta.field_name || meta.fieldName
            return fieldName === 'priceCustomer' || fieldName === 'priceHighestBid'
        }).length
        const decoyCount = activities.filter(a =>
            a.activityType.includes('DECOY')
        ).length
        const znsCount = activities.filter(a =>
            a.activityType.includes('ZNS')
        ).length

        return { statusCount, priceCount, decoyCount, znsCount }
    }

    // Compute price metrics for "Phân tích giá"
    const computePriceMetrics = (activities: SaleActivity[]): PriceMetrics | null => {
        // Filter for STATUS_UPDATED activities that have price field changes
        const priceUpdates = activities.filter(a => {
            if (a.activityType !== 'STATUS_UPDATED') return false
            const meta = a.metadata || {}
            const fieldName = meta.field_name || meta.fieldName
            return fieldName === 'priceCustomer' || fieldName === 'priceHighestBid'
        })

        if (priceUpdates.length === 0) return null

        // Sort by created date (oldest first) for timeline
        const sortedUpdates = [...priceUpdates].sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )

        // Initialize metrics
        const metrics: PriceMetrics = {
            customer: { decreaseCount: 0, totalDecrease: 0, timeline: [], current: null },
            dealer: { increaseCount: 0, totalIncrease: 0, timeline: [], current: null },
            gap: null,
            lastUpdate: null
        }

        // Track price evolution
        let lastCustomerPrice: number | null = null
        let lastDealerPrice: number | null = null

        sortedUpdates.forEach(activity => {
            const meta = activity.metadata || {}
            const fieldName = meta.field_name || meta.fieldName
            const prevValue = meta.previous_value ?? meta.previousValue ?? meta.old
            const newValue = meta.new_value ?? meta.newValue ?? meta.new

            // Customer price updates
            if (fieldName === 'priceCustomer' && newValue !== null && newValue !== undefined) {
                const newPrice = Number(newValue)
                if (!isNaN(newPrice) && newPrice > 0) {
                    metrics.customer.timeline.push(newPrice)
                    metrics.customer.current = newPrice

                    // Check for decrease
                    if (lastCustomerPrice !== null && newPrice < lastCustomerPrice) {
                        metrics.customer.decreaseCount++
                        metrics.customer.totalDecrease += (lastCustomerPrice - newPrice)
                    }
                    lastCustomerPrice = newPrice
                }
            }

            // Dealer price updates
            if (fieldName === 'priceHighestBid' && newValue !== null && newValue !== undefined) {
                const newPrice = Number(newValue)
                if (!isNaN(newPrice) && newPrice > 0) {
                    metrics.dealer.timeline.push(newPrice)
                    metrics.dealer.current = newPrice

                    // Check for increase
                    if (lastDealerPrice !== null && newPrice > lastDealerPrice) {
                        metrics.dealer.increaseCount++
                        metrics.dealer.totalIncrease += (newPrice - lastDealerPrice)
                    }
                    lastDealerPrice = newPrice
                }
            }
        })

        // Calculate gap
        if (metrics.customer.current !== null && metrics.dealer.current !== null) {
            metrics.gap = metrics.customer.current - metrics.dealer.current
        }

        // Get last update time
        if (sortedUpdates.length > 0) {
            metrics.lastUpdate = sortedUpdates[sortedUpdates.length - 1].createdAt
        }

        return metrics
    }

    // Format price in millions (e.g., 300000000 => "300M")
    const formatPrice = (price: number): string => {
        if (price >= 1000000) {
            return `${Math.round(price / 1000000)}M`
        }
        return price.toLocaleString('vi-VN')
    }

    const overviewMetrics = computeOverviewMetrics(activities)
    const priceMetrics = computePriceMetrics(activities)

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

    // Filter toggle handler
    const toggleFilter = (filterType: FilterType) => {
        setActiveFilters(prev =>
            prev.includes(filterType)
                ? prev.filter(f => f !== filterType)
                : [...prev, filterType]
        )
        setPage(1) // Reset to first page when filter changes
    }

    // Filter activities based on active filters
    const getFilteredActivities = () => {
        if (activeFilters.length === 0) return activities // No filters = show all

        return activities.filter(activity => {
            // Check if activity matches any of the active filters
            return activeFilters.some(filterType => {
                switch (filterType) {
                    case 'status':
                        return activity.activityType.includes('STATUS') || activity.activityType.includes('STAGE')
                    case 'price': {
                        if (activity.activityType !== 'STATUS_UPDATED') return false
                        const meta = activity.metadata || {}
                        const fieldName = meta.field_name || meta.fieldName
                        return fieldName === 'priceCustomer' || fieldName === 'priceHighestBid'
                    }
                    case 'decoy':
                        return activity.activityType.includes('DECOY')
                    case 'zns':
                        return activity.activityType.includes('ZNS')
                    default:
                        return false
                }
            })
        })
    }

    const filteredActivities = getFilteredActivities()
    const totalPages = Math.ceil(filteredActivities.length / perPage)
    const paginated = filteredActivities.slice((page - 1) * perPage, page * perPage)

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

    // Format date for grouping - returns just the date part
    const getDateKey = (dateStr: string): string => {
        const date = new Date(dateStr)
        return date.toISOString().split('T')[0] // YYYY-MM-DD format for grouping
    }

    // Format date for display header in Vietnamese
    const formatDateHeader = (dateKey: string): string => {
        const date = new Date(dateKey)
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        const todayKey = today.toISOString().split('T')[0]
        const yesterdayKey = yesterday.toISOString().split('T')[0]

        if (dateKey === todayKey) return 'Hôm nay'
        if (dateKey === yesterdayKey) return 'Hôm qua'

        // Format as DD/MM/YYYY for other dates
        const day = date.getDate().toString().padStart(2, '0')
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const year = date.getFullYear()
        return `${day}/${month}/${year}`
    }

    // Group paginated activities by date
    const groupedActivities = paginated.reduce<Record<string, SaleActivity[]>>((acc, activity) => {
        const dateKey = getDateKey(activity.createdAt)
        if (!acc[dateKey]) {
            acc[dateKey] = []
        }
        acc[dateKey].push(activity)
        return acc
    }, {})

    // Get sorted date keys (newest first)
    const sortedDateKeys = Object.keys(groupedActivities).sort((a, b) =>
        new Date(b).getTime() - new Date(a).getTime()
    )

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
            {/* Compact Overview Pills - "Tổng quan" */}
            <div className="mb-3 p-3 bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-100">
                <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Tổng quan
                </h4>
                <div className="flex flex-wrap gap-2">
                    {/* Status Filter */}
                    <button
                        onClick={() => toggleFilter('status')}
                        className={`px-2.5 py-1.5 rounded-md flex items-center gap-2 transition-all cursor-pointer hover:shadow-sm ${activeFilters.includes('status')
                                ? 'bg-emerald-500 border-2 border-emerald-600'
                                : 'bg-emerald-50 border border-emerald-100 hover:bg-emerald-100'
                            }`}
                    >
                        <span className={`text-xs font-medium ${activeFilters.includes('status') ? 'text-white' : 'text-gray-700'}`}>
                            Trạng thái
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded min-w-[24px] text-center ${activeFilters.includes('status') ? 'bg-emerald-600 text-white' : 'text-gray-900 bg-white'
                            }`}>
                            {overviewMetrics.statusCount}
                        </span>
                    </button>

                    {/* Price Filter */}
                    <button
                        onClick={() => toggleFilter('price')}
                        className={`px-2.5 py-1.5 rounded-md flex items-center gap-2 transition-all cursor-pointer hover:shadow-sm ${activeFilters.includes('price')
                                ? 'bg-blue-500 border-2 border-blue-600'
                                : 'bg-blue-50 border border-blue-100 hover:bg-blue-100'
                            }`}
                    >
                        <span className={`text-xs font-medium ${activeFilters.includes('price') ? 'text-white' : 'text-gray-700'}`}>
                            Giá
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded min-w-[24px] text-center ${activeFilters.includes('price') ? 'bg-blue-600 text-white' : 'text-gray-900 bg-white'
                            }`}>
                            {overviewMetrics.priceCount}
                        </span>
                    </button>

                    {/* Decoy Filter */}
                    <button
                        onClick={() => toggleFilter('decoy')}
                        className={`px-2.5 py-1.5 rounded-md flex items-center gap-2 transition-all cursor-pointer hover:shadow-sm ${activeFilters.includes('decoy')
                                ? 'bg-violet-500 border-2 border-violet-600'
                                : 'bg-violet-50 border border-violet-100 hover:bg-violet-100'
                            }`}
                    >
                        <span className={`text-xs font-medium ${activeFilters.includes('decoy') ? 'text-white' : 'text-gray-700'}`}>
                            Decoy
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded min-w-[24px] text-center ${activeFilters.includes('decoy') ? 'bg-violet-600 text-white' : 'text-gray-900 bg-white'
                            }`}>
                            {overviewMetrics.decoyCount}
                        </span>
                    </button>

                    {/* ZNS Filter */}
                    <button
                        onClick={() => toggleFilter('zns')}
                        className={`px-2.5 py-1.5 rounded-md flex items-center gap-2 transition-all cursor-pointer hover:shadow-sm ${activeFilters.includes('zns')
                                ? 'bg-orange-500 border-2 border-orange-600'
                                : 'bg-orange-50 border border-orange-100 hover:bg-orange-100'
                            }`}
                    >
                        <span className={`text-xs font-medium ${activeFilters.includes('zns') ? 'text-white' : 'text-gray-700'}`}>
                            ZNS
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded min-w-[24px] text-center ${activeFilters.includes('zns') ? 'bg-orange-600 text-white' : 'text-gray-900 bg-white'
                            }`}>
                            {overviewMetrics.znsCount}
                        </span>
                    </button>
                </div>
            </div>

            {/* Price Analysis Section */}
            {priceMetrics && (priceMetrics.customer.timeline.length > 0 || priceMetrics.dealer.timeline.length > 0) && (
                <div className="mb-4 rounded-lg border border-gray-200 overflow-hidden">
                    {/* Content */}
                    <div className="bg-white p-3 space-y-2.5">
                        {priceMetrics.lastUpdate && (
                            <div className="text-xs text-gray-500 mb-2">
                                Cập nhật: {relativeTime(priceMetrics.lastUpdate)}
                            </div>
                        )}
                        {/* Customer Price - Compact with expand toggle */}
                        {priceMetrics.customer.timeline.length > 0 && (
                            <CustomerPriceSection priceMetrics={priceMetrics} formatPrice={formatPrice} />
                        )}

                        {/* Dealer Price - Compact with expand toggle */}
                        {priceMetrics.dealer.timeline.length > 0 && (
                            <DealerPriceSection priceMetrics={priceMetrics} formatPrice={formatPrice} />
                        )}

                        {/* Gap Warning */}
                        {priceMetrics.gap !== null && priceMetrics.gap < 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-md p-2 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-amber-800">CHÊNH LỆCH (GAP)</p>
                                    <p className="text-xs text-amber-700 mt-0.5">
                                        KH thấp hơn Dealer
                                    </p>
                                </div>
                                <span className="text-lg font-bold text-amber-600">-{formatPrice(Math.abs(priceMetrics.gap))}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}


            {sortedDateKeys.map((dateKey) => (
                <div key={dateKey} className="mb-4">
                    {/* Date Header */}
                    <div className="flex items-center gap-2 mb-3">
                        <div className="h-px bg-gray-200 flex-1" />
                        <span className="text-xs font-semibold text-gray-500 bg-white px-2">
                            {formatDateHeader(dateKey)}
                        </span>
                        <div className="h-px bg-gray-200 flex-1" />
                    </div>

                    {/* Activities for this date */}
                    {groupedActivities[dateKey].map((activity, idx) => {
                        const meta = activity.metadata || {}
                        const fieldName = meta.field_name || meta.fieldName
                        const prevValue = meta.previous_value ?? meta.previousValue ?? meta.old
                        const newValue = meta.new_value ?? meta.newValue ?? meta.new
                        const reason = meta.changed_reason || meta.changedReason || meta.reason
                        const style = getActivityStyle(activity.activityType)
                        const IconComponent = style.icon

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
                </div>
            ))}

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

