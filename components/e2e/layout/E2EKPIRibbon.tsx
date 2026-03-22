"use client"

import { useState, useEffect } from "react"
import { HelpCircle, MessageSquareWarning, PhoneOff, ChevronDown, ChevronUp } from "lucide-react"
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

function LeadFunnelBreakdown({ data, loading, onMetricClick }: { data: any, loading: boolean, onMetricClick?: (metric: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (loading) {
    return (
      <div className="w-full bg-white rounded-xl border border-gray-100 p-8 flex justify-center shadow-sm">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-10 w-32 bg-gray-200 rounded mb-4"></div>
          <div className="flex gap-10">
            <div className="h-10 w-32 bg-gray-200 rounded"></div>
            <div className="h-10 w-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }
  if (!data) return null;
  const { totalLeads, hasImageCount, noImageCount, zaloSuccessCount, zaloNeverCount, zaloFailedCount, zaloBlockedCount, zaloSystemErrorCount } = data;

  const pctHasImage = totalLeads ? ((hasImageCount / totalLeads) * 100).toFixed(1) : 0;
  const pctNoImage = totalLeads ? ((noImageCount / totalLeads) * 100).toFixed(1) : 0;
  const pctZaloSuccess = noImageCount ? ((zaloSuccessCount / noImageCount) * 100).toFixed(1) : 0;
  const pctZaloFailed = noImageCount ? ((zaloFailedCount / noImageCount) * 100).toFixed(1) : 0;
  const pctZaloNever = noImageCount ? ((zaloNeverCount / noImageCount) * 100).toFixed(1) : 0;

  return (
    <div className="w-full mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-sm font-bold text-gray-800 mb-2 border-b pb-2 hover:bg-gray-50 transition-colors"
      >
        <span>Phân tích Lead Funnel (Tổng quan)</span>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {isExpanded && (
        <div className="flex flex-col items-center w-full max-w-4xl relative mt-4">
          <style dangerouslySetInnerHTML={{
            __html: `
          .tree-line-v {position: absolute; top: 100%; left: 50%; width: 2px; height: 24px; background-color: #e5e7eb; transform: translateX(-50%); }
          `}} />

          {/* Tier 1 */}
          <div className="relative flex flex-col items-center mb-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onMetricClick?.("FUNNEL_TOTAL_LEADS")}
                  className="bg-gray-100 border border-gray-200 rounded-lg px-6 py-2 min-w-[180px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform cursor-pointer"
                >
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">1. Nhận lead</div>
                  <div className="text-xl font-black text-gray-800">{totalLeads}</div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[250px] space-y-1">
                <p className="font-semibold text-sm">Tổng leads được nhận</p>
                <p className="text-xs text-gray-500">Tất cả leads được phân bổ trong khoảng thời gian.</p>
                <div className="bg-gray-50 rounded p-1 mt-1 border text-[10px] font-mono text-gray-600">
                  COUNT(DISTINCT l.id) FROM leads l
                </div>
              </TooltipContent>
            </Tooltip>
            <div className="tree-line-v"></div>
          </div>

          {/* Tier 2 */}
          <div className="relative flex justify-center gap-8 mb-6 w-full pt-6">
            <div className="absolute top-0 left-1/2 w-1/2 max-w-[200px] h-[2px] bg-gray-200 -translate-x-1/2"></div>

            {/* Node 2a */}
            <div className="relative flex flex-col items-center">
              <div className="absolute top-0 left-1/2 w-[2px] h-6 bg-gray-200 -translate-x-1/2 -mt-6"></div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onMetricClick?.("FUNNEL_HAS_IMAGE")}
                    className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 min-w-[160px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform cursor-pointer"
                  >
                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">2a. Đã có hình</div>
                    <div className="text-lg font-black text-emerald-700">{hasImageCount} <span className="text-xs font-medium opacity-70">({pctHasImage}%)</span></div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[250px] space-y-1">
                  <p className="font-semibold text-sm">Đã có hình (Strong Qualified)</p>
                  <p className="text-xs text-gray-500">Leads đã được xác nhận cung cấp hình ảnh xe đầy đủ qua Sale Status.</p>
                  <div className="bg-gray-50 rounded p-1 mt-1 border text-[10px] font-mono text-gray-600">
                    ss.qualified = 'STRONG_QUALIFIED'
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Node 2b */}
            <div className="relative flex flex-col items-center">
              <div className="absolute top-0 left-1/2 w-[2px] h-6 bg-gray-200 -translate-x-1/2 -mt-6"></div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onMetricClick?.("FUNNEL_NO_IMAGE")}
                    className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 min-w-[160px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform cursor-pointer"
                  >
                    <div className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-1">2b. Chưa có hình</div>
                    <div className="text-lg font-black text-orange-700">{noImageCount} <span className="text-xs font-medium opacity-70">({pctNoImage}%)</span></div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[250px] space-y-1">
                  <p className="font-semibold text-sm">Chưa có hình xe</p>
                  <p className="text-xs text-gray-500">Leads chưa đạt Strong Qualified hoặc chưa có báo cáo Sale Status nào.</p>
                  <div className="bg-gray-50 rounded p-1 mt-1 border text-[10px] font-mono text-gray-600">
                    ss.qualified != '...' OR ss.qualified IS NULL
                  </div>
                </TooltipContent>
              </Tooltip>
              <div className="tree-line-v"></div>
            </div>
          </div>

          {/* Tier 3 */}
          <div className="relative flex justify-end gap-3 mb-6 w-full pt-6 pr-[2%]">
            <div className="absolute top-0 right-[15%] w-[45%] h-[2px] bg-gray-200"></div>

            <div className="relative flex flex-col items-center">
              <div className="absolute top-0 left-1/2 w-[2px] h-6 bg-gray-200 -translate-x-1/2 -mt-6"></div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onMetricClick?.("FUNNEL_FIRST_MESSAGE_SUCCESS")}
                    className="bg-blue-50 border border-blue-200 rounded-lg px-2 py-2 min-w-[130px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform cursor-pointer"
                  >
                    <div className="text-[9px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">3a. firstMessage success</div>
                    <div className="text-base font-black text-blue-700">{zaloSuccessCount} <span className="text-[10px] font-medium opacity-70">({pctZaloSuccess}%)</span></div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[250px] space-y-1">
                  <p className="font-semibold text-sm">firstMessage success</p>
                  <p className="text-xs text-gray-500">Khách nhận được tin nhắn qua Zalo.</p>
                  <div className="bg-gray-50 rounded p-1 mt-1 border text-[10px] font-mono text-gray-600">
                    MAX(CASE WHEN action_type = 'firstMessage' AND status = 'success' THEN 1 ELSE 0 END)
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="relative flex flex-col items-center">
              <div className="absolute top-0 left-1/2 w-[2px] h-6 bg-gray-200 -translate-x-1/2 -mt-6"></div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onMetricClick?.("FUNNEL_FIRST_MESSAGE_FAILED")}
                    className="bg-red-50 border border-red-200 rounded-lg px-2 py-2 min-w-[130px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform cursor-pointer"
                  >
                    <div className="text-[9px] font-bold text-red-600 uppercase tracking-wider mb-0.5">3b. firstMessage failed</div>
                    <div className="text-base font-black text-red-700">{zaloFailedCount} <span className="text-[10px] font-medium opacity-70">({pctZaloFailed}%)</span></div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[250px] space-y-1">
                  <p className="font-semibold text-sm">firstMessage failed</p>
                  <p className="text-xs text-gray-500">Gửi nhưng lỗi, cần xem breakdown bên dưới.</p>
                  <div className="bg-gray-50 rounded p-1 mt-1 border text-[10px] font-mono text-gray-600">
                    z.has_success = 0 AND z.has_failed = 1
                  </div>
                </TooltipContent>
              </Tooltip>
              <div className="tree-line-v"></div>
            </div>

            <div className="relative flex flex-col items-center">
              <div className="absolute top-0 left-1/2 w-[2px] h-6 bg-gray-200 -translate-x-1/2 -mt-6"></div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onMetricClick?.("FUNNEL_NEVER_FIRST_MESSAGE")}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 min-w-[130px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform cursor-pointer"
                  >
                    <div className="text-[9px] font-bold text-gray-600 uppercase tracking-wider mb-0.5">3c. Chưa gửi firstMessage</div>
                    <div className="text-base font-black text-gray-700">{zaloNeverCount} <span className="text-[10px] font-medium opacity-70">({pctZaloNever}%)</span></div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[250px] space-y-1">
                  <p className="font-semibold text-sm">Chưa gửi firstMessage</p>
                  <p className="text-xs text-gray-500">Phones chưa SQ nhưng KHÔNG CÓ TRONG bảng zalo_action gửi firstMessage.</p>
                  <div className="bg-gray-50 rounded p-1 mt-1 border text-[10px] font-mono text-gray-600">
                    SĐT NOT IN (zalo_action WHERE action_type = 'firstMessage')
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Tier 4 */}
          <div className="relative flex justify-end gap-3 w-full pt-6 pr-[12%]">
            <div className="absolute top-0 right-[15%] w-[18%] h-[2px] bg-red-100"></div>

            <div className="relative flex flex-col items-center">
              <div className="absolute top-0 left-1/2 w-[2px] h-6 bg-red-100 -translate-x-1/2 -mt-6"></div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onMetricClick?.("FUNNEL_BLOCKED_MESSAGE")}
                    className="bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5 min-w-[110px] text-center relative z-10 hover:scale-105 transition-transform cursor-pointer"
                  >
                    <div className="text-[9px] font-bold text-rose-500 uppercase tracking-wider mb-0.5">Lỗi 1: Chặn tin nhắn</div>
                    <div className="text-sm font-black text-rose-600">{zaloBlockedCount || 0}</div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[250px] space-y-1 z-50">
                  <p className="font-semibold text-sm">Chặn tin nhắn người lạ</p>
                  <p className="text-xs text-gray-500">Khách cài đặt Zalo chặn nhận tin nhắn từ người lạ. Cần chuyển kênh liên lạc.</p>
                  <div className="bg-gray-50 rounded p-1 mt-1 border text-[10px] font-mono text-gray-600 break-all leading-tight">
                    fail_reasons LIKE '%Bạn chưa thể gửi%' OR ...
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="relative flex flex-col items-center">
              <div className="absolute top-0 left-1/2 w-[2px] h-6 bg-red-100 -translate-x-1/2 -mt-6"></div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onMetricClick?.("FUNNEL_SYSTEM_ERROR")}
                    className="bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5 min-w-[110px] text-center relative z-10 hover:scale-105 transition-transform cursor-pointer"
                  >
                    <div className="text-[9px] font-bold text-rose-500 uppercase tracking-wider mb-0.5">Lỗi 2: No uid / HT</div>
                    <div className="text-sm font-black text-rose-600">{zaloSystemErrorCount || 0}</div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[250px] space-y-1 z-50">
                  <p className="font-semibold text-sm">No UID / Lỗi hệ thống</p>
                  <p className="text-xs text-gray-500">Không tìm thấy tài khoản Zalo, hoặc lỗi Connection reset/Timeout từ AkaBiz.</p>
                  <div className="bg-gray-50 rounded p-1 mt-1 border text-[10px] font-mono text-gray-600 break-all leading-tight">
                    fail_reasons LIKE '%No uid found%' OR ...
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function E2EKPIRibbon({ picId, search, sources, dateFrom, dateTo, onMetricClick }: E2EKPIRibbonProps) {
  const [undefinedCount, setUndefinedCount] = useState(0)
  const [zaloReasonBreakdown, setZaloReasonBreakdown] = useState<Record<string, number>>({})
  const [noZaloActionCount, setNoZaloActionCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Funnel States
  const [funnelData, setFunnelData] = useState<any>(null)
  const [funnelLoading, setFunnelLoading] = useState(false)
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

    if (ALLOWED_FUNNEL_PICS.includes(picId)) {
      setFunnelLoading(true)
      fetch(`/api/e2e/funnel-stats?${params.toString()}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (!cancelled && data) setFunnelData(data)
        })
        .catch((err) => console.error("[E2EKPIRibbon] Funnel Error:", err))
        .finally(() => { if (!cancelled) setFunnelLoading(false) })
    } else {
      setFunnelData(null)
    }

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
          <LeadFunnelBreakdown data={funnelData} loading={funnelLoading} onMetricClick={onMetricClick} />
        )}
      </div>
    </TooltipProvider>
  )
}
