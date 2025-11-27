"use client"

import { useState, forwardRef, useImperativeHandle, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, HelpCircle, MapPin, Gauge, Send } from "lucide-react"
import { PhoneTagInput } from "@/components/phone-tag-input"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { maskPhone } from "@/lib/utils"

interface LeadContext {
  phone: string
  name: string
  carInfo: string
  leadInfo: string
  notes: string
  classification: "new" | "contacted" | "invalid"
  invalidReason?: string
  decoyHistory?: Array<{
    id: number
    account: string
    first_message: string
    is_sent: boolean
    created_at: string
  }>
  rawData?: {
    lead_info: {
      created_at: string
      name: string
      qualified: string
      stage: string
      reason: string | null
      notes: string | null
      intention: string
      price_customer: number
      price_highest_bid: number
      user_name: string
    }
    car_info: {
      brand: string
      model: string
      variant: string
      year: number
      mileage: number
      intention: string
      is_inspection: boolean
      car_location: string
    }
  }
}

function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount)
}

const DECOY_ACCOUNTS = [
  {
    name: "Minh Anh",
    account: "MA",
    shop_id: "68f5f0f907039cf6ae4581e8",
    default_message: "em dc bên kết nối chào xe. xe nhà mình còn hong. gđ e xin thêm thông tin á anh",
  },
  {
    name: "Huy Hồ",
    account: "HH",
    shop_id: "68c11ae4b7f53ee376145cc2",
    default_message:
      "Em được giới thiệu mình có nhu cầu bán xe em kết bạn để hỏi thêm ít thông tin được không ạ? Xe còn ko a",
  },
  {
    name: "Hùng Taxi",
    account: "HT",
    shop_id: "68ff3282a3cdba1da71a1b71",
    default_message:
      "Anh ơi, em là tài xế công nghệ đang cần mua xe gấp để chạy kiếm sống. Em thấy xe nhà anh đăng bán, không biết xe còn không ạ? Em muốn hỏi thêm thông tin với giá cả để tính toán xem có phù hợp không ạ.",
  },
]

const SEGMENT_TO_REASON_MAP: Record<string, string> = {
  negotiation: "Đàm phán/Cứng giá",
  ghost: "Ghost/Lead nguội",
  check_sold: "Check var đã bán chưa",
}

export const CampaignCreationPanel = forwardRef<
  { onCampaignExecuted: () => void },
  { onCampaignExecuted?: () => void; onOpenOnboarding?: () => void }
>((props, ref) => {
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([])
  const [segment, setSegment] = useState("")
  const [leadContexts, setLeadContexts] = useState<LeadContext[]>([])
  const [checking, setChecking] = useState(false)
  const [allDecoyHistory, setAllDecoyHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [leadSelections, setLeadSelections] = useState<
    Record<string, { account: string; message: string; sending: boolean }>
  >({})
  const { toast } = useToast()

  const phoneCount = phoneNumbers.length
  const newLeads = leadContexts.filter((l) => l.classification === "new")
  const contactedLeads = leadContexts.filter((l) => l.classification === "contacted")
  const invalidLeads = leadContexts.filter((l) => l.classification === "invalid")

  useImperativeHandle(ref, () => ({
    onCampaignExecuted: () => {
      if (props.onCampaignExecuted) {
        props.onCampaignExecuted()
      }
    },
  }))

  useEffect(() => {
    const fetchDecoyHistory = async () => {
      console.log("[v0] Step 0: Fetching all decoy history on mount...")
      try {
        const response = await fetch("/api/decoy/all")
        const data = await response.json()
        console.log("[v0] Decoy history loaded:", data.length, "records")
        setAllDecoyHistory(data)
      } catch (error) {
        console.error("[v0] Error fetching decoy history:", error)
      } finally {
        setLoadingHistory(false)
      }
    }
    fetchDecoyHistory()
  }, [])

  const handleLeadAccountChange = (phone: string, accountKey: string) => {
    const account = DECOY_ACCOUNTS.find((acc) => acc.account === accountKey)
    if (account) {
      setLeadSelections((prev) => ({
        ...prev,
        [phone]: {
          account: accountKey,
          message: account.default_message,
          sending: false,
        },
      }))
    }
  }

  const handleLeadMessageChange = (phone: string, message: string) => {
    setLeadSelections((prev) => ({
      ...prev,
      [phone]: {
        ...prev[phone],
        message,
      },
    }))
  }

  const checkPhones = async () => {
    if (phoneNumbers.length === 0) {
      console.log("[v0] Check phones failed: No phone numbers entered")
      toast({ title: "Lỗi", description: "Vui lòng nhập số điện thoại", variant: "destructive" })
      return
    }

    console.log("[v0] Step 1: Starting concurrent phone check for", phoneNumbers.length, "phones...")
    setChecking(true)

    const leadContextPromises = phoneNumbers.map((phone) =>
      fetch("/api/leads/lead-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })
        .then((res) => res.json())
        .then((data) => ({ phone, data, success: true }))
        .catch((error) => ({ phone, error, success: false })),
    )

    const results = await Promise.allSettled(leadContextPromises)
    console.log("[v0] Step 1 complete. Lead context results:", results)

    console.log("[v0] Step 2: Merging CRM data with decoy history...")
    const classifiedLeads: LeadContext[] = []

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.success) {
        const { phone, data } = result.value

        // Check if lead has valid CRM data
        const hasValidCRM = data.lead_info && data.car_info

        const requiresPrice = segment !== "check_sold"
        const hasValidPrice =
          hasValidCRM &&
          (!requiresPrice || (data.lead_info.price_highest_bid !== null && data.lead_info.price_highest_bid !== "N/A"))

        // Find decoy history for this phone
        const phoneHistory = allDecoyHistory.filter((record) => record.phone === phone)
        const hasHistory = phoneHistory.length > 0

        console.log(
          "[v0] Phone:",
          phone,
          "Valid CRM:",
          hasValidCRM,
          "Valid Price:",
          hasValidPrice,
          "Requires Price:",
          requiresPrice,
          "History:",
          hasHistory,
        )

        if (!hasValidCRM) {
          // Type 3: Invalid - Not found in CRM
          classifiedLeads.push({
            phone,
            name: "N/A",
            carInfo: "",
            leadInfo: "",
            notes: "",
            classification: "invalid",
            invalidReason: "Không tìm thấy thông tin trong CRM",
          })
        } else if (!hasValidPrice) {
          // Type 3: Invalid - Missing price_highest_bid (only if price is required)
          classifiedLeads.push({
            phone,
            name: data.lead_info.name || "N/A",
            carInfo: "",
            leadInfo: "",
            notes: "",
            classification: "invalid",
            invalidReason: "Chưa có giá, hãy cập nhật price_highest_bid",
          })
        } else if (!hasHistory) {
          // Type 1: New Lead
          classifiedLeads.push({
            phone,
            name: data.lead_info.name || "Unknown",
            carInfo: `${data.car_info.year} ${data.car_info.brand} ${data.car_info.model} ${data.car_info.variant}`,
            leadInfo: `Stage: ${data.lead_info.stage}, Intention: ${data.lead_info.intention}`,
            notes: data.lead_info.notes || "",
            classification: "new",
            rawData: data,
          })
        } else {
          // Type 2: Already Contacted
          classifiedLeads.push({
            phone,
            name: data.lead_info.name || "Unknown",
            carInfo: `${data.car_info.year} ${data.car_info.brand} ${data.car_info.model} ${data.car_info.variant}`,
            leadInfo: `Stage: ${data.lead_info.stage}, Intention: ${data.lead_info.intention}`,
            notes: data.lead_info.notes || "",
            classification: "contacted",
            decoyHistory: phoneHistory,
            rawData: data,
          })
        }
      } else {
        // Type 3: Invalid - API error
        const phone = result.status === "fulfilled" ? result.value.phone : "Unknown"
        classifiedLeads.push({
          phone,
          name: "Error",
          carInfo: "",
          leadInfo: "",
          notes: "",
          classification: "invalid",
          invalidReason: "Lỗi khi tải dữ liệu",
        })
      }
    }

    console.log(
      "[v0] Step 2 complete. Classified leads - New:",
      classifiedLeads.filter((l) => l.classification === "new").length,
      "Contacted:",
      classifiedLeads.filter((l) => l.classification === "contacted").length,
      "Invalid:",
      classifiedLeads.filter((l) => l.classification === "invalid").length,
    )

    setLeadContexts(classifiedLeads)
    setChecking(false)
  }

  const sendLeadCampaign = async (lead: LeadContext) => {
    console.log("[v0] ========== SEND CAMPAIGN ATTEMPT ==========")
    console.log("[v0] Lead phone:", lead.phone)
    console.log("[v0] Lead selection state:", leadSelections[lead.phone])
    console.log("[v0] Segment:", segment)
    console.log("[v0] All DECOY_ACCOUNTS:", DECOY_ACCOUNTS)

    const selection = leadSelections[lead.phone]
    if (!selection || !selection.account || !selection.message || !segment) {
      console.log("[v0] Validation failed:")
      console.log("[v0] - Has selection:", !!selection)
      console.log("[v0] - Has account:", !!selection?.account)
      console.log("[v0] - Has message:", !!selection?.message)
      console.log("[v0] - Has segment:", !!segment)
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn tài khoản, lý do quây và tin nhắn",
        variant: "destructive",
      })
      return
    }

    const account = DECOY_ACCOUNTS.find((acc) => acc.account === selection.account)
    if (!account) {
      console.log("[v0] Account not found for key:", selection.account)
      toast({ title: "Lỗi", description: "Tài khoản không hợp lệ", variant: "destructive" })
      return
    }

    console.log("[v0] Validation passed. Account found:", account)
    console.log(
      "[v0] Sending campaign for phone:",
      lead.phone,
      "Account:",
      account.name,
      "Shop ID:",
      account.shop_id,
      "Segment:",
      segment,
    )

    // Set sending state for this lead
    setLeadSelections((prev) => ({
      ...prev,
      [lead.phone]: { ...prev[lead.phone], sending: true },
    }))

    try {
      // Step 1: Create job in database
      console.log("[v0] Step 1: Creating job in database...")
      const createResponse = await fetch("/api/decoy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: lead.phone,
          shop_id: account.shop_id,
          first_message: selection.message,
          account: account.account,
          segment: segment,
          is_sent: false,
        }),
      })

      const createdJob = await createResponse.json()
      console.log("[v0] Job created:", createdJob)

      if (!createdJob.id) {
        throw new Error("Failed to create job")
      }

      // Step 2: Trigger n8n webhook
      console.log("[v0] Step 2: Triggering n8n webhook...")
      await fetch("https://n8n.vucar.vn/webhook/57039721-04a9-42a1-945c-fdd24250e6a8", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: createdJob.id,
          phone: lead.phone,
          shop_id: account.shop_id,
          first_message: selection.message,
          account: account.account,
          segment: segment,
        }),
      })

      console.log("[v0] Step 3: Updating reason in database...")
      const reasonText = SEGMENT_TO_REASON_MAP[segment] || segment
      console.log("[v0] Mapping segment:", segment, "to reason:", reasonText)

      await fetch("/api/decoy/update-reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: lead.phone,
          reason: reasonText,
        }),
      })

      console.log("[v0] Campaign sent successfully for phone:", lead.phone)
      toast({
        title: "✓ Đã nhận được yêu cầu",
        description: `Bạn hãy check tình trạng gửi của SĐT ${lead.phone} sau 1 phút dưới phần Lịch sử Quây khách`,
        className: "bg-green-50 border-green-200",
        duration: 5000,
      })

      // Trigger refresh callback
      if (props.onCampaignExecuted) {
        props.onCampaignExecuted()
      }

      // Remove this lead from the list
      setLeadContexts((prev) => prev.filter((l) => l.phone !== lead.phone))
      setLeadSelections((prev) => {
        const newSelections = { ...prev }
        delete newSelections[lead.phone]
        return newSelections
      })
    } catch (error) {
      console.error("[v0] Error sending campaign:", error)
      toast({
        title: "✗ Gửi thất bại",
        description: "Không thể gửi tin nhắn. Vui lòng thử lại.",
        variant: "destructive",
      })
    } finally {
      setLeadSelections((prev) => ({
        ...prev,
        [lead.phone]: { ...prev[lead.phone], sending: false },
      }))
    }
  }

  if (loadingHistory) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Bắt đầu Quây khách 😎</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => props.onOpenOnboarding?.()}>
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  <strong>Bước 1:</strong> Chọn lý do quây
                  <br />
                  <strong>Bước 2:</strong> Nhập danh sách SĐT
                  <br />
                  <strong>Bước 3:</strong> Kiểm tra tình trạng và gửi
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Configuration */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </div>
              <h3 className="font-semibold">Lý do quây *</h3>
            </div>
            <div className="ml-8 space-y-3">
              <div className="space-y-2">
                <Select value={segment} onValueChange={setSegment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn lý do..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="negotiation">Đàm phán / Cứng giá</SelectItem>
                    <SelectItem value="ghost">Ghost / Lead nguội</SelectItem>
                    <SelectItem value="check_sold">Check var đã bán chưa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Step 2: Phone Input */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </div>
              <h3 className="font-semibold">Nhập SĐT *</h3>
            </div>
            <div className="ml-8 space-y-2">
              <Label>Danh sách số điện thoại</Label>
              <PhoneTagInput phones={phoneNumbers} onChange={setPhoneNumbers} placeholder="Nhập SĐT và nhấn Enter..." />
              <p className="text-sm text-muted-foreground">Đã nhập: {phoneCount} SĐT</p>
            </div>
          </div>

          {/* Step 3: Check & Send */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                3
              </div>
              <h3 className="font-semibold">Kiểm tra & Gửi *</h3>
            </div>
            <div className="ml-8">
              <Button onClick={checkPhones} disabled={phoneCount === 0 || checking} className="w-full">
                {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Check SĐT này
              </Button>
            </div>
          </div>

          {/* Results */}
          {leadContexts.length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold">Kết quả kiểm tra</h3>

              {/* Type 1: New Leads */}
              {newLeads.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">Lead Mới ({newLeads.length})</h4>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {newLeads.map((lead) => (
                      <Card key={lead.phone} className="shadow-sm border-green-200 bg-green-50/30">
                        <CardHeader className="pb-3">
                          <div className="font-mono text-sm font-semibold">{maskPhone(lead.phone)}</div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Lead & Car Info */}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-muted-foreground">Thông tin Lead</p>
                              <p>
                                <strong>{lead.rawData?.lead_info.name || "N/A"}</strong>
                              </p>
                              <p className="text-xs">PIC: {lead.rawData?.lead_info.user_name || "N/A"}</p>
                              <Badge variant="outline" className="text-xs">
                                {lead.rawData?.lead_info.stage || "N/A"}
                              </Badge>
                              <p className="text-xs">
                                Giá mong muốn:{" "}
                                {lead.rawData?.lead_info.price_customer
                                  ? formatVND(lead.rawData.lead_info.price_customer)
                                  : "N/A"}
                              </p>
                              <p className="text-xs">
                                Giá bid cao nhất:{" "}
                                {lead.rawData?.lead_info.price_highest_bid
                                  ? formatVND(lead.rawData.lead_info.price_highest_bid)
                                  : "N/A"}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-muted-foreground">Thông tin Xe</p>
                              <p className="font-medium">{lead.carInfo}</p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Gauge className="h-3 w-3" />
                                {lead.rawData?.car_info.mileage
                                  ? new Intl.NumberFormat("vi-VN").format(lead.rawData.car_info.mileage)
                                  : "N/A"}{" "}
                                km
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {lead.rawData?.car_info.car_location || "N/A"}
                              </div>
                            </div>
                          </div>

                          {/* Action Area */}
                          <div className="space-y-3 pt-3 border-t">
                            <div className="space-y-2">
                              <Label className="text-xs">Chọn Account</Label>
                              <Select
                                value={leadSelections[lead.phone]?.account || ""}
                                onValueChange={(value) => handleLeadAccountChange(lead.phone, value)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Chọn tài khoản..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {DECOY_ACCOUNTS.map((acc) => (
                                    <SelectItem key={acc.account} value={acc.account}>
                                      {acc.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Tin nhắn</Label>
                              <Textarea
                                value={leadSelections[lead.phone]?.message || ""}
                                onChange={(e) => handleLeadMessageChange(lead.phone, e.target.value)}
                                placeholder="Nhập tin nhắn..."
                                rows={2}
                                className="resize-none text-sm"
                              />
                            </div>
                            <Button
                              onClick={() => sendLeadCampaign(lead)}
                              disabled={
                                !leadSelections[lead.phone]?.account ||
                                !leadSelections[lead.phone]?.message ||
                                !segment ||
                                leadSelections[lead.phone]?.sending
                              }
                              size="sm"
                              className="w-full"
                            >
                              {leadSelections[lead.phone]?.sending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="mr-2 h-4 w-4" />
                              )}
                              Gửi bằng {leadSelections[lead.phone]?.account || "..."}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Type 2: Already Contacted Leads */}
              {contactedLeads.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">
                    Lead Đã tiếp cận ({contactedLeads.length})
                  </h4>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {contactedLeads.map((lead) => {
                      const usedAccounts = lead.decoyHistory?.map((h) => h.account) || []
                      const availableAccounts = DECOY_ACCOUNTS.filter((acc) => !usedAccounts.includes(acc.account))

                      return (
                        <Card key={lead.phone} className="shadow-sm border-yellow-200 bg-yellow-50/30">
                          <CardHeader className="pb-3">
                            <div className="font-mono text-sm font-semibold">{maskPhone(lead.phone)}</div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Lead & Car Info */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground">Thông tin Lead</p>
                                <p>
                                  <strong>{lead.rawData?.lead_info.name || "N/A"}</strong>
                                </p>
                                <p className="text-xs">PIC: {lead.rawData?.lead_info.user_name || "N/A"}</p>
                                <Badge variant="outline" className="text-xs">
                                  {lead.rawData?.lead_info.stage || "N/A"}
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground">Thông tin Xe</p>
                                <p className="font-medium">{lead.carInfo}</p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Gauge className="h-3 w-3" />
                                  {lead.rawData?.car_info.mileage
                                    ? new Intl.NumberFormat("vi-VN").format(lead.rawData.car_info.mileage)
                                    : "N/A"}{" "}
                                  km
                                </div>
                              </div>
                            </div>

                            {/* History */}
                            <div className="space-y-2 pt-3 border-t">
                              <p className="text-xs font-semibold text-muted-foreground">Lịch sử tiếp cận</p>
                              <div className="space-y-1">
                                {lead.decoyHistory?.map((history, idx) => (
                                  <div key={idx} className="text-xs bg-background/50 rounded p-2">
                                    <div className="flex items-center justify-between">
                                      <Badge variant="secondary" className="text-xs">
                                        {history.account}
                                      </Badge>
                                      <span className="text-muted-foreground">
                                        {new Date(history.created_at).toLocaleDateString("vi-VN")}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-muted-foreground">{history.first_message}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Action Area */}
                            {availableAccounts.length > 0 ? (
                              <div className="space-y-3 pt-3 border-t">
                                <div className="space-y-2">
                                  <Label className="text-xs">Chọn Account khác</Label>
                                  <Select
                                    value={leadSelections[lead.phone]?.account || ""}
                                    onValueChange={(value) => handleLeadAccountChange(lead.phone, value)}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Chọn tài khoản..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableAccounts.map((acc) => (
                                        <SelectItem key={acc.account} value={acc.account}>
                                          {acc.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Tin nhắn</Label>
                                  <Textarea
                                    value={leadSelections[lead.phone]?.message || ""}
                                    onChange={(e) => handleLeadMessageChange(lead.phone, e.target.value)}
                                    placeholder="Nhập tin nhắn..."
                                    rows={2}
                                    className="resize-none text-sm"
                                  />
                                </div>
                                <Button
                                  onClick={() => sendLeadCampaign(lead)}
                                  disabled={
                                    !leadSelections[lead.phone]?.account ||
                                    !leadSelections[lead.phone]?.message ||
                                    !segment ||
                                    leadSelections[lead.phone]?.sending
                                  }
                                  size="sm"
                                  className="w-full"
                                >
                                  {leadSelections[lead.phone]?.sending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Send className="mr-2 h-4 w-4" />
                                  )}
                                  Gửi bằng {leadSelections[lead.phone]?.account || "..."}
                                </Button>
                              </div>
                            ) : (
                              <div className="pt-3 border-t">
                                <p className="text-xs text-center text-muted-foreground py-2">
                                  Đã tiếp cận bằng tất cả các account
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Type 3: Invalid Leads */}
              {invalidLeads.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">Không hợp lệ ({invalidLeads.length})</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left">SĐT</th>
                          <th className="px-4 py-2 text-left">Lý do</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {invalidLeads.map((lead) => (
                          <tr key={lead.phone}>
                            <td className="px-4 py-2 font-mono">{maskPhone(lead.phone)}</td>
                            <td className="px-4 py-2 text-muted-foreground">{lead.invalidReason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
})

CampaignCreationPanel.displayName = "CampaignCreationPanel"
