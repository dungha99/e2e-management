"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

type DecoyRecord = {
  id: string
  phone: string
  account: string
  segment?: string
  is_sent: boolean
  length_of_chat_history: number
  created_at: string
}

type Timeframe = "7days" | "30days" | "thisMonth" | "allTime"

export function Dashboard() {
  const [timeframe, setTimeframe] = useState<Timeframe>("allTime")
  const [allRecords, setAllRecords] = useState<DecoyRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllRecords()
  }, [])

  async function fetchAllRecords() {
    try {
      setLoading(true)
      const response = await fetch("/api/decoy/all")
      const data = await response.json()
      setAllRecords(data)
    } catch (error) {
      console.error("[v0] Error fetching decoy records:", error)
    } finally {
      setLoading(false)
    }
  }

  function getFilteredRecords(): DecoyRecord[] {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (timeframe) {
      case "7days":
        const sevenDaysAgo = new Date(startOfToday)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        return allRecords.filter((r) => new Date(r.created_at) >= sevenDaysAgo)

      case "30days":
        const thirtyDaysAgo = new Date(startOfToday)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        return allRecords.filter((r) => new Date(r.created_at) >= thirtyDaysAgo)

      case "thisMonth":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        return allRecords.filter((r) => new Date(r.created_at) >= startOfMonth)

      case "allTime":
      default:
        return allRecords
    }
  }

  const filteredRecords = getFilteredRecords()

  // Metric 1: Total Leads Sent (unique phones)
  const uniquePhonesSent = new Set(filteredRecords.filter((r) => r.is_sent).map((r) => r.phone))
  const totalLeadsSent = uniquePhonesSent.size

  // Metric 2: Response Rate (unique phones)
  const uniquePhonesReplied = new Set(
    filteredRecords.filter((r) => r.is_sent && r.length_of_chat_history > 1).map((r) => r.phone),
  )
  const repliedCount = uniquePhonesReplied.size
  const responseRate = totalLeadsSent > 0 ? (repliedCount / totalLeadsSent) * 100 : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Timeframe Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Khung thời gian:</span>
        <Select value={timeframe} onValueChange={(value) => setTimeframe(value as Timeframe)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">7 ngày qua</SelectItem>
            <SelectItem value="30days">30 ngày qua</SelectItem>
            <SelectItem value="thisMonth">Tháng này</SelectItem>
            <SelectItem value="allTime">Toàn thời gian</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metric 1: Total Leads Sent */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Tổng số Leads đã gửi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{totalLeadsSent}</div>
            <p className="text-xs text-muted-foreground mt-1">Unique leads</p>
          </CardContent>
        </Card>

        {/* Metric 2: Response Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Tỷ lệ Phản hồi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{responseRate.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {repliedCount} / {totalLeadsSent} leads
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
