"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Loader2, Phone, Copy, ExternalLink, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { RenameLeadAction } from "@/components/e2e/actions/RenameLeadAction"
import { SendFirstMessageAction } from "@/components/e2e/actions/SendFirstMessageAction"
import { ViewZaloChatAction } from "@/components/e2e/actions/ViewZaloChatAction"

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

  // Funnel mapped categories
  FUNNEL_TOTAL_LEADS: { title: "Nhận lead", color: "text-gray-800" },
  FUNNEL_HAS_IMAGE: { title: "Đã có hình", color: "text-emerald-700" },
  FUNNEL_NO_IMAGE: { title: "Chưa có hình", color: "text-orange-700" },
  FUNNEL_FIRST_MESSAGE_SUCCESS: { title: "firstMessage success", color: "text-blue-700" },
  FUNNEL_NEVER_FIRST_MESSAGE: { title: "Chưa gửi firstMessage", color: "text-gray-700" },
  FUNNEL_FIRST_MESSAGE_FAILED: { title: "firstMessage failed", color: "text-red-700" },
  FUNNEL_BLOCKED_MESSAGE: { title: "Lỗi 1: Chặn tin nhắn", color: "text-red-600" },
  FUNNEL_SYSTEM_ERROR: { title: "Lỗi 2: No uid / lỗi hệ thống", color: "text-rose-600" },
}

interface KPIDetailLead {
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
}

export function KPIDetailPanel({ open, onClose, metric, picId, search, sources, dateFrom, dateTo }: KPIDetailPanelProps) {
  const { toast } = useToast()
  const [leads, setLeads] = useState<KPIDetailLead[]>([])
  const [loading, setLoading] = useState(false)
  const [renamingLeads, setRenamingLeads] = useState<Record<string, boolean>>({})
  const [sendingMessages, setSendingMessages] = useState<Record<string, boolean>>({})

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

  const fetchDetail = useCallback(async () => {
    if (!metric || !picId) return
    setLoading(true)

    const params = new URLSearchParams({ pic_id: picId, metric })
    if (search) params.set("search", search)
    if (sources && sources.length > 0) params.set("sources", sources.join(","))
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)

    try {
      const res = await fetch(`/api/e2e/kpi-detail?${params.toString()}`)
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setLeads(data.leads ?? [])
    } catch (err) {
      console.error("[KPIDetailPanel]", err)
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [metric, picId, search, sources?.join(","), dateFrom, dateTo])

  useEffect(() => {
    if (open && metric) {
      fetchDetail()
    } else {
      setLeads([])
    }
  }, [open, metric, fetchDetail])

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
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
          <div>
            <h2 className={`text-sm font-bold ${cfg.color}`}>{cfg.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading ? "Đang tải..." : `${leads.length} leads`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {leads.length > 0 && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleCopyAll}>
                <Copy className="w-3 h-3" />
                Copy All
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchDetail} disabled={loading}>
              <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
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
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Ghi chú</th>
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
                      <div className="text-[11px] text-gray-600 line-clamp-4 leading-relaxed max-w-[250px] pt-1" title={lead.notes}>
                        {lead.notes || "—"}
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
                        {metric === 'FUNNEL_NEVER_FIRST_MESSAGE' && (
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
