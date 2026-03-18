"use client"

import { AlertTriangle, Zap, Bot } from "lucide-react"

interface KPIRibbonProps {
  needsAction: number
  escalation: number
  botActive: number
  loading: boolean
}

export function KPIRibbon({ needsAction, escalation, botActive, loading }: KPIRibbonProps) {
  if (loading) {
    return (
      <div className="flex items-stretch w-full bg-white rounded-xl border border-gray-100 mb-5 overflow-hidden">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 px-6 py-4 animate-pulse border-r border-gray-100 last:border-r-0">
            <div className="h-3 bg-gray-100 rounded w-28 mb-3" />
            <div className="h-9 bg-gray-100 rounded w-12" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-stretch w-full bg-white rounded-xl border border-gray-100 mb-5 overflow-hidden shadow-sm">

      {/* CẦN XỬ LÝ */}
      <div className="flex-1 px-6 py-4 border-r border-gray-100">
        <div className="flex items-center gap-1.5 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" strokeWidth={2.5} />
          <span className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">Cần xử lý</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-gray-900 leading-none">{needsAction}</span>
          <span className="text-sm font-medium text-gray-400">alerts</span>
        </div>
      </div>

      {/* ESCALATION */}
      <div className="flex-1 px-6 py-4 border-r border-gray-100">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="w-3.5 h-3.5 text-orange-500" strokeWidth={2.5} />
          <span className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">Escalation</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-gray-900 leading-none">{escalation}</span>
          <span className="text-sm font-medium text-gray-400">chưa resolve</span>
        </div>
      </div>

      {/* BOT TỰ XỬ LÝ */}
      <div className="flex-1 px-6 py-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Bot className="w-3.5 h-3.5 text-violet-500" strokeWidth={2.5} />
          <span className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">Bot tự xử lý</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-gray-900 leading-none">{botActive}</span>
          <span className="text-sm font-medium text-gray-400">/ {needsAction + escalation} leads</span>
        </div>
      </div>

    </div>
  )
}
