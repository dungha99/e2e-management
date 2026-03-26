"use client"

import { AlertTriangle, Zap, Bot, HelpCircle, MessageSquareWarning, PhoneOff } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// ── Zalo reason badge config (same labelling as ZaloErrorBadges.tsx) ────────
const ZALO_CATEGORY_CONFIG: Record<string, {
  label: string
  shortLabel: string
  className: string
  icon: string
}> = {
  BLOCKED_STRANGER: { label: "Chặn tin nhắn người lạ", shortLabel: "Chặn TN", className: "bg-red-50 text-red-600 border-red-200", icon: "🚫" },
  DECLINED_MESSAGES: { label: "Từ chối nhận tin", shortLabel: "Từ chối", className: "bg-orange-50 text-orange-600 border-orange-200", icon: "✋" },
  NO_UID_FOUND: { label: "Không tìm thấy Zalo", shortLabel: "No UID", className: "bg-amber-50 text-amber-700 border-amber-200", icon: "🔍" },
  CONTACT_NOT_FOUND: { label: "Không tìm thấy contact", shortLabel: "No Contact", className: "bg-purple-50 text-purple-600 border-purple-200", icon: "👤" },
  TIMEOUT: { label: "Hết thời gian chờ", shortLabel: "Timeout", className: "bg-sky-50 text-sky-600 border-sky-200", icon: "⏱" },
  SEARCH_FAILED: { label: "Lỗi tìm kiếm", shortLabel: "Search Err", className: "bg-indigo-50 text-indigo-600 border-indigo-200", icon: "⚠" },
  OTHER: { label: "Lỗi khác", shortLabel: "Khác", className: "bg-gray-50 text-gray-600 border-gray-200", icon: "❓" },
}

interface KPIRibbonProps {
  needsAction: number
  escalation: number
  botActive: number
  undefinedCount: number
  noZaloActionCount: number
  zaloReasonBreakdown: Record<string, number>
  loading: boolean
}

export function KPIRibbon({ needsAction, escalation, botActive, undefinedCount, noZaloActionCount, zaloReasonBreakdown, loading }: KPIRibbonProps) {
  if (loading) {
    return (
      <div className="flex items-stretch w-full bg-white rounded-xl border border-gray-100 mb-5 overflow-hidden">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex-1 px-6 py-4 animate-pulse border-r border-gray-100 last:border-r-0">
            <div className="h-3 bg-gray-100 rounded w-28 mb-3" />
            <div className="h-9 bg-gray-100 rounded w-12" />
          </div>
        ))}
      </div>
    )
  }

  const totalZaloLeads = Object.values(zaloReasonBreakdown).reduce((s, c) => s + c, 0)
  const sortedReasons = Object.entries(zaloReasonBreakdown)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-stretch w-full bg-white rounded-xl border border-gray-100 mb-5 overflow-hidden shadow-sm">

        {/* CẦN XỬ LÝ */}
        <div className="flex-1 px-6 py-4 border-r border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" strokeWidth={2.5} />
            <span className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">Cần xử lý</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-gray-900 leading-none">{needsAction}</span>
            <span className="text-sm font-medium text-gray-400">alerts</span>
          </div>
        </div>

        {/* ESCALATION */}
        <div className="flex-1 px-6 py-4 border-r border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="w-3.5 h-3.5 text-orange-500" strokeWidth={2.5} />
            <span className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">Escalation</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-gray-900 leading-none">{escalation}</span>
            <span className="text-sm font-medium text-gray-400">chưa resolve</span>
          </div>
        </div>

        {/* BOT TỰ XỬ LÝ */}
        <div className="flex-1 px-6 py-4 border-r border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Bot className="w-3.5 h-3.5 text-violet-500" strokeWidth={2.5} />
            <span className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">Bot tự xử lý</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-gray-900 leading-none">{botActive}</span>
            <span className="text-sm font-medium text-gray-400">/ {needsAction + escalation} leads</span>
          </div>
        </div>

        {/* UNDEFINED */}
        <div className="flex-1 px-6 py-4 border-r border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <HelpCircle className="w-3.5 h-3.5 text-gray-400" strokeWidth={2.5} />
            <span className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">Undefined</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-gray-900 leading-none">{undefinedCount}</span>
            <span className="text-sm font-medium text-gray-400">leads</span>
          </div>
        </div>

        {/* CHƯA ZALO (No Zalo Action) */}
        <div className="flex-1 px-6 py-4 border-r border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <PhoneOff className="w-3.5 h-3.5 text-red-400" strokeWidth={2.5} />
            <span className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">Chưa Zalo</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-gray-900 leading-none">{noZaloActionCount}</span>
            <span className="text-sm font-medium text-gray-400">leads</span>
          </div>
        </div>

        {/* LIÊN HỆ ZALO */}
        <div className="flex-1 px-6 py-4 min-w-0">
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquareWarning className="w-3.5 h-3.5 text-blue-500" strokeWidth={2.5} />
            <span className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">Liên hệ Zalo</span>
            <span className="text-[11px] font-bold text-blue-500 ml-auto">{totalZaloLeads}</span>
          </div>
          {sortedReasons.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {sortedReasons.map(([category, count]) => {
                const cfg = ZALO_CATEGORY_CONFIG[category] ?? ZALO_CATEGORY_CONFIG.OTHER
                return (
                  <Tooltip key={category}>
                    <TooltipTrigger asChild>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border cursor-help transition-all hover:shadow-sm ${cfg.className}`}
                      >
                        <span className="text-[9px] leading-none">{cfg.icon}</span>
                        {cfg.shortLabel}
                        <span className="font-bold opacity-80">{count}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {cfg.label}: {count} leads
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          ) : (
            <span className="text-sm text-gray-300">Không có lỗi</span>
          )}
        </div>

      </div>
    </TooltipProvider>
  )
}
