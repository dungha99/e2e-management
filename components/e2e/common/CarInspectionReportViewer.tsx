"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Loader2,
  X,
  ClipboardCheck,
  Eye,
  MapPin,
  User,
  Clock,
  Trophy,
  XCircle,
  AlertCircle,
  Sparkles,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

// ── Types ──────────────────────────────────────────────────────────────────────

interface CarViewingReport {
  id: string
  booking_id: string
  staff_name: string
  outcome: "win" | "fail" | "pending"
  reason: string
  timestamp: string
}

interface InspectionReport {
  id: string
  note: string
  ai_note: string
  inspected_by: string
  inspected_time: string
  location: string
}

interface CarReportsData {
  success: boolean
  car_id: string
  car_viewing_reports: CarViewingReport[]
  inspection_reports: InspectionReport[]
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useCarInspectionReports(carId: string | null | undefined) {
  const [data, setData] = useState<CarReportsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchReports = useCallback(async () => {
    if (!carId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/e2e/car-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: carId }),
      })
      if (res.ok) {
        const json = await res.json()
        setData(json)
      } else {
        const errBody = await res.text()
        setError(`Lỗi ${res.status}`)
        setData(null)
        console.error("[CarReports] Error:", errBody)
      }
    } catch (err) {
      setError("Không thể kết nối server")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [carId])

  return { data, loading, error, fetchReports }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

const OUTCOME_CONFIG: Record<
  string,
  { label: string; icon: typeof Trophy; className: string; bgClass: string }
> = {
  win: {
    label: "Win",
    icon: Trophy,
    className: "text-emerald-700",
    bgClass: "bg-emerald-50 border-emerald-200",
  },
  fail: {
    label: "Fail",
    icon: XCircle,
    className: "text-red-600",
    bgClass: "bg-red-50 border-red-200",
  },
  pending: {
    label: "Pending",
    icon: AlertCircle,
    className: "text-amber-600",
    bgClass: "bg-amber-50 border-amber-200",
  },
}

// ── Expandable AI Note ─────────────────────────────────────────────────────────

function ExpandableNote({ label, text, icon: Icon, accentColor }: {
  label: string
  text: string
  icon: typeof FileText
  accentColor: string
}) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > 200

  return (
    <div className="mt-2">
      <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${accentColor} mb-1`}>
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div
        className={`text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap bg-white/60 rounded-lg p-2.5 border border-gray-100 ${
          !expanded && isLong ? "line-clamp-4" : ""
        }`}
      >
        {text}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" /> Thu gọn
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" /> Xem thêm
            </>
          )}
        </button>
      )}
    </div>
  )
}

// ── Car Viewing Report Card ────────────────────────────────────────────────────

function ViewingReportCard({ report, index }: { report: CarViewingReport; index: number }) {
  const outcome = OUTCOME_CONFIG[report.outcome] || OUTCOME_CONFIG.pending
  const OutcomeIcon = outcome.icon

  return (
    <div className={`rounded-xl border p-4 transition-all hover:shadow-md ${outcome.bgClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${outcome.bgClass} border`}>
            <Eye className={`w-3.5 h-3.5 ${outcome.className}`} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Xem xe #{index + 1}
            </span>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${outcome.bgClass} ${outcome.className}`}>
          <OutcomeIcon className="w-3 h-3" />
          {outcome.label}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[12px]">
          <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="font-semibold text-gray-700">{report.staff_name}</span>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-gray-500">{formatDateTime(report.timestamp)}</span>
        </div>
        {report.reason && (
          <div className="mt-2 text-[12px] text-gray-600 leading-relaxed bg-white/60 rounded-lg p-2.5 border border-gray-100 whitespace-pre-wrap">
            {report.reason}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inspection Report Card ─────────────────────────────────────────────────────

function InspectionReportCard({ report, index }: { report: InspectionReport; index: number }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center">
            <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Kiểm định #{index + 1}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[12px]">
          <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="font-semibold text-gray-700">{report.inspected_by}</span>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-gray-500">{formatDateTime(report.inspected_time)}</span>
        </div>
        <div className="flex items-start gap-2 text-[12px]">
          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
          <span className="text-gray-600">{report.location}</span>
        </div>

        {/* Notes */}
        {report.note && (
          <ExpandableNote
            label="Ghi chú kiểm định viên"
            text={report.note}
            icon={FileText}
            accentColor="text-blue-500"
          />
        )}
        {report.ai_note && (
          <ExpandableNote
            label="Ghi chú AI"
            text={report.ai_note}
            icon={Sparkles}
            accentColor="text-purple-500"
          />
        )}
      </div>
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
      <ClipboardCheck className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}

// ── Dialog Component ───────────────────────────────────────────────────────────

export interface CarInspectionReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  carId: string | null | undefined
  customerName?: string
  autoFetch?: boolean
}

export function CarInspectionReportDialog({
  open,
  onOpenChange,
  carId,
  customerName,
  autoFetch = true,
}: CarInspectionReportDialogProps) {
  const { data, loading, error, fetchReports } = useCarInspectionReports(carId)

  // Auto-fetch when the dialog opens
  useEffect(() => {
    if (open && autoFetch && carId) {
      fetchReports()
    }
  }, [open, autoFetch, carId, fetchReports])

  const totalViewing = data?.car_viewing_reports?.length ?? 0
  const totalInspection = data?.inspection_reports?.length ?? 0

  // Active tab state
  const [activeTab, setActiveTab] = useState<"viewing" | "inspection">("inspection")

  // Reset tab when dialog opens
  useEffect(() => {
    if (open) setActiveTab("inspection")
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-4 border-b shrink-0 bg-white relative">
          <div className="pr-8">
            <DialogTitle className="text-base font-bold text-gray-900 truncate flex items-center gap-2">
              {customerName || "Báo cáo xe"}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold uppercase tracking-wider">
                <ClipboardCheck className="w-3 h-3" />
                Reports
              </span>
            </DialogTitle>
            <p className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-2">
              <span>Báo cáo xem xe & kiểm định</span>
              {carId && (
                <span className="text-gray-400 font-mono text-[10px]">
                  · {carId.length > 12 ? carId.slice(0, 12) + "…" : carId}
                </span>
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 h-8 w-8 rounded-full hover:bg-gray-100"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4 text-gray-500" />
          </Button>
        </DialogHeader>

        {/* Tab Selector */}
        {!loading && data && (
          <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-2">
            <button
              onClick={() => setActiveTab("inspection")}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all flex items-center gap-1.5 ${
                activeTab === "inspection"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              <ClipboardCheck className="w-3 h-3" />
              Kiểm định
              <span className="opacity-70">({totalInspection})</span>
            </button>
            <button
              onClick={() => setActiveTab("viewing")}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all flex items-center gap-1.5 ${
                activeTab === "viewing"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              <Eye className="w-3 h-3" />
              Xem xe
              <span className="opacity-70">({totalViewing})</span>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-gray-500">
                Đang tải báo cáo...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-500 font-medium">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchReports}>
                Thử lại
              </Button>
            </div>
          ) : !data ? (
            <EmptyState message="Chưa có dữ liệu" />
          ) : (
            <div className="p-4 space-y-3">
              {activeTab === "inspection" && (
                <>
                  {totalInspection === 0 ? (
                    <EmptyState message="Chưa có báo cáo kiểm định" />
                  ) : (
                    data.inspection_reports.map((report, idx) => (
                      <InspectionReportCard
                        key={report.id}
                        report={report}
                        index={idx}
                      />
                    ))
                  )}
                </>
              )}
              {activeTab === "viewing" && (
                <>
                  {totalViewing === 0 ? (
                    <EmptyState message="Chưa có báo cáo xem xe" />
                  ) : (
                    data.car_viewing_reports.map((report, idx) => (
                      <ViewingReportCard
                        key={report.id}
                        report={report}
                        index={idx}
                      />
                    ))
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
