"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Clock, ChevronLeft, ChevronRight, Eye, MessageSquare, Timer, Calendar } from "lucide-react"

interface ActivityLogItem {
  event_name: string
  time: string
}

interface RecentActivityTabProps {
  phone: string | null
}

// Keywords to identify different activity types
const SESSION_VIEW_KEYWORDS = ['page_view', 'view', 'visit', 'session', 'load', 'open', 'click', 'scroll']
const CHAT_KEYWORDS = ['chat', 'message', 'send', 'reply', 'conversation', 'support', 'gửi', 'tin nhắn']

export function RecentActivityTab({ phone }: RecentActivityTabProps) {
  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([])
  const [loadingActivity, setLoadingActivity] = useState(false)
  const [activityPage, setActivityPage] = useState(1)
  const activityPerPage = 10

  useEffect(() => {
    if (phone) {
      fetchActivityLog(phone)
    } else {
      setActivityLog([])
    }
  }, [phone])

  async function fetchActivityLog(phone: string) {
    setLoadingActivity(true)
    setActivityPage(1)
    try {
      const response = await fetch(`/api/e2e/activity-log?phone=${encodeURIComponent(phone)}`)

      if (!response.ok) {
        setActivityLog([])
        return
      }

      const data = await response.json()
      setActivityLog(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("[E2E] Error fetching activity log:", error)
      setActivityLog([])
    } finally {
      setLoadingActivity(false)
    }
  }

  // Calculate aggregate metrics from activity log
  const aggregateMetrics = useMemo(() => {
    if (activityLog.length === 0) {
      return {
        sessionViews: 0,
        chatExchanges: 0,
        avgResponseTime: null as string | null,
        totalDaysSpent: 0
      }
    }

    // Count session views (page views, visits, etc.)
    const sessionViews = activityLog.filter(activity =>
      SESSION_VIEW_KEYWORDS.some(keyword =>
        activity.event_name.toLowerCase().includes(keyword)
      )
    ).length

    // Count chat exchanges (messages, chats, etc.)
    const chatExchanges = activityLog.filter(activity =>
      CHAT_KEYWORDS.some(keyword =>
        activity.event_name.toLowerCase().includes(keyword)
      )
    ).length

    // Calculate average response time between consecutive activities
    let avgResponseTime: string | null = null
    if (activityLog.length >= 2) {
      const sortedActivities = [...activityLog].sort((a, b) =>
        new Date(a.time).getTime() - new Date(b.time).getTime()
      )

      let totalDiff = 0
      let diffCount = 0

      for (let i = 1; i < sortedActivities.length; i++) {
        const prevTime = new Date(sortedActivities[i - 1].time).getTime()
        const currTime = new Date(sortedActivities[i].time).getTime()
        const diffMinutes = (currTime - prevTime) / (1000 * 60)

        // Only count reasonable response times (less than 24 hours)
        if (diffMinutes > 0 && diffMinutes < 1440) {
          totalDiff += diffMinutes
          diffCount++
        }
      }

      if (diffCount > 0) {
        const avgMinutes = totalDiff / diffCount
        if (avgMinutes < 60) {
          avgResponseTime = `${Math.round(avgMinutes)} phút`
        } else if (avgMinutes < 1440) {
          const hours = Math.floor(avgMinutes / 60)
          const mins = Math.round(avgMinutes % 60)
          avgResponseTime = `${hours}h ${mins}m`
        } else {
          avgResponseTime = `${Math.round(avgMinutes / 1440)} ngày`
        }
      }
    }

    // Calculate total days spent (from first to last activity)
    let totalDaysSpent = 0
    if (activityLog.length >= 1) {
      const sortedActs = [...activityLog].sort((a, b) =>
        new Date(a.time).getTime() - new Date(b.time).getTime()
      )
      const firstTime = new Date(sortedActs[0].time).getTime()
      const lastTime = new Date(sortedActs[sortedActs.length - 1].time).getTime()
      totalDaysSpent = Math.ceil((lastTime - firstTime) / (1000 * 60 * 60 * 24)) || 1 // At least 1 day
    }

    return {
      sessionViews: sessionViews || activityLog.length, // Fallback to total if no specific views found
      chatExchanges,
      avgResponseTime,
      totalDaysSpent
    }
  }, [activityLog])

  const totalActivityPages = Math.ceil(activityLog.length / activityPerPage)
  const startIndex = (activityPage - 1) * activityPerPage
  const endIndex = startIndex + activityPerPage
  const paginatedActivities = activityLog.slice(startIndex, endIndex)

  return (
    <div className="space-y-6">
      {/* Aggregate Metrics Section - Pill Style */}
      <div className="flex flex-wrap gap-3">
        {/* MONITORING */}
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200">
          <Eye className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Monitoring</span>
          <span className="text-sm font-bold">
            {loadingActivity ? <Loader2 className="h-3 w-3 animate-spin" /> : aggregateMetrics.sessionViews}
          </span>
        </div>

        {/* ENGAGEMENT */}
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-200">
          <MessageSquare className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Engagement</span>
          <span className="text-sm font-bold">
            {loadingActivity ? <Loader2 className="h-3 w-3 animate-spin" /> : aggregateMetrics.chatExchanges}
          </span>
        </div>

        {/* RESPONSE */}
        <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full border border-purple-200">
          <Timer className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Response</span>
          <span className="text-sm font-bold">
            {loadingActivity ? <Loader2 className="h-3 w-3 animate-spin" /> : (aggregateMetrics.avgResponseTime || 'N/A')}
          </span>
        </div>

        {/* TOTAL DAYS */}
        <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full border border-orange-200">
          <Calendar className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Total Days</span>
          <span className="text-sm font-bold">
            {loadingActivity ? <Loader2 className="h-3 w-3 animate-spin" /> : `${aggregateMetrics.totalDaysSpent} ngày`}
          </span>
        </div>
      </div>

      {/* Activity Log Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Hoạt động trên website</h3>
          {activityLog.length > 0 && (
            <p className="text-sm text-gray-500">
              Tổng cộng: <span className="font-semibold">{activityLog.length}</span> hoạt động
            </p>
          )}
        </div>

        {loadingActivity ? (
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-gray-400" />
            <p className="text-sm text-gray-400 mt-4">Đang tải hoạt động...</p>
          </div>
        ) : activityLog.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Clock className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">Chưa có hoạt động nào</p>
            <p className="text-xs mt-2">Các hoạt động của lead sẽ được hiển thị ở đây</p>
          </div>
        ) : (
          <>
            <div className="space-y-6 mb-6">
              {(() => {
                // Group paginated activities by date
                const groupedByDate: Record<string, typeof paginatedActivities> = {}
                paginatedActivities.forEach(activity => {
                  const date = new Date(activity.time)
                  const dateKey = date.toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                  if (!groupedByDate[dateKey]) {
                    groupedByDate[dateKey] = []
                  }
                  groupedByDate[dateKey].push(activity)
                })

                return Object.entries(groupedByDate).map(([dateLabel, activities]) => (
                  <div key={dateLabel}>
                    {/* Date Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1 bg-gray-200" />
                      <span className="text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        {dateLabel}
                      </span>
                      <div className="h-px flex-1 bg-gray-200" />
                    </div>

                    {/* Activities for this date */}
                    <div className="space-y-2">
                      {activities.map((activity, index) => (
                        <div
                          key={`${dateLabel}-${index}`}
                          className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex-shrink-0 w-2.5 h-2.5 bg-purple-500 rounded-full mt-1.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{activity.event_name}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(activity.time).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </div>

            {totalActivityPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Hiển thị {startIndex + 1}-{Math.min(endIndex, activityLog.length)} trong số {activityLog.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActivityPage(activityPage - 1)}
                    disabled={activityPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Trang {activityPage} / {totalActivityPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActivityPage(activityPage + 1)}
                    disabled={activityPage === totalActivityPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
