"use client"

import { useState } from "react"
import { Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { ZaloChatV2Dialog } from "../common/ZaloChatV2Viewer"

interface ViewZaloChatV2ActionProps {
  phone: string | null | undefined
  customerName?: string
  className?: string
  /** Render as an icon-only button (used in card footers) */
  iconOnly?: boolean
}

export function ViewZaloChatV2Action({ phone, customerName, className, iconOnly = false }: ViewZaloChatV2ActionProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()

  const handleOpen = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (!phone) {
      toast({ title: "Lỗi", description: "Không có số điện thoại", variant: "destructive" })
      return
    }
    setOpen(true)
  }

  if (iconOnly) {
    return (
      <>
        <button
          onClick={handleOpen}
          className={`flex items-center justify-center text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-600 hover:text-white p-1.5 rounded-lg transition-all duration-150 shrink-0 ${className || ''}`}
          title="Xem chat Zalo V2 (Vucar DB)"
        >
          <Database className="w-3.5 h-3.5" />
        </button>
        <ZaloChatV2Dialog open={open} onOpenChange={setOpen} phone={phone} customerName={customerName} />
      </>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        disabled={!phone}
        className={`bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 text-xs sm:text-sm ${className || ''}`}
      >
        <Database className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1.5 sm:mr-2" />
        <span className="hidden sm:inline">Zalo V2</span>
        <span className="sm:hidden">V2</span>
      </Button>
      <ZaloChatV2Dialog open={open} onOpenChange={setOpen} phone={phone} customerName={customerName} />
    </>
  )
}
