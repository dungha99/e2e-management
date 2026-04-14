"use client"

import { useEffect, useState, Suspense } from "react"
import { AiFunnelDashboard } from "@/components/ai-funnel/AiFunnelDashboard"
import { DateRange } from "react-day-picker"
import { startOfMonth, endOfDay } from "date-fns"

function DashboardPageContent() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Default to this month
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfDay(new Date())
  })
  const [picId, setPicId] = useState<string>("all")
  const [source, setSource] = useState<string>("all")

  useEffect(() => {
    setLoading(true)
    let url = "/api/ai-funnel/dashboard"
    const params = new URLSearchParams()
    
    if (dateRange?.from && dateRange?.to) {
      params.append("startDate", dateRange.from.toISOString())
      params.append("endDate", dateRange.to.toISOString())
    }
    if (picId && picId !== "all") {
      params.append("picId", picId)
    }
    if (source && source !== "all") {
      params.append("source", source)
    }
    
    const queryString = params.toString()
    if (queryString) url += `?${queryString}`

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [dateRange, picId, source])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">Đang tải dashboard...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-destructive font-medium">Lỗi tải dữ liệu</p>
          <p className="text-muted-foreground text-sm mt-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
          >
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  return (
    <AiFunnelDashboard 
      data={data} 
      loading={loading}
      filters={{ dateRange, picId, source }}
      onFilterChange={(newFilters: any) => {
        if (newFilters.dateRange !== undefined) setDateRange(newFilters.dateRange)
        if (newFilters.picId !== undefined) setPicId(newFilters.picId)
        if (newFilters.source !== undefined) setSource(newFilters.source)
      }}
    />
  )
}

export default function AiFunnelPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <DashboardPageContent />
    </Suspense>
  )
}
