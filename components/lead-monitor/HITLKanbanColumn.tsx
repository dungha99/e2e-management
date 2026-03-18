"use client"

import { HITLLead } from "./types"
import { HITLLeadCard } from "./HITLLeadCard"
import { Loader2 } from "lucide-react"

interface HITLKanbanColumnProps {
  title: string
  dotColor: string
  leads: HITLLead[]
  isLoading: boolean
  onResolve: (id: string) => void
  onDetail: (id: string) => void
}

export function HITLKanbanColumn({
  title,
  dotColor,
  leads,
  isLoading,
  onResolve,
  onDetail,
}: HITLKanbanColumnProps) {
  const criticalCount = leads.filter((l) => l.trigger.severity === "CRITICAL").length

  return (
    <div className="flex flex-col flex-shrink-0 w-[320px] min-w-[320px] px-3 h-full min-h-0">

      {/* Column Header — fixed */}
      <div className="flex items-center gap-2 mb-3 shrink-0 px-1">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
        <h3 className="font-semibold text-gray-700 text-sm leading-tight">{title}</h3>

        <div className="ml-auto flex items-center gap-1">
          {criticalCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-100 text-red-600 text-[11px] font-bold">
              {criticalCount}
            </span>
          )}
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-bold">
            {leads.length}
          </span>
        </div>
      </div>

      {/* Cards — scrolls vertically */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-none">
        <div className="space-y-3 pb-4 pr-1">

          {/* Loading state — only shown while board fetches for first time */}
          {isLoading && leads.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && leads.length === 0 && (
            <div className="border border-dashed border-gray-200 rounded-xl p-8 flex items-center justify-center bg-gray-50/50">
              <span className="text-sm text-gray-400 font-medium">Không có alert</span>
            </div>
          )}

          {/* Lead cards */}
          {leads.map((lead) => (
            <HITLLeadCard
              key={lead.id}
              lead={lead}
              onResolve={onResolve}
              onDetail={onDetail}
            />
          ))}

        </div>
      </div>
    </div>
  )
}
