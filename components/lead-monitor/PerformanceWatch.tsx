"use client"

import { useEffect, useState, useCallback } from "react"
import { TrendingUp, AlertTriangle, Clock, CheckCircle2, XCircle, Activity, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

type RangeDays = 7 | 30 | 90

interface StepStat {
  step_key: string
  label: string
  sla_hours: number
  total: number
  ongoing: number
  failed: number
  success: number
  currently_breached: number
  breach_rate: number
  avg_overdue_formatted: string
}

interface TrendPoint {
  day: string
  total: number
  breached: number
}

interface SLAStats {
  period_days: number
  summary: {
    total: number
    ongoing: number
    currently_breached: number
    success: number
    failed: number
    breach_rate: number
  }
  steps: StepStat[]
  trend: TrendPoint[]
}

const STEP_META: Record<string, { dot: string; bar: string; bg: string; text: string }> = {
  zalo_connect:        { dot: "bg-blue-500",   bar: "bg-blue-500",   bg: "bg-blue-50",   text: "text-blue-700" },
  thu_thap_thong_tin:  { dot: "bg-purple-500", bar: "bg-purple-500", bg: "bg-purple-50", text: "text-purple-700" },
  dat_lich_kiem_dinh:  { dot: "bg-amber-500",  bar: "bg-amber-500",  bg: "bg-amber-50",  text: "text-amber-700" },
  dam_phan_1:          { dot: "bg-orange-500", bar: "bg-orange-500", bg: "bg-orange-50", text: "text-orange-700" },
}

function rateColor(rate: number): string {
  if (rate >= 0.6) return "text-red-600"
  if (rate >= 0.4) return "text-amber-500"
  return "text-emerald-600"
}

function rateBarColor(rate: number): string {
  if (rate >= 0.6) return "bg-red-500"
  if (rate >= 0.4) return "bg-amber-400"
  return "bg-emerald-500"
}

function rateBg(rate: number): string {
  if (rate >= 0.6) return "bg-red-50 border-red-100"
  if (rate >= 0.4) return "bg-amber-50 border-amber-100"
  return "bg-emerald-50 border-emerald-100"
}

function pct(rate: number) {
  return `${(rate * 100).toFixed(1)}%`
}

// Mini sparkline from trend data
function TrendSparkline({ trend }: { trend: TrendPoint[] }) {
  if (trend.length < 2) return null
  const maxVal = Math.max(...trend.map((t) => t.total), 1)
  const W = 120
  const H = 32
  const pts = trend.map((t, i) => {
    const x = (i / (trend.length - 1)) * W
    const y = H - (t.total / maxVal) * H
    return `${x},${y}`
  })
  const bPts = trend.map((t, i) => {
    const x = (i / (trend.length - 1)) * W
    const y = H - (t.breached / maxVal) * H
    return `${x},${y}`
  })
  return (
    <svg width={W} height={H} className="opacity-70">
      <polyline points={pts.join(" ")} fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinejoin="round" />
      <polyline points={bPts.join(" ")} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function KPICard({
  icon,
  label,
  value,
  sub,
  color,
  loading,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color: string
  loading: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      {loading ? (
        <>
          <div className="h-7 bg-gray-100 rounded animate-pulse w-16" />
          <div className="h-3.5 bg-gray-100 rounded animate-pulse w-24" />
        </>
      ) : (
        <>
          <div className="text-2xl font-bold text-gray-900 leading-none">{value}</div>
          <div className="text-xs text-gray-400 font-medium">{label}</div>
          {sub && <div className="text-xs text-gray-300">{sub}</div>}
        </>
      )}
    </div>
  )
}

export function PerformanceWatch() {
  const [days, setDays] = useState<RangeDays>(30)
  const [data, setData] = useState<SLAStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/lead-monitor/sla-stats?days=${days}`)
      const json = await res.json()
      setData(json)
    } catch {
      // keep stale data
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { fetchStats() }, [fetchStats])

  const s = data?.summary
  const steps = data?.steps ?? []

  return (
    <div className="h-full overflow-y-auto scrollbar-none px-4 py-2">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Hiệu suất SLA</h3>
          <p className="text-xs text-gray-400 mt-0.5">Tỷ lệ xe đang vượt hạn SLA theo từng bước</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Range toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-medium">
            {([7, 30, 90] as RangeDays[]).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-md transition-colors ${days === d ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                {d}n
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchStats} className="gap-1.5 h-8 text-xs">
            <RotateCcw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── KPI Summary ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KPICard
          icon={<Activity className="w-4 h-4 text-blue-600" />}
          label="Tổng SLA logs"
          value={s?.total ?? "—"}
          sub={`trong ${days} ngày qua`}
          color="bg-blue-50"
          loading={loading}
        />
        <KPICard
          icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
          label="Đang vi phạm"
          value={s?.currently_breached ?? "—"}
          sub={`/ ${s?.ongoing ?? "—"} đang chạy`}
          color="bg-red-50"
          loading={loading}
        />
        <KPICard
          icon={<TrendingUp className="w-4 h-4 text-amber-500" />}
          label="Tỷ lệ vi phạm"
          value={s ? pct(s.breach_rate) : "—"}
          sub={s ? (s.breach_rate >= 0.4 ? "⚠ Cần chú ý" : "✓ Trong ngưỡng") : undefined}
          color="bg-amber-50"
          loading={loading}
        />
        <KPICard
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          label="Hoàn thành đúng hạn"
          value={s ? pct(s.total > 0 ? s.success / s.total : 0) : "—"}
          sub={`${s?.success ?? "—"} xe thành công`}
          color="bg-emerald-50"
          loading={loading}
        />
      </div>

      {/* ── Per-step breakdown ───────────────────────────────────────────── */}
      <div className="space-y-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-40 mb-3" />
                <div className="h-2.5 bg-gray-100 rounded w-full mb-2" />
                <div className="h-3 bg-gray-100 rounded w-24" />
              </div>
            ))
          : steps.map((step) => {
              const meta = STEP_META[step.step_key] ?? { dot: "bg-gray-400", bar: "bg-gray-400", bg: "bg-gray-50", text: "text-gray-700" }
              const hasOngoing = step.ongoing > 0

              return (
                <div
                  key={step.step_key}
                  className={`bg-white rounded-2xl border shadow-sm p-4 ${step.breach_rate >= 0.6 ? "border-red-100" : step.breach_rate >= 0.4 ? "border-amber-100" : "border-gray-100"}`}
                >
                  {/* Row 1: Step name + rate */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
                      <span className="font-semibold text-gray-800 text-sm">{step.label}</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                        SLA {step.sla_hours}h
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-bold tabular-nums leading-none ${rateColor(step.breach_rate)}`}>
                        {hasOngoing ? pct(step.breach_rate) : "—"}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {step.currently_breached}/{step.ongoing} đang vi phạm
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Breach rate bar */}
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${rateBarColor(step.breach_rate)}`}
                      style={{ width: hasOngoing ? `${step.breach_rate * 100}%` : "0%" }}
                    />
                  </div>

                  {/* Row 3: Status pills + avg overdue */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        {step.success} thành công
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-full">
                        <XCircle className="w-3 h-3" />
                        {step.failed} thất bại
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                        <Activity className="w-3 h-3" />
                        {step.ongoing} đang chạy
                      </span>
                    </div>
                    {step.currently_breached > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Clock className="w-3 h-3 text-red-400" />
                        TB vượt: <span className="font-semibold text-red-500 ml-0.5">{step.avg_overdue_formatted}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
      </div>

      {/* ── Trend mini chart ────────────────────────────────────────────── */}
      {!loading && data && data.trend.length >= 2 && (
        <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-gray-800">Xu hướng {days} ngày</div>
              <p className="text-xs text-gray-400 mt-0.5">Số SLA logs tạo mới mỗi ngày</p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-gray-400">
                <span className="inline-block w-6 h-0.5 bg-gray-300 rounded" /> Tổng
              </span>
              <span className="flex items-center gap-1.5 text-red-500">
                <span className="inline-block w-6 h-0.5 bg-red-400 rounded" /> Vi phạm
              </span>
            </div>
          </div>
          <TrendSparkline trend={data.trend} />
        </div>
      )}

      {/* ── Footer note ─────────────────────────────────────────────────── */}
      <div className="mt-4 mb-6 flex items-start gap-1.5 text-xs text-gray-400">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
        <span>Tỷ lệ vi phạm = số xe ongoing đang quá hạn SLA / tổng xe đang ở bước đó. Lọc trong {days} ngày gần nhất.</span>
      </div>
    </div>
  )
}
