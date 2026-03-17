"use client"

import { HITLLead, StepProgress } from "./types"
import { MapPin, EyeOff, Clock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import { useRouter } from "next/navigation"

interface HITLLeadCardProps {
  lead: HITLLead
  onResolve: (id: string) => void
  onDetail: (id: string) => void
}

const STEP_SHORT: Record<string, string> = {
  zalo_connect:       "Kết nối Zalo",
  thu_thap_thong_tin: "Thu thập TT",
  dat_lich_kiem_dinh: "Đặt lịch KĐ",
  dam_phan_1:         "Đàm phán",
}

const STEP_STATUS_STYLE: Record<string, string> = {
  success:     "bg-green-100 text-green-700 border-green-200",
  failed:      "bg-red-100   text-red-600   border-red-200",
  ongoing:     "bg-blue-100  text-blue-700  border-blue-200",
  not_started: "bg-gray-100  text-gray-400  border-gray-200",
  terminated:  "bg-gray-100  text-gray-400  border-gray-200",
}

function StepStrip({ steps }: { steps: StepProgress[] }) {
  if (!steps.length) return null
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {steps.map((s) => {
        const style = s.is_overdue && s.status !== "success"
          ? "bg-amber-100 text-amber-700 border-amber-200"
          : STEP_STATUS_STYLE[s.status] ?? STEP_STATUS_STYLE.not_started
        return (
          <span
            key={s.step_key}
            className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${style}`}
            title={s.label}
          >
            {STEP_SHORT[s.step_key] ?? s.step_key}
          </span>
        )
      })}
    </div>
  )
}

// Generate a consistent muted color from a string
const AVATAR_COLORS = [
  "bg-slate-200 text-slate-600",
  "bg-stone-200 text-stone-600",
  "bg-zinc-200 text-zinc-600",
  "bg-neutral-200 text-neutral-600",
]
function avatarColor(name: string) {
  const i = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[i]
}

export function HITLLeadCard({ lead, onResolve, onDetail }: HITLLeadCardProps) {
  const { customer, car, trigger, triggered_at, pic_id, pic_name } = lead
  const router = useRouter()

  const timeAgo = formatDistanceToNow(new Date(triggered_at), { addSuffix: true, locale: vi })

  const handleDetail = () => {
    const phone = customer.phone ?? ""
    router.push(`/e2e/${pic_id}?tab=nurture&page=1&search=${encodeURIComponent(phone)}`)
  }

  const isSLA = trigger.type === "SLA_BREACH"
  const triggerBg = isSLA
    ? trigger.severity === "CRITICAL" ? "bg-red-50 text-red-600"
    : trigger.severity === "WARN"     ? "bg-amber-50 text-amber-600"
    :                                    "bg-blue-50 text-blue-600"
    : "bg-purple-50 text-purple-700"

  return (
    <div className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-default">
      <div className="p-4">

        {/* ── Customer Header ─────────────────────────────── */}
        <div className="flex items-center gap-3 mb-4">
          {customer.avatar ? (
            <img src={customer.avatar} alt={customer.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
          ) : (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${avatarColor(customer.name)}`}>
              {customer.name.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase().slice(0, 2)}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-bold text-gray-900 text-[15px] leading-tight truncate">{customer.name}</div>
            {customer.location && (
              <div className="flex items-center gap-0.5 text-xs text-gray-400 mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{customer.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Car Block ───────────────────────────────────── */}
        <div className="bg-gray-50 rounded-xl p-3 mb-3">
          <div className="flex gap-3 mb-3">
            {car.thumbnail ? (
              <img src={car.thumbnail} alt={car.model} className="w-[72px] h-14 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-[72px] h-14 rounded-lg bg-gray-200 shrink-0" />
            )}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="font-bold text-gray-800 text-sm leading-tight truncate">
                {car.model}{car.year ? ` ${car.year}` : ""}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                ODO: {car.odo ? `${car.odo.toLocaleString()} km` : "N/A"}
              </div>
              {car.location && (
                <div className="flex items-center gap-0.5 text-xs text-gray-400 mt-0.5">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{car.location}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Kỳ vọng:</span>
              <span className="font-semibold text-gray-800">
                {car.price_expected ? `${car.price_expected} Tr` : "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Giá Max:</span>
              <span className={`font-semibold ${car.price_max ? "text-red-500" : "text-gray-400"}`}>
                {car.price_max ? `${car.price_max} Tr` : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Trigger ─────────────────────────────────────── */}
        <div className="mb-4">
          {isSLA ? (
            <div className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg ${triggerBg}`}>
              <Clock className="w-3.5 h-3.5" />
              {trigger.time_string ?? "—"}
            </div>
          ) : (
            <div className="space-y-2">
              <div className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg ${triggerBg}`}>
                ⚡ {trigger.intent ?? "Escalation"}
              </div>
              {trigger.keywords && trigger.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {trigger.keywords.map((kw, i) => (
                    <span key={i} className="text-[11px] font-medium px-1.5 py-0.5 rounded border border-purple-200 bg-purple-50 text-purple-700">
                      &quot;{kw}&quot;
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Step Progress ───────────────────────────────── */}
        {lead.steps.length > 0 && (
          <div className="mb-3">
            <StepStrip steps={lead.steps} />
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">{timeAgo}</span>
            {pic_name && (
              <span className="text-[10px] font-medium text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded truncate max-w-[72px]" title={pic_name}>
                {pic_name}
              </span>
            )}
          </div>

          {car.has_images && (
            <span className="flex items-center gap-1 text-xs font-medium text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full">
              <EyeOff className="w-3 h-3" />
              Che biển
            </span>
          )}
        </div>
      </div>

      {/* ── Hover: Xem chi tiết (slides up from bottom) ── */}
      <div
        onClick={handleDetail}
        className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200 bg-blue-600 text-white text-sm font-semibold py-2.5 text-center hover:bg-blue-700 cursor-pointer select-none"
      >
        Xem chi tiết
      </div>
    </div>
  )
}
