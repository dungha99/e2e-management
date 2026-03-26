"use client"

import { useState, useEffect, useMemo } from "react"
import { ChevronDown, ChevronUp, Bell, Clock, CheckCircle, Activity, Car, MapPin, Edit3, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { ViewZaloChatAction } from "../actions/ViewZaloChatAction"
import { FollowUpAction } from "../actions/FollowUpAction"
import { EditLeadDialog } from "../dialogs/EditLeadDialog"
import { formatPriceForEdit } from "../utils"

const QUALIFIED_CONFIG: Record<string, { label: string; className: string }> = {
  STRONG_QUALIFIED: { label: "STRONG", className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  QUALIFIED: { label: "QUALIFIED", className: "text-blue-700 bg-blue-50 border-blue-200" },
  SLOW: { label: "SLOW", className: "text-sky-700 bg-sky-50 border-sky-200" },
  WEAK_QUALIFIED: { label: "WEAK", className: "text-amber-700 bg-amber-50 border-amber-200" },
  WEAK: { label: "WEAK", className: "text-amber-700 bg-amber-50 border-amber-200" },
  NON_QUALIFIED: { label: "NON", className: "text-red-600 bg-red-50 border-red-200" },
  UNDERFINED_QUALIFIED: { label: "UNDEFINED", className: "text-gray-500 bg-gray-50 border-gray-200" },
  UNDEFINED_QUALIFIED: { label: "UNDEFINED", className: "text-gray-500 bg-gray-50 border-gray-200" },
}

interface LeadFunnelBreakdownProps {
  data: any
  loading: boolean
  onMetricClick?: (metric: string) => void
  picId?: string
  dateFrom?: string | null
  dateTo?: string | null
}

export function LeadFunnelBreakdown({ data, loading, onMetricClick, picId, dateFrom, dateTo }: LeadFunnelBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [followUpLeads, setFollowUpLeads] = useState<any[]>([])
  const [metrics, setMetrics] = useState({ totalFollowed: 0, totalNotFollowed: 0 })
  const [loadingFollowUp, setLoadingFollowUp] = useState(false)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>('desc')
  const { toast } = useToast()

  // Edit Lead Dialog State
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedLeadForEdit, setSelectedLeadForEdit] = useState<any>(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit Form Fields
  const [editedPriceCustomer, setEditedPriceCustomer] = useState("")
  const [editedPriceHighestBid, setEditedPriceHighestBid] = useState("")
  const [editedStage, setEditedStage] = useState("")
  const [editedQualified, setEditedQualified] = useState("")
  const [editedIntentionLead, setEditedIntentionLead] = useState("")
  const [editedNegotiationAbility, setEditedNegotiationAbility] = useState("")
  const [editedNotes, setEditedNotes] = useState("")

  const fetchFollowUpLeads = async () => {
    if (!picId) return
    setLoadingFollowUp(true)
    try {
      const params = new URLSearchParams({ pic_id: picId })
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      const res = await fetch(`/api/e2e/funnel-followup-leads?${params.toString()}`)
      const json = await res.json()
      setFollowUpLeads(json.leads || [])
      setMetrics(json.metrics || { totalFollowed: 0, totalNotFollowed: 0 })
    } catch (err) {
      console.error("[FollowUp] Error:", err)
    } finally {
      setLoadingFollowUp(false)
    }
  }

  useEffect(() => {
    if (isExpanded) {
      fetchFollowUpLeads()
    }
  }, [picId, dateFrom, dateTo, isExpanded])

  const handleEditLead = (lead: any) => {
    setSelectedLeadForEdit(lead)
    setEditedStage(lead.stage || "")
    setEditedPriceCustomer(formatPriceForEdit(lead.price_customer))
    setEditedPriceHighestBid(formatPriceForEdit(lead.price_highest_bid))
    setEditedQualified(lead.qualified || "")
    setEditedIntentionLead(lead.intentionLead || "")
    setEditedNegotiationAbility(lead.negotiationAbility || "")
    setEditedNotes(lead.notes || "")
    setEditMode(false)
    setEditDialogOpen(true)
  }

  const handleSaveLead = async () => {
    if (!selectedLeadForEdit) return
    setSaving(true)
    try {
      const res = await fetch("/api/e2e/update-sale-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          car_id: selectedLeadForEdit.car_id,
          stage: editedStage,
          price_customer: editedPriceCustomer,
          price_highest_bid: editedPriceHighestBid,
          qualified: editedQualified,
          intentionLead: editedIntentionLead,
          negotiationAbility: editedNegotiationAbility,
          notes: editedNotes,
        }),
      })

      if (res.ok) {
        toast({ title: "Thành công", description: "Đã cập nhật thông tin lead" })
        setEditDialogOpen(false)
        fetchFollowUpLeads()
      } else {
        toast({ title: "Lỗi", description: "Không thể cập nhật thông tin lead", variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Lỗi", description: "Có lỗi xảy ra", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // Grouping & Sorting Logic
  const groupedLeads = useMemo(() => {
    const groups: Record<string, any[]> = {}
    
    // Group 1: Not Followed
    const notFollowed = followUpLeads.filter(l => !l.followUpSent)
    
    // Apply sorting to notFollowed
    if (sortOrder) {
      notFollowed.sort((a, b) => {
        return sortOrder === 'asc' ? a.daysSince - b.daysSince : b.daysSince - a.daysSince
      })
    }
    
    if (notFollowed.length > 0) groups["Chưa Follow Up"] = notFollowed

    // Group 2: Followed (by date)
    const followed = [...followUpLeads.filter(l => l.followUpSent)]
    followed.sort((a, b) => {
      const dateA = new Date(a.lastFollowUpAt).getTime()
      const dateB = new Date(b.lastFollowUpAt).getTime()
      return dateB - dateA // Always sort groups by date desc
    })
    
    followed.forEach(lead => {
      const date = new Date(lead.lastFollowUpAt).toLocaleDateString("vi-VN")
      if (!groups[date]) groups[date] = []
      groups[date].push(lead)
    })

    // Apply sorting within each followed group
    if (sortOrder) {
      Object.keys(groups).forEach(key => {
        if (key !== "Chưa Follow Up") {
          groups[key].sort((a, b) => {
            return sortOrder === 'asc' ? a.daysSince - b.daysSince : b.daysSince - a.daysSince
          })
        }
      })
    }

    return groups
  }, [followUpLeads, sortOrder])

  const toggleSort = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
  }

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

  const totalLeads = Number(data.totalLeads) || 0;
  const hasImageCount = Number(data.hasImageCount) || 0;
  const noImageCount = Number(data.noImageCount) || 0;
  const zaloSuccessCount = Number(data.zaloSuccessCount) || 0;
  const zaloSuccessAutoCount = Number(data.zaloSuccessAutoCount) || 0;
  const zaloSuccessManualCount = Number(data.zaloSuccessManualCount) || 0;
  const zaloFailedCount = Number(data.zaloFailedCount) || 0;
  const zaloNeverCount = Number(data.zaloNeverCount) || 0;

  const zaloSuccessAutoHot = Number(data.zaloSuccessAutoHot) || 0;
  const zaloSuccessAutoWarn = Number(data.zaloSuccessAutoWarn) || 0;
  const zaloSuccessAutoMedium = Number(data.zaloSuccessAutoMedium) || 0;
  const zaloSuccessAutoFresh = Number(data.zaloSuccessAutoFresh) || 0;
  const zaloSuccessAutoHotRename = Number(data.zaloSuccessAutoHotRename) || 0;
  const zaloSuccessAutoWarnRename = Number(data.zaloSuccessAutoWarnRename) || 0;
  const zaloSuccessAutoMediumRename = Number(data.zaloSuccessAutoMediumRename) || 0;
  const zaloSuccessAutoFreshRename = Number(data.zaloSuccessAutoFreshRename) || 0;

  const zaloSuccessManualHot = Number(data.zaloSuccessManualHot) || 0;
  const zaloSuccessManualWarn = Number(data.zaloSuccessManualWarn) || 0;
  const zaloSuccessManualMedium = Number(data.zaloSuccessManualMedium) || 0;
  const zaloSuccessManualFresh = Number(data.zaloSuccessManualFresh) || 0;
  const zaloSuccessManualHotRename = Number(data.zaloSuccessManualHotRename) || 0;
  const zaloSuccessManualWarnRename = Number(data.zaloSuccessManualWarnRename) || 0;
  const zaloSuccessManualMediumRename = Number(data.zaloSuccessManualMediumRename) || 0;
  const zaloSuccessManualFreshRename = Number(data.zaloSuccessManualFreshRename) || 0;

  const zaloNeverSaleOnly = Number(data.zaloNeverSaleOnly) || 0;
  const zaloNeverNoInteraction = Number(data.zaloNeverNoInteraction) || 0;
  const zaloNeverRenameSuccess = Number(data.zaloNeverRenameSuccess) || 0;
  const zaloNeverRenameFailed = Number(data.zaloNeverRenameFailed) || 0;
  const zaloNeverRenameNone = Number(data.zaloNeverRenameNone) || 0;
  const zaloNeverRenameReserve = Number(data.zaloNeverRenameReserve) || 0;
  const maxDaysWaitingReply = Number(data.maxDaysWaitingReply) || 0;
  const maxDaysSinceActivity = Number(data.maxDaysSinceActivity) || 0;
  const zaloBlockedCount = Number(data.zaloBlockedCount) || 0;
  const zaloSystemErrorCount = Number(data.zaloSystemErrorCount) || 0;

  const pctHasImage = totalLeads ? ((hasImageCount / totalLeads) * 100).toFixed(1) : "0.0";
  const pctNoImage = totalLeads ? ((noImageCount / totalLeads) * 100).toFixed(1) : "0.0";
  const pctZaloSuccess = noImageCount ? ((zaloSuccessCount / noImageCount) * 100).toFixed(1) : "0.0";
  const pctZaloAuto = noImageCount ? ((zaloSuccessAutoCount / noImageCount) * 100).toFixed(1) : "0.0";
  const pctZaloManual = noImageCount ? ((zaloSuccessManualCount / noImageCount) * 100).toFixed(1) : "0.0";
  const pctZaloFailed = noImageCount ? ((zaloFailedCount / noImageCount) * 100).toFixed(1) : "0.0";
  const pctZaloNever = noImageCount ? ((zaloNeverCount / noImageCount) * 100).toFixed(1) : "0.0";

  const safePct = (val: string) => (val === "NaN" || isNaN(parseFloat(val))) ? "0.0" : val;

  const sPctHasImage = safePct(pctHasImage);
  const sPctNoImage = safePct(pctNoImage);
  const sPctZaloSuccess = safePct(pctZaloSuccess);
  const sPctZaloAuto = safePct(pctZaloAuto);
  const sPctZaloManual = safePct(pctZaloManual);
  const sPctZaloFailed = safePct(pctZaloFailed);
  const sPctZaloNever = safePct(pctZaloNever);

  return (
    <>
      <div className="w-full mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-sm font-bold text-gray-800 mb-2 border-b pb-2 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>Phân tích Lead Funnel (Tổng quan)</span>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {isExpanded && (
        <Tabs defaultValue="v2" className="w-full">
          <div className="flex justify-center mb-6">
            <TabsList className="bg-gray-100 p-1 h-10 rounded-xl">
              <TabsTrigger value="v1" className="px-8 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all text-gray-500 font-bold">
                Version 1
              </TabsTrigger>
              <TabsTrigger value="v2" className="px-8 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all text-gray-500 font-bold flex items-center gap-2">
                Version 2
                <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">New</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <style dangerouslySetInnerHTML={{
            __html: `
          .tree-line-v {position: absolute; top: 100%; left: 50%; width: 2px; height: 24px; background-color: #e5e7eb; transform: translateX(-50%); }
          `}} />

          {/* VERSION 1: SIMPLIFIED VIEW */}
          <TabsContent value="v1">
            <div className="flex flex-col items-center w-full max-w-4xl relative mt-4 mx-auto pb-8">
              {/* Tier 1 */}
              <div className="relative flex flex-col items-center mb-6">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => onMetricClick?.("FUNNEL_TOTAL_LEADS")} className="bg-gray-50 border border-gray-200 rounded-lg px-6 py-2 min-w-[180px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform translate-y-2">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">1. Nhận lead</div>
                      <div className="text-xl font-black text-gray-700">{totalLeads}</div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Tổng số lead được phân bổ</TooltipContent>
                </Tooltip>
                <div className="tree-line-v mt-2"></div>
              </div>

              {/* Tier 2 */}
              <div className="relative flex justify-center gap-12 mb-6 w-full pt-8">
                <div className="absolute top-0 left-1/2 w-1/2 max-w-[240px] h-[2px] bg-gray-200 -translate-x-1/2"></div>
                
                <div className="relative flex flex-col items-center">
                  <div className="absolute top-0 left-1/2 w-[2px] h-8 bg-gray-200 -translate-x-1/2 -mt-8"></div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => onMetricClick?.("FUNNEL_HAS_IMAGE")} className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2 min-w-[160px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform">
                        <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">2a. Đã có hình</div>
                        <div className="text-lg font-black text-emerald-700">{hasImageCount} <span className="text-xs font-medium opacity-60">({sPctHasImage}%)</span></div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Strong Qualified</TooltipContent>
                  </Tooltip>
                </div>

                <div className="relative flex flex-col items-center">
                  <div className="absolute top-0 left-1/2 w-[2px] h-8 bg-gray-200 -translate-x-1/2 -mt-8"></div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => onMetricClick?.("FUNNEL_NO_IMAGE")} className="bg-orange-50 border border-orange-100 rounded-lg px-4 py-2 min-w-[160px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform">
                        <div className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-1">2b. Chưa có hình</div>
                        <div className="text-lg font-black text-orange-700">{noImageCount} <span className="text-xs font-medium opacity-60">({sPctNoImage}%)</span></div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Chưa đạt Strong Qualified</TooltipContent>
                  </Tooltip>
                  <div className="tree-line-v mt-0"></div>
                </div>
              </div>

              {/* Tier 3 */}
              <div className="relative flex justify-end gap-4 mb-6 w-full pt-8 pr-[1.5%]">
                <div className="absolute top-0 right-[15%] w-[45%] h-[2px] bg-gray-200"></div>

                <div className="relative flex flex-col items-center">
                  <div className="absolute top-0 left-1/2 w-[2px] h-8 bg-gray-200 -translate-x-1/2 -mt-8"></div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => onMetricClick?.("FUNNEL_FIRST_MESSAGE_SUCCESS")} className="bg-blue-50 border border-blue-100 rounded-lg px-2 py-3 min-w-[130px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform">
                        <div className="text-[9px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">3a. Success</div>
                        <div className="text-base font-black text-blue-700">{zaloSuccessCount} <span className="text-[10px] font-medium opacity-60">({sPctZaloSuccess}%)</span></div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Gửi Zalo thành công</TooltipContent>
                  </Tooltip>
                </div>

                <div className="relative flex flex-col items-center">
                  <div className="absolute top-0 left-1/2 w-[2px] h-8 bg-gray-200 -translate-x-1/2 -mt-8"></div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => onMetricClick?.("FUNNEL_FIRST_MESSAGE_FAILED")} className="bg-red-50 border border-red-100 rounded-lg px-2 py-3 min-w-[130px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform">
                        <div className="text-[9px] font-bold text-red-600 uppercase tracking-wider mb-0.5">3b. Failed</div>
                        <div className="text-base font-black text-red-700">{zaloFailedCount} <span className="text-[10px] font-medium opacity-60">({sPctZaloFailed}%)</span></div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Lỗi gửi tin nhắn</TooltipContent>
                  </Tooltip>
                </div>

                <div className="relative flex flex-col items-center">
                  <div className="absolute top-0 left-1/2 w-[2px] h-8 bg-gray-200 -translate-x-1/2 -mt-8"></div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => onMetricClick?.("FUNNEL_NEVER_FIRST_MESSAGE")} className="bg-gray-100 border border-gray-200 rounded-lg px-2 py-3 min-w-[130px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform">
                        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">3c. Chưa gửi</div>
                        <div className="text-base font-black text-gray-600">{zaloNeverCount} <span className="text-[10px] font-medium opacity-60">({sPctZaloNever}%)</span></div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Chưa có tương tác Zalo</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* VERSION 2: DETAILED VIEW */}
          <TabsContent value="v2">
            <div className="flex flex-col items-center w-full max-w-4xl relative mt-4 mx-auto pb-12">
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
                <div className="relative flex flex-col items-center">
                  <div className="absolute top-0 left-1/2 w-[2px] h-6 bg-gray-200 -translate-x-1/2 -mt-6"></div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onMetricClick?.("FUNNEL_HAS_IMAGE")}
                        className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 min-w-[160px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform cursor-pointer"
                      >
                        <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">2a. Đã có hình</div>
                        <div className="text-lg font-black text-emerald-700">{hasImageCount} <span className="text-xs font-medium opacity-70">({sPctHasImage}%)</span></div>
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
                <div className="relative flex flex-col items-center">
                  <div className="absolute top-0 left-1/2 w-[2px] h-6 bg-gray-200 -translate-x-1/2 -mt-6"></div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onMetricClick?.("FUNNEL_NO_IMAGE")}
                        className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 min-w-[160px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform cursor-pointer"
                      >
                        <div className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-1">2b. Chưa có hình</div>
                        <div className="text-lg font-black text-orange-700">{noImageCount} <span className="text-xs font-medium opacity-70">({sPctNoImage}%)</span></div>
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
                  
                  {/* 3a. Success (Parent) */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onMetricClick?.("FUNNEL_FIRST_MESSAGE_SUCCESS")}
                        className="bg-blue-600 border border-blue-700 rounded-lg px-2 py-2 min-w-[130px] text-center shadow-md relative z-10 hover:scale-105 transition-transform cursor-pointer"
                      >
                        <div className="text-[9px] font-bold text-white uppercase tracking-wider mb-0.5">3a. 1st success</div>
                        <div className="text-base font-black text-white">{zaloSuccessCount} <span className="text-[10px] font-medium opacity-80">({sPctZaloSuccess}%)</span></div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Thành công (Auto + Manual)</TooltipContent>
                  </Tooltip>
                  <div className="tree-line-v !h-5 !bg-gray-300"></div>

                  <div className="relative flex items-start gap-4 pt-5 mt-0.5">
                    {/* Horizontal link line */}
                    <div className="absolute top-0 left-1/2 w-[calc(100%-140px)] h-[2px] bg-gray-300 -translate-x-1/2"></div>
                    
                    {/* 3a-I: Automation */}
                    <div className="flex flex-col items-center">
                      <div className="absolute top-0 left-1/2 w-[2px] h-5 bg-gray-300 -translate-x-1/2 -mt-5"></div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onMetricClick?.("FUNNEL_FIRST_MESSAGE_SUCCESS_AUTO")}
                            className="bg-blue-50 border border-blue-200 rounded-lg px-2 py-2 min-w-[130px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform cursor-pointer"
                          >
                            <div className="text-[9px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">3a-I. Automation</div>
                            <div className="text-base font-black text-blue-700">{zaloSuccessAutoCount} <span className="text-[10px] font-medium opacity-70">({sPctZaloAuto}%)</span></div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Thành công qua Automation</TooltipContent>
                      </Tooltip>
                      <div className="flex flex-col gap-1 mt-2 w-full">
                        <div className="flex gap-1 justify-center">
                          <button onClick={(e) => { e.stopPropagation(); onMetricClick?.("FUNNEL_FIRST_MESSAGE_SUCCESS_AUTO_HOT"); }} className="bg-red-50 border border-red-100 hover:bg-red-100 rounded px-1.5 py-1 flex-1 transition-colors group relative" title="Rất lâu (>7 ngày)">
                            <div className="text-[7px] font-bold text-red-500 uppercase tracking-tighter group-hover:text-red-700">&gt;7d</div>
                            <div className="text-[10px] font-black text-red-700">{zaloSuccessAutoHot ?? 0}</div>
                            {zaloSuccessAutoHotRename > 0 && (
                              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[7px] min-w-[12px] h-3 px-0.5 rounded-full flex items-center justify-center font-bold border border-white hover:bg-emerald-600 transition-colors">
                                {zaloSuccessAutoHotRename}
                              </div>
                            )}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onMetricClick?.("FUNNEL_FIRST_MESSAGE_SUCCESS_AUTO_WARN"); }} className="bg-orange-50 border border-orange-100 hover:bg-orange-100 rounded px-1.5 py-1 flex-1 transition-colors group relative" title="Lâu (4-7 ngày)">
                            <div className="text-[7px] font-bold text-orange-500 uppercase tracking-tighter group-hover:text-orange-700">4-7d</div>
                            <div className="text-[10px] font-black text-orange-700">{zaloSuccessAutoWarn ?? 0}</div>
                            {zaloSuccessAutoWarnRename > 0 && (
                              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[7px] min-w-[12px] h-3 px-0.5 rounded-full flex items-center justify-center font-bold border border-white hover:bg-emerald-600 transition-colors">
                                {zaloSuccessAutoWarnRename}
                              </div>
                            )}
                          </button>
                        </div>
                        <div className="flex gap-1 justify-center">
                          <button onClick={(e) => { e.stopPropagation(); onMetricClick?.("FUNNEL_FIRST_MESSAGE_SUCCESS_AUTO_MEDIUM"); }} className="bg-amber-50 border border-amber-100 hover:bg-amber-100 rounded px-1.5 py-1 flex-1 transition-colors group relative" title="Trung bình (2-4 ngày)">
                            <div className="text-[7px] font-bold text-amber-500 uppercase tracking-tighter group-hover:text-amber-700">2-4d</div>
                            <div className="text-[10px] font-black text-amber-700">{zaloSuccessAutoMedium ?? 0}</div>
                            {zaloSuccessAutoMediumRename > 0 && (
                              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[7px] min-w-[12px] h-3 px-0.5 rounded-full flex items-center justify-center font-bold border border-white hover:bg-emerald-600 transition-colors">
                                {zaloSuccessAutoMediumRename}
                              </div>
                            )}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onMetricClick?.("FUNNEL_FIRST_MESSAGE_SUCCESS_AUTO_FRESH"); }} className="bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded px-1.5 py-1 flex-1 transition-colors group relative" title="Mới (0-2 ngày)">
                            <div className="text-[7px] font-bold text-blue-500 uppercase tracking-tighter group-hover:text-blue-700">0-2d</div>
                            <div className="text-[10px] font-black text-blue-700">{zaloSuccessAutoFresh ?? 0}</div>
                            {zaloSuccessAutoFreshRename > 0 && (
                              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[7px] min-w-[12px] h-3 px-0.5 rounded-full flex items-center justify-center font-bold border border-white hover:bg-emerald-600 transition-colors">
                                {zaloSuccessAutoFreshRename}
                              </div>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 3a-II: Manual */}
                    <div className="flex flex-col items-center">
                      <div className="absolute top-0 left-1/2 w-[2px] h-5 bg-gray-300 -translate-x-1/2 -mt-5"></div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onMetricClick?.("FUNNEL_FIRST_MESSAGE_SUCCESS_MANUAL")}
                            className="bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-2 min-w-[130px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform cursor-pointer"
                          >
                            <div className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider mb-0.5">3a-II. Manual</div>
                            <div className="text-base font-black text-indigo-700">{zaloSuccessManualCount} <span className="text-[10px] font-medium opacity-70">({sPctZaloManual}%)</span></div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Thành công qua Manual/Sale</TooltipContent>
                      </Tooltip>
                      <div className="flex flex-col gap-1 mt-2 w-full">
                        <div className="flex gap-1 justify-center">
                          <button onClick={(e) => { e.stopPropagation(); onMetricClick?.("FUNNEL_FIRST_MESSAGE_SUCCESS_MANUAL_HOT"); }} className="bg-red-50 border border-red-100 hover:bg-red-100 rounded px-1.5 py-1 flex-1 transition-colors group relative" title="Rất lâu (>7 ngày)">
                            <div className="text-[7px] font-bold text-red-500 uppercase tracking-tighter group-hover:text-red-700">&gt;7d</div>
                            <div className="text-[10px] font-black text-red-700">{zaloSuccessManualHot ?? 0}</div>
                            {zaloSuccessManualHotRename > 0 && (
                              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[7px] min-w-[12px] h-3 px-0.5 rounded-full flex items-center justify-center font-bold border border-white hover:bg-emerald-600 transition-colors">
                                {zaloSuccessManualHotRename}
                              </div>
                            )}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onMetricClick?.("FUNNEL_FIRST_MESSAGE_SUCCESS_MANUAL_WARN"); }} className="bg-orange-50 border border-orange-100 hover:bg-orange-100 rounded px-1.5 py-1 flex-1 transition-colors group relative" title="Lâu (4-7 ngày)">
                            <div className="text-[7px] font-bold text-orange-500 uppercase tracking-tighter group-hover:text-orange-700">4-7d</div>
                            <div className="text-[10px] font-black text-orange-700">{zaloSuccessManualWarn ?? 0}</div>
                            {zaloSuccessManualWarnRename > 0 && (
                              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[7px] min-w-[12px] h-3 px-0.5 rounded-full flex items-center justify-center font-bold border border-white hover:bg-emerald-600 transition-colors">
                                {zaloSuccessManualWarnRename}
                              </div>
                            )}
                          </button>
                        </div>
                        <div className="flex gap-1 justify-center">
                          <button onClick={(e) => { e.stopPropagation(); onMetricClick?.("FUNNEL_FIRST_MESSAGE_SUCCESS_MANUAL_MEDIUM"); }} className="bg-amber-50 border border-amber-100 hover:bg-amber-100 rounded px-1.5 py-1 flex-1 transition-colors group relative" title="Trung bình (2-4 ngày)">
                            <div className="text-[7px] font-bold text-amber-500 uppercase tracking-tighter group-hover:text-amber-700">2-4d</div>
                            <div className="text-[10px] font-black text-amber-700">{zaloSuccessManualMedium ?? 0}</div>
                            {zaloSuccessManualMediumRename > 0 && (
                              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[7px] min-w-[12px] h-3 px-0.5 rounded-full flex items-center justify-center font-bold border border-white hover:bg-emerald-600 transition-colors">
                                {zaloSuccessManualMediumRename}
                              </div>
                            )}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onMetricClick?.("FUNNEL_FIRST_MESSAGE_SUCCESS_MANUAL_FRESH"); }} className="bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded px-1.5 py-1 flex-1 transition-colors group relative" title="Mới (0-2 ngày)">
                            <div className="text-[7px] font-bold text-blue-500 uppercase tracking-tighter group-hover:text-blue-700">0-2d</div>
                            <div className="text-[10px] font-black text-blue-700">{zaloSuccessManualFresh ?? 0}</div>
                            {zaloSuccessManualFreshRename > 0 && (
                              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[7px] min-w-[12px] h-3 px-0.5 rounded-full flex items-center justify-center font-bold border border-white hover:bg-emerald-600 transition-colors">
                                {zaloSuccessManualFreshRename}
                              </div>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative flex flex-col items-center">
                  <div className="absolute top-0 left-1/2 w-[2px] h-6 bg-gray-200 -translate-x-1/2 -mt-6"></div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onMetricClick?.("FUNNEL_FIRST_MESSAGE_FAILED")}
                        className="bg-red-50 border border-red-200 rounded-lg px-2 py-2 min-w-[130px] text-center shadow-sm relative z-10 hover:scale-105 transition-transform cursor-pointer"
                      >
                        <div className="text-[9px] font-bold text-red-600 uppercase tracking-wider mb-0.5">3b. Failed</div>
                        <div className="text-base font-black text-red-700">{zaloFailedCount} <span className="text-[10px] font-medium opacity-70">({sPctZaloFailed}%)</span></div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px] space-y-1">
                      <p className="font-semibold text-sm">firstMessage failed</p>
                      <p className="text-xs text-gray-500">Gửi nhưng lỗi hệ thống hoặc bị chặn.</p>
                      <div className="bg-gray-50 rounded p-1 mt-1 border text-[10px] font-mono text-gray-600">
                        z.has_failed = 1 AND has_success = 0
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
                        <div className="text-[9px] font-bold text-gray-600 uppercase tracking-wider mb-0.5">3c. Chưa gửi</div>
                        <div className="text-base font-black text-gray-700">{zaloNeverCount} <span className="text-[10px] font-medium opacity-70">({pctZaloNever}%)</span></div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px] space-y-1">
                      <p className="font-semibold text-sm">Chưa gửi firstMessage</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="flex flex-col gap-1 mt-2 w-full">
                    <button onClick={(e) => { e.stopPropagation(); onMetricClick?.("FUNNEL_NEVER_FIRST_MESSAGE_SALE_ONLY"); }} className="bg-amber-50 border border-amber-100 hover:bg-amber-100 rounded px-1.5 py-1 flex justify-between items-center transition-colors group" title="Sale đã nhắn, đang chờ khách phản hồi">
                      <div className="flex flex-col items-start translate-y-[1px]">
                        <div className="text-[7px] font-bold text-amber-500 uppercase tracking-tighter group-hover:text-amber-700">3c-iii. Sale nhắn</div>
                        {maxDaysWaitingReply > 0 && <div className="text-[6px] text-amber-400 font-medium">{maxDaysWaitingReply}d</div>}
                      </div>
                      <div className="text-[10px] font-black text-amber-700">{zaloNeverSaleOnly ?? 0}</div>
                    </button>
                    <div className="bg-gray-50/50 border border-gray-100 rounded-lg p-1.5 flex flex-col gap-1.5">
                      <button onClick={(e) => { e.stopPropagation(); onMetricClick?.("FUNNEL_NEVER_FIRST_MESSAGE_NO_INTERACTION"); }} className="flex justify-between items-center group px-1" title="Chưa có bất kỳ tương tác nào">
                        <div className="flex flex-col items-start text-left">
                          <div className="text-[7px] font-bold text-gray-500 uppercase tracking-tighter group-hover:text-gray-700">3c-iv. Trắng</div>
                          {maxDaysSinceActivity > 0 && <div className="text-[6px] text-gray-400 font-medium tracking-tight">Act: {maxDaysSinceActivity}d</div>}
                        </div>
                        <div className="text-[10px] font-black text-gray-700">{zaloNeverNoInteraction ?? 0}</div>
                      </button>
                      <div className="grid grid-cols-2 gap-1">
                        <button onClick={(e) => { e.stopPropagation(); onMetricClick?.("FUNNEL_RENAME_SUCCESS"); }} className="bg-white border border-emerald-100 hover:bg-emerald-50 rounded px-1 py-1 flex flex-col items-center justify-center transition-colors group" title="Đã đổi tên thành công">
                          <div className="text-[7px] font-bold text-emerald-500 uppercase group-hover:text-emerald-700">Đã đổi tên</div>
                          <div className="text-[10px] font-black text-emerald-700">{zaloNeverRenameSuccess ?? 0}</div>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onMetricClick?.("FUNNEL_RENAME_RESERVE"); }} className="bg-white border border-gray-100 hover:bg-gray-100 rounded px-1 py-1 flex flex-col items-center justify-center transition-colors group" title="Các lead còn lại">
                          <div className="text-[7px] font-bold text-gray-400 uppercase group-hover:text-gray-600">Còn lại</div>
                          <div className="text-[10px] font-black text-gray-600">{zaloNeverRenameReserve}</div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tier 4 */}
              <div className="relative flex justify-end gap-3 w-full pt-6 pr-[12%]">
                <div className="absolute top-0 right-[15%] w-[18%] h-[2px] bg-red-100"></div>
                <div className="relative flex flex-col items-center">
                  <div className="absolute top-0 left-1/2 w-[2px] h-6 bg-red-100 -translate-x-1/2 -mt-6"></div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => onMetricClick?.("FUNNEL_BLOCKED_MESSAGE")} className="bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5 min-w-[110px] text-center relative z-10 hover:scale-105 transition-transform cursor-pointer">
                        <div className="text-[9px] font-bold text-rose-500 uppercase tracking-wider mb-0.5">Lỗi: Chặn TN</div>
                        <div className="text-sm font-black text-rose-600">{zaloBlockedCount || 0}</div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Khách chặn người lạ</TooltipContent>
                  </Tooltip>
                </div>
                <div className="relative flex flex-col items-center">
                  <div className="absolute top-0 left-1/2 w-[2px] h-6 bg-red-100 -translate-x-1/2 -mt-6"></div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => onMetricClick?.("FUNNEL_SYSTEM_ERROR")} className="bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5 min-w-[110px] text-center relative z-10 hover:scale-105 transition-transform cursor-pointer">
                        <div className="text-[9px] font-bold text-rose-500 uppercase tracking-wider mb-0.5">Lỗi: No UID/HT</div>
                        <div className="text-sm font-black text-rose-600">{zaloSystemErrorCount || 0}</div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Lỗi kết nối / No UID</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>

    {isExpanded && (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 mt-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 leading-none">Follow up để xin hình ảnh</h3>
              <p className="text-xs text-gray-400 font-medium mt-1">Leads 3A & 3C cần được follow up sau 1 ngày stall</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-gray-50/80 p-1.5 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none mb-1">Đã Followed</span>
                <span className="text-sm font-black text-emerald-600 leading-none">{metrics.totalFollowed}</span>
              </div>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none mb-1">Chưa Followed</span>
                <span className="text-sm font-black text-orange-500 leading-none">{metrics.totalNotFollowed}</span>
              </div>
              <Activity className="w-4 h-4 text-orange-400" />
            </div>
          </div>
        </div>

        <Tabs defaultValue="not-followed" className="w-full">
          <TabsList className="bg-gray-100/80 p-1 rounded-xl h-11 border border-gray-200/50">
            <TabsTrigger 
              value="not-followed" 
              className="rounded-lg px-6 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                Chưa Follow Up
                <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-md text-[10px] font-black">{metrics.totalNotFollowed}</span>
              </div>
            </TabsTrigger>
            <TabsTrigger 
              value="followed" 
              className="rounded-lg px-6 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5" />
                Đã Follow Up
                <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-md text-[10px] font-black">{metrics.totalFollowed}</span>
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="not-followed" className="mt-4 outline-none">
            {loadingFollowUp ? (
              <div className="py-20 flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm text-gray-400 font-medium">Đang tải danh sách...</p>
              </div>
            ) : !groupedLeads["Chưa Follow Up"] ? (
              <div className="py-20 flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200 grayscale opacity-60">
                <Bell className="h-12 w-12 text-gray-300 mb-4" />
                <p className="text-sm text-gray-400 font-medium italic">Không có lead nào cần follow up</p>
              </div>
            ) : (
              <div className="border rounded-2xl overflow-hidden shadow-sm border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/80 border-b">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 border-b-2 border-transparent">Khách hàng & Xe</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 border-b-2 border-transparent uppercase tracking-wider">Phân loại</th>
                      <th 
                        className="text-left px-4 py-2.5 text-[10px] font-bold text-blue-600 border-b-2 border-blue-200 uppercase tracking-wider cursor-pointer hover:bg-blue-50 transition-colors"
                        onClick={toggleSort}
                      >
                        <div className="flex items-center gap-1">
                          Hoạt động
                          {sortOrder === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : sortOrder === 'desc' ? <ArrowDown className="w-2.5 h-2.5" /> : <ArrowUpDown className="w-2.5 h-2.5" />}
                        </div>
                      </th>
                      <th className="text-center px-4 py-2.5 text-[10px] font-bold text-gray-400 border-b-2 border-transparent uppercase tracking-wider">Status</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {groupedLeads["Chưa Follow Up"].map((lead) => (
                      <tr key={lead.car_id} className="group hover:bg-blue-50/40 transition-all duration-200">
                        <td className="px-4 py-3 align-top min-w-[240px]">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-gray-900 leading-none">{lead.phone}</span>
                              <span className="text-[10px] text-gray-400 font-medium truncate max-w-[100px]">— {lead.name}</span>
                              {lead.qualified && (
                                <span className={`text-[8px] font-black px-1 py-0.5 rounded border uppercase tracking-tighter ${
                                  QUALIFIED_CONFIG[lead.qualified]?.className || "text-gray-500 bg-gray-50 border-gray-200"
                                }`}>
                                  {QUALIFIED_CONFIG[lead.qualified]?.label || lead.qualified}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-gray-500 font-medium bg-gray-50 w-fit px-2 py-0.5 rounded border border-gray-100 shadow-sm">
                              <span className="flex items-center gap-1"><Car className="w-2.5 h-2.5" /> {lead.brand} {lead.model} {lead.year}</span>
                              <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {lead.location}</span>
                              <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {lead.mileage?.toLocaleString()} km</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black border tracking-tight ${
                            lead.is3A ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                          }`}>
                            {lead.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top font-black text-gray-700 text-xs">
                          {lead.daysSince} ngày
                        </td>
                        <td className="px-4 py-3 align-top text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black bg-gray-100 text-gray-400 border border-gray-200 italic">
                            Not Sent
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <ViewZaloChatAction carId={lead.car_id} customerName={lead.name} iconOnly />
                                </TooltipTrigger>
                                <TooltipContent><p className="text-[10px]">Xem chat Zalo</p></TooltipContent>
                              </Tooltip>

                              <FollowUpAction 
                                lead={{
                                  ...lead,
                                  id: lead.id,
                                  phone: lead.phone
                                } as any} 
                                isSidebarVariant 
                                className="scale-90"
                                onSuccess={fetchFollowUpLeads}
                              />

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button 
                                    onClick={() => handleEditLead(lead)}
                                    className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-lg text-gray-400 transition-all border border-transparent hover:border-indigo-100 hover:shadow-sm"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-[10px]">Chỉnh sửa lead</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="followed" className="mt-4 outline-none">
            {loadingFollowUp ? (
              <div className="py-20 flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm text-gray-400 font-medium">Đang tải danh sách...</p>
              </div>
            ) : Object.keys(groupedLeads).filter(k => k !== "Chưa Follow Up").length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200 grayscale opacity-60">
                <Bell className="h-12 w-12 text-gray-300 mb-4" />
                <p className="text-sm text-gray-400 font-medium italic">Chưa có lead nào được follow up</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedLeads).filter(([k]) => k !== "Chưa Follow Up").map(([date, leads]) => (
                  <div key={date} className="space-y-3">
                    <div className="flex items-center gap-2 px-2">
                       <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle className="w-3 h-3" /> Đã gửi ngày {date}
                      </h4>
                      <div className="h-px flex-1 bg-gradient-to-r from-emerald-100 to-transparent"></div>
                    </div>
                    <div className="border rounded-2xl overflow-hidden shadow-sm border-gray-100">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50/80 border-b">
                          <tr>
                            <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 border-b-2 border-transparent">Khách hàng & Xe</th>
                            <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 border-b-2 border-transparent uppercase tracking-wider">Phân loại</th>
                            <th 
                              className="text-left px-4 py-2.5 text-[10px] font-bold text-blue-600 border-b-2 border-blue-200 uppercase tracking-wider cursor-pointer hover:bg-blue-50 transition-colors"
                              onClick={toggleSort}
                            >
                              <div className="flex items-center gap-1">
                                Hoạt động
                                {sortOrder === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : sortOrder === 'desc' ? <ArrowDown className="w-2.5 h-2.5" /> : <ArrowUpDown className="w-2.5 h-2.5" />}
                              </div>
                            </th>
                            <th className="text-center px-4 py-2.5 text-[10px] font-bold text-gray-400 border-b-2 border-transparent uppercase tracking-wider">Status</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {leads.map((lead) => (
                            <tr key={lead.car_id} className="group hover:bg-emerald-50/40 transition-all duration-200">
                              <td className="px-4 py-3 align-top min-w-[240px]">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-gray-900 leading-none">{lead.phone}</span>
                                    <span className="text-[10px] text-gray-400 font-medium truncate max-w-[100px]">— {lead.name}</span>
                                    {lead.qualified && (
                                      <span className={`text-[8px] font-black px-1 py-0.5 rounded border uppercase tracking-tighter ${
                                        QUALIFIED_CONFIG[lead.qualified]?.className || "text-gray-500 bg-gray-50 border-gray-200"
                                      }`}>
                                        {QUALIFIED_CONFIG[lead.qualified]?.label || lead.qualified}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] text-gray-500 font-medium bg-gray-50 w-fit px-2 py-0.5 rounded border border-gray-100 shadow-sm">
                                    <span className="flex items-center gap-1"><Car className="w-2.5 h-2.5" /> {lead.brand} {lead.model} {lead.year}</span>
                                    <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {lead.location}</span>
                                    <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {lead.mileage?.toLocaleString()} km</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 align-top">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black border tracking-tight ${
                                  lead.is3A ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                                }`}>
                                  {lead.category}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-top font-black text-gray-700 text-xs">
                                {lead.daysSince} ngày
                              </td>
                              <td className="px-4 py-3 align-top text-center">
                                <div className="flex flex-col items-center">
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                    <CheckCircle className="w-2 h-2" /> Followed
                                  </span>
                                  <span className="text-[8px] text-gray-400 mt-0.5">{new Date(lead.lastFollowUpAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 align-top text-right">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <ViewZaloChatAction carId={lead.car_id} customerName={lead.name} iconOnly />
                                      </TooltipTrigger>
                                      <TooltipContent side="top" align="center"><p className="text-[10px]">Xem chat Zalo</p></TooltipContent>
                                    </Tooltip>

                                    <FollowUpAction 
                                      lead={{
                                        ...lead,
                                        id: lead.id,
                                        phone: lead.phone
                                      } as any} 
                                      isSidebarVariant 
                                      className="scale-90"
                                      onSuccess={fetchFollowUpLeads}
                                    />

                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button 
                                          onClick={() => handleEditLead(lead)}
                                          className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-lg text-gray-400 transition-all border border-transparent hover:border-indigo-100 hover:shadow-sm"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent><p className="text-[10px]">Chỉnh sửa lead</p></TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Shared Dialogs */}
        <EditLeadDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          lead={selectedLeadForEdit}
          editMode={editMode}
          setEditMode={setEditMode}
          editedPriceCustomer={editedPriceCustomer}
          setEditedPriceCustomer={setEditedPriceCustomer}
          editedPriceHighestBid={editedPriceHighestBid}
          setEditedPriceHighestBid={setEditedPriceHighestBid}
          editedStage={editedStage}
          setEditedStage={setEditedStage}
          editedQualified={editedQualified}
          setEditedQualified={setEditedQualified}
          editedIntentionLead={editedIntentionLead}
          setEditedIntentionLead={setEditedIntentionLead}
          editedNegotiationAbility={editedNegotiationAbility}
          setEditedNegotiationAbility={setEditedNegotiationAbility}
          editedNotes={editedNotes}
          setEditedNotes={setEditedNotes}
          processedImages={[]} 
          onSave={handleSaveLead}
          saving={saving}
          getStageStyle={() => ""} 
        />
      </div>
    )}
  </>
)
}
