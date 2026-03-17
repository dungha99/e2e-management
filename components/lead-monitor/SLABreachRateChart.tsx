"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"

interface SLABreachRateItem {
  step_key: string
  label: string
  breach_count: number
  total: number
  rate: number
}

const STEP_COLORS: Record<string, { bar: string; badge: string; text: string }> = {
  zalo_connect:        { bar: "bg-blue-500",   badge: "bg-blue-50 text-blue-700",   text: "text-blue-600" },
  thu_thap_thong_tin:  { bar: "bg-purple-500", badge: "bg-purple-50 text-purple-700", text: "text-purple-600" },
  dat_lich_kiem_dinh:  { bar: "bg-amber-500",  badge: "bg-amber-50 text-amber-700",  text: "text-amber-600" },
  dam_phan_1:          { bar: "bg-orange-500", badge: "bg-orange-50 text-orange-700", text: "text-orange-600" },
  escalation:          { bar: "bg-red-500",    badge: "bg-red-50 text-red-700",      text: "text-red-600" },
}

function shortLabel(label: string) {
  return label.split(" — ")[0]
}

function rateColor(rate: number) {
  if (rate >= 0.6) return "text-red-600"
  if (rate >= 0.4) return "text-amber-600"
  return "text-green-600"
}

export function SLABreachRateChart() {
  const [data, setData] = useState<SLABreachRateItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/lead-monitor/sla-breach-rate")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-48 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (!data.length) {
    return <p className="text-sm text-gray-400">Không có dữ liệu</p>
  }

  const maxRate = Math.max(...data.map((d) => d.rate))

  return (
    <div className="space-y-5">
      {data.map((item) => {
        const colors = STEP_COLORS[item.step_key] ?? { bar: "bg-gray-400", badge: "bg-gray-50 text-gray-700", text: "text-gray-600" }
        const pct = maxRate > 0 ? (item.rate / maxRate) * 100 : 0

        return (
          <div key={item.step_key}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-700">{shortLabel(item.label)}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{item.breach_count}/{item.total}</span>
                <span className={`text-sm font-bold tabular-nums ${rateColor(item.rate)}`}>
                  {(item.rate * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}

      <div className="pt-2 border-t flex items-start gap-1.5 text-xs text-gray-400">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
        <span>Tỷ lệ vi phạm SLA = số xe quá hạn / tổng xe đang xử lý ở bước đó</span>
      </div>
    </div>
  )
}
