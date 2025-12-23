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
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Campaign Jobs Status</CardTitle>
            <Button onClick={fetchJobs} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              placeholder="Search by phone or account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Thời gian</th>
                        <th className="px-4 py-3 text-left font-medium">Phone Number</th>
                        <th className="px-4 py-3 text-left font-medium">Account</th>
                        <th className="px-4 py-3 text-left font-medium">Trạng thái phản hồi</th>
                        <th className="px-4 py-3 text-left font-medium">Thông tin xe</th>
                        <th className="px-4 py-3 text-left font-medium">Thông tin Lead</th>
                        <th className="px-4 py-3 text-left font-medium">Hành động</th>
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
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {job.created_at ? formatDateTime(job.created_at) : "—"}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">{maskPhone(job.phone)}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{job.account}</Badge>
                                  <span className="text-xs text-muted-foreground">{accountName}</span>
                                </div>
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
                                {enrichment?.loading ? (
                                  <div className="flex gap-2">
                                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{enrichment?.carInfo || "—"}</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {enrichment?.loading ? (
                                  <div className="flex gap-2">
                                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{enrichment?.leadInfo || "—"}</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1">
                                  {/* Chat View Button */}
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
                                      <TooltipContent>Xem tin nhắn</TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground text-xs">
                                      —
                                    </span>
                                  )}

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
            )}

            <p className="text-xs text-muted-foreground text-center">
              Showing {filteredJobs.length} of {jobs.length} jobs
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Chat History Modal */}
      <Dialog open={chatModalOpen} onOpenChange={setChatModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Hội thoại với {selectedChat ? maskPhone(selectedChat.phone) : ""}
              {selectedChat && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({DECOY_ACCOUNTS[selectedChat.account] || selectedChat.account})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh] space-y-3 p-4">
            {selectedChat?.chat_history?.messages?.map((message, idx) => (
              <div key={idx} className={`flex ${message.role === "bot" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${message.role === "bot" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"
                    }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {(!selectedChat?.chat_history?.messages || selectedChat.chat_history.messages.length === 0) && (
              <div className="text-center text-muted-foreground py-4">
                Chưa có tin nhắn
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
