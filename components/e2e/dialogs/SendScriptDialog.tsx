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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, AlertCircle, Send, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { Lead } from "../types"

const CONNECTOR_NAME = "Send message to Sale"

interface SendScriptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedLead: Lead
  scriptText: string
}

// Derive form fields from connector's input_schema (JSON Schema format)
// e.g. { "properties": { "phone": { "type": "string" }, "first_message": { "type": "string" } }, "required": ["phone"] }
interface SchemaProperty {
  type?: string
  default?: any
  description?: string
  enum?: string[]
  hidden?: boolean
  "read-only"?: boolean
  required?: boolean
}

interface ParsedField {
  name: string
  label: string
  type: string // "string" | "number" | "integer" | etc.
  required: boolean
  default?: any
  description?: string
  enumValues?: string[]
  hidden?: boolean
  readOnly?: boolean
}

function parseInputSchema(inputSchema: any): ParsedField[] | null {
  console.log("[SendScriptDialog] Parsing input_schema:", inputSchema)

  if (!inputSchema || typeof inputSchema !== "object") {
    console.log("[SendScriptDialog] Invalid schema: not an object")
    return null
  }

  // Handle multiple schema structures:
  // 1. Top-level properties: { properties: { field1: {...}, field2: {...} } }
  // 2. Nested body.properties: { body: { properties: { field1: {...} } } }
  // 3. Direct body fields: { body: { field1: {...}, field2: {...} } }
  let properties = inputSchema.properties

  if (!properties && inputSchema.body) {
    // Check if body has properties wrapper
    if (inputSchema.body.properties) {
      console.log("[SendScriptDialog] Using nested body.properties")
      properties = inputSchema.body.properties
    } else {
      // Body contains fields directly (no properties wrapper)
      console.log("[SendScriptDialog] Using body fields directly")
      properties = inputSchema.body
    }
  }

  if (!properties || typeof properties !== "object") {
    console.log("[SendScriptDialog] No valid properties found in schema")
    return null
  }

  const requiredFields: string[] = Array.isArray(inputSchema.required) ? inputSchema.required : []

  const parsed = Object.entries(properties).map(([name, prop]) => {
    const schemaProp = prop as SchemaProperty
    return {
      name,
      label: schemaProp.description || name,
      type: schemaProp.type || "string",
      required: schemaProp.required || requiredFields.includes(name),
      default: schemaProp.default,
      description: schemaProp.description,
      enumValues: schemaProp.enum,
      hidden: schemaProp.hidden === true,
      readOnly: schemaProp["read-only"] === true,
    }
  })

  console.log("[SendScriptDialog] Parsed fields:", parsed)
  return parsed
}

export function SendScriptDialog({
  open,
  onOpenChange,
  selectedLead,
  scriptText,
}: SendScriptDialogProps) {
  const [connector, setConnector] = useState<any>(null)
  const [fields, setFields] = useState<ParsedField[]>([])
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingConnector, setIsLoadingConnector] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPayload, setShowPayload] = useState(false)

  // Load connector and build form when dialog opens
  useEffect(() => {
    if (!open) {
      setError(null)
      setSuccess(false)
      return
    }

    const loadConnector = async () => {
      setIsLoadingConnector(true)
      try {
        const res = await fetch(`/api/e2e/tables/api_connectors?limit=100`)
        if (!res.ok) throw new Error("Failed to fetch connectors")

        const data = await res.json()
        const found = data.data?.find((c: any) => c.name === CONNECTOR_NAME)
        setConnector(found || null)

        if (found?.input_schema) {
          const parsed = parseInputSchema(found.input_schema)
          if (parsed && parsed.length > 0) {
            setFields(parsed)
            initFormValues(parsed)
            return
          }
        }

        // Fallback: no connector or no valid input_schema - show raw phone + message
        setFields([])
        setFormValues({
          phone: selectedLead.additional_phone || selectedLead.phone || "",
          first_message: scriptText,
        })
      } catch {
        setConnector(null)
        setFields([])
        setFormValues({
          phone: selectedLead.additional_phone || selectedLead.phone || "",
          first_message: scriptText,
        })
      } finally {
        setIsLoadingConnector(false)
      }
    }

    loadConnector()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const initFormValues = (parsedFields: ParsedField[]) => {
    const values: Record<string, any> = {}
    for (const field of parsedFields) {
      // Use default from schema if present
      if (field.default !== undefined) {
        values[field.name] = field.default
      } else {
        values[field.name] = ""
      }
    }

    // Pre-fill phone from lead (flexible field name matching)
    if ("phone" in values) {
      values.phone = selectedLead.additional_phone || selectedLead.phone || ""
    }
    if ("send_to_number" in values) {
      values.send_to_number = selectedLead.additional_phone || selectedLead.phone || ""
    }

    // Pre-fill message/script from prop (flexible field name matching)
    if ("first_message" in values) {
      values.first_message = scriptText
    }
    if ("message" in values) {
      values.message = scriptText
    }

    setFormValues(values)
  }

  const handleFieldChange = (name: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async () => {
    setError(null)

    // Validate required fields
    for (const field of fields) {
      if (field.required) {
        const val = formValues[field.name]
        if (val === undefined || val === null || (typeof val === "string" && !val.trim())) {
          setError(`Vui lòng nhập ${field.label}`)
          return
        }
      }
    }

    // Fallback validation when no schema fields
    if (fields.length === 0) {
      if (!formValues.phone?.trim()) {
        setError("Vui lòng nhập số điện thoại")
        return
      }
      if (!formValues.first_message?.trim()) {
        setError("Vui lòng nhập tin nhắn")
        return
      }
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/e2e/execute-connector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorName: CONNECTOR_NAME,
          payload: formValues,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Gửi script thất bại")
      }

      setSuccess(true)
      setTimeout(() => {
        onOpenChange(false)
        setSuccess(false)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra")
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderField = (field: ParsedField) => {
    const value = formValues[field.name] ?? ""

    // Enum → select dropdown
    if (field.enumValues && field.enumValues.length > 0) {
      return (
        <select
          id={field.name}
          value={value}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          disabled={field.readOnly}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Chọn...</option>
          {field.enumValues.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }

    // Long text → textarea
    if (field.type === "string" && (typeof value === "string" && value.length > 100)) {
      return (
        <Textarea
          id={field.name}
          value={value}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          disabled={field.readOnly}
          className="min-h-[100px]"
        />
      )
    }

    // Number
    if (field.type === "number" || field.type === "integer") {
      return (
        <Input
          id={field.name}
          type="number"
          value={value}
          onChange={(e) => handleFieldChange(field.name, e.target.valueAsNumber)}
          disabled={field.readOnly}
        />
      )
    }

    // Default: text input
    return (
      <Input
        id={field.name}
        type="text"
        value={value}
        onChange={(e) => handleFieldChange(field.name, e.target.value)}
        disabled={field.readOnly}
      />
    )
  }

  // Fallback UI when no input_schema
  const renderFallbackForm = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor="phone">
          Số điện thoại <span className="text-red-500">*</span>
        </Label>
        <Input
          id="phone"
          type="text"
          value={formValues.phone || ""}
          onChange={(e) => handleFieldChange("phone", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="first_message">
          Tin nhắn <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="first_message"
          value={formValues.first_message || ""}
          onChange={(e) => handleFieldChange("first_message", e.target.value)}
          className="min-h-[100px]"
        />
      </div>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] md:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Gửi Script
          </DialogTitle>
          <DialogDescription>
            Gửi tin nhắn cho lead{" "}
            <strong>{selectedLead.name || selectedLead.phone}</strong>
            {connector && (
              <span className="block text-xs text-gray-400 mt-1">
                Connector: {connector.name} ({connector.method} {connector.base_url})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-4 py-4 px-1">
          {isLoadingConnector ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm">Đang tải cấu hình connector...</span>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-700">Gửi thành công!</p>
            </div>
          ) : (
            <>
              {fields.length > 0 ? (
                fields
                  .filter((field) => !field.hidden) // Don't render hidden fields
                  .map((field) => (
                    <div key={field.name} className="space-y-2">
                      <Label htmlFor={field.name} className={field.readOnly ? "text-gray-500" : ""}>
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                        {field.readOnly && <span className="text-xs text-gray-400 ml-1">(chỉ đọc)</span>}
                      </Label>
                      {renderField(field)}
                    </div>
                  ))
              ) : (
                renderFallbackForm()
              )}

              {/* Payload Preview */}
              <div className="rounded-lg bg-gray-50 border border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowPayload(!showPayload)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <span>Payload sẽ gửi ({Object.keys(formValues).length} fields)</span>
                  {showPayload ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {showPayload && (
                  <pre className="px-3 pb-3 text-[11px] text-gray-700 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(formValues, null, 2)}
                  </pre>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoadingConnector || success}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang gửi...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Gửi
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
