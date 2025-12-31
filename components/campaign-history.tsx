"use client"

import { useEffect, useState, forwardRef, useImperativeHandle } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Loader2, RefreshCw, MessageCircle, Eye, Send, UserCog } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { maskPhone } from "@/lib/utils"

interface Job {
  id: string
  phone: string
  account: string
  is_sent: boolean
  created_at: string
  chat_history: {
    messages: Array<{
      role: "user" | "bot"
      content: string
    }>
  } | null
  length_of_chat_history: number
}

interface LeadContext {
  lead_info: {
    created_at: string
    user_name: string
    stage: string | null
    price_customer: number | null
    price_highest_bid: number | null
  }
  car_info: {
    brand: string
    model: string
    variant: string
    year: number
    mileage: number
    car_location: string
    is_inspection: boolean
  }
}

export const CampaignHistory = forwardRef<{ refresh: () => void }>((props, ref) => {
  const [jobs, setJobs] = useState<Job[]>([])
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const [phoneSearch, setPhoneSearch] = useState<string>("")

  const [showAllJobs, setShowAllJobs] = useState(false)

  // Filter states
  const [accountFilter, setAccountFilter] = useState<string>("all") // Renamed from picFilter
  const [sendStatusFilter, setSendStatusFilter] = useState<string>("all")
  const [responseStatusFilter, setResponseStatusFilter] = useState<string>("all")

  // Chat modal state
  const [selectedChat, setSelectedChat] = useState<Job | null>(null)
  const [chatModalOpen, setChatModalOpen] = useState(false)

  // Lead details modal state
  const [leadDetailsModalOpen, setLeadDetailsModalOpen] = useState(false)
  const [leadDetailsLoading, setLeadDetailsLoading] = useState(false)
  const [leadDetailsData, setLeadDetailsData] = useState<LeadContext | null>(null)
  const [leadDetailsError, setLeadDetailsError] = useState<string | null>(null)

  const [sendOtherBotModalOpen, setSendOtherBotModalOpen] = useState(false)
  const [sendOtherBotPhone, setSendOtherBotPhone] = useState<string>("")
  const [sendOtherBotAccount, setSendOtherBotAccount] = useState<string>("")
  const [sendingOtherBot, setSendingOtherBot] = useState(false)

  // Rename confirmation dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renamePhone, setRenamePhone] = useState<string>("")
  const [renameShopId, setRenameShopId] = useState<string>("")
  const [renaming, setRenaming] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    console.log("[v0] CampaignHistory mounted, fetching jobs...")
    fetchJobs()
  }, [])

  useEffect(() => {
    console.log(
      "[v0] Applying filters - Account:",
      accountFilter,
      "Send:",
      sendStatusFilter,
      "Response:",
      responseStatusFilter,
      "Phone:",
      phoneSearch,
    )
    applyFilters()
  }, [accountFilter, sendStatusFilter, responseStatusFilter, phoneSearch, jobs])

  useImperativeHandle(ref, () => ({
    refresh: fetchJobs,
  }))

  async function fetchJobs() {
    console.log("[v0] Fetching all jobs from API...")
    setLoading(true)
    try {
      const response = await fetch("/api/decoy/all")
      const data = await response.json()
      console.log("[v0] Fetched", data.length, "jobs:", data)
      setJobs(data)
      setFilteredJobs(data)
      setLastUpdated(new Date())
    } catch (error) {
      console.error("[v0] Error fetching jobs:", error)
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    let filtered = [...jobs]

    if (phoneSearch.trim() !== "") {
      filtered = filtered.filter((job) => job.phone.includes(phoneSearch.trim()))
    }

    if (accountFilter !== "all") {
      filtered = filtered.filter((job) => job.account === accountFilter)
    }

    if (sendStatusFilter === "sent") {
      filtered = filtered.filter((job) => job.is_sent === true)
    } else if (sendStatusFilter === "not_sent") {
      filtered = filtered.filter((job) => job.is_sent === false)
    }

    if (responseStatusFilter === "replied") {
      filtered = filtered.filter((job) => job.length_of_chat_history > 1)
    } else if (responseStatusFilter === "not_replied") {
      filtered = filtered.filter((job) => job.length_of_chat_history <= 1)
    }

    console.log("[v0] Filtered jobs:", filtered.length, "of", jobs.length)
    setFilteredJobs(filtered)
  }

  function openChatModal(job: Job) {
    console.log("[v0] Opening chat modal for phone:", job.phone)
    setSelectedChat(job)
    setChatModalOpen(true)
  }

  async function openLeadDetailsModal(phone: string) {
    console.log("[v0] Opening lead details modal for phone:", phone)
    setLeadDetailsModalOpen(true)
    setLeadDetailsLoading(true)
    setLeadDetailsError(null)
    setLeadDetailsData(null)

    try {
      console.log("[v0] Fetching lead context for phone:", phone)
      const response = await fetch("/api/leads/lead-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })

      if (!response.ok) {
        throw new Error("Failed to fetch lead context")
      }

      const data = await response.json()
      console.log("[v0] Lead context fetched successfully:", data)
      setLeadDetailsData(data)
    } catch (error) {
      console.error("[v0] Error fetching lead context:", error)
      setLeadDetailsError("Không thể tải thông tin lead. Vui lòng thử lại.")
    } finally {
      setLeadDetailsLoading(false)
    }
  }

  function openSendOtherBotModal(phone: string, currentAccount: string) {
    console.log("[v0] Opening send other bot modal for phone:", phone, "current account:", currentAccount)
    setSendOtherBotPhone(phone)

    // Determine which account hasn't sent to this phone yet
    const otherAccount = currentAccount === "MA" ? "HH" : "MA"
    setSendOtherBotAccount(otherAccount)
    setSendOtherBotModalOpen(true)
  }

  async function sendWithOtherBot() {
    console.log("[v0] Sending campaign with other bot:", sendOtherBotAccount, "to phone:", sendOtherBotPhone)
    setSendingOtherBot(true)

    try {
      let accountConfig
      if (sendOtherBotAccount === "MA") {
        accountConfig = {
          account: "MA",
          shop_id: "68c11ae4-b7f5-3ee3-7614-5cc200000000",
          default_message: "em dc bên kết nối chào xe. xe nhà mình còn hong. gđ e xin thêm thông tin á anh",
        }
      } else if (sendOtherBotAccount === "HH") {
        accountConfig = {
          account: "HH",
          shop_id: "68c11ae4-b7f5-3ee3-7614-5cc200000000",
          default_message:
            "Em được giới thiệu mình có nhu cầu bán xe em kết bạn để hỏi thêm ít thông tin được không ạ? Xe còn ko a",
        }
      } else {
        accountConfig = {
          account: "HT",
          shop_id: "68ff3282-a3cd-ba1d-a71a-1b7100000000",
          default_message:
            "Anh ơi, em là tài xế công nghệ đang cần mua xe gấp để chạy kiếm sống. Em thấy xe nhà anh đăng bán, không biết xe còn không ạ? Em muốn hỏi thêm thông tin với giá cả để tính toán xem có phù hợp không ạ.",
        }
      }

      // Step 1: Create job
      const createResponse = await fetch("/api/decoy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: sendOtherBotPhone,
          shop_id: accountConfig.shop_id,
          first_message: accountConfig.default_message,
          account: accountConfig.account,
          is_sent: false,
        }),
      })

      const createdJob = await createResponse.json()

      if (!createdJob.id) {
        throw new Error("Failed to create job")
      }

      // Step 2: Trigger webhook
      await fetch("https://n8n.vucar.vn/webhook/57039721-04a9-42a1-945c-fdd24250e6a8", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: createdJob.id,
          phone: createdJob.phone,
          shop_id: createdJob.shop_id,
          first_message: createdJob.first_message,
          account: createdJob.account,
        }),
      })

      toast({
        title: "✓ Đã gửi thành công",
        description: `Đã gửi tin nhắn từ ${sendOtherBotAccount === "MA" ? "Minh Anh" : sendOtherBotAccount === "HH" ? "Huy Hồ" : "Hùng Taxi"} đến ${sendOtherBotPhone}`,
        className: "bg-green-50 border-green-200",
      })

      setSendOtherBotModalOpen(false)
      fetchJobs() // Refresh the table
    } catch (error) {
      console.error("[v0] Error sending with other bot:", error)
      toast({
        title: "✗ Gửi thất bại",
        description: "Không thể gửi tin nhắn. Vui lòng thử lại.",
        variant: "destructive",
      })
    } finally {
      setSendingOtherBot(false)
    }
  }

  function openRenameDialog(phone: string, shopId: string) {
    console.log("[v0] Opening rename dialog for phone:", phone, "shop_id:", shopId)
    setRenamePhone(phone)
    setRenameShopId(shopId)
    setRenameDialogOpen(true)
  }

  async function handleRename() {
    console.log("[v0] Renaming decoy for phone:", renamePhone, "shop_id:", renameShopId)
    setRenaming(true)

    try {
      const response = await fetch("/api/akabiz/rename-decoy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: renamePhone,
          shop_id: renameShopId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to rename decoy")
      }

      const data = await response.json()
      console.log("[v0] Rename response:", data)

      if (data.is_successful) {
        toast({
          title: "✓ Đổi tên thành công",
          description: `Đã đổi tên decoy cho số ${renamePhone}`,
          className: "bg-green-50 border-green-200",
        })
        setRenameDialogOpen(false)
        fetchJobs() // Refresh the table
      } else {
        throw new Error("Rename was not successful")
      }
    } catch (error) {
      console.error("[v0] Error renaming decoy:", error)
      toast({
        title: "✗ Đổi tên thất bại",
        description: "Không thể đổi tên decoy. Vui lòng thử lại.",
        variant: "destructive",
      })
    } finally {
      setRenaming(false)
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function formatCurrency(amount: number | null) {
    if (amount === null) return "N/A"
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount)
  }

  // Helper function to adjust timezone by adding 7 hours
  function adjustTimezone(dateString: string) {
    const date = new Date(dateString)
    // Add 7 hours in milliseconds
    date.setTime(date.getTime() + 7 * 60 * 60 * 1000)
    return date
  }

  function groupJobsByDate(jobs: Job[]) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const groups: { label: string; jobs: Job[] }[] = []
    const todayJobs: Job[] = []
    const yesterdayJobs: Job[] = []
    const olderJobsByDate: Map<string, Job[]> = new Map()

    jobs.forEach((job) => {
      const jobDate = adjustTimezone(job.created_at)
      jobDate.setHours(0, 0, 0, 0)

      if (jobDate.getTime() === today.getTime()) {
        todayJobs.push(job)
      } else if (jobDate.getTime() === yesterday.getTime()) {
        yesterdayJobs.push(job)
      } else {
        const dateKey = jobDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
        if (!olderJobsByDate.has(dateKey)) {
          olderJobsByDate.set(dateKey, [])
        }
        olderJobsByDate.get(dateKey)!.push(job)
      }
    })

    const sortByMostRecent = (a: Job, b: Job) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }

    if (todayJobs.length > 0) {
      todayJobs.sort(sortByMostRecent)
      groups.push({ label: "Hôm nay", jobs: todayJobs })
    }
    if (yesterdayJobs.length > 0) {
      yesterdayJobs.sort(sortByMostRecent)
      groups.push({ label: "Hôm qua", jobs: yesterdayJobs })
    }

    // Sort older dates in descending order
    const sortedOlderDates = Array.from(olderJobsByDate.entries()).sort((a, b) => {
      const dateA = new Date(a[0].split("/").reverse().join("-"))
      const dateB = new Date(b[0].split("/").reverse().join("-"))
      return dateB.getTime() - dateA.getTime()
    })

    sortedOlderDates.forEach(([dateKey, jobs]) => {
      jobs.sort(sortByMostRecent)
      groups.push({ label: dateKey, jobs })
    })

    return groups
  }

  const sortedFilteredJobs = [...filteredJobs].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const RECORDS_LIMIT = 20

  // Calculate visible jobs based on showAllJobs state
  let visibleJobs: Job[]
  if (showAllJobs) {
    visibleJobs = sortedFilteredJobs
  } else {
    visibleJobs = sortedFilteredJobs.slice(0, RECORDS_LIMIT)
  }

  // Group the visible jobs by date for display
  const visibleGroups = groupJobsByDate(visibleJobs)
  const hasMoreJobs = sortedFilteredJobs.length > RECORDS_LIMIT

  return (
    <>
      <TooltipProvider>
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lịch sử Quây khách 💸</CardTitle>
              <Button onClick={fetchJobs} variant="outline" size="sm" disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Cập nhật lần cuối vào{" "}
                {lastUpdated.toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Tìm theo SĐT..."
                value={phoneSearch}
                onChange={(e) => setPhoneSearch(e.target.value)}
                className="w-full"
              />

              <div className="flex gap-3 flex-wrap">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tất cả Account</Label>
                  <Select value={accountFilter} onValueChange={setAccountFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả Account</SelectItem>
                      <SelectItem value="MA">Minh Anh</SelectItem>
                      <SelectItem value="HH">Huy Hồ</SelectItem>
                      <SelectItem value="HT">Hùng Taxi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Trạng thái gửi</Label>
                  <Select value={sendStatusFilter} onValueChange={setSendStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Trạng thái gửi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="sent">Đã gửi</SelectItem>
                      <SelectItem value="not_sent">Chưa gửi/Lỗi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Trạng thái phản hồi</Label>
                  <Select value={responseStatusFilter} onValueChange={setResponseStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Trạng thái phản hồi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      <SelectItem value="replied">Đã phản hồi</SelectItem>
                      <SelectItem value="not_replied">Chưa phản hồi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  {visibleGroups.map((group) => (
                    <div key={group.label} className="space-y-3">
                      <h3 className="font-semibold text-sm text-primary sticky top-0 bg-background py-2 border-b">
                        {group.label}
                      </h3>
                      <div className="border rounded-xl overflow-hidden bg-card">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="px-4 py-3 text-left font-medium">Thời gian</th>
                                <th className="px-4 py-3 text-left font-medium">SĐT</th>
                                <th className="px-4 py-3 text-left font-medium">Account</th>
                                <th className="px-4 py-3 text-left font-medium">Trạng thái gửi</th>
                                <th className="px-4 py-3 text-left font-medium">Trạng thái phản hồi</th>
                                <th className="px-4 py-3 text-left font-medium">Hành động</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {group.jobs.map((job) => {
                                const hasReplied = job.length_of_chat_history > 1
                                const hasChat =
                                  job.chat_history && job.chat_history.messages && job.chat_history.messages.length > 0

                                return (
                                  <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3 text-xs text-muted-foreground">
                                      {adjustTimezone(job.created_at).toLocaleTimeString("vi-VN", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs">{maskPhone(job.phone)}</td>
                                    <td className="px-4 py-3">{job.account}</td>
                                    <td className="px-4 py-3">
                                      <Badge variant={job.is_sent ? "default" : "secondary"}>
                                        {job.is_sent ? "Đã gửi" : "Chưa gửi/Lỗi"}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge
                                        variant={hasReplied ? "default" : "secondary"}
                                        className={hasReplied ? "bg-purple-500" : ""}
                                      >
                                        {hasReplied ? "Đã phản hồi" : "Chưa phản hồi"}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex gap-2">
                                        {hasChat ? (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openChatModal(job)}
                                                className="h-8 w-8 p-0"
                                              >
                                                <MessageCircle className="h-4 w-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Full tin nhắn</TooltipContent>
                                          </Tooltip>
                                        ) : (
                                          <span className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground text-xs">
                                            —
                                          </span>
                                        )}
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => openLeadDetailsModal(job.phone)}
                                              className="h-8 w-8 p-0"
                                            >
                                              <Eye className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Chi tiết CRM</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => openSendOtherBotModal(job.phone, job.account)}
                                              className="h-8 w-8 p-0"
                                            >
                                              <Send className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Gửi Bot khác</TooltipContent>
                                        </Tooltip>
                                        {!job.is_sent && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  let shopId
                                                  if (job.account === "MA") {
                                                    shopId = "68c11ae4-b7f5-3ee3-7614-5cc200000000"
                                                  } else if (job.account === "HH") {
                                                    shopId = "68c11ae4-b7f5-3ee3-7614-5cc200000000"
                                                  } else {
                                                    shopId = "68ff3282-a3cd-ba1d-a71a-1b7100000000"
                                                  }
                                                  openRenameDialog(job.phone, shopId)
                                                }}
                                                className="h-8 w-8 p-0"
                                              >
                                                <UserCog className="h-4 w-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Rename lại</TooltipContent>
                                          </Tooltip>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))}

                  {visibleGroups.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">Không tìm thấy dữ liệu</div>
                  )}

                  {hasMoreJobs && !showAllJobs && (
                    <div className="flex justify-center pt-4">
                      <Button variant="outline" onClick={() => setShowAllJobs(true)}>
                        Xem thêm ({sortedFilteredJobs.length - RECORDS_LIMIT} jobs)
                      </Button>
                    </div>
                  )}

                  {showAllJobs && hasMoreJobs && (
                    <div className="flex justify-center pt-4">
                      <Button variant="outline" onClick={() => setShowAllJobs(false)}>
                        Thu gọn
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                Hiển thị {sortedFilteredJobs.length} / {jobs.length} jobs
              </p>
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>

      {/* Chat History Modal */}
      <Dialog open={chatModalOpen} onOpenChange={setChatModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Hội thoại với {selectedChat ? maskPhone(selectedChat.phone) : ""}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh] space-y-3 p-4">
            {selectedChat?.chat_history?.messages?.map((message, idx) => (
              <div key={idx} className={`flex ${message.role === "bot" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    message.role === "bot" ? "bg-blue-500 text-white" : "bg-muted text-foreground"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={leadDetailsModalOpen} onOpenChange={setLeadDetailsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết Lead</DialogTitle>
          </DialogHeader>

          {leadDetailsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Đang tải thông tin...</span>
            </div>
          ) : leadDetailsError ? (
            <div className="py-8 text-center">
              <p className="text-red-500 mb-4">{leadDetailsError}</p>
              <Button onClick={() => setLeadDetailsModalOpen(false)} variant="outline">
                Đóng
              </Button>
            </div>
          ) : leadDetailsData ? (
            <div className="space-y-6">
              {/* Lead Information */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg border-b pb-2">Thông tin Lead</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Ngày tạo Lead</p>
                    <p className="font-medium">{formatDate(leadDetailsData.lead_info.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nhân viên PIC</p>
                    <p className="font-medium">{leadDetailsData.lead_info.user_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Giai đoạn</p>
                    <p className="font-medium">{leadDetailsData.lead_info.stage || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Giá mong muốn</p>
                    <p className="font-medium">{formatCurrency(leadDetailsData.lead_info.price_customer)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Giá bid cao nhất</p>
                    <p className="font-medium">{formatCurrency(leadDetailsData.lead_info.price_highest_bid)}</p>
                  </div>
                </div>
              </div>

              {/* Car Information */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg border-b pb-2">Thông tin Xe</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Tên xe</p>
                    <p className="font-medium text-lg">
                      {leadDetailsData.car_info.year} {leadDetailsData.car_info.brand} {leadDetailsData.car_info.model}{" "}
                      {leadDetailsData.car_info.variant}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Số ODO</p>
                    <p className="font-medium">
                      {new Intl.NumberFormat("vi-VN").format(leadDetailsData.car_info.mileage)} km
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vị trí xe</p>
                    <p className="font-medium">{leadDetailsData.car_info.car_location}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Đã thẩm định?</p>
                    <Badge variant={leadDetailsData.car_info.is_inspection ? "default" : "secondary"}>
                      {leadDetailsData.car_info.is_inspection ? "Đã thẩm định" : "Chưa thẩm định"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={sendOtherBotModalOpen} onOpenChange={setSendOtherBotModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gửi Bot khác cho {maskPhone(sendOtherBotPhone)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tài khoản</Label>
              <Select value={sendOtherBotAccount} onValueChange={setSendOtherBotAccount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MA">Minh Anh</SelectItem>
                  <SelectItem value="HH">Huy Hồ</SelectItem>
                  <SelectItem value="HT">Hùng Taxi</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Tin nhắn mặc định của tài khoản sẽ được sử dụng</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSendOtherBotModalOpen(false)}>
                Hủy
              </Button>
              <Button onClick={sendWithOtherBot} disabled={sendingOtherBot}>
                {sendingOtherBot && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gửi ngay
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Confirmation Dialog */}
      <AlertDialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận đổi tên Decoy</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn đổi tên decoy cho số điện thoại <strong>{maskPhone(renamePhone)}</strong>? Hành động
              này sẽ cập nhật tên trong hệ thống Zalo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={renaming}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleRename} disabled={renaming}>
              {renaming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
})

CampaignHistory.displayName = "CampaignHistory"
