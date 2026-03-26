"use client"

import { HITLLead, StepProgress } from "./types"
import { ZaloErrorBadges } from "./ZaloErrorBadges"
import { MapPin, Clock, Copy, Phone, History, CheckCircle2, XCircle, MinusCircle, MoreVertical, Bell, PhoneCall, Send, MessageCircle, Loader2, User, ExternalLink } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { ChatMessage } from "@/components/e2e/types"

interface HITLLeadCardProps {
  lead: HITLLead
  onResolve: (id: string) => void
  onDetail: (id: string) => void
}

// ── Qualified status badge ─────────────────────────────────────────────────
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

function QualifiedBadge({ status }: { status?: string | null }) {
  if (!status) return null
  const cfg = QUALIFIED_CONFIG[status] ?? { label: status, className: "text-gray-500 bg-gray-50 border-gray-200" }
  return (
    <span className={`inline-flex items-center text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded border ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

// ── Avatar ─────────────────────────────────────────────────────────────────
const AVATAR_PALETTES = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
]
function avatarColor(name: string) {
  return AVATAR_PALETTES[name.charCodeAt(0) % AVATAR_PALETTES.length]
}
function initials(name: string) {
  return name.split(" ").slice(-2).map((w) => w[0]).join("").toUpperCase().slice(0, 2)
}

// ── Step strip ──────────────────────────────────────────────────────────────
const STEP_SHORT: Record<string, string> = {
  zalo_connect: "Zalo",
  thu_thap_thong_tin: "Thu thập TT",
  dat_lich_kiem_dinh: "Đặt lịch",
  dam_phan_1: "Đàm phán",
}
function StepStrip({ steps }: { steps: StepProgress[] }) {
  if (!steps.length) return null
  return (
    <div className="flex gap-1 flex-wrap mt-2">
      {steps.map((s) => {
        const Icon = s.condition_end_met ? CheckCircle2 : s.is_overdue ? XCircle : MinusCircle
        const style = s.condition_end_met
          ? "text-emerald-600 border-emerald-200"
          : s.is_overdue
            ? "text-red-500 border-red-200"
            : "text-black-400"
        return (
          <span
            key={s.step_key}
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${style}`}
          >
            <Icon className="w-2.5 h-2.5 shrink-0" />
            {STEP_SHORT[s.step_key] ?? s.step_key}
          </span>
        )
      })}
    </div>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────
export function HITLLeadCard({ lead, onResolve, onDetail }: HITLLeadCardProps) {
  const { customer, car, trigger, triggered_at, pic_id, pic_name, qualified_status } = lead
  const [copied, setCopied] = useState(false)
  const [copiedCarId, setCopiedCarId] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [zaloChatOpen, setZaloChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [loadingChat, setLoadingChat] = useState(false)
  const [biddingHistoryOpen, setBiddingHistoryOpen] = useState(false)
  const [biddingHistory, setBiddingHistory] = useState<any[]>([])
  const [loadingBids, setLoadingBids] = useState(false)
  const { toast } = useToast()

  const timeAgo = formatDistanceToNow(new Date(triggered_at), { addSuffix: true, locale: vi })

  const handleDetail = () => {
    const phone = encodeURIComponent(customer.phone ?? "")
    toast({ title: "Đang chuyển hướng", description: "Đang mở chi tiết lead..." })
    window.open(
      `https://e2e-management.vercel.app/e2e/${pic_id}?tab=nurture&page=1&search=${phone}`,
      "_blank"
    )
  }

  const handleCopyCarId = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    navigator.clipboard.writeText(lead.car_id)
    setCopiedCarId(true)
    toast({ title: "Thành công", description: "Đã sao chép Car ID" })
    setTimeout(() => setCopiedCarId(false), 1500)
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!customer.phone) return
    navigator.clipboard.writeText(customer.phone)
    setCopied(true)
    toast({ title: "Thành công", description: "Đã sao chép số điện thoại" })
    setTimeout(() => setCopied(false), 1500)
  }

  // ── Action handlers ────────────────────────────────────────────────────
  const handleFollowUp = async () => {
    const phone = customer.phone
    if (!phone) {
      toast({ title: "Lỗi", description: "Không tìm thấy số điện thoại", variant: "destructive" })
      return
    }
    setActionLoading("follow_up")
    try {
      const res = await fetch("https://n8n.vucar.vn/webhook/7c06fc96-f8dc-4c5d-af17-57c2bab57864", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })
      if (res.ok) {
        toast({ title: "Thành công", description: "Đã gửi yêu cầu Follow up" })
      } else {
        throw new Error("Failed")
      }
    } catch {
      toast({ title: "Lỗi", description: "Có lỗi xảy ra khi gửi yêu cầu", variant: "destructive" })
    } finally {
      setActionLoading(null)
    }
  }

  const handleCall = async () => {
    const phone = customer.phone
    if (!phone) {
      toast({ title: "Lỗi", description: "Không tìm thấy số điện thoại", variant: "destructive" })
      return
    }
    setActionLoading("call")
    try {
      const res = await fetch("https://n8n.vucar.vn/webhook/firstcall-chotot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })
      if (res.ok) {
        toast({ title: "Thành công", description: "Đã kích hoạt gọi, đợi phản hồi bên Slack" })
      } else {
        throw new Error("Failed")
      }
    } catch {
      toast({ title: "Lỗi", description: "Lỗi kết nối hệ thống", variant: "destructive" })
    } finally {
      setActionLoading(null)
    }
  }

  const handleSendNoti = async () => {
    const phone = customer.phone
    if (!phone) {
      toast({ title: "Lỗi", description: "Không tìm thấy số điện thoại", variant: "destructive" })
      return
    }
    setActionLoading("send_noti")
    try {
      const res = await fetch("/api/e2e/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "499943", phoneNumbers: [phone] }),
      })
      const data = await res.json()
      if (data.success && (!data.failedSends || data.failedSends === 0)) {
        toast({ title: "ZNS Thành công", description: "Gửi thành công", className: "bg-green-50 border-green-200 text-green-900" })
      } else {
        toast({ title: "ZNS Thất bại", description: "Không thể gửi tin nhắn ZNS", variant: "destructive" })
      }
    } catch {
      toast({ title: "ZNS Lỗi", description: "Lỗi kết nối đến server ZNS", variant: "destructive" })
    } finally {
      setActionLoading(null)
    }
  }

  const handleRenameLead = async () => {
    const phone_number = customer.phone
    const pic_id = lead.pic_id

    if (!phone_number || !pic_id) {
      toast({
        title: "Lỗi",
        description: !phone_number ? "Không có số điện thoại" : "Không có PIC ID",
        variant: "destructive",
      })
      return
    }

    setActionLoading("rename")
    try {
      const response = await fetch("/api/akabiz/rename-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number, pic_id }),
      })

      if (!response.ok) throw new Error("Failed to rename lead")

      toast({ title: "Thành công", description: "Đã đổi tên lead thành công" })
    } catch (error) {
      console.error("[E2E] Error renaming lead:", error)
      toast({ title: "Lỗi", description: "Không thể đổi tên lead", variant: "destructive" })
    } finally {
      setActionLoading(null)
    }
  }

  const handleSendFirstMessage = async () => {
    const customer_phone = customer.phone
    const picId = lead.pic_id

    if (!customer_phone || !picId) {
      toast({
        title: "Lỗi",
        description: !customer_phone ? "Không có số điện thoại" : "Không có PIC ID",
        variant: "destructive",
      })
      return
    }

    // Build car details message
    const carParts = []
    if (car.model) carParts.push(car.model)
    if (car.year) carParts.push(car.year.toString())
    const carInfo = carParts.length > 0 ? carParts.join(" ") : "xe"

    const mileageText = car.odo ? `${car.odo.toLocaleString('vi-VN')} km` : "Đang cập nhật"
    const locationText = car.location || "TP. Hồ Chí Minh"

    const messages = [
      "Dạ em là nhân viên từ Vucar. Em liên hệ hỗ trợ mình để bán xe TP. Hồ Chí Minh ạ. Em đang có 2-3 người mua sẵn quan tâm dòng này ạ",
      `Thông tin chi tiết xe: ${carInfo}\nSố km đã đi (Odo): ${mileageText}\nKhu vực: ${locationText}`,
      "Mình cho em xin vài hình ảnh xe + hình ảnh giấy tờ đăng kiểm để em xác nhận lại thông tin xe và kết nối xe mình đến người mua phù hợp nhất nha."
    ]

    setActionLoading("send_first")
    try {
      const response = await fetch("/api/akabiz/send-customer-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_phone, messages, picId }),
      })

      if (!response.ok) throw new Error("Failed to send message")

      toast({ title: "Thành công", description: "Đã gửi tin nhắn đầu tiên cho khách hàng" })
    } catch (error) {
      console.error("[E2E] Error sending first message:", error)
      toast({ title: "Lỗi", description: "Không thể gửi tin nhắn", variant: "destructive" })
    } finally {
      setActionLoading(null)
    }
  }

  const handleViewBiddingHistory = async () => {
    setBiddingHistoryOpen(true)
    setLoadingBids(true)
    try {
      const res = await fetch("/api/e2e/bidding-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: lead.car_id }),
      })
      if (res.ok) {
        const data = await res.json()
        setBiddingHistory(data.biddings || [])
      } else {
        setBiddingHistory([])
      }
    } catch (error) {
      console.error("[E2E] Error fetching bidding history:", error)
      setBiddingHistory([])
    } finally {
      setLoadingBids(false)
    }
  }

  const handleViewZaloChat = async () => {
    setZaloChatOpen(true)
    setLoadingChat(true)
    toast({ title: "Đang lấy tin nhắn", description: "Đang tải tin nhắn Zalo..." })
    try {
      const res = await fetch("/api/e2e/messages-zalo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: lead.car_id }),
      })
      if (res.ok) {
        const data = await res.json()
        setChatMessages(data.messages_zalo || [])
      } else {
        setChatMessages([])
      }
    } catch {
      setChatMessages([])
    } finally {
      setLoadingChat(false)
    }
  }

  const isSLA = trigger.type === "SLA_BREACH"
  const isOverdue = (lead.time_overdue_minutes ?? 0) > 0

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleDetail}
        onKeyDown={(e) => e.key === "Enter" && handleDetail()}
        className="w-full text-left cursor-pointer bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-blue-50/30 hover:border-blue-300 hover:shadow-md transition-all duration-200"
      >

        {/* ── 1. SLA / Escalation badge row ─────────────────────────── */}
        <div className="px-4 pt-4 pb-3 space-y-2">
          {isSLA && (
            <div className={`flex items-center gap-2 py-1 text-sm font-semibold
            ${isOverdue
                ? "bg-red-50 text-red-600 border border-red-100 px-3 py-2 rounded-xl"
                : "text-gray-400"
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {trigger.time_string ?? "—"}
            </div>
          )}

          {!isSLA && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-rose-50 text-rose-600 border border-rose-100">
                <span className="text-base leading-none">⚡</span>
                Escalation — {trigger.intent ?? "Cảnh báo"}
              </div>
              {trigger.keywords && trigger.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 px-1">
                  {trigger.keywords.map((kw, i) => (
                    <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-4 pb-4 space-y-3">

          {/* ── 2. Car block ────────────────────────────────────────── */}
          <div className="rounded-xl">
            <div className="flex gap-3">
              {/* Thumbnail */}
              {car.thumbnail ? (
                <img
                  src={car.thumbnail}
                  alt={car.model}
                  className="w-32 h-24 rounded-lg object-cover shrink-0 bg-gray-200"
                />
              ) : (
                <div className="w-32 h-24 rounded-lg bg-gradient-to-br from-gray-200 to-gray-100 shrink-0 flex items-center justify-center">
                  <span className="text-gray-400 text-xs font-medium">No img</span>
                </div>
              )}

              {/* Car info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm leading-snug truncate">
                  {car.model}{car.year ? ` ${car.year}` : ""}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-gray-400 font-mono truncate">{lead.car_id}</span>
                  <button onClick={handleCopyCarId} className="p-0.5 rounded hover:bg-gray-200 transition-colors shrink-0">
                    <Copy className={`w-2.5 h-2.5 ${copiedCarId ? "text-emerald-500" : "text-gray-400"}`} />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {car.odo ? `${car.odo.toLocaleString()} km` : "N/A"}
                </p>
                {car.location && (
                  <div className="flex items-center gap-0.5 text-xs text-gray-400 mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{car.location}</span>
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toast({ title: "Đang chuyển hướng", description: "Đang mở trang sửa tin..." });
                    window.open(`https://dashboard.vucar.vn/kho-xe/${lead.car_id}`, "_blank");
                  }}
                  className="mt-1 text-gray-400 text-[10px] font-medium hover:text-blue-500 transition-colors w-fit"
                >
                  Sửa tin
                </button>
              </div>
            </div>

            {/* Price comparison */}
            {(car.price_expected != null || car.price_max != null) && (
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100">
                <span className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">Giá:</span>{" "}
                  {car.price_expected ? `${Math.round(car.price_expected / 1e6)}tr` : "—"}
                  {" vs "}
                  <span className="font-semibold text-orange-500">
                    {car.price_max ? `${Math.round(car.price_max / 1e6)}tr` : "—"}
                  </span>
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleViewBiddingHistory() }}
                  className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md hover:bg-blue-100 transition-colors"
                >
                  <History className="w-2.5 h-2.5" />
                  Dealers trả
                </button>
              </div>
            )}
          </div>

          {/* ── 3. Customer info ────────────────────────────────────── */}
          <div className="pt-3 border-t border-gray-100 flex items-start gap-2.5">
            <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold ${avatarColor(customer.name)}`}>
              {initials(customer.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-gray-900 text-sm leading-tight">{customer.name}</span>
                <QualifiedBadge status={qualified_status} />
              </div>
              {/* Phone */}
              {customer.phone && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-500 font-mono">{customer.phone}</span>
                  <button
                    onClick={handleCopy}
                    className="ml-0.5 p-0.5 rounded hover:bg-gray-100 transition-colors"
                    title="Sao chép SĐT"
                  >
                    <Copy className={`w-3 h-3 ${copied ? "text-emerald-500" : "text-gray-400"}`} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── 4. Zalo error badges ─────────────────────────────── */}
          {lead.zalo_errors && lead.zalo_errors.length > 0 && (
            <ZaloErrorBadges errors={lead.zalo_errors} />
          )}

          {/* ── 5. Footer ───────────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs text-gray-400 shrink-0">{timeAgo}</span>
              {pic_name && (
                <span
                  className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded truncate max-w-[80px]"
                  title={`PIC: ${pic_name}`}
                >
                  {pic_name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Zalo Chat Trigger */}
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleViewZaloChat() }}
                className="flex items-center justify-center text-gray-500 border border-gray-200 bg-gray-50 hover:bg-gray-600 hover:text-white p-1.5 rounded-lg transition-all duration-150 shrink-0"
                title="Xem tin nhắn Zalo"
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </button>

              {/* Action Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
                    className="flex items-center justify-center text-gray-500 border border-gray-200 bg-gray-50 hover:bg-gray-600 hover:text-white p-1.5 rounded-lg transition-all duration-150 shrink-0"
                    title="Hành động"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <MoreVertical className="w-3.5 h-3.5" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => { e.stopPropagation(); e.preventDefault() }}>
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); handleSendFirstMessage() }}
                    disabled={!!actionLoading}
                  >
                    <MessageCircle className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                    <span>Gửi tin nhắn đầu</span>
                    {actionLoading === "send_first" && <Loader2 className="w-3 h-3 ml-auto animate-spin" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); handleRenameLead() }}
                    disabled={!!actionLoading}
                  >
                    <User className="w-3.5 h-3.5 mr-2 text-indigo-500" />
                    <span>Đổi tên lead</span>
                    {actionLoading === "rename" && <Loader2 className="w-3 h-3 ml-auto animate-spin" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); handleFollowUp() }}
                    disabled={!!actionLoading}
                  >
                    <Bell className="w-3.5 h-3.5 mr-2 text-purple-500" />
                    <span>Follow up</span>
                    {actionLoading === "follow_up" && <Loader2 className="w-3 h-3 ml-auto animate-spin" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); handleCall() }}
                    disabled={!!actionLoading}
                  >
                    <PhoneCall className="w-3.5 h-3.5 mr-2 text-orange-500" />
                    <span>Gọi Bot</span>
                    {actionLoading === "call" && <Loader2 className="w-3 h-3 ml-auto animate-spin" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); handleSendNoti() }}
                    disabled={!!actionLoading}
                  >
                    <Send className="w-3.5 h-3.5 mr-2 text-blue-500" />
                    <span>Gửi Noti</span>
                    {actionLoading === "send_noti" && <Loader2 className="w-3 h-3 ml-auto animate-spin" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

            </div>
          </div>
        </div>
      </div>

      {/* ── Zalo Chat Dialog ─────────────────────────────────────────── */}
      <Dialog open={zaloChatOpen} onOpenChange={setZaloChatOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-500" />
              Tin nhắn Zalo — {customer.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-[200px] max-h-[60vh]">
            {loadingChat ? (
              <div className="flex items-center justify-center h-full py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-400">Đang tải tin nhắn...</span>
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full py-12 text-gray-400 text-sm">
                Chưa có tin nhắn
              </div>
            ) : (
              chatMessages.map((msg: any, index) => {
                const isVuCar = msg.fromMe === true || msg.uidFrom === "0" || msg.uidFrom === "bot" || msg.uidFrom === "system"
                const content = msg.content || msg.text || msg.body || ""
                const timestamp = msg.timestamp
                  ? (typeof msg.timestamp === 'number' ? new Date(msg.timestamp).toLocaleString("vi-VN") : msg.timestamp)
                  : msg.dateAction || ""

                return (
                  <div
                    key={msg._id || index}
                    className={`flex ${isVuCar ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-xl px-3 py-2 ${isVuCar
                        ? "bg-purple-500 text-white"
                        : "bg-gray-100 text-gray-900"
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-semibold">
                          {isVuCar ? "VuCar" : "Khách hàng"}
                        </span>
                        <span className="text-[10px] opacity-70">{timestamp}</span>
                      </div>
                      {msg.img && (
                        <img
                          src={msg.img}
                          alt="Message image"
                          className="max-w-[180px] max-h-[180px] object-cover rounded mb-1.5"
                        />
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
                      {msg.type && msg.type !== "text" && (
                        <span className="text-[10px] opacity-60 mt-0.5 block">
                          Type: {msg.type}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* ── Bidding History Dialog ────────────────────────────────────── */}
      <Dialog open={biddingHistoryOpen} onOpenChange={setBiddingHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-500" />
              Lịch sử Dealers trả — {car.model}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-[200px]">
            {loadingBids ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-400">Đang tải lịch sử...</span>
              </div>
            ) : biddingHistory.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm border rounded-xl border-dashed">
                Chưa có dealer nào trả giá
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Dealer</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Giá trả</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {biddingHistory.map((bid) => (
                      <tr key={bid.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-3 align-top">
                          <div className="font-bold text-gray-900">{bid.dealer_name}</div>
                          {bid.comment && (
                            <div className="text-[10px] text-gray-500 mt-1 italic">"{bid.comment}"</div>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100">
                            {(bid.price / 1e6).toLocaleString("vi-VN")}tr
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top text-gray-400 whitespace-nowrap">
                          {new Date(bid.created_at).toLocaleString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

