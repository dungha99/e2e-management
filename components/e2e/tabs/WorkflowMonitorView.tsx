"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Loader2, RefreshCw, Clock, CheckCircle2, XCircle, SkipForward,
  ChevronDown, ChevronUp, MessageSquare, AlertTriangle, Zap, User, Bot,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Lead } from "@/components/e2e/types"

// ─── Types ────────────────────────────────────────────────────────────────────

interface StepExecution {
  id: string
  status: "pending" | "running" | "success" | "failed" | "skipped"
  scheduledAt: string | null
  executedAt: string | null
  completedAt: string | null
  messages: string[]
  errorMessage: string | null
  retryCount: number
}

interface MonitorStep {
  stepId: string
  stepName: string
  stepOrder: number
  connectorId: string
  description: string | null
  execution: StepExecution | null
}

interface MonitorInstance {
  id: string
  status: "running" | "completed" | "terminated" | "failed"
  workflowName: string
  startedAt: string
  completedAt: string | null
  triggeredBy: "ai" | "user" | null
  steps: MonitorStep[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Timestamps are stored as VN local time in the DB (Gemini output stored raw, or
// via NOW() + INTERVAL '7 hours'). pg reads them as UTC Date objects, so the value
// is already +7h. Displaying as VN time requires another +7h → 14h total.
const VN_OFFSET_MS = 0 * 60 * 60 * 1000

function toVnDate(iso: string): Date {
  return new Date(new Date(iso).getTime() + VN_OFFSET_MS)
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function formatVnTime(iso: string | null): string {
  if (!iso) return "—"
  const d = toVnDate(iso)
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

function formatRelative(iso: string | null): string {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const abs = Math.abs(diff)
  const future = diff < 0
  const mins = Math.floor(abs / 60_000)
  const hours = Math.floor(abs / 3_600_000)
  const days = Math.floor(abs / 86_400_000)
  const label =
    days > 0 ? `${days} ngày` :
      hours > 0 ? `${hours} giờ` :
        mins > 0 ? `${mins} phút` : "vừa xong"
  return future ? `còn ${label}` : `${label} trước`
}

function instanceStatusConfig(status: string) {
  switch (status) {
    case "running": return { label: "ĐANG CHẠY", cls: "bg-blue-100 text-blue-700 border-blue-200" }
    case "completed": return { label: "HOÀN THÀNH", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" }
    case "terminated": return { label: "ĐÃ DỪNG", cls: "bg-gray-100 text-gray-600 border-gray-200" }
    case "failed": return { label: "LỖI", cls: "bg-red-100 text-red-700 border-red-200" }
    default: return { label: status, cls: "bg-gray-100 text-gray-600" }
  }
}

function resolveStepStatus(status: string, retryCount: number): string {
  if (status === "pending" && retryCount > 0) return "retrying"
  return status
}

function stepStatusConfig(status: string) {
  switch (status) {
    case "pending": return { icon: Clock, cls: "border-amber-400 bg-amber-50 text-amber-600", label: "Chờ gửi" }
    case "retrying": return { icon: AlertTriangle, cls: "border-orange-400 bg-orange-50 text-orange-600", label: "Đang thử lại" }
    case "running": return { icon: Loader2, cls: "border-blue-400 bg-blue-50 text-blue-600", label: "Đang chạy" }
    case "success": return { icon: CheckCircle2, cls: "border-emerald-500 bg-emerald-50 text-emerald-600", label: "Thành công" }
    case "failed": return { icon: XCircle, cls: "border-red-500 bg-red-50 text-red-600", label: "Thất bại" }
    case "skipped": return { icon: SkipForward, cls: "border-gray-400 bg-gray-50 text-gray-500", label: "Bỏ qua" }
    default: return { icon: Clock, cls: "border-gray-300 bg-gray-50 text-gray-400", label: status }
  }
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({ step, isLast, effectiveScheduledAt }: { step: MonitorStep; isLast: boolean; effectiveScheduledAt: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const exec = step.execution
  const rawStatus = exec?.status ?? "pending"
  const status = resolveStepStatus(rawStatus, exec?.retryCount ?? 0)
  const { icon: Icon, cls, label } = stepStatusConfig(status)
  const hasMessages = (exec?.messages?.length ?? 0) > 0
  const hasError = !!exec?.errorMessage

  return (
    <div className={`relative pl-8 ${!isLast ? "pb-4" : ""}`}>
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gray-200" />
      )}

      {/* Status dot */}
      <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center ${cls}`}>
        <Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />
      </div>

      <div
        onClick={() => setExpanded(v => !v)}
        className={`rounded-xl border p-3 transition-all cursor-pointer select-none ${status === "failed" ? "border-red-200 bg-red-50/30 hover:bg-red-50/50" :
          status === "retrying" ? "border-orange-200 bg-orange-50/20 hover:bg-orange-50/40" :
            status === "pending" ? "border-amber-200 bg-amber-50/20 hover:bg-amber-50/40" :
              status === "success" ? "border-emerald-200 bg-white hover:bg-emerald-50/20" :
                "border-gray-200 bg-white hover:bg-gray-50"
          }`}
      >
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-gray-400">#{step.stepOrder}</span>
            <span className="text-sm font-medium text-gray-800 truncate">{step.stepName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(status === "pending" || status === "retrying") && effectiveScheduledAt && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${status === "retrying"
                ? "text-orange-700 bg-orange-100 border-orange-200"
                : "text-amber-700 bg-amber-100 border-amber-200"
                }`}>
                <Clock className="h-3 w-3" />
                {formatRelative(effectiveScheduledAt)}
              </span>
            )}
            {(status === "retrying" || status === "failed") && exec && exec.retryCount > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full border ${status === "retrying"
                ? "text-orange-600 bg-orange-100 border-orange-200"
                : "text-red-600 bg-red-100 border-red-200"
                }`}>
                {exec.retryCount}/3 retries
              </span>
            )}
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </div>

        {/* Scheduled time (full) for pending / retrying */}
        {(status === "pending" || status === "retrying") && effectiveScheduledAt && (
          <div className={`mt-1 text-xs flex items-center gap-1 ${status === "retrying" ? "text-orange-600" : "text-amber-600"}`}>
            <span>{status === "retrying" ? "Thử lại lúc:" : "Lên lịch:"}</span>
            <span className="font-mono">{formatVnTime(effectiveScheduledAt)}</span>
          </div>
        )}

        {/* Completed time for success */}
        {status === "success" && exec?.completedAt && (
          <div className="mt-1 text-xs text-gray-400">
            Gửi lúc {formatVnTime(exec.completedAt)}
          </div>
        )}

        {/* Expandable content */}
        {expanded && (
          <div className="mt-3 space-y-2">
            {/* Error */}
            {hasError && (
              <div className="text-xs bg-red-50 border border-red-200 rounded-lg p-2.5 text-red-700 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="break-all">{exec!.errorMessage}</span>
              </div>
            )}

            {/* Messages — always shown when present */}
            {hasMessages && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Nội dung tin nhắn
                </div>
                {exec!.messages.map((msg, i) => (
                  <div key={i} className="text-xs bg-white border border-gray-200 rounded-lg p-2.5 text-gray-700 leading-relaxed">
                    {msg}
                  </div>
                ))}
              </div>
            )}

            {/* Description / tactical command */}
            {step.description && (
              <div className="text-xs text-gray-500 italic border-t pt-2 leading-relaxed">
                {step.description.split("\n").slice(0, 3).join(" · ")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Instance Card ────────────────────────────────────────────────────────────

function InstanceCard({ instance }: { instance: MonitorInstance }) {
  const [collapsed, setCollapsed] = useState(instance.status === "terminated")
  const { label, cls } = instanceStatusConfig(instance.status)

  const pendingCount = instance.steps.filter(s => resolveStepStatus(s.execution?.status ?? "pending", s.execution?.retryCount ?? 0) === "pending").length
  const retryingCount = instance.steps.filter(s => resolveStepStatus(s.execution?.status ?? "pending", s.execution?.retryCount ?? 0) === "retrying").length
  const failedCount = instance.steps.filter(s => s.execution?.status === "failed").length
  const doneCount = instance.steps.filter(s => s.execution?.status === "success").length

  return (
    <div className={`rounded-xl border overflow-hidden shadow-sm ${instance.status === "running" ? "border-blue-200" :
      instance.status === "failed" ? "border-red-200" :
        "border-gray-200"
      }`}>
      {/* Instance header */}
      <button
        className="w-full flex items-start justify-between p-4 bg-white hover:bg-gray-50/60 transition-colors text-left"
        onClick={() => setCollapsed(v => !v)}
      >
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-xs font-medium border ${cls}`}>{label}</Badge>
            {instance.triggeredBy === "ai" && (
              <span className="flex items-center gap-1 text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                <Bot className="h-3 w-3" /> AI
              </span>
            )}
            {instance.triggeredBy === "user" && (
              <span className="flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                <User className="h-3 w-3" /> Thủ công
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-gray-800 truncate">{instance.workflowName}</div>
          <div className="text-xs text-gray-400">{formatVnTime(instance.startedAt)}</div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-3">
          {/* Step stat pills */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            {pendingCount > 0 && (
              <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                <Clock className="h-3 w-3" />{pendingCount}
              </span>
            )}
            {retryingCount > 0 && (
              <span className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200">
                <AlertTriangle className="h-3 w-3" />{retryingCount}
              </span>
            )}
            {failedCount > 0 && (
              <span className="flex items-center gap-1 bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                <XCircle className="h-3 w-3" />{failedCount}
              </span>
            )}
            {doneCount > 0 && (
              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" />{doneCount}
              </span>
            )}
          </div>
          {collapsed ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronUp className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {/* Steps */}
      {!collapsed && (
        <div className={`p-4 border-t space-y-0 ${instance.status === "running" ? "bg-blue-50/20" :
          instance.status === "failed" ? "bg-red-50/10" :
            "bg-gray-50/40"
          }`}>
          {instance.steps.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Không có bước nào</p>
          ) : (
            instance.steps.map((step, idx) => {
              // Compute effective scheduled time for unexecuted steps:
              // - has its own scheduledAt → use it
              // - first step with no scheduledAt → fall back to instance startedAt
              // - later step with no scheduledAt → fall back to previous step's scheduledAt
              const effectiveScheduledAt =
                step.execution?.scheduledAt ??
                (idx === 0
                  ? instance.startedAt
                  : instance.steps[idx - 1].execution?.scheduledAt ?? instance.startedAt)

              return (
                <StepCard
                  key={step.stepId}
                  step={step}
                  isLast={idx === instance.steps.length - 1}
                  effectiveScheduledAt={effectiveScheduledAt}
                />
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

interface WorkflowMonitorViewProps {
  selectedLead: Lead | null
}

export function WorkflowMonitorView({ selectedLead }: WorkflowMonitorViewProps) {
  const [instances, setInstances] = useState<MonitorInstance[]>([])
  const [loading, setLoading] = useState(false)

  const fetchInstances = useCallback(async () => {
    if (!selectedLead?.car_id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/e2e/ai-workflows/monitor/${selectedLead.car_id}`)
      if (res.ok) {
        const data = await res.json()
        setInstances(data.instances || [])
      }
    } catch (err) {
      console.error("Failed to fetch workflow monitor data:", err)
    } finally {
      setLoading(false)
    }
  }, [selectedLead?.car_id])

  useEffect(() => {
    fetchInstances()
  }, [fetchInstances])

  const running = instances.filter(i => i.status === "running")
  const archived = instances.filter(i => i.status !== "running")

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-white">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-500" />
          Workflow Monitor
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7 gap-1.5 rounded-full bg-blue-50 text-blue-600 border-blue-200"
          onClick={fetchInstances}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : instances.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Zap className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Chưa có AI workflow nào cho Lead này.</p>
          </div>
        ) : (
          <>
            {/* Running instances first */}
            {running.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                  Đang chạy ({running.length})
                </div>
                {running.map(inst => <InstanceCard key={inst.id} instance={inst} />)}
              </div>
            )}

            {/* Archived */}
            {archived.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Lịch sử ({archived.length})
                </div>
                {archived.map(inst => <InstanceCard key={inst.id} instance={inst} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
