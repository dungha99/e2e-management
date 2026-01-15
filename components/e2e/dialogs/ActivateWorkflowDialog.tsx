"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, AlertCircle, Eye, Copy, Check, ChevronDown, ChevronUp, Info } from "lucide-react"
import { Lead, CustomFieldDefinition } from "../types"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { PriceInput } from "../common/PriceInput"

// WFD5 Message Templates
const WFD5_MESSAGE_TEMPLATES: Record<string, { title: string; template: string }> = {
  "D5.1": {
    title: "Mở phiên 5 ngày + Gửi cho người bán",
    template: `Về xe {{display_name}} {{year}} của mình, em sẽ cố gắng neo người mua để họ giữ nguyên mức giá trong 3 ngày tới ạ, mình cứ cân đối rồi báo em hong sao hết ạ.

Đồng thời, em đã mở thêm phiên kết nối để tìm thêm người mua có nhu cầu để tìm được mức giá tốt nhất có thể: {{session_url}}

Anh chị có thể theo dõi trực tiếp các tương tác từ người mua trên link này nhé!
Em sẽ update thường xuyên cho anh chị nha.`
  },
  "D5.2": {
    title: "Social Proof (Day 2)",
    template: `Tuần vừa rồi Vucar vừa giao dịch thành công 1 chiếc {{similar_car}} đời {{similar_year}}.

Tình trạng xe ok, giá chốt khoảng {{price_reference}}.

Em gửi anh chị tham khảo để nắm được tình hình thị trường hiện tại ạ.`
  },
  "D5.3": {
    title: "Scarcity - Buyer withdrew (Day 3)",
    template: `Dạ anh chị ơii,

Em cập nhật tình hình: Người mua trước có giá cao nhất liên hệ mình hôm trước thì họ đã mua được xe vừa ý rồi nên ngừng giao dịch ạ huhu

Để em tiếp tục tìm thêm người mua phù hợp cho mình nhé. Em sẽ cố gắng tìm được người mua tốt nhất cho xe của anh chị.`
  },
  "D5.4": {
    title: "Urgency - New buyer (Day 4)",
    template: `Em update cho anh chị tình hình ạ! Hiện tại hệ thống bên em đang có yêu cầu tìm mua dòng {{display_name}} từ khách hàng đã từng bán xe qua Vucar.

Họ cần xe trong tuần và có thể mua ngay. Mình còn nhu cầu bán không để em báo họ ưu tiên dẫn họ xem xe mình trước ạ?

Tài chính họ hiện tại đang tầm {{price_range}}.

Nếu oke thì em sẽ liên hệ người mua ngay để sắp xếp xem xe nhé! Mình phản hồi giúp em để em kịp thời báo cho người mua ạ.`
  },
  "D5.5": {
    title: "Close Session + Final Decision (Day 5)",
    template: `Dạ anh chị ơi, phiên đấu giá xe {{display_name}} đã kết thúc, em đẩy thêm tin xe mình đến tệp khách phù hợp tìm đúng dòng xe mình thì hiện tại thì ngân sách của họ chỉ đang giao động tầm {{price_range}}.

Em đã thương lượng sẵn cho bên bán thì với mức giá này bên người mua lo hết chi phí giấy tờ, anh chị nhận về đủ ạ.

Ngoài ra anh chị đắn đo giấy tờ hồ sơ thì bên em cũng sẽ hỗ trợ giúp mình cho đến khi nhận đủ tiền mới thôi.

Mình có thể xem thương lượng để đi đến mức giá tối ưu với khách này. Không biết anh chị thấy thế nào ạ?`
  }
}

// WFB2 Message Templates
const WFB2_MESSAGE_TEMPLATES: Record<string, { title: string; template: string }> = {
  "B2.1": {
    title: "Gửi lại phiên có báo cáo kiểm định cho khách",
    template: `Dạ anh chị ơi, xe mình đã kiểm định rồi nên em đã upload tình trạng xe chi tiết lên trên tin xe của mình để người mua họ tự tin đặt giá ạ.

Em đã upload tình trạng xe của mình trên phiên đấu giá của anh chị ạ: {{session_url}}. Có điểm gì cần bổ sung anh chị cứ nhắn em nha.

[Tin nhắn 2]
Với tình trạng xe của mình, anh xem có thể cân nhắc được giá nào cho khách em ạ. Khách em thiện chí muốn mua xe mình lắm nhưng mà với tình trạng xe đẹp, không vết vát gì thì khách giao dịch đủ tiền như em báo với mình luôn. Tuy nhiên thì sau khi xem xe, khách có cân nhắc thêm nên anh xem gia lộc cho khách được giá nào để em báo khách ạ?`
  },
  "B2.2": {
    title: "Social Proof (sau 30')",
    template: `Decoy zalo`
  },
  "B2.3": {
    title: "Gửi lại summary của bot (sau 30')",
    template: ``
  },
  "B2.4": {
    title: "Gửi lại kết phiên cho khách",
    template: `Dạ em đã đẩy thêm tin xe mình với tình trạng xe thực tế. Có vài người mua mới liên hệ nhưng tài chính họ hơi thấp nên em chưa làm việc tiếp. Hiện tại thì người mua hôm trước trả giá cao nhất vẫn còn quan tâm do họ tìm đúng dòng này ạ.

Dạ nếu anh cân nhắc được mức giá nào hợp lý thì cứ báo lại em để em hỗ trợ mình deal với khách ạ, do em ở giữa nên luôn cố gắng deal cho mình mức giá tốt và hợp lý nhất, anh yên tâm nhé.`
  }
}

// WF2 Message Templates
const WF2_MESSAGE_TEMPLATES: Record<string, { title: string; template: string }> = {
  "W2.1": {
    title: "Create Bidding",
    template: `Dạ em đang tiếp tục đẩy thêm tin xe mình tiếp tục trên hệ thống ạ để thu hút thêm người mua quan tâm dòng xe này.

Em gửi anh chị theo dõi tin xe của mình ạ.

Phiên đấu giá xe {{display_name}} {{year}}
Thông tin xe:
Khu vực: TP. Hồ Chí Minh
Odo: {{mileage}} km
Link phiên: {{session_url}}`
  },
  "W2.2": {
    title: "Kết thúc phiên",
    template: `Dạ anh chị ơi, phiên đấu giá xe {{display_name}} đã kết thúc, thì kết quả không khả quan lắm ạ, các khách mua bên Vucar em có thông tin sẵn thì vẫn không được giá.

Hiện tại thì ngân sách của họ chỉ đang giao động tầm {{price_range}}.

Em có thương lượng thêm thì với mức giá này bên người mua lo hết chi phí giấy tờ, anh chị nhận về đủ ạ.

Mình có thể xem thương lượng để đi đến mức giá tối ưu với khách này. Không biết anh chị thấy thế nào ạ?`
  }
}

interface ActivateWorkflowDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedLead: Lead
  targetWorkflowId: string
  targetWorkflowName: string
  targetWorkflowTooltip?: string | null
  parentInstanceId: string
  customFields?: CustomFieldDefinition[]
  aiInsightId?: string | null
  isAlignedWithAi?: boolean
  hideDefaultFields?: boolean
  onSuccess?: () => void
}

export function ActivateWorkflowDialog({
  open,
  onOpenChange,
  selectedLead,
  targetWorkflowId,
  targetWorkflowName,
  targetWorkflowTooltip,
  parentInstanceId,
  customFields = [],
  aiInsightId,
  isAlignedWithAi,
  hideDefaultFields = false,
  onSuccess,
}: ActivateWorkflowDialogProps) {
  const [insight, setInsight] = useState("")
  const [finalOutcome, setFinalOutcome] = useState<"discount" | "original_price" | "lost" | "">("")
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Preview state
  const [showPreview, setShowPreview] = useState(true)
  const [selectedPreviewStep, setSelectedPreviewStep] = useState<string>("")
  const [copied, setCopied] = useState(false)

  // Check workflow type and get appropriate templates
  // Workflow IDs:
  // WF0: 3fc82631-68e9-469a-95d7-c249fe682ced
  // WF1: 36af24d3-6e60-43b8-b198-cfec8b5d0e0e
  // WF2: 3b78a161-116e-43a2-8b7f-61fcf9ba9930
  // WFD1: 9f130676-a416-418f-bae9-a581096f6426
  // WFD5: e06d0d0b-be03-45f9-97f1-38964ee7e231
  // WFB2: fc43e876-0948-4d5a-b16d-a717e891fd57
  const isWFD1 = targetWorkflowId === "9f130676-a416-418f-bae9-a581096f6426"
  const isWFD5 = targetWorkflowId === "e06d0d0b-be03-45f9-97f1-38964ee7e231"
  const isWFB2 = targetWorkflowId === "fc43e876-0948-4d5a-b16d-a717e891fd57"
  const isWF2 = targetWorkflowId === "3b78a161-116e-43a2-8b7f-61fcf9ba9930"
  const hasPreview = isWFD5 || isWFB2 || isWF2

  // Get the appropriate template set based on workflow type
  const getMessageTemplates = () => {
    if (isWFD5) return WFD5_MESSAGE_TEMPLATES
    if (isWFB2) return WFB2_MESSAGE_TEMPLATES
    if (isWF2) return WF2_MESSAGE_TEMPLATES
    return {}
  }
  const messageTemplates = getMessageTemplates()

  // Set default step when workflow type changes
  useEffect(() => {
    if (isWFD5) setSelectedPreviewStep("D5.1")
    else if (isWFB2) setSelectedPreviewStep("B2.1")
    else if (isWF2) setSelectedPreviewStep("W2.1")
  }, [isWFD5, isWFB2, isWF2])

  // Helper function to get plain text message (for copy)
  // Uses customFieldValues (form input) when available for live preview updates
  const getPlainMessage = (stepKey: string): string => {
    const template = messageTemplates[stepKey]?.template || ""
    const displayName = selectedLead.display_name || `${selectedLead.brand || ""} ${selectedLead.model || ""}`.trim() || "xe"
    const year = selectedLead.year?.toString() || ""

    // Use form values for prices if available, otherwise fall back to lead data
    const minPriceFromForm = customFieldValues.minPrice ? Number(customFieldValues.minPrice) : null
    const maxPriceFromForm = customFieldValues.maxPrice ? Number(customFieldValues.maxPrice) : null

    // Calculate price_reference: use maxPrice from form, or fall back to highest bid - 17tr
    const highestBidInMillions = maxPriceFromForm || (selectedLead.price_highest_bid ? Math.round(selectedLead.price_highest_bid / 1000000) : 0)
    const priceReference = highestBidInMillions > 0 ? `${highestBidInMillions - 17} triệu` : "N/A"

    // Calculate price_range: use minPrice and maxPrice from form if available
    const priceRangeLow = minPriceFromForm || (highestBidInMillions > 0 ? highestBidInMillions - 5 : 0)
    const priceRangeHigh = maxPriceFromForm || (highestBidInMillions > 0 ? highestBidInMillions + 10 : 0)
    const priceRange = (priceRangeLow > 0 || priceRangeHigh > 0) ? `${priceRangeLow} - ${priceRangeHigh} triệu` : "N/A"

    const sessionUrl = selectedLead.car_id ? `https://vucar.vn/session/${selectedLead.car_id}` : "[session_url]"
    const mileage = selectedLead.mileage ? selectedLead.mileage.toLocaleString("vi-VN") : "N/A"

    return template
      .replace(/\{\{display_name\}\}/g, displayName)
      .replace(/\{\{year\}\}/g, year)
      .replace(/\{\{similar_car\}\}/g, displayName)
      .replace(/\{\{similar_year\}\}/g, year)
      .replace(/\{\{price_reference\}\}/g, priceReference)
      .replace(/\{\{price_range\}\}/g, priceRange)
      .replace(/\{\{session_url\}\}/g, sessionUrl)
      .replace(/\{\{mileage\}\}/g, mileage)
  }

  // Helper function to render message with highlighted variables
  // Uses customFieldValues (form input) when available for live preview updates
  const renderHighlightedMessage = (stepKey: string): React.ReactNode => {
    const template = messageTemplates[stepKey]?.template || ""
    const displayName = selectedLead.display_name || `${selectedLead.brand || ""} ${selectedLead.model || ""}`.trim() || "xe"
    const year = selectedLead.year?.toString() || ""

    // Use form values for prices if available, otherwise fall back to lead data
    const minPriceFromForm = customFieldValues.minPrice ? Number(customFieldValues.minPrice) : null
    const maxPriceFromForm = customFieldValues.maxPrice ? Number(customFieldValues.maxPrice) : null

    // Calculate price_reference: use maxPrice from form, or fall back to highest bid - 17tr
    const highestBidInMillions = maxPriceFromForm || (selectedLead.price_highest_bid ? Math.round(selectedLead.price_highest_bid / 1000000) : 0)
    const priceReference = highestBidInMillions > 0 ? `${highestBidInMillions - 17} triệu` : "N/A"

    // Calculate price_range: use minPrice and maxPrice from form if available
    const priceRangeLow = minPriceFromForm || (highestBidInMillions > 0 ? highestBidInMillions - 5 : 0)
    const priceRangeHigh = maxPriceFromForm || (highestBidInMillions > 0 ? highestBidInMillions + 10 : 0)
    const priceRange = (priceRangeLow > 0 || priceRangeHigh > 0) ? `${priceRangeLow} - ${priceRangeHigh} triệu` : "N/A"

    const sessionUrl = selectedLead.car_id ? `https://vucar.vn/session/${selectedLead.car_id}` : "[session_url]"
    const mileage = selectedLead.mileage ? selectedLead.mileage.toLocaleString("vi-VN") : "N/A"

    // Replace variables with marked versions (using special delimiters)
    const markedText = template
      .replace(/\{\{display_name\}\}/g, `⟦${displayName}⟧`)
      .replace(/\{\{year\}\}/g, `⟦${year}⟧`)
      .replace(/\{\{similar_car\}\}/g, `⟦${displayName}⟧`)
      .replace(/\{\{similar_year\}\}/g, `⟦${year}⟧`)
      .replace(/\{\{price_reference\}\}/g, `⟦${priceReference}⟧`)
      .replace(/\{\{price_range\}\}/g, `⟦${priceRange}⟧`)
      .replace(/\{\{session_url\}\}/g, `⟦${sessionUrl}⟧`)
      .replace(/\{\{mileage\}\}/g, `⟦${mileage}⟧`)

    // Split by markers and create JSX elements
    const parts = markedText.split(/⟦|⟧/)
    return parts.map((part, index) => {
      // Odd indices are the highlighted variables
      if (index % 2 === 1) {
        return (
          <span
            key={index}
            className="bg-blue-100 text-blue-800 px-1 rounded font-medium"
          >
            {part}
          </span>
        )
      }
      return <span key={index}>{part}</span>
    })
  }

  const handleCopyPreview = async () => {
    const message = getPlainMessage(selectedPreviewStep)
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  // Prefill minPrice and maxPrice when dialog opens
  useEffect(() => {
    if (open) {
      const prefillValues: Record<string, string> = {}

      // Prefill minPrice with price_customer
      if (selectedLead?.price_customer) {
        prefillValues.minPrice = Math.round(selectedLead.price_customer / 1000000).toString()
      }

      // Prefill maxPrice with highest bid from sale_status.price_highest_bid
      if (selectedLead?.price_highest_bid) {
        prefillValues.maxPrice = Math.round(selectedLead.price_highest_bid / 1000000).toString()
      }

      // Prefill WFD1 fields
      if (isWFD1) {
        // Phone: priority is additional_phone, fallback to phone
        prefillValues.phone = selectedLead?.additional_phone || selectedLead?.phone || ""
        // Default first_message
        prefillValues.first_message = "Em được giới thiệu mình có nhu cầu bán xe em kết bạn để hỏi thêm ít thông tin được không ạ? Xe còn ko a"
      }

      if (Object.keys(prefillValues).length > 0) {
        setCustomFieldValues(prev => ({
          ...prev,
          ...prefillValues
        }))
      }
    }
  }, [open, selectedLead?.price_customer, selectedLead?.price_highest_bid, selectedLead?.phone, selectedLead?.additional_phone, isWFD1])

  const handleSubmit = async () => {
    // Validation - skip default fields if hideDefaultFields is true
    if (!hideDefaultFields) {
      if (!insight.trim()) {
        setError("Vui lòng nhập lý do kích hoạt workflow")
        return
      }
      if (!finalOutcome) {
        setError("Vui lòng chọn kết quả của workflow trước đó")
        return
      }
    }

    // Validate required custom fields
    for (const field of customFields) {
      if (field.required) {
        const value = customFieldValues[field.name]
        if (!value || (typeof value === "string" && !value.trim())) {
          setError(`Vui lòng nhập ${field.label}`)
          return
        }
      }
    }

    setError(null)
    setIsSubmitting(true)

    try {
      // Prepare transition properties with hybrid structure
      // For WF0, insight can be empty and we don't store car_snapshot
      const transitionProperties = hideDefaultFields ? {
        custom_fields: customFieldValues,
      } : {
        insight: insight.trim(),
        car_snapshot: {
          display_name: selectedLead.display_name || `${selectedLead.brand} ${selectedLead.model} ${selectedLead.year}`.trim() || null,
          intention: selectedLead.intentionLead || null,
          sales_stage: selectedLead.stage || null,
          qualified_status: selectedLead.qualified || null,
          price_customer: selectedLead.price_customer || null,
          price_highest_bid: selectedLead.dealer_bidding?.maxPrice || null,
          gap_price: selectedLead.price_customer && selectedLead.dealer_bidding?.maxPrice
            ? selectedLead.price_customer - selectedLead.dealer_bidding.maxPrice
            : null,
        },
        custom_fields: customFieldValues,
      }

      // Get phone number for webhook
      const phoneNumber = selectedLead.phone || selectedLead.additional_phone

      const response = await fetch("/api/e2e/activate-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId: selectedLead.car_id,
          targetWorkflowId,
          parentInstanceId: parentInstanceId || null,
          finalOutcome: hideDefaultFields ? null : finalOutcome,
          transitionProperties,
          aiInsightId: aiInsightId || null,
          isAlignedWithAi: isAlignedWithAi !== undefined ? isAlignedWithAi : null,
          phoneNumber: phoneNumber || null,
          workflowPayload: customFieldValues, // Workflow-specific fields for webhook
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to activate workflow")
      }

      // Reset form
      setInsight("")
      setFinalOutcome("")
      setCustomFieldValues({})
      onOpenChange(false)

      // Notify success
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error("[ActivateWorkflowDialog] Error:", err)
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra khi kích hoạt workflow")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setInsight("")
    setFinalOutcome("")
    setCustomFieldValues({})
    setError(null)
    onOpenChange(false)
  }

  const handleCustomFieldChange = (fieldName: string, value: any) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [fieldName]: value,
    }))
  }

  const renderCustomField = (field: CustomFieldDefinition) => {
    const value = customFieldValues[field.name] ?? field.default_value ?? ""

    // Special handling for checkbox fields (true/false options)
    const isCheckboxField = field.type === "select" &&
      field.options?.length === 2 &&
      field.options.includes("true") &&
      field.options.includes("false")

    if (isCheckboxField) {
      const isChecked = value === "true" || value === true
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={field.name}
            checked={isChecked}
            onCheckedChange={(checked) => handleCustomFieldChange(field.name, checked === true)}
          />
          <Label htmlFor={field.name} className="text-sm font-normal cursor-pointer">
            {field.label}
          </Label>
        </div>
      )
    }

    switch (field.type) {
      case "text":
        return (
          <Input
            id={field.name}
            type="text"
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
          />
        )

      case "number":
        // Use PriceInput for price fields to show description and validation
        if (field.name.includes("Price") || field.name.includes("price")) {
          return (
            <PriceInput
              id={field.name}
              placeholder={field.placeholder}
              value={value}
              onChange={(val) => handleCustomFieldChange(field.name, val)}
            />
          )
        }
        return (
          <Input
            id={field.name}
            type="number"
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleCustomFieldChange(field.name, e.target.valueAsNumber)}
          />
        )

      case "date":
        return (
          <Input
            id={field.name}
            type="date"
            value={value}
            onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
          />
        )

      case "select":
        return (
          <Select value={value} onValueChange={(val) => handleCustomFieldChange(field.name, val)}>
            <SelectTrigger id={field.name}>
              <SelectValue placeholder={field.placeholder || "Chọn..."} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case "textarea":
        return (
          <Textarea
            id={field.name}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
            className="min-h-[80px]"
          />
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[90vh] flex flex-col ${hasPreview ? "sm:max-w-[900px]" : "sm:max-w-[500px] md:max-w-[600px]"}`}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Kích hoạt {targetWorkflowName}</DialogTitle>
          <DialogDescription>
            Vui lòng cung cấp thông tin để kích hoạt workflow mới cho xe{" "}
            <strong>
              {selectedLead.brand} {selectedLead.model} {selectedLead.year}
            </strong>
          </DialogDescription>
          {targetWorkflowTooltip && (
            <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700 whitespace-pre-wrap">{targetWorkflowTooltip}</p>
            </div>
          )}
        </DialogHeader>

        <div className={`overflow-y-auto flex-1 ${hasPreview ? "flex gap-6" : "space-y-4 py-4 px-1"}`}>
          {/* Left Side - Form */}
          <div className={`space-y-4 py-4 ${hasPreview ? "flex-1 min-w-0 pr-2" : ""}`}>
            {/* Final Outcome - Hidden for WF0 */}
            {!hideDefaultFields && (
              <div className="space-y-2">
                <Label htmlFor="final-outcome">
                  Kết quả workflow trước <span className="text-red-500">*</span>
                </Label>
                <Select value={finalOutcome} onValueChange={(value: any) => setFinalOutcome(value)}>
                  <SelectTrigger id="final-outcome">
                    <SelectValue placeholder="Chọn kết quả..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discount">Discount (Khách chấp nhận giảm giá)</SelectItem>
                    <SelectItem value="original_price">Original Price (Giữ giá gốc)</SelectItem>
                    <SelectItem value="lost">Lost (Mất deal)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">Kết quả này sẽ được lưu vào workflow instance trước đó</p>
              </div>
            )}

            {/* Insight - Hidden for WF0 */}
            {!hideDefaultFields && (
              <div className="space-y-2">
                <Label htmlFor="insight">
                  Lý do kích hoạt <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="insight"
                  placeholder="Tại sao bạn muốn kích hoạt workflow này?"
                  value={insight}
                  onChange={(e) => setInsight(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            )}

            {/* Custom Fields */}
            {customFields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </Label>
                {renderCustomField(field)}
              </div>
            ))}

            {/* Transition Properties Preview - Hidden for WF0 */}
            {!hideDefaultFields && (
              <div className="rounded-lg bg-gray-50 p-3 space-y-1">
                <p className="text-xs font-medium text-gray-700 mb-2">Thông tin được lưu:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Giá khách:</span>{" "}
                    <span className="font-medium">
                      {selectedLead.price_customer ? `${(selectedLead.price_customer / 1000000).toFixed(0)}tr` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Giá cao nhất:</span>{" "}
                    <span className="font-medium">
                      {selectedLead.dealer_bidding?.maxPrice
                        ? `${(selectedLead.dealer_bidding.maxPrice / 1000000).toFixed(0)}tr`
                        : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Gap:</span>{" "}
                    <span className="font-medium">
                      {selectedLead.price_customer && selectedLead.dealer_bidding?.maxPrice
                        ? `${((selectedLead.price_customer - selectedLead.dealer_bidding.maxPrice) / 1000000).toFixed(0)}tr`
                        : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Stage:</span>{" "}
                    <span className="font-medium">{selectedLead.stage || "—"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Right Side - Message Preview (WFD5 and WFB2) */}
          {hasPreview && selectedPreviewStep && (
            <div className="flex-1 min-w-0 py-4 border-l pl-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Xem trước tin nhắn</span>
                </div>
                <button
                  onClick={handleCopyPreview}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${copied
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Đã copy!" : "Copy"}
                </button>
              </div>

              {/* Step Selector */}
              <div className="mb-3">
                <Select value={selectedPreviewStep} onValueChange={setSelectedPreviewStep}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(messageTemplates).map(([key, { title }]) => (
                      <SelectItem key={key} value={key} className="text-xs">
                        {key}: {title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Message Preview */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 max-h-[400px] overflow-y-auto">
                <p className="text-xs text-gray-500 mb-2">
                  {messageTemplates[selectedPreviewStep]?.title}
                </p>
                <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {renderHighlightedMessage(selectedPreviewStep)}
                </div>
              </div>

              <p className="text-[10px] text-gray-400 mt-2">
                * Dữ liệu được tự động điền từ thông tin xe hiện tại
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang kích hoạt...
              </>
            ) : (
              "Kích hoạt"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
