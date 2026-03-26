"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { HelpCircle, MessageSquareWarning, PhoneOff, ChevronDown, ChevronUp, BarChart3 } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// ── Zalo reason badge config ───────────────────────────────────────────────
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

interface E2EKPIRibbonProps {
  picId: string
  search?: string
  sources?: string[]
  dateFrom?: string | null
  dateTo?: string | null
  onMetricClick?: (metric: string) => void
}

// ── ALLOWED PIC IDs for Funnel ──────────────────────────────────────────────
const ALLOWED_FUNNEL_PICS = [
  "bd1e0eee-422f-47a8-bb30-56c27cf6690b",
  "286af2a8-a866-496a-8ed0-da30df3120ec",
  "2ffa8389-2641-4d8b-98a6-5dc2dd2d20a4",
  "9ee91b08-448b-4cf4-8b3d-79c6f1c71fef",
]


export function E2EKPIRibbon({ picId, search, sources, dateFrom, dateTo, onMetricClick }: E2EKPIRibbonProps) {
  const router = useRouter()
  const [undefinedCount, setUndefinedCount] = useState(0)
  const [zaloReasonBreakdown, setZaloReasonBreakdown] = useState<Record<string, number>>({})
  const [noZaloActionCount, setNoZaloActionCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const isFunnelAllowed = ALLOWED_FUNNEL_PICS.includes(picId)

  useEffect(() => {
    if (!picId) return

    let cancelled = false
    setLoading(true)

    // Build query string with filter params
    const params = new URLSearchParams({ pic_id: picId })
    if (search) params.set("search", search)
    if (sources && sources.length > 0) params.set("sources", sources.join(","))
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)

    fetch(`/api/e2e/kpi-stats?${params.toString()}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return
        setUndefinedCount(data.undefinedQualifiedCount ?? 0)
        setZaloReasonBreakdown(data.zaloReasonBreakdown ?? {})
        setNoZaloActionCount(data.noZaloActionCount ?? 0)
      })
      .catch((err) => console.error("[E2EKPIRibbon] Error:", err))
      .finally(() => { if (!cancelled) setLoading(false) })


    return () => { cancelled = true }
  }, [picId, search, sources?.join(","), dateFrom, dateTo])

  if (loading) {
    return (
      <div className="flex items-stretch w-full bg-white rounded-xl border border-gray-100 overflow-hidden">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 px-5 py-3 animate-pulse border-r border-gray-100 last:border-r-0">
            <div className="h-2.5 bg-gray-100 rounded w-24 mb-2" />
            <div className="h-7 bg-gray-100 rounded w-10" />
          </div>
        ))}
      </div>
    )
  }

  const totalZaloLeads = Object.values(zaloReasonBreakdown).reduce((s, c) => s + c, 0)
  const sortedReasons = Object.entries(zaloReasonBreakdown)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)

  const cardBase = "flex-1 px-5 py-3 border-r border-gray-100 transition-colors cursor-pointer hover:bg-blue-50/50 active:bg-blue-100/50"

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-3 w-full">
        <div className="flex items-stretch w-full bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">

          {/* UNDEFINED */}
          <div
            className={cardBase}
            onClick={() => onMetricClick?.("UNDEFINED_QUALIFIED")}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <HelpCircle className="w-3 h-3 text-gray-400" strokeWidth={2.5} />
              <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Undefined</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-gray-900 leading-none">{undefinedCount}</span>
              <span className="text-xs font-medium text-gray-400">leads</span>
            </div>
          </div>

          {/* NO ZALO ACTION */}
          <div
            className={cardBase}
            onClick={() => onMetricClick?.("NO_ZALO_ACTION")}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <PhoneOff className="w-3 h-3 text-red-400" strokeWidth={2.5} />
              <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Chưa Zalo</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-gray-900 leading-none">{noZaloActionCount}</span>
              <span className="text-xs font-medium text-gray-400">leads</span>
            </div>
          </div>

          {/* LIÊN HỆ ZALO */}
          <div className="flex-1 px-5 py-3 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquareWarning className="w-3 h-3 text-blue-500" strokeWidth={2.5} />
              <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Liên hệ Zalo</span>
              <span className="text-[10px] font-bold text-blue-500 ml-auto">{totalZaloLeads}</span>
            </div>
            {sortedReasons.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {sortedReasons.map(([category, count]) => {
                  const cfg = ZALO_CATEGORY_CONFIG[category] ?? ZALO_CATEGORY_CONFIG.OTHER
                  return (
                    <Tooltip key={category}>
                      <TooltipTrigger asChild>
                        <span
                          onClick={() => onMetricClick?.(category)}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border cursor-pointer transition-all hover:shadow-md hover:scale-105 ${cfg.className}`}
                        >
                          <span className="text-[9px] leading-none">{cfg.icon}</span>
                          {cfg.shortLabel}
                          <span className="font-bold opacity-80">{count}</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        Click để xem chi tiết · {cfg.label}: {count} leads
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            ) : (
              <span className="text-xs text-gray-300">Không có lỗi</span>
            )}
          </div>

        </div>

        {isFunnelAllowed && (
          <button
            onClick={() => {
              const params = new URLSearchParams()
              if (dateFrom) params.set("dateFrom", dateFrom)
              if (dateTo) params.set("dateTo", dateTo)
              router.push(`/e2e/${picId}/funnel?${params.toString()}`)
            }}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between hover:bg-gray-50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-gray-800">Phân tích Lead Funnel (Tổng quan)</div>
                <div className="text-xs text-gray-500">Xem báo cáo chi tiết về tỷ lệ chuyển đổi và hiệu quả Zalo</div>
              </div>
            </div>
            <div className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider group-hover:bg-blue-600 group-hover:text-white transition-all">
              Xem chi tiết
            </div>
          </button>
        )}
      </div>
    </TooltipProvider>
  )
}
