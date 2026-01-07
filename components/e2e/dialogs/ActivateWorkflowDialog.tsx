"use client"

import { useState } from "react"
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
import { Loader2, AlertCircle } from "lucide-react"
import { Lead, CustomFieldDefinition } from "../types"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

interface ActivateWorkflowDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedLead: Lead
  targetWorkflowId: string
  targetWorkflowName: string
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
        // Use text input for price fields to match Workflow2Dialog style
        if (field.name.includes("Price") || field.name.includes("price")) {
          return (
            <Input
              id={field.name}
              type="text"
              placeholder={field.placeholder}
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
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
      <DialogContent className="sm:max-w-[500px] md:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Kích hoạt {targetWorkflowName}</DialogTitle>
          <DialogDescription>
            Vui lòng cung cấp thông tin để kích hoạt workflow mới cho xe{" "}
            <strong>
              {selectedLead.brand} {selectedLead.model} {selectedLead.year}
            </strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1 px-1">
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
