"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, User, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { maskPhone } from "@/lib/utils"

interface DealerBiddingStatus {
  status: "not_sent" | "sent" | "got_price"
  maxPrice?: number
}

interface ChatMessage {
  _id: string
  content: string
  uidFrom: string
  timestamp: number
  dateAction: string
  type: string
  img?: string
}

interface Lead {
  id: string
  name: string
  phone: string | null
  identify_number: string | null
  bank_account_number: string | null
  otp_verified: string
  created_at: string
  pic_id: string
  pic_og: string
  source: string | null
  url: string | null
  additional_phone: string | null
  qx_qc_scoring: string | null
  customer_feedback: string | null
  is_referral: boolean
  car_id?: string | null
  first_message_sent?: boolean
  has_enough_images?: boolean
  dealer_bidding?: DealerBiddingStatus
  bot_active?: boolean
}

const ACCOUNTS = [
  { name: "Dũng", uid: "9ee91b08-448b-4cf4-8b3d-79c6f1c71fef" },
  { name: "Thư", uid: "286af2a8-a866-496a-8ed0-da30df3120ec" },
  { name: "Trường", uid: "2ffa8389-2641-4d8b-98a6-5dc2dd2d20a4" },
]

const ITEMS_PER_PAGE = 10

export function E2EManagement() {
  const { toast } = useToast()
  const [selectedAccount, setSelectedAccount] = useState<string>(ACCOUNTS[0].uid)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCarIds, setLoadingCarIds] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Chat modal state
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [runningE2E, setRunningE2E] = useState(false)

  useEffect(() => {
    if (selectedAccount) {
      setCurrentPage(1) // Reset to first page when account changes
      fetchLeads(selectedAccount)
    }
  }, [selectedAccount])

  useEffect(() => {
    // Fetch additional data when page changes
    if (leads.length > 0) {
      fetchPageData(currentPage)
    }
  }, [currentPage])

  async function fetchCarId(phone: string): Promise<string | null> {
    try {
      const response = await fetch("/api/e2e/car-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return data.car_id || null
    } catch (error) {
      console.error("[E2E] Error fetching car_id for phone:", phone, error)
      return null
    }
  }

  async function fetchMessagesZalo(car_id: string): Promise<boolean> {
    try {
      const response = await fetch("/api/e2e/messages-zalo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id }),
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()
      const messages = data.messages_zalo || []

      // Return true if we have messages, false otherwise
      return Array.isArray(messages) && messages.length > 0
    } catch (error) {
      console.error("[E2E] Error fetching messages_zalo for car_id:", car_id, error)
      return false
    }
  }

  async function checkHasEnoughImages(phone: string): Promise<boolean> {
    try {
      const response = await fetch("/api/leads/lead-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()
      const additionalImages = data.car_info?.additional_images

      if (!additionalImages) {
        return false
      }

      // Check if we have at least 1 image in "outside" and at least 1 in "paper"
      const hasOutside = Array.isArray(additionalImages.outside) && additionalImages.outside.length > 0
      const hasPaper = Array.isArray(additionalImages.paper) && additionalImages.paper.length > 0

      return hasOutside && hasPaper
    } catch (error) {
      console.error("[E2E] Error checking images for phone:", phone, error)
      return false
    }
  }

  async function checkDealerBidding(car_id: string): Promise<DealerBiddingStatus> {
    try {
      const response = await fetch("/api/e2e/dealer-bidding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id }),
      })

      if (!response.ok) {
        return { status: "not_sent" }
      }

      const data = await response.json()

      // If no data or empty array, not sent
      if (!Array.isArray(data) || data.length === 0) {
        return { status: "not_sent" }
      }

      // Find the maximum price
      const maxPrice = Math.max(...data.map((bid: any) => bid.price || 0))

      // If max price is 1, it means sent but no real price yet
      if (maxPrice === 1) {
        return { status: "sent" }
      }

      // If max price > 1, we got a real price
      return { status: "got_price", maxPrice }
    } catch (error) {
      console.error("[E2E] Error checking dealer bidding for car_id:", car_id, error)
      return { status: "not_sent" }
    }
  }

  async function fetchChatMessages(car_id: string): Promise<ChatMessage[]> {
    try {
      const response = await fetch("/api/e2e/messages-zalo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id }),
      })

      if (!response.ok) {
        return []
      }

      const data = await response.json()
      return data.messages_zalo || []
    } catch (error) {
      console.error("[E2E] Error fetching chat messages for car_id:", car_id, error)
      return []
    }
  }

  async function handleLeadClick(lead: Lead) {
    if (!lead.car_id) {
      console.log("[E2E] No car_id available for this lead")
      return
    }

    setSelectedLead(lead)
    setChatModalOpen(true)
    setLoadingMessages(true)
    setChatMessages([])

    const messages = await fetchChatMessages(lead.car_id)
    setChatMessages(messages)
    setLoadingMessages(false)
  }

  async function fetchBotStatus(phone: string): Promise<boolean> {
    try {
      const response = await fetch("/api/e2e/bot-status/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()

      // Parse nested structure: data.cars[0].sale_statuses[0].bot_status
      if (data.cars && Array.isArray(data.cars) && data.cars.length > 0) {
        const firstCar = data.cars[0]
        if (firstCar.sale_statuses && Array.isArray(firstCar.sale_statuses) && firstCar.sale_statuses.length > 0) {
          return firstCar.sale_statuses[0].bot_status || false
        }
      }

      return false
    } catch (error) {
      console.error("[E2E] Error fetching bot status for phone:", phone, error)
      return false
    }
  }

  async function handleBotToggle(lead: Lead, newStatus: boolean) {
    const phone = lead.phone || lead.additional_phone
    if (!phone) {
      toast({
        title: "Lỗi",
        description: "Không có số điện thoại",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/e2e/bot-status/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_status: newStatus, phone }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        toast({
          title: "Cập nhật bot thất bại",
          description: newStatus
            ? "Không thể kích hoạt bot. Vui lòng thử lại."
            : "Không thể tắt bot. Vui lòng thử lại.",
          variant: "destructive",
        })
        return
      }

      // Update the lead in state
      setLeads((prevLeads) =>
        prevLeads.map((l) => (l.id === lead.id ? { ...l, bot_active: newStatus } : l))
      )

      toast({
        title: "Thành công",
        description: newStatus ? "Đã kích hoạt bot" : "Đã tắt bot",
      })
    } catch (error) {
      console.error("[E2E] Error updating bot status:", error)
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật trạng thái bot",
        variant: "destructive",
      })
    }
  }

  async function handleRunE2E() {
    if (!selectedLead) return

    const phone = selectedLead.phone || selectedLead.additional_phone
    if (!phone) {
      toast({
        title: "Lỗi",
        description: "Không có số điện thoại",
        variant: "destructive",
      })
      return
    }

    setRunningE2E(true)

    try {
      // Step 1: Check and update bot status if needed
      if (!selectedLead.bot_active) {
        console.log("[E2E] Bot is not active, activating...")
        const updateResponse = await fetch("/api/e2e/bot-status/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot_status: true, phone }),
        })

        const updateData = await updateResponse.json()

        if (!updateResponse.ok || !updateData.success) {
          toast({
            title: "Không thể kích hoạt bot",
            description: "Vui lòng kích hoạt bot trước khi chạy E2E",
            variant: "destructive",
          })
          setRunningE2E(false)
          return
        }

        // Update the lead in state
        setLeads((prevLeads) => prevLeads.map((l) => (l.id === selectedLead.id ? { ...l, bot_active: true } : l)))
        setSelectedLead({ ...selectedLead, bot_active: true })
      }

      // Step 2: Call E2E webhook
      console.log("[E2E] Calling E2E webhook...")
      const e2eResponse = await fetch("https://n8n.vucar.vn/webhook/bdb8f9b8-4b12-4a08-9a94-d0406e0d16b0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          chat_history: chatMessages,
        }),
      })

      if (!e2eResponse.ok) {
        throw new Error("E2E webhook failed")
      }

      const e2eData = await e2eResponse.json()
      console.log("[E2E] E2E webhook response:", e2eData)

      // Step 3: Check if there are message suggestions and send them
      if (Array.isArray(e2eData) && e2eData.length > 0) {
        const firstResult = e2eData[0]
        const messageSuggestions = firstResult?.output?.message_suggestions

        if (Array.isArray(messageSuggestions) && messageSuggestions.length > 0) {
          console.log("[E2E] Sending", messageSuggestions.length, "suggested messages...")

          const sendMessageResponse = await fetch("https://crm-vucar-api.vucar.vn/api/v1/akabiz/send-customer-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_phone: phone,
              messages: messageSuggestions,
              picId: selectedAccount,
            }),
          })

          if (!sendMessageResponse.ok) {
            console.error("[E2E] Failed to send messages")
            toast({
              title: "Cảnh báo",
              description: "E2E hoàn thành nhưng không thể gửi tin nhắn gợi ý",
              variant: "destructive",
            })
            return
          }

          toast({
            title: "Thành công",
            description: `E2E hoàn thành và đã gửi ${messageSuggestions.length} tin nhắn`,
          })
        } else {
          toast({
            title: "Thành công",
            description: "E2E hoàn thành, không có tin nhắn gợi ý",
          })
        }
      } else {
        toast({
          title: "Thành công",
          description: "E2E đã được khởi chạy",
        })
      }
    } catch (error) {
      console.error("[E2E] Error running E2E:", error)
      toast({
        title: "Lỗi",
        description: "Không thể chạy E2E",
        variant: "destructive",
      })
    } finally {
      setRunningE2E(false)
    }
  }

  async function fetchLeads(uid: string) {
    console.log("[E2E] Fetching leads for account:", uid)
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/e2e/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch leads: ${response.status}`)
      }

      const data = await response.json()
      console.log("[E2E] Fetched", data.length, "leads")
      setLeads(data)
      setLoading(false)

      // Fetch data for the first page
      if (data.length > 0) {
        await fetchPageData(1, data)
      }
    } catch (err) {
      console.error("[E2E] Error fetching leads:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch leads")
      setLoading(false)
      setLoadingCarIds(false)
    }
  }

  async function fetchPageData(page: number, allLeads?: Lead[]) {
    const leadsToUse = allLeads || leads
    if (leadsToUse.length === 0) return

    // Calculate which leads are on this page
    const startIndex = (page - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const pageLeads = leadsToUse.slice(startIndex, endIndex)

    // Check if we already have data for these leads
    const needsFetch = pageLeads.some((lead) => lead.car_id === undefined)
    if (!needsFetch) {
      console.log("[E2E] Page", page, "already has data loaded")
      return
    }

    setLoadingCarIds(true)
    console.log("[E2E] Fetching data for page", page, "-", pageLeads.length, "leads...")

    // Fetch car_ids, message status, image status, and dealer bidding for current page leads
    const updatedPageLeads = await Promise.all(
      pageLeads.map(async (lead: Lead) => {
        const phone = lead.phone || lead.additional_phone
        if (!phone) {
          return {
            ...lead,
            car_id: null,
            first_message_sent: false,
            has_enough_images: false,
            dealer_bidding: { status: "not_sent" as const },
            bot_active: false,
          }
        }

        // Fetch car_id, image check, and bot status in parallel
        const [car_id, has_enough_images, bot_active] = await Promise.all([
          fetchCarId(phone),
          checkHasEnoughImages(phone),
          fetchBotStatus(phone),
        ])

        // If we have car_id, fetch messages_zalo and dealer bidding in parallel
        let first_message_sent = false
        let dealer_bidding: DealerBiddingStatus = { status: "not_sent" }

        if (car_id) {
          const [messageSent, biddingStatus] = await Promise.all([
            fetchMessagesZalo(car_id),
            checkDealerBidding(car_id),
          ])
          first_message_sent = messageSent
          dealer_bidding = biddingStatus
        }

        return { ...lead, car_id, first_message_sent, has_enough_images, dealer_bidding, bot_active }
      })
    )

    // Update the leads array with the new data
    const updatedLeads = [...leadsToUse]
    updatedPageLeads.forEach((updatedLead, index) => {
      updatedLeads[startIndex + index] = updatedLead
    })

    console.log("[E2E] Car IDs and message status fetched successfully for page", page)
    setLeads(updatedLeads)
    setLoadingCarIds(false)
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

  function getDisplayPhone(lead: Lead): string {
    return lead.phone || lead.additional_phone || "N/A"
  }

  function formatPrice(price: number): string {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price)
  }

  function getDealerBiddingDisplay(status?: DealerBiddingStatus): string {
    if (!status) return "Not Sent"
    switch (status.status) {
      case "not_sent":
        return "Not Sent"
      case "sent":
        return "Sent"
      case "got_price":
        return status.maxPrice ? formatPrice(status.maxPrice) : "Got Price"
      default:
        return "Not Sent"
    }
  }

  // Pagination calculations
  const totalPages = Math.ceil(leads.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentPageLeads = leads.slice(startIndex, endIndex)

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const selectedAccountName = ACCOUNTS.find((acc) => acc.uid === selectedAccount)?.name || ""

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Quản lý E2E</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Account Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Chọn tài khoản</Label>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNTS.map((account) => (
                <SelectItem key={account.uid} value={account.uid}>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {account.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Đang tải leads của {selectedAccountName}...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-8">
            <p className="text-sm text-destructive mb-4">{error}</p>
          </div>
        )}

        {/* Leads List */}
        {!loading && !error && leads.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                Danh sách Leads - {selectedAccountName} (Hiển thị {startIndex + 1}-{Math.min(endIndex, leads.length)} / {leads.length} leads)
              </h3>
              {loadingCarIds && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Đang tải dữ liệu...</span>
                </div>
              )}
            </div>

            <div className="border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Tên</th>
                      <th className="px-4 py-3 text-left font-medium">SĐT</th>
                      <th className="px-4 py-3 text-left font-medium">Car ID</th>
                      <th className="px-4 py-3 text-left font-medium">First Message Sent</th>
                      <th className="px-4 py-3 text-left font-medium">Enough Images</th>
                      <th className="px-4 py-3 text-left font-medium">Dealer Bidding</th>
                      <th className="px-4 py-3 text-left font-medium">Bot Active</th>
                      <th className="px-4 py-3 text-left font-medium">Ngày tạo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {currentPageLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                        <td
                          className="px-4 py-3 cursor-pointer hover:text-primary"
                          onClick={() => handleLeadClick(lead)}
                        >
                          <div className="font-medium flex items-center gap-2">
                            <MessageCircle className="h-4 w-4 opacity-50" />
                            {lead.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {getDisplayPhone(lead) !== "N/A" ? maskPhone(getDisplayPhone(lead)) : "N/A"}
                        </td>
                        <td className="px-4 py-3">
                          {loadingCarIds && !lead.car_id ? (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          ) : (
                            <span className="text-xs font-mono">{lead.car_id || "N/A"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {loadingCarIds && lead.first_message_sent === undefined ? (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            ) : (
                              <>
                                <Checkbox checked={lead.first_message_sent || false} disabled />
                                <span className="text-xs text-muted-foreground">
                                  {lead.first_message_sent ? "Sent" : "Not Sent"}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {loadingCarIds && lead.has_enough_images === undefined ? (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            ) : (
                              <>
                                <Checkbox checked={lead.has_enough_images || false} disabled />
                                <span className="text-xs text-muted-foreground">
                                  {lead.has_enough_images ? "Yes" : "No"}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {loadingCarIds && !lead.dealer_bidding ? (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          ) : (
                            <Badge
                              variant={
                                lead.dealer_bidding?.status === "got_price"
                                  ? "default"
                                  : lead.dealer_bidding?.status === "sent"
                                    ? "secondary"
                                    : "outline"
                              }
                              className="text-xs"
                            >
                              {getDealerBiddingDisplay(lead.dealer_bidding)}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {loadingCarIds && lead.bot_active === undefined ? (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            ) : (
                              <Checkbox
                                checked={lead.bot_active || false}
                                onCheckedChange={(checked) => handleBotToggle(lead, checked as boolean)}
                                disabled={!lead.phone && !lead.additional_phone}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(lead.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-muted-foreground">
                  Trang {currentPage} / {totalPages} ({leads.length} leads)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1 || loadingCarIds}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Trước
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        disabled={loadingCarIds}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages || loadingCarIds}
                  >
                    Sau
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && leads.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Không có leads nào cho tài khoản {selectedAccountName}</p>
          </div>
        )}
      </CardContent>

      {/* Chat Messages Modal */}
      <Dialog open={chatModalOpen} onOpenChange={setChatModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Chat với {selectedLead?.name || "Lead"} ({selectedLead?.phone ? maskPhone(selectedLead.phone) : "N/A"})
              </DialogTitle>
              <Button onClick={handleRunE2E} disabled={runningE2E || loadingMessages} size="sm">
                {runningE2E ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  "Run E2E"
                )}
              </Button>
            </div>
          </DialogHeader>

          {/* Chat Messages */}
          <div className="overflow-y-auto max-h-[60vh] space-y-3 p-4">
            {loadingMessages && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Đang tải tin nhắn...</span>
              </div>
            )}

            {!loadingMessages && chatMessages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>Chưa có tin nhắn nào</p>
              </div>
            )}

            {!loadingMessages &&
              chatMessages.map((message, index) => {
                const isFromSale = message.uidFrom === "0"
                const messageTime = new Date(message.dateAction).toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })

                return (
                  <div key={message._id || `${message.timestamp}-${index}`} className={`flex ${isFromSale ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        isFromSale ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold">{isFromSale ? "Sale" : "Customer"}</span>
                        <span className="text-xs opacity-70">{messageTime}</span>
                      </div>
                      {message.type === "text" && <p className="text-sm whitespace-pre-wrap">{message.content}</p>}
                      {message.type === "image" && message.img && (
                        <img src={message.img} alt="Image" className="max-w-full rounded mt-2" />
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
