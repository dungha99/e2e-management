"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { RefreshCcw, AlertTriangle, Clock } from "lucide-react"
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts"
import { BotAtRiskDrilldown } from "./BotAtRiskDrilldown"
import { cn } from "@/lib/utils"

interface BotAtRiskCardProps {
  filters?: {
    dateRange?: { from?: Date; to?: Date }
    picId?: string
  }
}

export function BotAtRiskCard({ filters }: BotAtRiskCardProps) {
  const [threshold, setThreshold] = useState<string>("15")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string>("")

  // Stabilize filter values into primitives to avoid infinite re-render loops
  const startDateISO = filters?.dateRange?.from?.toISOString() ?? ""
  const endDateISO = filters?.dateRange?.to?.toISOString() ?? ""
  const picId = filters?.picId ?? "all"

  const fetchData = useCallback(async (isAuto = false) => {
    if (!isAuto) setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append("threshold", threshold)
      if (startDateISO) {
        params.append("startDate", startDateISO)
      }
      if (endDateISO) {
        params.append("endDate", endDateISO)
      }
      if (picId && picId !== 'all') {
        params.append("picId", picId)
      }

      const res = await fetch(`/api/ai-funnel/bot-at-risk?${params.toString()}`)
      const resData = await res.json()
      setData(resData)
      setLastUpdated(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }))
    } catch (error) {
      console.error("Error fetching bot at-risk data:", error)
    } finally {
      if (!isAuto) setLoading(false)
    }
  }, [threshold, startDateISO, endDateISO, picId])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(true), 2 * 60 * 1000) // 2 minutes
    return () => clearInterval(interval)
  }, [fetchData])

  const chartData = data?.buckets ? [
    { name: "<15m", value: data.buckets.lt15, color: "#10b981" },
    { name: "15-30m", value: data.buckets.m15to30, color: "#f59e0b" },
    { name: "30-60m", value: data.buckets.m30to60, color: "#f97316" },
    { name: "1-2h", value: data.buckets.h1to2, color: "#ef4444" },
    { name: ">2h", value: data.buckets.gt2h, color: "#991b1b" },
  ] : []

  const count = data?.count || 0
  const colorClass = count === 0 ? "border-emerald-500" : count <= 10 ? "border-amber-500" : "border-red-500"
  const textClass = count === 0 ? "text-emerald-600" : count <= 10 ? "text-amber-600" : "text-red-600"

  return (
    <Card className={cn("relative overflow-hidden transition-all border-l-4 shadow-sm", colorClass)}>
      <CardHeader className="pb-2 space-y-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className={cn("h-4 w-4", textClass)} />
              Bot at-risk
            </CardTitle>
            <CardDescription className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mt-0.5">
              Chat Agent stalling monitor
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-1">
              {lastUpdated} <RefreshCcw className={cn("h-2.5 w-2.5 cursor-pointer", loading && "animate-spin")} onClick={() => fetchData()} />
            </span>
            <Select value={threshold} onValueChange={setThreshold}>
              <SelectTrigger className="h-7 w-[95px] text-[10px] font-semibold bg-white border-gray-200">
                <SelectValue placeholder="Threshold" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5" className="text-xs">5 phút</SelectItem>
                <SelectItem value="15" className="text-xs">15 phút</SelectItem>
                <SelectItem value="30" className="text-xs">30 phút</SelectItem>
                <SelectItem value="60" className="text-xs">1 giờ</SelectItem>
                <SelectItem value="120" className="text-xs">2 giờ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        <div 
          className="flex flex-col items-center justify-center py-2 cursor-pointer group"
          onClick={() => setIsDrilldownOpen(true)}
        >
          <p className={cn("text-5xl font-black tracking-tighter leading-none group-hover:scale-105 transition-transform", textClass)}>
            {count}
          </p>
          <div className="flex items-center gap-1 mt-2 text-xs font-bold text-gray-500 uppercase tracking-tight">
            leads chưa được reply
            <Clock className="h-3 w-3" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-center font-medium">
            Khách nhắn {'>'} {threshold} phút chưa có phản hồi từ bot
          </p>
        </div>

        {/* Visualization Area */}
        <div className="h-[120px] w-full pt-2 border-t border-dashed border-gray-100">
          <p className="text-[9px] uppercase font-bold text-muted-foreground mb-2 flex items-center justify-between">
            <span>Phân bổ thời gian chờ (Tất cả)</span>
            <span className="text-gray-400 font-mono normal-case">Total: {data?.buckets ? Object.values(data.buckets).reduce((a: number, b: any) => a + (b || 0), 0) : 0}</span>
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                fontSize={8} 
                fontFamily="inherit" 
                interval={0}
              />
              <YAxis hide={true} />
              <Tooltip 
                contentStyle={{ fontSize: '10px', borderRadius: '6px', border: 'none' }}
                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
              />
              <Bar 
                dataKey="value" 
                radius={[4, 4, 0, 0]} 
                animationDuration={1500}
                animationEasing="ease-out"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>

      <BotAtRiskDrilldown 
        isOpen={isDrilldownOpen} 
        onClose={() => setIsDrilldownOpen(false)} 
        threshold={parseInt(threshold)}
        carIds={data?.carIds || []}
        picId={picId}
      />
    </Card>
  )
}
