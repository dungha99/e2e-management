"use client"

import { HITLLead, StepProgress } from "./types"
import { MapPin, Clock, Copy, Phone, History, CheckCircle2, XCircle, MinusCircle, Eye } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import { useState } from "react"

interface HITLLeadCardProps {
  lead: HITLLead
  onResolve: (id: string) => void
  onDetail: (id: string) => void
}

// ── Qualified status badge ─────────────────────────────────────────────────
const QUALIFIED_CONFIG: Record<string, { label: string; className: string }> = {
  STRONG_QUALIFIED: { label: "STRONG QUALIFIED", className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  QUALIFIED:        { label: "QUALIFIED",         className: "text-blue-700 bg-blue-50 border-blue-200" },
  SLOW:             { label: "SLOW",              className: "text-sky-700 bg-sky-50 border-sky-200" },
  WEAK:             { label: "WEAK",              className: "text-amber-700 bg-amber-50 border-amber-200" },
  NON_QUALIFIED:    { label: "NON QUALIFIED",     className: "text-red-600 bg-red-50 border-red-200" },
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
  zalo_connect:       "Zalo",
  thu_thap_thong_tin: "Thu thập TT",
  dat_lich_kiem_dinh: "Đặt lịch",
  dam_phan_1:         "Đàm phán",
}
function StepStrip({ steps }: { steps: StepProgress[] }) {
  if (!steps.length) return null
  return (
    <div className="flex gap-1 flex-wrap mt-2">
      {steps.map((s) => {
        const Icon = s.condition_end_met ? CheckCircle2 : s.is_overdue ? XCircle : MinusCircle
        const style = s.condition_end_met
          ? "bg-emerald-50 text-emerald-600 border-emerald-200"
          : s.is_overdue
          ? "bg-red-50 text-red-500 border-red-200"
          : "bg-gray-50 text-gray-400 border-gray-200"
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

  const timeAgo = formatDistanceToNow(new Date(triggered_at), { addSuffix: true, locale: vi })

  const handleDetail = () => {
    const phone = encodeURIComponent(customer.phone ?? "")
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
    setTimeout(() => setCopiedCarId(false), 1500)
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!customer.phone) return
    navigator.clipboard.writeText(customer.phone)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const isSLA = trigger.type === "SLA_BREACH"
  const isOverdue = (lead.time_overdue_minutes ?? 0) > 0

  return (
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
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold
            ${isOverdue
              ? "bg-red-50 text-red-600 border border-red-100"
              : "bg-amber-50 text-amber-600 border border-amber-100"
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
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex gap-3">
            {/* Thumbnail */}
            {car.thumbnail ? (
              <img
                src={car.thumbnail}
                alt={car.model}
                className="w-[72px] h-[52px] rounded-lg object-cover shrink-0 bg-gray-200"
              />
            ) : (
              <div className="w-[72px] h-[52px] rounded-lg bg-gradient-to-br from-gray-200 to-gray-100 shrink-0 flex items-center justify-center">
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
            </div>
          </div>

          {/* Price comparison */}
          {(car.price_expected != null || car.price_max != null) && (
            <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">Giá:</span>{" "}
                {car.price_expected ? `${car.price_expected}tr` : "—"}
                {" vs "}
                <span className="font-semibold text-orange-500">
                  {car.price_max ? `${car.price_max}tr` : "—"}
                </span>
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
                className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md hover:bg-blue-100 transition-colors"
              >
                <History className="w-2.5 h-2.5" />
                Lịch sử
              </button>
            </div>
          )}
        </div>

        {/* ── 3. Customer info ────────────────────────────────────── */}
        <div className="flex items-start gap-2.5">
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

        {/* ── 4. Step progress ────────────────────────────────────── */}
        {lead.steps.length > 0 && <StepStrip steps={lead.steps} />}

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

          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDetail() }}
            className="flex items-center justify-center text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-600 hover:text-white p-1.5 rounded-lg transition-all duration-150 shrink-0"
            title="Xem chi tiết"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
