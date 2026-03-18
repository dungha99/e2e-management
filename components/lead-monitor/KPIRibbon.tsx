"use client"

interface KPIRibbonProps {
  needsAction: number
  escalation: number
  botActive: number
  loading: boolean
}

export function KPIRibbon({ needsAction, escalation, botActive, loading }: KPIRibbonProps) {
  if (loading) {
    return (
      <div className="flex items-center w-full bg-white mb-6 border-b pb-4 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 px-4 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-24 mb-2" />
            <div className="h-9 bg-gray-100 rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center w-full bg-white mb-6 border-b pb-4">
      {/* CẦN XỬ LÝ */}
      <div className="flex-1 px-4 flex flex-col justify-center border-r">
        <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 mb-1">
          <span className="text-red-500">⚠</span> CẦN XỬ LÝ
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold">{needsAction}</span>
          <span className="text-sm font-medium text-gray-400">leads</span>
        </div>
      </div>

      {/* ESCALATION */}
      <div className="flex-1 px-4 flex flex-col justify-center border-r">
        <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 mb-1">
          <span className="text-purple-500">⚡</span> ESCALATION
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold">{escalation}</span>
          <span className="text-sm font-medium text-gray-400">chưa resolve</span>
        </div>
      </div>

      {/* BOT TỰ XỬ LÝ */}
      <div className="flex-1 px-4 flex flex-col justify-center">
        <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 mb-1">
          <span className="text-green-500">🤖</span> BOT TỰ XỬ LÝ
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold">{botActive}</span>
          <span className="text-sm font-medium text-gray-400">leads</span>
        </div>
      </div>
    </div>
  )
}
