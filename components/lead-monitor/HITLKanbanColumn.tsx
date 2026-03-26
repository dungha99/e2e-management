"use client"

import { useEffect, useRef } from "react"
import { StepKey } from "./types"
import { HITLLeadCard } from "./HITLLeadCard"
import { Loader2 } from "lucide-react"
import { useColumnLeads } from "./useColumnLeads"

interface HITLKanbanColumnProps {
  stepKey: StepKey
  title: string
  picId: string
  searchQuery: string
  qualifiedFilter: string
  refreshKey: number
  onResolve: (id: string) => void
  onDetail: (id: string) => void
}

export function HITLKanbanColumn({
  stepKey,
  title,
  picId,
  searchQuery,
  qualifiedFilter,
  refreshKey,
  onResolve,
  onDetail,
}: HITLKanbanColumnProps) {
  const { items, isLoadingInitial, isFetchingMore, hasMore, loadMore, removeItem } =
    useColumnLeads(stepKey, picId, refreshKey)

  // Client-side search filter applied on top of loaded pages
  const searched = searchQuery
    ? items.filter((lead) => {
      const q = searchQuery.toLowerCase()
      return (
        lead.customer.name.toLowerCase().includes(q) ||
        (lead.customer.phone && lead.customer.phone.includes(q)) ||
        lead.car.model.toLowerCase().includes(q) ||
        lead.car_id.toLowerCase().includes(q)
      )
    })
    : items

  const filtered = (qualifiedFilter === "all"
    ? searched
    : searched.filter((lead) => {
      const status = (lead.qualified_status || "UNDEFINED").toUpperCase()
      if (qualifiedFilter === "strong") return status.includes("STRONG")
      if (qualifiedFilter === "weak") return status.includes("WEAK")
      if (qualifiedFilter === "undefined") return status.includes("UNDEFINED")
      return true
    }))

  const slaBreachedCount = filtered.filter((l) => (l.time_overdue_minutes ?? 0) > 0).length
  const hasOverdue = filtered.some((l) => (l.time_overdue_minutes ?? 0) > 0)

  // IntersectionObserver sentinel — keeps a stable ref to loadMore
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreRef.current()
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  const handleResolve = (id: string) => {
    removeItem(id)
    onResolve(id)
  }

  return (
    <div className="flex flex-col flex-shrink-0 w-[320px] min-w-[320px] px-3 h-full min-h-0">

      {/* Column Header — fixed */}
      <div className="flex items-center gap-1.5 mb-3 shrink-0 px-1">
        <h3 className="font-semibold text-gray-700 text-sm leading-tight">{title}</h3>

        {/* Badge: <#SLA_breached> <#total> */}
        <div className="ml-auto flex items-center gap-1">
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-100 text-red-600 text-[11px] font-bold">
            {slaBreachedCount}
          </span>
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-bold">
            {filtered.length}
          </span>
        </div>
      </div>

      {/* Cards — scrolls vertically */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-none">
        <div className="space-y-3 pb-4 pr-1">

          {/* Initial loading */}
          {isLoadingInitial && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          )}

          {/* Empty state */}
          {!isLoadingInitial && filtered.length === 0 && (
            <div className="border border-dashed border-gray-200 rounded-xl p-8 flex items-center justify-center bg-gray-50/50">
              <span className="text-sm text-gray-400 font-medium">Không có alert</span>
            </div>
          )}

          {/* Lead cards */}
          {filtered.map((lead) => (
            <HITLLeadCard
              key={lead.id}
              lead={lead}
              onResolve={handleResolve}
              onDetail={onDetail}
            />
          ))}

          {/* Sentinel div — triggers loadMore when visible */}
          {!isLoadingInitial && hasMore && (
            <div ref={sentinelRef} className="h-4" />
          )}

          {/* Load-more spinner */}
          {isFetchingMore && (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
