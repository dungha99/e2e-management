"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, MessageCircle, ExternalLink } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
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

interface LeadEnrichment {
  carInfo: string
  leadInfo: string
  leadId: string | null
  loading: boolean
}

const DECOY_ACCOUNTS: Record<string, string> = {
  "MA": "Minh Anh",
  "HH": "Huy Hồ",
  "HT": "Hùng Taxi",
}

export function JobsDashboard() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [leadEnrichments, setLeadEnrichments] = useState<Map<string, LeadEnrichment>>(new Map())
  const cacheRef = useRef<Map<string, any>>(new Map())

  // Chat modal state
  const [selectedChat, setSelectedChat] = useState<Job | null>(null)
  const [chatModalOpen, setChatModalOpen] = useState(false)

  useEffect(() => {
    console.log("[v0] JobsDashboard mounted, fetching jobs...")
    fetchJobs()
  }, [])

  useEffect(() => {
    console.log("[v0] Search query changed:", searchQuery)
    if (searchQuery.trim()) {
      const filtered = jobs.filter(
        (job) => job.phone.includes(searchQuery) || job.account.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      console.log("[v0] Filtered jobs:", filtered.length, "of", jobs.length)
      setFilteredJobs(filtered)
    } else {
      console.log("[v0] Showing all jobs:", jobs.length)
      setFilteredJobs(jobs)
    }
  }, [searchQuery, jobs])

  async function fetchJobs() {
    console.log("[v0] Fetching all jobs from API...")
    setLoading(true)
    try {
      const response = await fetch("/api/decoy/all")
      const data = await response.json()
      console.log("[v0] Fetched", data.length, "jobs:", data)
      // Sort by created_at descending (newest first)
      const sortedData = data.sort((a: Job, b: Job) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      setJobs(sortedData)
      setFilteredJobs(sortedData)

      console.log("[v0] Starting lead data enrichment for", sortedData.length, "jobs...")
      enrichLeadData(sortedData)
    } catch (error) {
      console.error("[v0] Error fetching jobs:", error)
    } finally {
      setLoading(false)
    }
  }

  async function enrichLeadData(jobsList: Job[]) {
    console.log("[v0] Initializing enrichment for", jobsList.length, "jobs...")
    const newEnrichments = new Map<string, LeadEnrichment>()

    jobsList.forEach((job) => {
      newEnrichments.set(job.phone, {
        carInfo: "",
        leadInfo: "",
        leadId: null,
        loading: true,
      })
    })
    setLeadEnrichments(newEnrichments)

    for (const job of jobsList) {
      // Check cache first
      if (cacheRef.current.has(job.phone)) {
        console.log("[v0] Using cached data for phone:", job.phone)
        const cachedData = cacheRef.current.get(job.phone)
        updateEnrichment(job.phone, cachedData)
        continue
      }

      // Fetch from API
      console.log("[v0] Fetching lead context for phone:", job.phone)
      try {
        const response = await fetch("/api/leads/lead-context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: job.phone }),
        })

        const data = await response.json()
        console.log("[v0] Lead context response for", job.phone, ":", data)

        cacheRef.current.set(job.phone, data)
        console.log("[v0] Cached data for phone:", job.phone)

        updateEnrichment(job.phone, data)
      } catch (error) {
        console.error("[v0] Error enriching phone:", job.phone, error)
        setLeadEnrichments((prev) => {
          const updated = new Map(prev)
          updated.set(job.phone, {
            carInfo: "Error loading",
            leadInfo: "Error loading",
            leadId: null,
            loading: false,
          })
          return updated
        })
      }
    }
    console.log("[v0] Lead data enrichment complete!")
  }

  function updateEnrichment(phone: string, data: any) {
    const carInfo = data.car_info
      ? `${data.car_info.year || ""} ${data.car_info.brand || ""} ${data.car_info.model || ""} - ${data.car_info.mileage || 0}km`.trim()
      : "No data"

    const leadInfo = data.lead_info
      ? `${data.lead_info.name || "Unknown"} - ${data.lead_info.stage || "N/A"}`
      : "No data"

    const leadId = data.lead_info?.id || null

    console.log("[v0] Updated enrichment for", phone, "- Car:", carInfo, "Lead:", leadInfo, "LeadId:", leadId)

    setLeadEnrichments((prev) => {
      const updated = new Map(prev)
      updated.set(phone, {
        carInfo,
        leadInfo,
        leadId,
        loading: false,
      })
      return updated
    })
  }

  function openChatModal(job: Job) {
    setSelectedChat(job)
    setChatModalOpen(true)
  }

  function navigateToLead(leadId: string) {
    const selectedAccount = localStorage.getItem("e2e-selectedAccount") || "placeholder"
    router.push(`/e2e/${selectedAccount}?tab=priority&page=1&search=${leadId}`)
  }

  // Helper function to format date
  function formatDateTime(dateString: string) {
    const date = new Date(dateString)
    // Add 7 hours for timezone adjustment
    date.setTime(date.getTime() + 7 * 60 * 60 * 1000)
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <TooltipProvider>
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="sticky top-0 bg-background z-10 border-b md:border-b-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg sm:text-xl">
              <span className="hidden sm:inline">Campaign Jobs Status</span>
              <span className="sm:hidden">Jobs Status</span>
            </CardTitle>
            <Button onClick={fetchJobs} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent 
          className="max-h-[calc(100vh-200px)] md:max-h-none overflow-y-auto md:overflow-visible scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 scroll-smooth"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          <div className="space-y-4 pb-4 md:pb-0">
            <div className="sticky top-0 md:relative bg-background z-20 -mx-6 px-6 py-3 md:p-0 border-b md:border-b-0 shadow-sm md:shadow-none">
              <Input
                placeholder="Tìm theo SĐT hoặc account..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:max-w-sm"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block border rounded-xl overflow-hidden bg-card">
                  <div 
                    className="overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 scroll-smooth"
                    style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
                  >
                    <table className="w-full text-sm min-w-[800px] sm:min-w-0">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Thời gian</th>
                          <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Phone Number</th>
                          <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Account</th>
                          <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Trạng thái phản hồi</th>
                          <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Thông tin xe</th>
                          <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Thông tin Lead</th>
                          <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Hành động</th>
                        </tr>
                      </thead>
                    <tbody className="divide-y divide-border">
                      {filteredJobs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                            No jobs found
                          </td>
                        </tr>
                      ) : (
                        filteredJobs.map((job, idx) => {
                          const enrichment = leadEnrichments.get(job.phone)
                          const hasReplied = job.length_of_chat_history > 1
                          const hasChat = job.chat_history && job.chat_history.messages && job.chat_history.messages.length > 0
                          const accountName = DECOY_ACCOUNTS[job.account] || job.account

                          return (
                            <tr key={job.id || idx} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                {job.created_at ? formatDateTime(job.created_at) : "—"}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{maskPhone(job.phone)}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{job.account}</Badge>
                                  <span className="text-xs text-muted-foreground">{accountName}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <Badge
                                  variant={hasReplied ? "default" : "secondary"}
                                  className={hasReplied ? "bg-purple-500" : ""}
                                >
                                  {hasReplied ? "Đã phản hồi" : "Chưa phản hồi"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 max-w-[200px]">
                                {enrichment?.loading ? (
                                  <div className="flex gap-2">
                                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground truncate block">{enrichment?.carInfo || "—"}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 max-w-[180px]">
                                {enrichment?.loading ? (
                                  <div className="flex gap-2">
                                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground truncate block">{enrichment?.leadInfo || "—"}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex gap-1">
                                  {/* Chat View Button */}
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
                                    <TooltipContent>Xem tin nhắn</TooltipContent>
                                  </Tooltip>

                                  {/* Detail Lead Button */}
                                  {enrichment?.leadId && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => navigateToLead(enrichment.leadId!)}
                                          className="h-8 w-8 p-0"
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Xem chi tiết Lead</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 pb-2">
                {filteredJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Không tìm thấy jobs
                  </div>
                ) : (
                  filteredJobs.map((job, idx) => {
                    const enrichment = leadEnrichments.get(job.phone)
                    const hasReplied = job.length_of_chat_history > 1
                    const accountName = DECOY_ACCOUNTS[job.account] || job.account

                    return (
                      <div key={job.id || idx} className="border rounded-lg p-3 bg-card space-y-3 shadow-sm active:shadow-md transition-shadow">
                        {/* Header Row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                              {job.account}
                            </span>
                            <div>
                              <p className="text-xs font-medium">{accountName}</p>
                              <p className="text-xs text-muted-foreground">
                                {job.created_at ? formatDateTime(job.created_at) : "—"}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={hasReplied ? "default" : "secondary"}
                            className={`text-xs ${hasReplied ? "bg-purple-500" : ""}`}
                          >
                            {hasReplied ? "Đã phản hồi" : "Chưa phản hồi"}
                          </Badge>
                        </div>

                        {/* Phone Row */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">SĐT:</span>
                          <span className="font-mono text-xs font-medium">{maskPhone(job.phone)}</span>
                        </div>

                        {/* Car Info Row */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">Thông tin xe:</span>
                          {enrichment?.loading ? (
                            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                          ) : (
                            <span className="text-xs text-right break-words">{enrichment?.carInfo || "—"}</span>
                          )}
                        </div>

                        {/* Lead Info Row */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">Thông tin Lead:</span>
                          {enrichment?.loading ? (
                            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                          ) : (
                            <span className="text-xs text-right break-words">{enrichment?.leadInfo || "—"}</span>
                          )}
                        </div>

                        {/* Actions Row */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openChatModal(job)}
                            className="h-8 text-xs flex items-center gap-1.5"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Xem tin nhắn
                          </Button>

                          {enrichment?.leadId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigateToLead(enrichment.leadId!)}
                              className="h-8 text-xs flex items-center gap-1.5"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Chi tiết Lead
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              </>
            )}

            <p className="text-xs text-muted-foreground text-center sticky bottom-0 bg-background/95 backdrop-blur-sm py-3 md:static md:bg-transparent md:py-0 -mx-6 px-6 md:mx-0 md:px-0 border-t md:border-t-0">
              Hiển thị {filteredJobs.length} / {jobs.length} jobs
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Chat History Modal */}
      <Dialog open={chatModalOpen} onOpenChange={setChatModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[80vh] w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              Hội thoại với {selectedChat ? maskPhone(selectedChat.phone) : ""}
              {selectedChat && (
                <span className="ml-2 text-xs sm:text-sm font-normal text-muted-foreground">
                  ({DECOY_ACCOUNTS[selectedChat.account] || selectedChat.account})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[65vh] sm:max-h-[60vh] space-y-3 p-2 sm:p-4">
            {selectedChat?.chat_history?.messages?.map((message, idx) => (
              <div key={idx} className={`flex ${message.role === "bot" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 sm:px-4 py-2 ${message.role === "bot" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"
                    }`}
                >
                  <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              </div>
            ))}
            {(!selectedChat?.chat_history?.messages || selectedChat.chat_history.messages.length === 0) && (
              <div className="text-center text-muted-foreground py-4 text-sm">
                Chưa có tin nhắn
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
