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

interface SchemaProperty {
  type?: string
  default?: any
  description?: string
  enum?: string[]
  hidden?: boolean
  "read-only"?: boolean
  required?: boolean
  properties?: Record<string, SchemaProperty>  // For nested dict/object fields
}

interface ParsedField {
  name: string
  label: string
  type: string
  required: boolean
  default?: any
  description?: string
  enumValues?: string[]
  hidden?: boolean
  readOnly?: boolean
  subFields?: ParsedField[]  // For nested dict/object fields
}

interface ExecuteConnectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectorName: string  // Can be either name or ID
  defaultValues?: Record<string, any>
  dialogTitle?: string
  dialogDescription?: string
}

function parseInputSchema(inputSchema: any): ParsedField[] | null {
  console.log("[ExecuteConnectorDialog] Parsing input_schema:", inputSchema)

  if (!inputSchema || typeof inputSchema !== "object") {
    console.log("[ExecuteConnectorDialog] Invalid schema: not an object")
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
      console.log("[ExecuteConnectorDialog] Using nested body.properties")
      properties = inputSchema.body.properties
    } else {
      // Body contains fields directly (no properties wrapper)
      console.log("[ExecuteConnectorDialog] Using body fields directly")
      properties = inputSchema.body
    }
  }

  if (!properties || typeof properties !== "object") {
    console.log("[ExecuteConnectorDialog] No valid properties found in schema")
    return null
  }

  const requiredFields: string[] = Array.isArray(inputSchema.required) ? inputSchema.required : []

  const parsed = Object.entries(properties).map(([name, prop]) => {
    const schemaProp = prop as SchemaProperty
    const field: ParsedField = {
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

    // Parse nested properties for dict/object types
    if ((schemaProp.type === 'dict' || schemaProp.type === 'object') && schemaProp.properties) {
      console.log(`[ExecuteConnectorDialog] Parsing sub-fields for ${name}:`, schemaProp.properties)
      field.subFields = Object.entries(schemaProp.properties).map(([subName, subProp]) => {
        const subSchemaProp = subProp as SchemaProperty
        return {
          name: `${name}.${subName}`,  // Use dot notation for nested fields
          label: subSchemaProp.description || subName,
          type: subSchemaProp.type || "string",
          required: subSchemaProp.required || false,
          default: subSchemaProp.default,
          description: subSchemaProp.description,
          enumValues: subSchemaProp.enum,
          hidden: subSchemaProp.hidden === true,
          readOnly: subSchemaProp["read-only"] === true,
        }
      })
    }

    return field
  })

  console.log("[ExecuteConnectorDialog] Parsed fields:", parsed)
  return parsed
}

// Fetch dict variable definitions and enrich fields with sub-fields
async function enrichDictFields(fields: ParsedField[]): Promise<ParsedField[]> {
  const dictFields = fields.filter(f => f.type === 'dict' || f.type === 'object')

  if (dictFields.length === 0) {
    return fields
  }

  console.log("[ExecuteConnectorDialog] Found dict fields:", dictFields.map(f => f.name))

  try {
    // Fetch all dict variable definitions
    const res = await fetch('/api/e2e/tables/dict_variables?limit=100')
    if (!res.ok) {
      console.warn("[ExecuteConnectorDialog] Failed to fetch dict_variables")
      return fields
    }

    const data = await res.json()
    console.log("[ExecuteConnectorDialog] Full dict_variables response:", data)
    console.log("[ExecuteConnectorDialog] Dict variables from DB:", data.data?.map((d: any) => d.name))
    console.log("[ExecuteConnectorDialog] First dict variable (full object):", data.data?.[0])
    // Enrich each dict field with its sub-fields
    return fields.map(field => {
      if (field.type !== 'dict' && field.type !== 'object') {
        return field
      }

      // Find matching dict variable definition
      const dictVar = data.data?.find((d: any) => d.name === field.name)

      if (!dictVar || !dictVar.variables) {
        console.warn(`[ExecuteConnectorDialog] No dict_variables entry found for ${field.name}`)
        return field
      }

      console.log(`[ExecuteConnectorDialog] Found dict variables for ${field.name}:`, dictVar.variables)

      // Parse variables (could be JSON string or object)
      let variables = dictVar.variables
      if (typeof variables === 'string') {
        try {
          variables = JSON.parse(variables)
        } catch (e) {
          console.error(`[ExecuteConnectorDialog] Failed to parse variables for ${field.name}:`, e)
          return field
        }
      }

      // Convert variables to sub-fields
      const subFields: ParsedField[] = Object.entries(variables).map(([subName, subDef]: [string, any]) => ({
        name: `${field.name}.${subName}`,
        label: subDef.description || subName,
        type: subDef.type || 'string',
        required: subDef.required || false,
        default: subDef.default,
        description: subDef.description,
        enumValues: subDef.enum,
        hidden: subDef.hidden === true,
        readOnly: subDef['read-only'] === true,
      }))

      console.log(`[ExecuteConnectorDialog] Created ${subFields.length} sub-fields for ${field.name}`)

      return {
        ...field,
        subFields
      }
    })
  } catch (error) {
    console.error("[ExecuteConnectorDialog] Error enriching dict fields:", error)
    return fields
  }
}


export function ExecuteConnectorDialog({
  open,
  onOpenChange,
  connectorName,
  defaultValues = {},
  dialogTitle,
  dialogDescription,
}: ExecuteConnectorDialogProps) {
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
        console.log("[ExecuteConnectorDialog] Loading connector:", connectorName)
        const res = await fetch(`/api/e2e/tables/api_connectors?limit=100`)
        if (!res.ok) throw new Error("Failed to fetch connectors")

        const data = await res.json()
        console.log("[ExecuteConnectorDialog] All connectors:", data.data?.map((c: any) => ({ id: c.id, name: c.name })))
        console.log("[ExecuteConnectorDialog] Looking for:", connectorName)

        // Try to find by ID first, then by name
        let found = data.data?.find((c: any) => c.id === connectorName)
        if (!found) {
          console.log("[ExecuteConnectorDialog] Not found by ID, trying by name...")
          found = data.data?.find((c: any) => c.name.toLowerCase() === connectorName.toLowerCase())
        }

        console.log("[ExecuteConnectorDialog] Found connector:", found ? "YES" : "NO")

        if (found) {
          console.log("[ExecuteConnectorDialog] Connector details:", {
            name: found.name,
            base_url: found.base_url,
            method: found.method,
            has_input_schema: !!found.input_schema,
            input_schema_type: typeof found.input_schema,
            input_schema_raw: found.input_schema
          })
        }

        setConnector(found || null)

        if (found?.input_schema) {
          // Parse input_schema if it's a string
          let schema = found.input_schema
          if (typeof schema === 'string') {
            try {
              schema = JSON.parse(schema)
              console.log("[ExecuteConnectorDialog] Parsed input_schema from string:", schema)
            } catch (e) {
              console.error("[ExecuteConnectorDialog] Failed to parse input_schema string:", e)
            }
          }

          const parsed = parseInputSchema(schema)
          console.log("[ExecuteConnectorDialog] Parsed result:", parsed)

          if (parsed && parsed.length > 0) {
            // Enrich dict fields with sub-fields from dict_variables table
            console.log("[ExecuteConnectorDialog] About to enrich dict fields, parsed:", parsed)
            try {
              const enriched = await enrichDictFields(parsed)
              console.log("[ExecuteConnectorDialog] Enriched fields:", enriched)

              setFields(enriched)
              initFormValues(enriched)
            } catch (error) {
              console.error("[ExecuteConnectorDialog] Error during enrichment:", error)
              // Fall back to using parsed fields without enrichment
              setFields(parsed)
              initFormValues(parsed)
            }
            return
          } else {
            console.warn("[ExecuteConnectorDialog] No fields parsed from schema")
          }
        } else {
          console.warn("[ExecuteConnectorDialog] Connector has no input_schema")
        }

        // Fallback: no valid input_schema
        setFields([])
        setFormValues(defaultValues)
      } catch {
        setConnector(null)
        setFields([])
        setFormValues(defaultValues)
      } finally {
        setIsLoadingConnector(false)
      }
    }

    loadConnector()
  }, [open, connectorName]) // eslint-disable-line react-hooks/exhaustive-deps

  const initFormValues = (parsedFields: ParsedField[]) => {
    console.log("[ExecuteConnectorDialog] initFormValues called with fields:", parsedFields)
    console.log("[ExecuteConnectorDialog] defaultValues prop:", defaultValues)

    const values: Record<string, any> = {}
    for (const field of parsedFields) {
      // Use default from schema if present
      if (field.default !== undefined) {
        values[field.name] = field.default
      } else if (field.type === 'dict' || field.type === 'object') {
        values[field.name] = {}  // Initialize dict/object fields as empty objects
      } else {
        values[field.name] = ""
      }
    }

    // Apply provided default values (overrides schema defaults)
    Object.assign(values, defaultValues)

    console.log("[ExecuteConnectorDialog] Final form values:", values)
    setFormValues(values)
  }

  const handleFieldChange = (name: string, value: any) => {
    // Handle nested fields (e.g., "shouldGenerateMetadata.key")
    if (name.includes('.')) {
      const [parentName, ...childPath] = name.split('.')
      const childName = childPath.join('.')

      setFormValues((prev) => {
        const parentValue = prev[parentName] || {}
        return {
          ...prev,
          [parentName]: {
            ...(typeof parentValue === 'object' ? parentValue : {}),
            [childName]: value
          }
        }
      })
    } else {
      setFormValues((prev) => ({ ...prev, [name]: value }))
    }
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

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/e2e/execute-connector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorName,
          payload: formValues,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Thực thi connector thất bại")
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
    // Get value - handle nested fields with dot notation
    let value
    if (field.name.includes('.')) {
      const [parentName, ...childPath] = field.name.split('.')
      const childName = childPath.join('.')
      const parentValue = formValues[parentName]
      value = (typeof parentValue === 'object' && parentValue !== null) ? parentValue[childName] : ""
    } else {
      value = formValues[field.name]
    }
    value = value ?? ""

    // Boolean → select dropdown with true/false
    if (field.type === "boolean" || field.type === "bool") {
      return (
        <select
          id={field.name}
          value={String(value)}
          onChange={(e) => {
            const boolValue = e.target.value === "true"
            handleFieldChange(field.name, boolValue)
          }}
          disabled={field.readOnly}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Chọn...</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      )
    }

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
    if (field.type === "number" || field.type === "integer" || field.type === "float" || field.type === "int") {
      return (
        <Input
          id={field.name}
          type="number"
          step={field.type === "float" ? "0.01" : "1"}
          value={value}
          onChange={(e) => handleFieldChange(field.name, e.target.valueAsNumber)}
          disabled={field.readOnly}
        />
      )
    }

    // Dict/Object → JSON textarea
    if (field.type === "dict" || field.type === "object") {
      const jsonValue = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
      return (
        <Textarea
          id={field.name}
          value={jsonValue}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value)
              handleFieldChange(field.name, parsed)
            } catch {
              // Allow invalid JSON while typing
              handleFieldChange(field.name, e.target.value)
            }
          }}
          disabled={field.readOnly}
          className="min-h-[100px] font-mono text-xs"
          placeholder='{"key": "value"}'
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] md:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            {dialogTitle || connectorName}
          </DialogTitle>
          <DialogDescription>
            {dialogDescription || `Thực thi connector: ${connectorName}`}
            {connector && (
              <span className="block text-xs text-gray-400 mt-1">
                {connector.method} {connector.base_url}
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
              <p className="text-sm font-medium text-emerald-700">Thành công!</p>
            </div>
          ) : (
            <>
              {fields.length > 0 ? (
                fields
                  .filter((field) => !field.hidden)
                  .map((field) => {
                    // Debug logging for dict fields
                    if (field.type === 'dict' || field.type === 'object') {
                      console.log(`[ExecuteConnectorDialog] Rendering dict field "${field.name}":`, {
                        hasSubFields: !!field.subFields,
                        subFieldsCount: field.subFields?.length || 0,
                        subFields: field.subFields
                      })
                    }

                    return (
                      <div key={field.name}>
                        {/* Main field - only render if not a dict/object with sub-fields */}
                        {!(field.type === 'dict' || field.type === 'object') || !field.subFields ? (
                          <div className="space-y-2">
                            <Label htmlFor={field.name} className={field.readOnly ? "text-gray-500" : ""}>
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                              {field.readOnly && <span className="text-xs text-gray-400 ml-1">(chỉ đọc)</span>}
                            </Label>
                            {renderField(field)}
                          </div>
                        ) : (
                          /* Dict/Object with sub-fields - render as section */
                          <div className="space-y-3">
                            <div className="font-medium text-sm text-gray-700 border-b pb-1">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </div>
                            <div className="pl-4 space-y-3 border-l-2 border-gray-200">
                              {field.subFields?.filter(sf => !sf.hidden).map((subField) => (
                                <div key={subField.name} className="space-y-2">
                                  <Label htmlFor={subField.name} className={subField.readOnly ? "text-gray-500" : ""}>
                                    {subField.label} {subField.required && <span className="text-red-500">*</span>}
                                    {subField.readOnly && <span className="text-xs text-gray-400 ml-1">(chỉ đọc)</span>}
                                  </Label>
                                  {renderField(subField)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">Connector không có schema được định nghĩa</p>
                </div>
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
                Thực thi
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
