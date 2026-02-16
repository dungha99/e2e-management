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
import { Loader2, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Zap, Clock, X, Plus, ChevronDown, ChevronUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  ParsedField,
  loadConnectorFields,
  initFormValues as initFormValuesFromFields,
  applyFieldChange,
} from "./connectorFormUtils"
import { createAiWorkflowAction } from "@/app/actions/workflow"

/** A single step extracted from the AI analysis */
export interface FlowStep {
  stepName: string
  connectorId: string
  connectorLabel: string
  defaultValues: Record<string, any>
  aiMetadata?: {
    action?: string
    expectedReaction?: string
    successSignal?: string
    failureSignal?: string
    ifSuccess?: string
    ifFailure?: string
  }
}

interface UseFlowWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  steps: FlowStep[]
  carId: string
  workflowName?: string
  workflowDescription?: string
  onSuccess?: () => void
}

export function UseFlowWizardDialog({
  open,
  onOpenChange,
  steps,
  carId,
  workflowName,
  workflowDescription,
  onSuccess,
}: UseFlowWizardDialogProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [stepPayloads, setStepPayloads] = useState<Record<string, any>[]>([])
  const [stepSchedules, setStepSchedules] = useState<string[]>([])
  const [stepFields, setStepFields] = useState<ParsedField[][]>([])
  const [loadingSchemas, setLoadingSchemas] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [flowName, setFlowName] = useState(workflowName || "")
  const [flowDescription, setFlowDescription] = useState(workflowDescription || "")
  const [showPayloads, setShowPayloads] = useState<Record<number, boolean>>({})

  // Reset on open
  useEffect(() => {
    if (open && steps.length > 0) {
      setCurrentStep(0)
      setStepPayloads(steps.map(s => ({ ...s.defaultValues })))
      setStepSchedules(steps.map(() => ""))
      setError(null)
      setSuccess(false)
      setFlowName(workflowName || `AI Flow ${new Date().toLocaleDateString('vi-VN')}`)
      setFlowDescription(workflowDescription || "")
      setShowPayloads({})
      fetchAllSchemas()
    }
  }, [open, steps]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch all connector schemas and initialize form values
  const fetchAllSchemas = async () => {
    setLoadingSchemas(true)
    const allFields: ParsedField[][] = []
    const allPayloads: Record<string, any>[] = []

    for (const step of steps) {
      try {
        const { fields } = await loadConnectorFields(step.connectorId)
        allFields.push(fields)
        // Initialize form values from schema, then override with defaults
        allPayloads.push(initFormValuesFromFields(fields, step.defaultValues))
      } catch (err) {
        console.error(`[UseFlowWizard] Failed to load schema for ${step.connectorId}:`, err)
        allFields.push([])
        allPayloads.push({ ...step.defaultValues })
      }
    }

    setStepFields(allFields)
    setStepPayloads(allPayloads)
    setLoadingSchemas(false)
  }

  // ------- Field change handlers (same as ExecuteConnectorDialog) -------

  const handleFieldChange = (stepIdx: number, name: string, value: any) => {
    setStepPayloads(prev => {
      const updated = [...prev]
      updated[stepIdx] = applyFieldChange(updated[stepIdx] || {}, name, value)
      return updated
    })
  }

  const handleAddArrayItem = (stepIdx: number, name: string) => {
    setStepPayloads(prev => {
      const updated = [...prev]
      const current = Array.isArray(updated[stepIdx]?.[name]) ? updated[stepIdx][name] : []
      updated[stepIdx] = { ...updated[stepIdx], [name]: [...current, ""] }
      return updated
    })
  }

  const handleArrayItemChange = (stepIdx: number, name: string, index: number, value: string) => {
    setStepPayloads(prev => {
      const updated = [...prev]
      const current = [...(Array.isArray(updated[stepIdx]?.[name]) ? updated[stepIdx][name] : [])]
      current[index] = value
      updated[stepIdx] = { ...updated[stepIdx], [name]: current }
      return updated
    })
  }

  const handleRemoveArrayItem = (stepIdx: number, name: string, index: number) => {
    setStepPayloads(prev => {
      const updated = [...prev]
      const current = [...(Array.isArray(updated[stepIdx]?.[name]) ? updated[stepIdx][name] : [])]
      current.splice(index, 1)
      updated[stepIdx] = { ...updated[stepIdx], [name]: current }
      return updated
    })
  }

  const handleScheduleChange = (stepIdx: number, value: string) => {
    setStepSchedules(prev => {
      const updated = [...prev]
      updated[stepIdx] = value
      return updated
    })
  }

  // ------- Render field (matching ExecuteConnectorDialog exactly) -------

  const renderField = (stepIdx: number, field: ParsedField) => {
    // Get value - handle nested fields with dot notation
    let value
    if (field.name.includes('.')) {
      const [parentName, ...childPath] = field.name.split('.')
      const childName = childPath.join('.')
      const parentValue = stepPayloads[stepIdx]?.[parentName]
      value = (typeof parentValue === 'object' && parentValue !== null) ? parentValue[childName] : ""
    } else {
      value = stepPayloads[stepIdx]?.[field.name]
    }
    value = value ?? ""

    // Array → dynamic list of inputs
    if (field.type === "array") {
      const arrayItems = Array.isArray(value) ? value : []
      return (
        <div className="space-y-2">
          {arrayItems.map((item: string, idx: number) => (
            <div key={idx} className="flex gap-2">
              <Textarea
                value={item}
                onChange={(e) => handleArrayItemChange(stepIdx, field.name, idx, e.target.value)}
                disabled={field.readOnly}
                className="min-h-[60px] text-xs"
              />
              {!field.readOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveArrayItem(stepIdx, field.name, idx)}
                  className="h-8 w-8 text-red-500 hover:text-red-700 shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {!field.readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddArrayItem(stepIdx, field.name)}
              className="w-full text-[10px] h-7 border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            >
              <Plus className="h-3 w-3 mr-1" /> Thêm item
            </Button>
          )}
        </div>
      )
    }

    // Boolean → select dropdown
    if (field.type === "boolean" || field.type === "bool") {
      return (
        <select
          id={field.name}
          value={String(value)}
          onChange={(e) => {
            const boolValue = e.target.value === "true"
            handleFieldChange(stepIdx, field.name, boolValue)
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
          onChange={(e) => handleFieldChange(stepIdx, field.name, e.target.value)}
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
          onChange={(e) => handleFieldChange(stepIdx, field.name, e.target.value)}
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
          onChange={(e) => handleFieldChange(stepIdx, field.name, e.target.valueAsNumber)}
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
              handleFieldChange(stepIdx, field.name, parsed)
            } catch {
              handleFieldChange(stepIdx, field.name, e.target.value)
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
        onChange={(e) => handleFieldChange(stepIdx, field.name, e.target.value)}
        disabled={field.readOnly}
      />
    )
  }

  // ------- Render a complete field row (with dict sub-fields support) -------

  const renderFieldRow = (stepIdx: number, field: ParsedField) => {
    if (field.hidden) return null

    // Dict/Object with sub-fields → render as section with indented sub-fields
    if ((field.type === 'dict' || field.type === 'object') && field.subFields) {
      return (
        <div key={field.name} className="space-y-3">
          <div className="font-medium text-sm text-gray-700 border-b pb-1">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </div>
          <div className="pl-4 space-y-3 border-l-2 border-gray-200">
            {field.subFields.filter(sf => !sf.hidden).map((subField) => (
              <div key={subField.name} className="space-y-2">
                <Label htmlFor={subField.name} className={subField.readOnly ? "text-gray-500" : ""}>
                  {subField.label} {subField.required && <span className="text-red-500">*</span>}
                  {subField.readOnly && <span className="text-xs text-gray-400 ml-1">(chỉ đọc)</span>}
                </Label>
                {renderField(stepIdx, subField)}
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Normal field
    return (
      <div key={field.name} className="space-y-2">
        <Label htmlFor={field.name} className={field.readOnly ? "text-gray-500" : ""}>
          {field.label} {field.required && <span className="text-red-500">*</span>}
          {field.readOnly && <span className="text-xs text-gray-400 ml-1">(chỉ đọc)</span>}
        </Label>
        {renderField(stepIdx, field)}
      </div>
    )
  }

  // ------- Submit -------

  const handleSubmit = async () => {
    if (!flowName.trim()) {
      setError("Vui lòng nhập tên workflow")
      return
    }

    // Validate required fields for each step
    for (let i = 0; i < steps.length; i++) {
      const fields = stepFields[i] || []
      for (const field of fields) {
        if (field.required) {
          const val = stepPayloads[i]?.[field.name]
          if (val === undefined || val === null || (typeof val === "string" && !val.trim())) {
            setError(`Step ${i + 1} - Vui lòng nhập ${field.label}`)
            setCurrentStep(i)
            return
          }
        }
      }
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        name: flowName.trim(),
        description: flowDescription.trim() || undefined,
        carId,
        steps: steps.map((step, idx) => {
          const actualValues = stepPayloads[idx] || {}

          // Build generic input_mapping template from field names
          // e.g. { "duration": "{{duration}}", "carId": "{{carId}}" }
          const genericMapping: Record<string, string> = {}
          const fields = stepFields[idx] || []
          if (fields.length > 0) {
            for (const field of fields) {
              if (field.hidden) continue
              if ((field.type === 'dict' || field.type === 'object') && field.subFields) {
                // For dict fields, map sub-fields: { "dictName": { "subKey": "{{subKey}}" } }
                const subMapping: Record<string, string> = {}
                for (const sf of field.subFields) {
                  const subKey = sf.name.split('.').pop() || sf.name
                  subMapping[subKey] = `{{${subKey}}}`
                }
                genericMapping[field.name] = JSON.stringify(subMapping)
              } else {
                genericMapping[field.name] = `{{${field.name}}}`
              }
            }
          } else {
            // Fallback: derive from actual payload keys
            for (const key of Object.keys(actualValues)) {
              genericMapping[key] = `{{${key}}}`
            }
          }

          // Build step description from AI metadata
          const nextStep = steps[idx + 1]
          const descriptionParts = [
            step.aiMetadata?.action ? `Action: ${step.aiMetadata.action}` : null,
            step.aiMetadata?.expectedReaction ? `Expected Customer Reaction: ${step.aiMetadata.expectedReaction}` : null,
            step.aiMetadata?.successSignal ? `Success Signal: ${step.aiMetadata.successSignal}` : null,
            step.aiMetadata?.failureSignal ? `Failure Signal: ${step.aiMetadata.failureSignal}` : null,
            step.aiMetadata?.ifSuccess ? `If Success: ${step.aiMetadata.ifSuccess}` : null,
            step.aiMetadata?.ifFailure ? `If Failure: ${step.aiMetadata.ifFailure}` : null,
            nextStep?.aiMetadata?.action ? `Ở bước kế tiếp, mục tiêu sẽ là ${nextStep.aiMetadata.action}` : null,
          ].filter(Boolean)

          return {
            stepName: step.stepName,
            stepOrder: idx + 1,
            connectorId: step.connectorId,
            inputMapping: genericMapping,
            requestPayload: actualValues,
            scheduledAt: stepSchedules[idx] || undefined,
            description: descriptionParts.join('\n'),
          }
        }),
      }

      const res = await createAiWorkflowAction(payload)

      if (!res.success) {
        throw new Error(res.error || "Failed to create workflow")
      }

      setSuccess(true)
      setTimeout(() => {
        onOpenChange(false)
        onSuccess?.()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra")
    } finally {
      setSubmitting(false)
    }
  }

  // ------- Rendering -------

  const totalSteps = steps.length
  const isLastStep = currentStep === totalSteps - 1
  const step = steps[currentStep]
  const fields = stepFields[currentStep] || []
  const currentPayload = stepPayloads[currentStep] || {}

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-lg font-semibold text-green-700">Flow đã được tạo thành công!</p>
            <p className="text-sm text-gray-500">Workflow &quot;{flowName}&quot; với {totalSteps} bước đã được lưu.</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] md:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Use Flow — Bước {currentStep + 1}/{totalSteps}
          </DialogTitle>
          <DialogDescription>
            Tạo workflow từ phân tích AI
          </DialogDescription>
        </DialogHeader>

        {/* Step Progress Indicator */}
        <div className="flex items-center gap-1">
          {steps.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`flex-1 h-1.5 rounded-full transition-all cursor-pointer ${idx < currentStep ? 'bg-indigo-500' :
                idx === currentStep ? 'bg-indigo-400 animate-pulse' :
                  'bg-gray-200'
                }`}
              title={s.connectorLabel}
            />
          ))}
        </div>

        <div className="overflow-y-auto flex-1 space-y-4 py-2 px-1">
          {/* Workflow Name/Description (only on first step) */}
          {currentStep === 0 && (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-600">Tên Workflow</Label>
                <Input
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="Tên workflow..."
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-600">Mô tả (tùy chọn)</Label>
                <Input
                  value={flowDescription}
                  onChange={(e) => setFlowDescription(e.target.value)}
                  placeholder="Mô tả ngắn..."
                  className="text-sm"
                />
              </div>
            </div>
          )}

          {/* Current Step Header */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-indigo-200 text-indigo-600 text-[10px]">
              Step {currentStep + 1}
            </Badge>
            <span className="text-sm font-semibold text-gray-800">{step?.connectorLabel}</span>
          </div>

          {/* Form Fields */}
          {loadingSchemas ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm">Đang tải cấu hình connector...</span>
            </div>
          ) : (
            <>
              {fields.length > 0 ? (
                fields
                  .filter(f => !f.hidden)
                  .map(field => renderFieldRow(currentStep, field))
              ) : (
                /* Fallback: render default values as editable fields */
                Object.entries(currentPayload).map(([key, val]) => (
                  <div key={key} className="space-y-2">
                    <Label className="capitalize">{key.replace(/_/g, ' ')}</Label>
                    {Array.isArray(val) ? (
                      <div className="space-y-2">
                        {(val as string[]).map((item, idx) => (
                          <div key={idx} className="flex gap-2">
                            <Textarea
                              value={item}
                              onChange={(e) => handleArrayItemChange(currentStep, key, idx, e.target.value)}
                              className="min-h-[60px] text-xs"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveArrayItem(currentStep, key, idx)}
                              className="h-8 w-8 text-red-500 shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddArrayItem(currentStep, key)}
                          className="w-full text-[10px] h-7 border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Thêm item
                        </Button>
                      </div>
                    ) : typeof val === 'string' && val.length > 100 ? (
                      <Textarea
                        value={val}
                        onChange={(e) => handleFieldChange(currentStep, key, e.target.value)}
                        className="min-h-[100px]"
                      />
                    ) : (
                      <Input
                        value={String(val ?? "")}
                        onChange={(e) => handleFieldChange(currentStep, key, e.target.value)}
                        className="text-sm"
                      />
                    )}
                  </div>
                ))
              )}

              {/* Schedule Field */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Lịch thực hiện (tùy chọn)
                </Label>
                <Input
                  type="datetime-local"
                  value={stepSchedules[currentStep] || ""}
                  onChange={(e) => handleScheduleChange(currentStep, e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Payload Preview (same as ExecuteConnectorDialog) */}
              <div className="rounded-lg bg-gray-50 border border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowPayloads(prev => ({ ...prev, [currentStep]: !prev[currentStep] }))}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <span>Payload sẽ gửi ({Object.keys(currentPayload).length} fields)</span>
                  {showPayloads[currentStep] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {showPayloads[currentStep] && (
                  <pre className="px-3 pb-3 text-[11px] text-gray-700 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(currentPayload, null, 2)}
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

        <DialogFooter className="flex-shrink-0 flex items-center justify-between gap-2 pt-2">
          <div className="flex-1">
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(prev => prev - 1)}
              >
                <ChevronLeft className="h-3 w-3 mr-1" /> Quay lại
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Hủy
            </Button>
            {isLastStep ? (
              <Button
                onClick={handleSubmit}
                disabled={submitting || !flowName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang tạo...</>
                ) : (
                  <><Zap className="h-4 w-4 mr-2" /> Tạo Flow</>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Tiếp theo <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
