"use client"

import { useState } from "react"
import { ClipboardCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { CarInspectionReportDialog } from "../common/CarInspectionReportViewer"

interface ViewCarReportActionProps {
  carId: string | null | undefined
  customerName?: string
  className?: string
  /** Render as an icon-only button (used in card footers / table rows) */
  iconOnly?: boolean
}

export function ViewCarReportAction({ carId, customerName, className, iconOnly = false }: ViewCarReportActionProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()

  const handleOpen = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (!carId) {
      toast({ title: "Lỗi", description: "Không có Car ID", variant: "destructive" })
      return
    }
    setOpen(true)
  }

  if (iconOnly) {
    return (
      <>
        <button
          onClick={handleOpen}
          className={`flex items-center justify-center text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-600 hover:text-white p-1.5 rounded-lg transition-all duration-150 shrink-0 ${className || ''}`}
          title="Xem báo cáo kiểm định"
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
        </button>
        <CarInspectionReportDialog open={open} onOpenChange={setOpen} carId={carId} customerName={customerName} />
      </>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        disabled={!carId}
        className={`bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 hover:border-orange-300 text-xs sm:text-sm ${className || ''}`}
      >
        <ClipboardCheck className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1.5 sm:mr-2" />
        <span className="hidden sm:inline">Báo cáo KĐ</span>
        <span className="sm:hidden">KĐ</span>
      </Button>
      <CarInspectionReportDialog open={open} onOpenChange={setOpen} carId={carId} customerName={customerName} />
    </>
  )
}
