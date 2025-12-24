"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Loader2, Check, X, Zap, Clock, AlertCircle } from "lucide-react"
import { Lead, WorkflowInstanceWithDetails } from "../types"

interface BetaTrackingViewProps {
  workflowInstancesData?: {
    success: boolean
    data: WorkflowInstanceWithDetails[]
    allWorkflows: { id: string; name: string; description?: string }[]
    allTransitions: { from_workflow_id: string; to_workflow_id: string; to_workflow_name: string }[]
    canActivateWF2: boolean
  }
  selectedLead: Lead
  onActivateWorkflow: (workflowId: string, workflowName: string) => void
}

export function BetaTrackingView({ workflowInstancesData, selectedLead, onActivateWorkflow }: BetaTrackingViewProps) {
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null)

  // Loading state
  if (!workflowInstancesData?.allWorkflows) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <Loader2 className="h-8 w-8 animate-spin mb-2 opacity-20" />
        <p className="text-sm">Đang tải cấu hình workflow...</p>
      </div>
    )
  }

  const { allWorkflows, allTransitions, data: instances } = workflowInstancesData

  // No workflows configured
  if (allWorkflows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <AlertCircle className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-sm">Chưa có workflow nào được cấu hình</p>
      </div>
    )
  }

  // Set default active workflow to the first one
  const currentActiveWorkflowId = activeWorkflowId || allWorkflows[0]?.id

  // Get instance for active workflow
  const activeInstance = instances?.find(i => i.instance.workflow_id === currentActiveWorkflowId)

  // Get available transitions FROM this workflow (if it's completed)
  const availableTransitions =
    activeInstance?.instance.status === "completed"
      ? allTransitions.filter(t => t.from_workflow_id === currentActiveWorkflowId)
      : []

  // Filter out transitions where target workflow already has running/completed instance
  const visibleTransitions = availableTransitions.filter(transition => {
    const targetInstance = instances?.find(i => i.instance.workflow_id === transition.to_workflow_id)
    // Hide if target already has running or completed instance
    return !targetInstance || (targetInstance.instance.status !== "running" && targetInstance.instance.status !== "completed")
  })

  return (
    <div className="space-y-6">
      {/* Workflow Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 min-w-max">
          {allWorkflows.map(workflow => {
            const workflowInstance = instances?.find(i => i.instance.workflow_id === workflow.id)
            const isActive = currentActiveWorkflowId === workflow.id
            const hasInstance = !!workflowInstance

            return (
              <button
                key={workflow.id}
                onClick={() => setActiveWorkflowId(workflow.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                  isActive
                    ? "text-blue-600 border-blue-600 bg-blue-50/30"
                    : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {/* Status indicator */}
                {hasInstance ? (
                  workflowInstance.instance.status === "completed" ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : workflowInstance.instance.status === "running" ? (
                    <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                  )
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                )}
                <span>{workflow.name}</span>
                {workflow.description && (
                  <span className="text-xs text-gray-400 hidden sm:inline">({workflow.description})</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Workflow Content */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Header with activation buttons */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-semibold text-gray-900">
              {allWorkflows.find(w => w.id === currentActiveWorkflowId)?.name}
            </h4>
            {activeInstance && (
              <Badge
                variant={activeInstance.instance.status === "completed" ? "default" : "secondary"}
                className={
                  activeInstance.instance.status === "completed"
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                    : activeInstance.instance.status === "running"
                    ? "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200"
                    : "bg-gray-100 text-gray-600"
                }
              >
                {activeInstance.instance.status.toUpperCase()}
              </Badge>
            )}
          </div>

          {/* Activation Buttons */}
          {visibleTransitions.length > 0 && (
            <div className="flex items-center gap-2">
              {visibleTransitions.map(transition => (
                <Button
                  key={transition.to_workflow_id}
                  size="sm"
                  onClick={() => {
                    console.log("[Beta Tracking] Activating workflow:", {
                      fromWorkflowId: currentActiveWorkflowId,
                      toWorkflowId: transition.to_workflow_id,
                      toWorkflowName: transition.to_workflow_name,
                      carId: selectedLead.car_id,
                      parentInstanceId: activeInstance?.instance.id
                    })
                    onActivateWorkflow(transition.to_workflow_id, transition.to_workflow_name)
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  Kích hoạt {transition.to_workflow_name}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Workflow Instance Details */}
        {activeInstance ? (
          <div className="p-4">
            {/* Instance metadata */}
            <div className="flex items-center gap-6 mb-6 text-xs text-gray-600">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                <span>Bắt đầu: {new Date(activeInstance.instance.started_at).toLocaleString("vi-VN")}</span>
              </div>
              {activeInstance.instance.completed_at && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Hoàn thành: {new Date(activeInstance.instance.completed_at).toLocaleString("vi-VN")}</span>
                </div>
              )}
              {activeInstance.instance.sla_deadline && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                  <span>SLA: {new Date(activeInstance.instance.sla_deadline).toLocaleString("vi-VN")}</span>
                </div>
              )}
            </div>

            {/* Steps Timeline */}
            {activeInstance.steps && activeInstance.steps.length > 0 ? (
              <div className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                {activeInstance.steps.map((step: any, idx: number) => {
                  const execution = step.execution
                  const isExecuted = execution && execution.status === "success"
                  const isFailed = execution && execution.status === "failed"
                  const isPending = !execution || execution.status === "pending"

                  return (
                    <div key={step.id} className="relative pl-8 flex items-start gap-3 group">
                      {/* Step indicator */}
                      <div
                        className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center z-10 transition-colors ${
                          isExecuted
                            ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                            : isFailed
                            ? "border-red-500 bg-red-50 text-red-600"
                            : "border-gray-300 text-gray-400"
                        }`}
                      >
                        {isExecuted ? (
                          <Check className="h-3 w-3" />
                        ) : isFailed ? (
                          <X className="h-3 w-3" />
                        ) : (
                          <span className="text-[10px] font-bold">{idx + 1}</span>
                        )}
                      </div>

                      {/* Step content */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium ${isExecuted ? "text-gray-900" : "text-gray-500"}`}>
                              {step.step_name}
                            </p>
                            {step.is_automated && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1 bg-blue-50 text-blue-600 border-blue-200">
                                <Zap className="h-2.5 w-2.5 mr-0.5" />
                                Auto
                              </Badge>
                            )}
                          </div>
                          {execution && (
                            <span className="text-[10px] text-gray-400 font-mono">
                              {new Date(execution.executed_at).toLocaleTimeString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </div>
                        {isFailed && execution?.error_message && (
                          <p className="text-[10px] text-red-500 mt-0.5 italic">{execution.error_message}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">Workflow này chưa có bước nào được cấu hình</p>
            )}
          </div>
        ) : (
          // No instance for this workflow
          <div className="p-8 text-center">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="h-12 w-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Workflow chưa được chạy</p>
                <p className="text-xs mt-1">
                  Xe này chưa có instance nào cho workflow{" "}
                  {allWorkflows.find(w => w.id === currentActiveWorkflowId)?.name}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
