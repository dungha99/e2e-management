"use client"

import { useEffect, useRef, useMemo } from "react"
import { HITLLead, StepKey } from "./types"
import { HITLLeadCard } from "./HITLLeadCard"
import { useColumnLeads } from "./useColumnLeads"
import { Loader2 } from "lucide-react"

interface HITLKanbanColumnProps {
  title: string
  dotColor: string
  stepKey: StepKey
  picId: string
  searchQuery: string
  refreshKey: number
  onResolve: (id: string) => void
  onDetail: (id: string) => void
}

export function HITLKanbanColumn({
  title,
  dotColor,
  stepKey,
  picId,
  searchQuery,
  refreshKey,
  onResolve,
  onDetail,
}: HITLKanbanColumnProps) {
  const { leads, isLoading, hasMore, total, loadMore, removeLead } = useColumnLeads(stepKey, picId, refreshKey)

  // Client-side search filter on loaded items
  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads
    const q = searchQuery.toLowerCase()
    return leads.filter(
      (lead) =>
        lead.customer.name.toLowerCase().includes(q) ||
        (lead.customer.phone && lead.customer.phone.includes(q)) ||
        lead.car.model.toLowerCase().includes(q)
    )
  }, [leads, searchQuery])

  const criticalCount = filteredLeads.filter((l) => l.trigger.severity === "CRITICAL").length

  // IntersectionObserver sentinel at the bottom of the list
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreRef.current()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  const handleResolve = (id: string) => {
    removeLead(id)
    onResolve(id)
  }

  // Determine dot color: red if any lead is overdue
  const hasOverdue = leads.some((l) => l.time_overdue_minutes != null && l.time_overdue_minutes > 0)
  const activeDotColor = hasOverdue ? "bg-red-500" : dotColor

  return (
    <div className="flex flex-col flex-shrink-0 w-[320px] min-w-[320px] px-3 h-full min-h-0">
      {/* Column Header — fixed */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <span className={`w-2 h-2 rounded-full ${activeDotColor}`} />
        <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>

        <div className="ml-auto flex items-center gap-1.5">
          {criticalCount > 0 && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold">
              {criticalCount}
            </span>
          )}
          <span className="flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
            {total > 0 ? total : filteredLeads.length}
          </span>
        </div>
      </div>

      {/* Cards — scrolls vertically */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-none">
        <div className="space-y-3 pb-4 pr-1">
          {/* Initial loading skeleton */}
          {isLoading && filteredLeads.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filteredLeads.length === 0 && (
            <div className="border border-dashed border-gray-200 rounded-xl p-8 flex items-center justify-center bg-gray-50/50">
              <span className="text-sm text-gray-400 font-medium">Không có alert</span>
            </div>
          )}

          {/* Lead cards */}
          {filteredLeads.map((lead: HITLLead) => (
            <HITLLeadCard
              key={lead.id}
              lead={lead}
              onResolve={handleResolve}
              onDetail={onDetail}
            />
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-1" aria-hidden />

          {/* Loading more indicator */}
          {isLoading && filteredLeads.length > 0 && (
            <div className="flex items-center justify-center py-3 gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Đang tải...</span>
            </div>
          )}

          {/* No more data indicator */}
          {!isLoading && !hasMore && filteredLeads.length > 0 && (
            <div className="flex items-center justify-center py-3">
              <span className="text-xs text-gray-300">— Hết dữ liệu —</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
