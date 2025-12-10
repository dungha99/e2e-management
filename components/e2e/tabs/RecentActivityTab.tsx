"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Clock, ChevronLeft, ChevronRight } from "lucide-react"

interface ActivityLogItem {
  event_name: string
  time: string
}

interface RecentActivityTabProps {
  phone: string | null
}

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

  const totalActivityPages = Math.ceil(activityLog.length / activityPerPage)
  const startIndex = (activityPage - 1) * activityPerPage
  const endIndex = startIndex + activityPerPage
  const paginatedActivities = activityLog.slice(startIndex, endIndex)

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Hoạt động gần đây</h3>
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
          <div className="space-y-4 mb-6">
            {paginatedActivities.map((activity, index) => (
              <div
                key={startIndex + index}
                className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div className="flex-shrink-0 w-3 h-3 bg-purple-500 rounded-full mt-1.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-gray-900">{activity.event_name}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    {new Date(activity.time).toLocaleString('vi-VN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
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
  )
}
