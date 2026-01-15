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

// Hardcoded message templates removed in favor of dynamic loading from workflow_steps table.


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
  workflowSteps?: any[]
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
  workflowSteps = [],
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

  // Workflow IDs for specific logic (prefilling, etc.)
  const isWFD1 = targetWorkflowId === "9f130676-a416-418f-bae9-a581096f6426"

  // Generate dynamic templates from workflow_steps
  const messageTemplates: Record<string, { title: string; template: string }> = workflowSteps.reduce((acc, step) => {
    if (step.template) {
      // Step key format: [Workflow Name].[Step Order] (e.g., WF2.1)
      const stepKey = `${targetWorkflowName}.${step.step_order}`
      acc[stepKey] = {
        title: step.step_name,
        template: step.template
      }
    }
    return acc
  }, {} as Record<string, { title: string; template: string }>)

  const hasPreview = Object.keys(messageTemplates).length > 0

  // Set default step when templates or workflow changes
  useEffect(() => {
    if (hasPreview) {
      const firstStepKey = Object.keys(messageTemplates).sort()[0]
      setSelectedPreviewStep(firstStepKey)
    } else {
      setSelectedPreviewStep("")
    }
  }, [targetWorkflowId, hasPreview])

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
    return parts.map((part: string, index: number) => {
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
