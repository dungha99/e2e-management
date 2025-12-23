"use client"

import { useEffect, useState, forwardRef, useImperativeHandle } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RefreshCw } from "lucide-react"

const ACCOUNTS_TO_MONITOR = [
  {
    displayName: "Minh Anh",
    apiKey: "MA",
    description:
      "Người phụ nữ xinh đẹp thông minh, người mua am hiểu, tự tin. Chiến lược là dùng dữ liệu thị trường để đàm phán sòng phẳng về một mức giá hợp lý.",
    avatar: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Minh%20Anh-bKEhRfZrpweZWjfZHziFDOJlRF0gpN.jpg",
  },
  {
    displayName: "Huy Hồ",
    apiKey: "HH",
    description:
      "Nam nhân, người mua lần đầu, cẩn thận. Chiến lược là dùng tâm lý thiện chí, tình cảm, soi lỗi thương lượng giá xuống mức thấp nhất có thể.",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Huy%20Ho%CC%82%CC%80-pO3qnW3hkh2p6iLHXSBs8hGn1ZW1Pf.jpg",
  },
  {
    displayName: "Hùng Taxi",
    apiKey: "HT",
    description:
      "Tài xế công nghệ, cần xe gấp để kiếm cơm. Chiến lược dùng chi phí dọn xe để trừ tiền cộng với việc kể khổ để xin bớt. Phù hợp cho xe lỗi, xe cỏ, hoặc tệp khách tài xế dễ đồng cảm.",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Hung%20Taxi%20avatar-LUGqfwziGvaCwNAVPFyUTYKQLL2WzB.jpg",
  },
]

const DAILY_LIMIT = 20

interface AccountStatus {
  displayName: string
  sentToday: number
  dailyLimit: number
  totalSent: number
}

export const AccountStatusPanel = forwardRef<{ refresh: () => void }>((props, ref) => {
  const [accountStats, setAccountStats] = useState<AccountStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    console.log("[v0] AccountStatusPanel mounted, fetching account status...")
    fetchAccountStatus()
  }, [])

  useImperativeHandle(ref, () => ({
    refresh: fetchAccountStatus,
  }))

  async function fetchAccountStatus() {
    console.log("[v0] Starting account status fetch for", ACCOUNTS_TO_MONITOR.length, "accounts...")
    setLoading(true)
    setError(null)

    try {
      const statsPromises = ACCOUNTS_TO_MONITOR.map(async (account) => {
        console.log("[v0] Fetching data for account:", account.displayName, "API Key:", account.apiKey)
        const response = await fetch("/api/decoy/by-account", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ account: account.apiKey }),
        })

        if (!response.ok) {
          console.error("[v0] Failed to fetch data for", account.displayName, "Status:", response.status)
          throw new Error(`Failed to fetch data for ${account.displayName}`)
        }

        const jobs = await response.json()
        console.log("[v0] Received", jobs.length, "jobs for account:", account.displayName)

        const now = new Date()
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

        const sentTodayCount = jobs.filter((job: any) => {
          if (!job.is_sent) return false
          const createdAt = new Date(job.created_at)
          return createdAt >= twentyFourHoursAgo && createdAt <= now
        }).length

        const totalSentCount = jobs.length

        console.log(
          "[v0] Account",
          account.displayName,
          "- Sent today:",
          sentTodayCount,
          "of",
          DAILY_LIMIT,
          "- Total sent:",
          totalSentCount,
        )

        return {
          displayName: account.displayName,
          sentToday: sentTodayCount,
          dailyLimit: DAILY_LIMIT,
          totalSent: totalSentCount,
        }
      })

      const stats = await Promise.all(statsPromises)
      console.log("[v0] Account status fetch complete. Stats:", stats)
      setAccountStats(stats)
      setLastUpdated(new Date())
    } catch (err) {
      console.error("[v0] Error fetching account status:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch account status")
    } finally {
      setLoading(false)
    }
  }

  function getProgressColor(sentToday: number, limit: number): string {
    const percentage = (sentToday / limit) * 100
    if (percentage <= 70) return "bg-green-500"
    if (percentage <= 90) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <Card className="h-fit shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 pt-3">
        <CardTitle className="text-sm font-semibold">Decoy Personas</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchAccountStatus} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        {lastUpdated && (
          <p className="text-[10px] text-muted-foreground text-center mb-2">
            Cập nhật: {lastUpdated.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}

        {loading && accountStats.length === 0 ? (
          <div className="space-y-2">
            {ACCOUNTS_TO_MONITOR.map((account) => (
              <div key={account.apiKey} className="space-y-2 p-2 rounded-lg bg-muted/30 animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-2 bg-muted rounded w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={fetchAccountStatus} size="sm" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {accountStats.map((account) => {
              const accountConfig = ACCOUNTS_TO_MONITOR.find((a) => a.displayName === account.displayName)
              const percentage = (account.sentToday / account.dailyLimit) * 100

              return (
                <div
                  key={account.displayName}
                  className="space-y-2 p-2 rounded-lg bg-gradient-to-br from-muted/30 to-muted/10 border border-border/50"
                >
                  {/* Profile Header */}
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 border border-primary/20">
                      <AvatarImage src={accountConfig?.avatar || "/placeholder.svg"} alt={account.displayName} />
                      <AvatarFallback className="text-xs font-semibold">
                        {account.displayName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{account.displayName}</h3>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Hôm nay</span>
                      <span className="text-xs font-semibold text-primary">
                        {account.sentToday}/{account.dailyLimit}
                      </span>
                    </div>
                    <Progress value={percentage} className="h-1.5" />
                  </div>

                  {/* Total Sent Metric */}
                  <div className="text-[10px] text-muted-foreground">
                    Tổng: <span className="font-medium text-foreground">{account.totalSent.toLocaleString()}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
})

AccountStatusPanel.displayName = "AccountStatusPanel"
