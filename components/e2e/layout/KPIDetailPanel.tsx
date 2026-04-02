"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { X, Loader2, Phone, Copy, ExternalLink, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { RenameLeadAction } from "@/components/e2e/actions/RenameLeadAction"
import { SendFirstMessageAction } from "@/components/e2e/actions/SendFirstMessageAction"
import { ViewZaloChatAction } from "@/components/e2e/actions/ViewZaloChatAction"
import { FollowUpAction } from "@/components/e2e/actions/FollowUpAction"
import { EditLeadDialog } from "@/components/e2e/dialogs/EditLeadDialog"
import { formatPriceForEdit, parseShorthandPrice } from "@/components/e2e/utils"
import { Bell, ShieldCheck, Edit3 } from "lucide-react"


const QUALIFIED_CONFIG: Record<string, { label: string; className: string }> = {
  STRONG_QUALIFIED: { label: "STRONG", className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  QUALIFIED: { label: "QUALIFIED", className: "text-blue-700 bg-blue-50 border-blue-200" },
  SLOW: { label: "SLOW", className: "text-sky-700 bg-sky-50 border-sky-200" },
  WEAK_QUALIFIED: { label: "WEAK", className: "text-amber-700 bg-amber-50 border-amber-200" },
  WEAK: { label: "WEAK", className: "text-amber-700 bg-amber-50 border-amber-200" },
  NON_QUALIFIED: { label: "NON", className: "text-red-600 bg-red-50 border-red-200" },
  UNDEFINED_QUALIFIED: { label: "UNDEFINED", className: "text-gray-500 bg-gray-50 border-gray-200" },
}

// ── Metric display config ──────────────────────────────────────────────────
const METRIC_CONFIG: Record<string, { title: string; color: string }> = {
  UNDEFINED_QUALIFIED: { title: "Undefined Leads", color: "text-gray-600" },
  NO_ZALO_ACTION: { title: "Chưa Zalo", color: "text-red-600" },
  BLOCKED_STRANGER: { title: "Chặn tin nhắn người lạ", color: "text-red-600" },
  DECLINED_MESSAGES: { title: "Từ chối nhận tin", color: "text-orange-600" },
  NO_UID_FOUND: { title: "Không tìm thấy Zalo", color: "text-amber-700" },
  CONTACT_NOT_FOUND: { title: "Không tìm thấy contact", color: "text-purple-600" },
  TIMEOUT: { title: "Hết thời gian chờ", color: "text-sky-600" },
  SEARCH_FAILED: { title: "Lỗi tìm kiếm", color: "text-indigo-600" },
  OTHER: { title: "Lỗi khác", color: "text-gray-600" },

  // Funnel mapped categories (v2)
  FUNNEL_TOTAL_LEADS: { title: "1. Nhận lead", color: "text-gray-800" },
  FUNNEL_HAS_IMAGE: { title: "2a. Đã có hình", color: "text-emerald-700" },
  FUNNEL_HAS_IMAGE_WITH_ADDITIONAL: { title: "2a-I. Có ảnh bổ sung", color: "text-emerald-700" },
  FUNNEL_HAS_IMAGE_WITHOUT_ADDITIONAL: { title: "2a-II. Chưa có ảnh bổ sung", color: "text-amber-700" },
  FUNNEL_NO_IMAGE: { title: "2b. Chưa có hình", color: "text-orange-700" },
  FUNNEL_NO_IMAGE_HAD_IMAGE: { title: "2b-I. Đã gửi ảnh qua chat", color: "text-orange-700" },
  FUNNEL_NO_IMAGE_NO_HAD_IMAGE: { title: "2b-II. Chưa gửi ảnh", color: "text-red-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS: { title: "3a. FM success (Auto+Manual)", color: "text-blue-700" },
  
  // 3a-I: Automation
  FUNNEL_FIRST_MESSAGE_SUCCESS_AUTO: { title: "3a-I. FM Automation Success", color: "text-blue-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_AUTO_HOT: { title: "3a-I. >7 ngày (Rất lâu)", color: "text-red-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_AUTO_WARN: { title: "3a-I. 4–7 ngày (Lâu)", color: "text-orange-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_AUTO_MEDIUM: { title: "3a-I. 2–4 ngày (Trung bình)", color: "text-amber-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_AUTO_FRESH: { title: "3a-I. 0–2 ngày (Mới)", color: "text-blue-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_AUTO_HOT_RENAME: { title: "3a-I. >7 ngày & Đã đổi tên", color: "text-emerald-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_AUTO_WARN_RENAME: { title: "3a-I. 4–7 ngày & Đã đổi tên", color: "text-emerald-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_AUTO_MEDIUM_RENAME: { title: "3a-I. 2–4 ngày & Đã đổi tên", color: "text-emerald-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_AUTO_FRESH_RENAME: { title: "3a-I. 0–2 ngày & Đã đổi tên", color: "text-emerald-700" },

  // 3a-II: Manual
  FUNNEL_FIRST_MESSAGE_SUCCESS_MANUAL: { title: "3a-II. FM Manual Success", color: "text-blue-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_MANUAL_HOT: { title: "3a-II. >7 ngày (Rất lâu)", color: "text-red-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_MANUAL_WARN: { title: "3a-II. 4–7 ngày (Lâu)", color: "text-orange-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_MANUAL_MEDIUM: { title: "3a-II. 2–4 ngày (Trung bình)", color: "text-amber-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_MANUAL_FRESH: { title: "3a-II. 0–2 ngày (Mới)", color: "text-blue-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_MANUAL_HOT_RENAME: { title: "3a-II. >7 ngày & Đã đổi tên", color: "text-emerald-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_MANUAL_WARN_RENAME: { title: "3a-II. 4–7 ngày & Đã đổi tên", color: "text-emerald-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_MANUAL_MEDIUM_RENAME: { title: "3a-II. 2–4 ngày & Đã đổi tên", color: "text-emerald-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_MANUAL_FRESH_RENAME: { title: "3a-II. 0–2 ngày & Đã đổi tên", color: "text-emerald-700" },

  FUNNEL_FIRST_MESSAGE_SUCCESS_HOT: { title: "3a. >7 ngày (Rất lâu)", color: "text-red-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_WARN: { title: "3a. 4–7 ngày (Lâu)", color: "text-orange-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_MEDIUM: { title: "3a. 2–4 ngày (Trung bình)", color: "text-amber-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_FRESH: { title: "3a. 0–2 ngày (Mới)", color: "text-blue-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_HOT_RENAME: { title: "3a. >7 ngày & Đã đổi tên", color: "text-emerald-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_WARN_RENAME: { title: "3a. 4–7 ngày & Đã đổi tên", color: "text-emerald-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_MEDIUM_RENAME: { title: "3a. 2–4 ngày & Đã đổi tên", color: "text-emerald-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS_FRESH_RENAME: { title: "3a. 0–2 ngày & Đã đổi tên", color: "text-emerald-700" },
  FUNNEL_FIRST_MESSAGE_FAILED: { title: "3b. firstMessage failed", color: "text-red-700" },
  FUNNEL_BLOCKED_MESSAGE: { title: "Lỗi 1: Chặn tin nhắn", color: "text-red-600" },
  FUNNEL_SYSTEM_ERROR: { title: "Lỗi 2: No uid / lỗi hệ thống", color: "text-rose-600" },
  FUNNEL_NEVER_FIRST_MESSAGE: { title: "3c. Chưa gửi firstMessage", color: "text-gray-700" },
  FUNNEL_NEVER_FIRST_MESSAGE_SALE_ONLY: { title: "3c-iii. Sale nhắn, khách chưa reply", color: "text-amber-700" },
  FUNNEL_NEVER_FIRST_MESSAGE_NO_INTERACTION: { title: "3c-iv. Chưa có tương tác", color: "text-gray-500" },
  FUNNEL_RENAME_SUCCESS: { title: "3c-iv. Đã đổi tên", color: "text-emerald-700" },
  FUNNEL_RENAME_RESERVE: { title: "3c-iv. Còn lại", color: "text-gray-600" },
}

interface KPIDetailLead {
  id: string
  phone: string
  name: string
  car_id: string
  brand: string | null
  model: string | null
  year: number | null
  car_created_at: string | null
  location: string | null
  mileage: number | null
  notes?: string
  qualified?: string | null
  daysWaiting?: number | null
  zaloActions?: Record<string, string>
  additional_phone?: string | null
  variant?: string | null
  plate?: string | null
  sku?: string | null
  additional_images?: any
  intentionLead?: string | null
  negotiationAbility?: string | null
  stage?: string | null
  price_customer?: number | null
  price_highest_bid?: number | null
  pic_id?: string | null
  pic_name?: string | null
}

interface KPIDetailPanelProps {
  open: boolean
  onClose: () => void
  metric: string | null
  picId: string
  search?: string
  sources?: string[]
  dateFrom?: string | null
  dateTo?: string | null
  qualified?: string | null
}

export function KPIDetailPanel({ open, onClose, metric, picId, search, sources, dateFrom, dateTo, qualified: initialQualified }: KPIDetailPanelProps) {
  const { toast } = useToast()
  const [leads, setLeads] = useState<KPIDetailLead[]>([])
  const [loading, setLoading] = useState(false)
  const [renamingLeads, setRenamingLeads] = useState<Record<string, boolean>>({})
  const [sendingMessages, setSendingMessages] = useState<Record<string, boolean>>({})
  const [isBulkFollowingUp, setIsBulkFollowingUp] = useState(false)
  const [selectedQualified, setSelectedQualified] = useState<string[]>(initialQualified ? initialQualified.split(',').filter(Boolean) : [])
  const [availableQualified, setAvailableQualified] = useState<string[]>([])

  // Sync internal qualified filter when the parent prop changes
  useEffect(() => {
    setSelectedQualified(initialQualified ? initialQualified.split(',').filter(Boolean) : [])
  }, [initialQualified])
  
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

  const handleRenameLead = async (phone: string, currentPicId: string) => {
    if (!phone || !currentPicId) {
      toast({ title: "Lỗi", description: "Thiếu thông tin số điện thoại hoặc PIC ID", variant: "destructive" })
      return
    }

    setRenamingLeads(prev => ({ ...prev, [phone]: true }))
    try {
      const response = await fetch("/api/akabiz/rename-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, pic_id: currentPicId }),
      })
      if (!response.ok) throw new Error("Failed to rename lead")
      toast({ title: "Thành công", description: `Đã đổi tên lead ${phone} thành công` })
    } catch (error) {
      console.error("[KPIDetailPanel] Error renaming lead:", error)
      toast({ title: "Lỗi", description: "Không thể đổi tên lead", variant: "destructive" })
    } finally {
      setRenamingLeads(prev => ({ ...prev, [phone]: false }))
    }
  }

  const processedImages = useMemo(() => {
    const images: string[] = []
    if (!selectedLeadForEdit) return images

    if (selectedLeadForEdit.image) {
      images.push(selectedLeadForEdit.image)
    }

    if (selectedLeadForEdit.additional_images) {
      const imgCategories = selectedLeadForEdit.additional_images
      const categoryOrder = ['outside', 'inside', 'paper']

      for (const category of categoryOrder) {
        const categoryImages = imgCategories[category]
        if (Array.isArray(categoryImages)) {
          for (const img of categoryImages) {
            if (img.url && !images.includes(img.url)) {
              images.push(img.url)
            }
          }
        }
      }

      for (const [category, categoryImages] of Object.entries(imgCategories)) {
        if (!categoryOrder.includes(category) && Array.isArray(categoryImages)) {
          for (const img of categoryImages) {
            if (img.url && !images.includes(img.url)) {
              images.push(img.url)
            }
          }
        }
      }
    }
    return images
  }, [selectedLeadForEdit])

  const handleEditLead = (lead: KPIDetailLead) => {
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
          carId: selectedLeadForEdit.car_id,
          leadId: selectedLeadForEdit.id,
          stage: editedStage,
          price_customer: parseShorthandPrice(editedPriceCustomer),
          price_highest_bid: parseShorthandPrice(editedPriceHighestBid),
          qualified: editedQualified,
          intentionLead: editedIntentionLead,
          negotiationAbility: editedNegotiationAbility,
          notes: editedNotes,
          previousValues: {
            stage: selectedLeadForEdit.stage,
            price_customer: selectedLeadForEdit.price_customer,
            price_highest_bid: selectedLeadForEdit.price_highest_bid,
            qualified: selectedLeadForEdit.qualified,
            intentionLead: selectedLeadForEdit.intentionLead,
            negotiationAbility: selectedLeadForEdit.negotiationAbility,
            notes: selectedLeadForEdit.notes,
          }
        }),
      })

      if (res.ok) {
        toast({ title: "Thành công", description: "Đã cập nhật thông tin lead" })
        setEditDialogOpen(false)
        fetchDetail()
      } else {
        toast({ title: "Lỗi", description: "Không thể cập nhật thông tin lead", variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Lỗi", description: "Có lỗi xảy ra", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleSendFirstMessage = async (lead: KPIDetailLead, currentPicId: string) => {
    const customer_phone = lead.phone
    if (!customer_phone || !currentPicId) {
      toast({ title: "Lỗi", description: "Thiếu thông tin số điện thoại hoặc PIC ID", variant: "destructive" })
      return
    }

    const mileageText = lead.mileage ? `${lead.mileage.toLocaleString('vi-VN')} km` : "Đang cập nhật"
    const locationText = lead.location || "TP. Hồ Chí Minh"
    const carParts = []
    if (lead.brand) carParts.push(lead.brand)
    if (lead.model) carParts.push(lead.model)
    if (lead.year) carParts.push(lead.year.toString())
    const carInfo = carParts.length > 0 ? carParts.join(" ") : "xe"

    const messages = [
      "Dạ em là nhân viên từ Vucar. Em liên hệ hỗ trợ mình để bán xe TP. Hồ Chí Minh ạ. Em đang có 2-3 người mua sẵn quan tâm dòng này ạ",
      `Thông tin chi tiết xe: ${carInfo}\nSố km đã đi (Odo): ${mileageText}\nKhu vực: ${locationText}`,
      "Mình cho em xin vài hình ảnh xe + hình ảnh giấy tờ đăng kiểm để em xác nhận lại thông tin xe và kết nối xe mình đến người mua phù hợp nhất nha."
    ]

    setSendingMessages(prev => ({ ...prev, [lead.phone]: true }))
    try {
      const response = await fetch("/api/akabiz/send-customer-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_phone, messages, picId: currentPicId }),
      })
      if (!response.ok) throw new Error("Failed to send message")
      toast({ title: "Thành công", description: `Đã gửi tin nhắn đầu tiên cho khách hàng ${customer_phone}` })
    } catch (error) {
      console.error("[KPIDetailPanel] Error sending first message:", error)
      toast({ title: "Lỗi", description: "Không thể gửi tin nhắn", variant: "destructive" })
    } finally {
      setSendingMessages(prev => ({ ...prev, [lead.phone]: false }))
    }
  }

  const handleBulkFollowUp = async () => {
    if (leads.length === 0) return
    setIsBulkFollowingUp(true)
    let successCount = 0
    let failCount = 0

    for (const lead of leads) {
      if (!lead.phone) {
        failCount++
        continue
      }
      try {
        const response = await fetch('https://n8n.vucar.vn/webhook/7c06fc96-f8dc-4c5d-af17-57c2bab57864', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: lead.phone }),
        })
        if (response.ok) {
          successCount++
          fetch('/api/e2e/log-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId: lead.id,
              activityType: 'BOT_FOLLOW_UP_SENT',
              actorType: 'USER',
              metadata: { field_name: 'bot_follow_up', new_value: 'Triggered via bulk' },
              field: 'bot_follow_up'
            }),
          }).catch(err => console.error("Log error", err))
        } else {
          failCount++
        }
      } catch (err) {
        failCount++
      }
    }

    toast({
      title: "Hoàn tất Follow up hàng loạt",
      description: `Thành công: ${successCount}, Thất bại: ${failCount}`,
    })
    setIsBulkFollowingUp(false)
  }

  const fetchDetail = useCallback(async () => {
    if (!metric || !picId) return
    setLoading(true)

    const params = new URLSearchParams({ pic_id: picId, metric })
    if (search) params.set("search", search)
    if (sources && sources.length > 0) params.set("sources", sources.join(","))
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    if (selectedQualified.length > 0) params.set("qualified", selectedQualified.join(","))

    try {
      const res = await fetch(`/api/e2e/kpi-detail?${params.toString()}`)
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setLeads(data.leads ?? [])
      if (data.qualifiedValues) {
        setAvailableQualified(data.qualifiedValues)
      }
    } catch (err) {
      console.error("[KPIDetailPanel]", err)
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [metric, picId, search, sources, dateFrom, dateTo, selectedQualified, initialQualified])

  useEffect(() => {
    if (open && metric) {
      fetchDetail()
    } else {
      setLeads([])
    }
  }, [open, metric, fetchDetail, selectedQualified])

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone)
      toast({ title: "Đã sao chép", description: phone })
    } catch {
      toast({ title: "Lỗi", description: "Không thể sao chép", variant: "destructive" })
    }
  }

  const handleCopyAll = async () => {
    const phones = leads.map((l) => l.phone).join("\n")
    try {
      await navigator.clipboard.writeText(phones)
      toast({ title: "Đã sao chép", description: `${leads.length} số điện thoại` })
    } catch {
      toast({ title: "Lỗi", description: "Không thể sao chép", variant: "destructive" })
    }
  }

  const cfg = METRIC_CONFIG[metric ?? ""] ?? { title: metric ?? "—", color: "text-gray-600" }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[800px] max-w-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"
          }`}
      >
        {/* Header */}
        <div className="flex flex-col border-b bg-gray-50">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className={`text-sm font-bold ${cfg.color}`}>{cfg.title}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {loading ? "Đang tải..." : `${leads.length} leads`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {leads.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {metric?.startsWith('FUNNEL_FIRST_MESSAGE_SUCCESS_') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100"
                      onClick={handleBulkFollowUp}
                      disabled={isBulkFollowingUp}
                    >
                      {isBulkFollowingUp ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Bell className="w-3 h-3" />
                      )}
                      Bulk Follow Up
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleCopyAll}>
                    <Copy className="w-3 h-3" />
                    Copy All
                  </Button>
                </div>
              )}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchDetail} disabled={loading}>
                <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="px-5 py-2.5 bg-white border-t flex items-center gap-2 overflow-x-auto scrollbar-hide no-scrollbar">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Lọc Loại:</span>
            <button 
              onClick={() => setSelectedQualified([])}
              className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all whitespace-nowrap border ${
                selectedQualified.length === 0 
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                  : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
              }`}
            >
              TẤT CẢ
            </button>
            {availableQualified.map((q) => {
              const config = QUALIFIED_CONFIG[q] || { label: q, className: "bg-gray-100 text-gray-500 border-gray-200" }
              const isSelected = selectedQualified.includes(q)
              return (
                <button
                  key={q}
                  onClick={() => {
                    setSelectedQualified(prev => 
                      prev.includes(q) 
                        ? prev.filter(v => v !== q) 
                        : [...prev, q]
                    )
                  }}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all whitespace-nowrap border ${
                    isSelected 
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : `${config.className} opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0`
                  }`}
                >
                  {config.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">Không có leads</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Khách hàng & Xe</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Loại</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Ghi chú</th>
                  {leads.some(l => l.daysWaiting !== null) && (
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Chờ</th>
                  )}
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Trạng thái Zalo</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((lead, i) => (
                  <tr key={`${lead.car_id}-${i}`} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5 align-top">
                      <div className="flex flex-col gap-1.5 pt-1.5">
                        <div
                          className="flex items-center gap-1.5 cursor-pointer group w-fit"
                          onClick={() => handleCopyPhone(lead.phone)}
                          title="Click to copy"
                        >
                          <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0 group-hover:text-blue-500 transition-colors" />
                          <span className="font-mono text-[13px] font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{lead.phone}</span>
                          <Copy className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex flex-col gap-0.5 border-l-2 border-gray-100 pl-2 ml-1.5">
                          <span className="text-[12px] font-semibold text-gray-800 truncate max-w-[200px]" title={lead.name}>
                            {lead.name || "—"}
                          </span>
                          <span className="text-[11px] text-gray-500 truncate max-w-[200px]" title={[lead.brand, lead.model, lead.year].filter(Boolean).join(" ")}>
                            {[lead.brand, lead.model, lead.year].filter(Boolean).join(" ") || "Chưa rõ xe"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <div className="pt-1.5 flex flex-col items-start gap-1">
                        {lead.qualified ? (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${
                            QUALIFIED_CONFIG[lead.qualified]?.className || "text-gray-500 bg-gray-50 border-gray-200"
                          }`}>
                            {QUALIFIED_CONFIG[lead.qualified]?.label || lead.qualified}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-gray-400 italic">N/A</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <div className="text-[11px] text-gray-600 line-clamp-4 leading-relaxed max-w-[250px] pt-1" title={lead.notes}>
                        {lead.notes || "—"}
                      </div>
                    </td>
                    {leads.some(l => l.daysWaiting !== null) && (
                      <td className="px-4 py-2.5 align-top pt-3.5">
                        {lead.daysWaiting !== null ? (
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${lead.daysWaiting! > 5 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                            {lead.daysWaiting}d
                          </span>
                        ) : "—"}
                      </td>
                    )}
                    <td className="px-4 py-2.5 align-top pt-3">
                      <div className="flex flex-col gap-1.5">
                        {lead.zaloActions && Object.entries(lead.zaloActions).length > 0 ? (
                          Object.entries(lead.zaloActions).map(([type, status]) => {
                            const isSuccess = status === 'success'
                            const isFailed = status === 'failed'
                            return (
                              <div key={type} className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter w-14">
                                  {type === 'firstMessage' ? 'First Msg' : type}
                                </span>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${
                                  isSuccess ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                  isFailed ? 'bg-red-50 text-red-600 border-red-100' :
                                  'bg-gray-50 text-gray-500 border-gray-100'
                                }`}>
                                  {status.toUpperCase()}
                                </span>
                              </div>
                            )
                          })
                        ) : (
                          <span className="text-[10px] text-gray-300 italic">No actions yet</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 align-top pt-3.5">
                      {lead.car_created_at
                        ? new Date(lead.car_created_at).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                        })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right align-top pt-2">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <ViewZaloChatAction carId={lead.car_id} customerName={lead.name} iconOnly />
                        {(metric?.startsWith('FUNNEL_NEVER_FIRST_MESSAGE') || metric?.startsWith('FUNNEL_RENAME_')) && (
                          <>
                            <RenameLeadAction
                              onClick={() => handleRenameLead(lead.phone, picId)}
                              loading={renamingLeads[lead.phone]}
                            />
                            <SendFirstMessageAction
                              onClick={() => handleSendFirstMessage(lead, picId)}
                              loading={sendingMessages[lead.phone]}
                            />
                          </>
                        )}
                        {metric?.startsWith('FUNNEL_FIRST_MESSAGE_SUCCESS_') && (
                          <FollowUpAction lead={lead as any} />
                        )}
                        <button
                          onClick={() => handleEditLead(lead)}
                          className="p-1.5 hover:bg-gray-100 hover:text-blue-600 rounded-lg text-gray-400 transition-all border border-transparent hover:border-gray-200"
                          title="Chỉnh sửa lead"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Edit Lead Dialog */}
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
          processedImages={processedImages}
          onSave={handleSaveLead}
          saving={saving}
          getStageStyle={(stage) => {
            if (stage === 'COMPLETED') return 'bg-green-100 text-green-800'
            if (stage === 'DEPOSIT_PAID') return 'bg-emerald-100 text-emerald-800'
            if (stage === 'CAR_VIEW') return 'bg-blue-100 text-blue-800'
            if (stage === 'NEGOTIATION') return 'bg-yellow-100 text-yellow-800'
            if (stage === 'CONTACTED') return 'bg-purple-100 text-purple-800'
            if (stage === 'CANNOT_CONTACT') return 'bg-orange-100 text-orange-800'
            if (stage === 'FAILED') return 'bg-red-100 text-red-800'
            return 'bg-gray-100 text-gray-700'
          }}
        />
      </div>
    </>
  )
}
