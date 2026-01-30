"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"
import { Lead } from "../types"
import { formatCarInfo } from "../utils"
import { useToast } from "@/hooks/use-toast"

interface ImageUploadServiceProps {
  lead: Lead | null
  senderName: string
  renderTrigger: (uploading: boolean, handleTrigger: (e: React.MouseEvent | React.TouchEvent) => void) => React.ReactNode
}

export function ImageUploadService({
  lead,
  senderName,
  renderTrigger
}: ImageUploadServiceProps) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [showChoiceDialog, setShowChoiceDialog] = useState(false)
  const [sendingChoice, setSendingChoice] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleTrigger = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    if (!lead) return
    fileInputRef.current?.click()
  }

  const handleChoiceSelect = async (choice: 'dealer' | 'Ok') => {
    setSendingChoice(true)
    try {
      const response = await fetch("/api/e2e/webhook-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: choice,
          senderName: senderName
        }),
      })

      if (response.ok) {
        toast({
          title: "Thành công",
          description: `Đã gửi lựa chọn "${choice}" thành công`,
        })
        setShowChoiceDialog(false)
      } else {
        throw new Error("Gửi lựa chọn thất bại")
      }
    } catch (error) {
      console.error("[Choice Error]:", error)
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra khi gửi lựa chọn",
        variant: "destructive",
      })
    } finally {
      setSendingChoice(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !lead) return

    const MAX_SINGLE_SIZE = 4 * 1024 * 1024 // 4MB per request to be safe with Vercel
    const leadPhone = lead.phone || lead.additional_phone || ""
    const carInfo = formatCarInfo(lead)

    setUploading(true)
    let successCount = 0

    try {
      // 1. Upload images one by one
      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        if (file.size > MAX_SINGLE_SIZE) {
          toast({
            title: "Cảnh báo",
            description: `Ảnh thứ ${i + 1} (${(file.size / 1024 / 1024).toFixed(2)}MB) vượt quá giới hạn 4MB. Một số ảnh có thể không tải lên được.`,
            variant: "destructive",
          })
        }

        const formData = new FormData()
        formData.append("file", file)
        formData.append("phone", leadPhone)
        formData.append("displayName", carInfo)
        formData.append("senderName", senderName)
        formData.append("index", (i + 1).toString())

        const response = await fetch("/api/e2e/upload-image", {
          method: "POST",
          body: formData,
        })

        let result: any
        const contentType = response.headers.get("content-type")

        if (contentType && contentType.includes("application/json")) {
          result = await response.json()
        } else {
          const text = await response.text()
          if (response.status === 413) {
            throw new Error(`Ảnh thứ ${i + 1} quá lớn. Vui lòng giảm kích thước ảnh.`)
          }
          throw new Error(text || `Lỗi hệ thống (${response.status}) khi tải ảnh ${i + 1}.`)
        }

        if (response.ok) {
          successCount++
        } else {
          throw new Error(result?.error || `Tải ảnh ${i + 1} thất bại`)
        }
      }

      // 2. All images uploaded, now send the customer phone
      if (successCount > 0) {
        const phoneResponse = await fetch("/api/e2e/webhook-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: leadPhone,
            senderName: senderName
          }),
        })

        if (!phoneResponse.ok) {
          console.error("Failed to send phone webhook after uploads")
        }

        toast({
          title: "Thành công",
          description: `Đã tải lên ${successCount} ảnh thành công`,
        })

        // Show choice dialog
        setShowChoiceDialog(true)
      }
    } catch (error) {
      console.error("[Upload Error]:", error)
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra khi tải ảnh",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <>
      {renderTrigger(uploading, handleTrigger)}

      <AlertDialog open={showChoiceDialog} onOpenChange={setShowChoiceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chọn hành động tiếp theo</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn muốn gửi thông báo nào tiếp theo cho lead này?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleChoiceSelect('dealer')}
              disabled={sendingChoice}
            >
              {sendingChoice ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'dealer'
              )}
            </Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={() => handleChoiceSelect('Ok')}
              disabled={sendingChoice}
            >
              {sendingChoice ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Ok'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/*"
        className="hidden"
      />
    </>
  )
}
