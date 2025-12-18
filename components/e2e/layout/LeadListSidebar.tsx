"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SearchInput } from "@/components/ui/search-input"
import { Loader2, User, Zap, MessageCircle, FileText, ChevronLeft, ChevronRight, Star, Filter, X, SlidersHorizontal } from "lucide-react"
import { Lead } from "../types"
import { formatCarInfo, formatPrice } from "../utils"
import { useToast } from "@/hooks/use-toast"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"

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
  onSearchChange: (value: string) => void
  onSearch: () => void

  // Source filter
  sourceFilter: string[]
  onSourceFilterChange: (sources: string[]) => void
  availableSources: string[]

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
  onSearchChange,
  onSearch,
  sourceFilter,
  onSourceFilterChange,
  availableSources,
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
  const [filterOpen, setFilterOpen] = useState(false)

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

  return (
    <div className={`${isMobile ? 'w-full' : 'w-80'} border-r flex flex-col bg-white`}>
      {/* Header */}
      <div className="p-4 border-b bg-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">LeadOS</h2>
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

        {/* Search and Filter Row */}
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchInput
              placeholder="Tìm kiếm danh sách..."
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

        {/* Active Filter Pills */}
        {sourceFilter.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              onClick={() => onSourceFilterChange([])}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium"
            >
              <X className="h-3 w-3" />
              Bỏ lọc tất cả
            </button>
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

      {/* Leads List */}
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
            currentPageLeads.map((lead, index) => (
              <div
                key={`${lead.id}-${index}`}
                className={`p-4 transition-colors ${loading || loadingCarIds
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-blue-50"
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

      {/* Pagination */}
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
    </div>
  )
}
