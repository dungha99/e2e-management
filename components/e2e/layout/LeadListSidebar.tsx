"use client"

import { useState } from "react"
import { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SearchInput } from "@/components/ui/search-input"
import { User, Zap, MessageCircle, FileText, ChevronLeft, ChevronRight, Star, X, SlidersHorizontal, Play, CheckCircle, Download, Loader2, Activity, Copy, Calendar, MapPin, Clock, Upload } from "lucide-react"
import { Lead } from "../types"
import { formatCarInfo, formatPriceShort, calculateCampaignProgress, calculateRemainingTime, formatRelativeTime, getActivityFreshness, getActivityFreshnessClass } from "../utils"
import { useToast } from "@/hooks/use-toast"
import { useDecoySignals } from "@/hooks/use-decoy-signals"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { ExportReportDialog } from "../dialogs/ExportReportDialog"
import { DateRangePickerWithPresets } from "../common/DateRangePickerWithPresets"
import { ImageUploadService } from "../common/ImageUploadService"
import { useAccounts } from "@/contexts/AccountsContext"

interface LeadListSidebarProps {
  // Display props
  isMobile?: boolean
  mobileView?: "list" | "detail"

  // Account & loading state
  selectedAccount: string | null
  loading: boolean
  loadingCarIds?: boolean

  // Search
  searchPhone: string
  appliedSearch?: string
  onSearchChange: (value: string) => void
  onSearch: () => void
  onClearSearch?: () => void

  // Source filter
  sourceFilter: string[]
  onSourceFilterChange: (sources: string[]) => void
  availableSources: string[]

  // Date range filter
  dateRangeFilter?: DateRange | undefined
  onDateRangeFilterChange?: (dateRange: DateRange | undefined) => void

  // Tabs & counts
  activeTab: "priority" | "nurture"
  onTabChange: (tab: "priority" | "nurture") => void
  priorityCount: number
  nurtureCount: number

  // Leads data
  currentPageLeads: Lead[]
  selectedLead: Lead | null
  onLeadClick: (lead: Lead) => void

  // Pagination
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void

  // Actions
  onSummaryOpen?: () => void
  onUpdatePrimary?: (leadId: string, carId: string, isPrimary: boolean) => Promise<void>

  // Primary update state
  updatingPrimary?: boolean
}

export function LeadListSidebar({
  isMobile = false,
  mobileView = "list",
  selectedAccount,
  loading,
  loadingCarIds = false,
  searchPhone,
  appliedSearch = "",
  onSearchChange,
  onSearch,
  onClearSearch,
  sourceFilter,
  onSourceFilterChange,
  availableSources,
  dateRangeFilter,
  onDateRangeFilterChange,
  activeTab,
  onTabChange,
  priorityCount,
  nurtureCount,
  currentPageLeads,
  selectedLead,
  onLeadClick,
  currentPage,
  totalPages,
  onPageChange,
  onSummaryOpen,
  onUpdatePrimary,
  updatingPrimary = false
}: LeadListSidebarProps) {
  const { toast } = useToast()
  const { hasNewReplies } = useDecoySignals()
  const [filterOpen, setFilterOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  const handleTogglePrimary = async (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!lead.car_id || updatingPrimary || !onUpdatePrimary) return

    const newPrimaryStatus = !lead.is_primary

    try {
      await onUpdatePrimary(lead.id, lead.car_id, newPrimaryStatus)
      toast({
        title: "Thành công",
        description: newPrimaryStatus
          ? "Đã đánh dấu xe là Primary"
          : "Đã bỏ đánh dấu Primary",
      })
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật trạng thái Primary",
        variant: "destructive",
      })
    }
  }

  // --- Upload & Bot Logic Start ---
  const { accounts } = useAccounts()
  const currentPIC = accounts.find(a => a.uid === selectedAccount)
  const picName = currentPIC?.name || "Khả Nhi Vucar"
  // --- Upload & Bot Logic End ---

  // Truncate car ID: show first 8 chars + "..." if longer than 12
  const truncateCarId = (carId: string | null | undefined): string => {
    if (!carId) return "—"
    if (carId.length > 12) {
      return carId.substring(0, 8) + "..."
    }
    return carId
  }

  // Copy car ID to clipboard
  const handleCopyCarId = async (e: React.MouseEvent, carId: string) => {
    e.stopPropagation()
    if (!carId) return

    try {
      await navigator.clipboard.writeText(carId)
      toast({
        title: "Đã sao chép",
        description: "Car ID đã được sao chép vào clipboard",
      })
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể sao chép Car ID",
        variant: "destructive",
      })
    }
  }

  // Calculate the exact done date for a campaign
  const calculateDoneDate = (publishedAt: string, duration: number): string => {
    const startDate = new Date(publishedAt)
    const durationMs = duration * 60 * 60 * 1000 // duration is in HOURS to ms
    const doneDate = new Date(startDate.getTime() + durationMs)

    return doneDate.toLocaleString("vi-VN", {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className={`${isMobile ? 'flex-1 w-full min-h-0' : 'w-60 lg:w-80'} min-w-0 border-r flex flex-col bg-white ${isMobile ? 'overflow-hidden' : ''}`}>
      {/* Header */}
      <div className="p-4 border-b bg-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">LeadOS</h2>
          <div className="flex items-center gap-1">
            {/* Export Report Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setExportDialogOpen(true)}
              disabled={currentPageLeads.length === 0}
              title="Xuất báo cáo"
            >
              <Download className="h-4 w-4" />
            </Button>
            {onSummaryOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onSummaryOpen}
                title="Xem báo cáo tổng hợp"
              >
                <FileText className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filter Row */}
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchInput
              placeholder="Tìm tên, SĐT, xe..."
              value={searchPhone}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading && !loadingCarIds && selectedAccount) {
                  onSearch()
                }
              }}
              disabled={loading || loadingCarIds || !selectedAccount}
            />
          </div>

          {/* Source Filter Dropdown */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={`h-9 w-9 shrink-0 ${sourceFilter.length > 0 ? 'bg-blue-50 border-blue-300' : ''}`}
                disabled={loading || loadingCarIds || !selectedAccount || availableSources.length === 0}
                title="Lọc theo nguồn"
              >
                <SlidersHorizontal className={`h-4 w-4 ${sourceFilter.length > 0 ? 'text-blue-600' : ''}`} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-700 px-2 py-1">Nguồn Lead</p>
                {availableSources.map((source) => {
                  const displayName = source === "zalo" ? "Zalo" : source === "facebook" ? "Facebook" : source
                  const isChecked = sourceFilter.includes(source)
                  return (
                    <div
                      key={source}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        if (isChecked) {
                          onSourceFilterChange(sourceFilter.filter(s => s !== source))
                        } else {
                          onSourceFilterChange([...sourceFilter, source])
                        }
                      }}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            onSourceFilterChange([...sourceFilter, source])
                          } else {
                            onSourceFilterChange(sourceFilter.filter(s => s !== source))
                          }
                        }}
                      />
                      <span className="text-sm">{displayName}</span>
                    </div>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Date Range Filter Row */}
        {onDateRangeFilterChange && (
          <div className="mt-2">
            <DateRangePickerWithPresets
              dateRange={dateRangeFilter}
              onDateRangeChange={onDateRangeFilterChange}
              placeholder="Lọc theo ngày tạo"
              className="w-full h-9 text-sm"
            />
          </div>
        )}

        {/* Active Filter Pills */}
        {(appliedSearch || sourceFilter.length > 0 || dateRangeFilter?.from) && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              onClick={() => {
                if (onClearSearch) onClearSearch()
                onSourceFilterChange([])
                if (onDateRangeFilterChange) onDateRangeFilterChange(undefined)
              }}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium"
            >
              <X className="h-3 w-3" />
              Bỏ lọc tất cả
            </button>
            {appliedSearch && (
              <div
                className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-1 text-xs"
              >
                <span className="text-gray-600">search:</span>
                <span className="font-medium text-gray-900">{appliedSearch}</span>
                <button
                  onClick={onClearSearch}
                  className="ml-0.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {sourceFilter.map((source) => {
              const displayName = source === "zalo" ? "Zalo" : source === "facebook" ? "Facebook" : source
              return (
                <div
                  key={source}
                  className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-1 text-xs"
                >
                  <span className="text-gray-600">source:</span>
                  <span className="font-medium text-gray-900">{displayName}</span>
                  <button
                    onClick={() => onSourceFilterChange(sourceFilter.filter(s => s !== source))}
                    className="ml-0.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
            {dateRangeFilter?.from && (
              <div
                className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-1 text-xs"
              >
                <span className="text-gray-600">ngày:</span>
                <span className="font-medium text-gray-900">
                  {format(dateRangeFilter.from, "dd/MM", { locale: vi })}
                  {dateRangeFilter.to && dateRangeFilter.to !== dateRangeFilter.from && (
                    <> - {format(dateRangeFilter.to, "dd/MM", { locale: vi })}</>
                  )}
                </span>
                <button
                  onClick={() => onDateRangeFilterChange?.(undefined)}
                  className="ml-0.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-3 border-b flex gap-4">
        <button
          onClick={() => onTabChange("priority")}
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
          onClick={() => onTabChange("nurture")}
          className={`flex items-center gap-2 text-sm font-medium pb-2 transition-colors ${activeTab === "nurture"
            ? "text-emerald-600 border-b-2 border-emerald-600"
            : "text-gray-500 hover:text-gray-700"
            }`}
        >
          <MessageCircle className="h-4 w-4" />
          Nuôi dưỡng
          <Badge className={activeTab === "nurture" ? "bg-emerald-600 text-white text-white text-xs" : "bg-gray-200 text-gray-700 text-xs"}>
            {nurtureCount}
          </Badge>
        </button>
      </div>

      {/* Leads List - Scrollable area with touch scroll */}
      <div className="flex-1 overflow-y-auto scroll-touch scrollbar-hide">
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
            currentPageLeads.map((lead, index) => (
              <div
                key={`${lead.id}-${index}`}
                className={`p-4 transition-colors touch-target ${loading || loadingCarIds
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-blue-50 active:bg-blue-100"
                  } ${selectedLead?.id === lead.id ? "bg-blue-50 border-l-4 border-blue-600" : ""}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    onClick={() => {
                      if (!loading && !loadingCarIds) {
                        onLeadClick(lead)
                      }
                    }}
                    className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0 cursor-pointer"
                  >
                    {lead.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div
                    onClick={() => {
                      if (!loading && !loadingCarIds) {
                        onLeadClick(lead)
                      }
                    }}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900 truncate">{lead.name}</p>
                      {/* New reply indicator dot */}
                      {hasNewReplies(lead.id, lead.total_decoy_messages) && (
                        <span
                          className="h-2 w-2 bg-red-500 rounded-full animate-pulse shrink-0"
                          title="Có tin nhắn mới từ khách hàng"
                        />
                      )}
                      {lead.source && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {lead.source === "zalo" ? "Zalo" : lead.source === "facebook" ? "Facebook" : lead.source}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 ml-auto shrink-0"
                        onClick={(e) => handleTogglePrimary(lead, e)}
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
                    <div className="flex flex-col gap-0.5">
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
                      {/* Car ID Display */}
                      {lead.car_id && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                            {truncateCarId(lead.car_id)}
                          </span>
                          <button
                            onClick={(e) => handleCopyCarId(e, lead.car_id!)}
                            className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                            title="Sao chép Car ID"
                          >
                            <Copy className="h-3 w-3 text-gray-500 hover:text-gray-700" />
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Price Display Row */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs font-semibold text-emerald-600">
                        {formatPriceShort(lead.price_customer)}
                      </span>
                      {lead.price_highest_bid && lead.price_highest_bid > 0 && (
                        <>
                          <span className="text-xs text-gray-400">vs</span>
                          <span className="text-xs font-semibold text-blue-600">
                            {formatPriceShort(lead.price_highest_bid)}
                          </span>
                          {lead.price_customer && lead.price_customer > 0 && (
                            <span className="text-xs text-orange-500 font-medium">
                              Gap {formatPriceShort(lead.price_customer - lead.price_highest_bid)}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {/* Last Activity Time */}
                    <div className={`flex items-center gap-1 mt-1 ${getActivityFreshnessClass(getActivityFreshness(lead.last_activity_at))}`}>
                      <Activity className="h-3 w-3" />
                      <span className="text-[10px]">
                        {formatRelativeTime(lead.last_activity_at)}
                      </span>
                    </div>
                    {/* Workflow Status & Bot Button Row */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {lead.latest_campaign && (
                        <>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0.5 ${lead.latest_campaign.is_active
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-green-50 text-green-700 border-green-200'
                              }`}
                          >
                            {lead.latest_campaign.is_active ? (
                              <><Play className="h-2.5 w-2.5 mr-0.5" />WF{lead.latest_campaign.workflow_order}</>
                            ) : (
                              <><CheckCircle className="h-2.5 w-2.5 mr-0.5" />WF{lead.latest_campaign.workflow_order} - Done</>
                            )}
                          </Badge>
                          {/* Progress bar and countdown for running campaigns */}
                          {lead.latest_campaign.is_active && lead.latest_campaign.duration && (
                            <>
                              <div className="flex-1 max-w-[40px]">
                                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-purple-500 transition-all"
                                    style={{
                                      width: `${calculateCampaignProgress(
                                        lead.latest_campaign.published_at,
                                        lead.latest_campaign.duration
                                      )}%`
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[9px] text-purple-600 font-medium whitespace-nowrap">
                                  {calculateRemainingTime(lead.latest_campaign.published_at, lead.latest_campaign.duration)}
                                </span>
                                <span className="text-[9px] text-gray-500 whitespace-nowrap">
                                  {calculateDoneDate(lead.latest_campaign.published_at, lead.latest_campaign.duration)}
                                </span>
                              </div>
                            </>
                          )}
                        </>
                      )}

                      {/* Bot check biển upload button - Always visible */}
                      <ImageUploadService
                        lead={lead}
                        senderName={picName}
                        renderTrigger={(uploading, handleTrigger) => (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] ml-auto border-blue-200 text-blue-700 hover:bg-blue-50"
                            onClick={(e) => handleTrigger(e)}
                            disabled={uploading}
                          >
                            {uploading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Upload className="h-3 w-3 mr-1" />
                            )}
                            Bot che biển
                          </Button>
                        )}
                      />
                    </div>
                    {/* Inspection Schedule Badge */}
                    {lead.inspection_schedule && (
                      <div className="flex items-center gap-2 mt-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors"
                            >
                              <Calendar className="h-2.5 w-2.5 mr-0.5" />
                              Lịch KĐ: {lead.inspection_schedule.location.split('-')[0].trim().substring(0, 15)} - {lead.inspection_schedule.inspector}
                            </Badge>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-3" align="start">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-amber-700 font-medium">
                                <Calendar className="h-4 w-4" />
                                <span>Lịch kiểm định</span>
                              </div>
                              <div className="space-y-1.5 text-sm">
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                                  <span className="text-gray-700">{lead.inspection_schedule.location}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <User className="h-3.5 w-3.5 text-gray-400" />
                                  <span className="text-gray-700">{lead.inspection_schedule.inspector}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                                  <span className="text-gray-500 text-xs">
                                    {new Date(lead.inspection_schedule.scheduled_at).toLocaleString('vi-VN', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination - With safe area for mobile */}
      {totalPages > 1 && (
        <div className="border-t p-3 bg-gray-50 safe-area-bottom">
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
                    onClick={() => onPageChange(pageNum)}
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

      {/* Export Report Dialog */}
      <ExportReportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        leads={currentPageLeads}
      />
    </div>
  )
}
