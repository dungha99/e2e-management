"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, ExternalLink, Copy } from "lucide-react"
import { Lead } from "../types"
import { formatPrice, formatCarInfo } from "../utils"
import { maskPhone } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface EditLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: Lead | null

  // Edit State
  editMode: boolean
  setEditMode: (mode: boolean) => void

  // Form State
  editedPriceCustomer: string
  setEditedPriceCustomer: (value: string) => void
  editedPriceHighestBid: string
  setEditedPriceHighestBid: (value: string) => void
  editedStage: string
  setEditedStage: (value: string) => void

  // Gallery/Image Props
  processedImages: string[]
  onImageClick?: (images: string[], index: number) => void

  // Handlers
  onSave: () => void
  saving: boolean

  // Helper
  getStageStyle: (stage: string | undefined | null) => string
}

export function EditLeadDialog({
  open,
  onOpenChange,
  lead,
  editMode,
  setEditMode,
  editedPriceCustomer,
  setEditedPriceCustomer,
  editedPriceHighestBid,
  setEditedPriceHighestBid,
  editedStage,
  setEditedStage,
  processedImages,
  onImageClick,
  onSave,
  saving,
  getStageStyle,
}: EditLeadDialogProps) {
  const { toast } = useToast()

  if (!lead) return null

  const imageCount = processedImages.length

  const handleCopyLeadInfo = () => {
    const timeString = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    })
    const dateString = new Date().toLocaleDateString("vi-VN")
    const carName = [lead.brand, lead.model, lead.year].filter(Boolean).join(" ")
    const mileageText = lead.mileage ? `${lead.mileage.toLocaleString()} km` : "N/A"
    const locationText = lead.location || "N/A"

    const copyText = `Thời gian nhận thông tin: ${timeString} ${dateString}
Thông tin chi tiết xe: ${carName}
Số km đã đi (Odo): ${mileageText}
Khu vực:  - ${locationText}
Car_id: ${lead.car_id || "N/A"}
Giá mong muốn: ${lead.price_customer ? formatPrice(lead.price_customer) : "N/A"}`

    navigator.clipboard.writeText(copyText)
    toast({
      title: "Đã sao chép",
      description: "Thông tin lead đã được sao chép vào clipboard",
    })
  }

  const handleCancelEdit = () => {
    setEditMode(false)
    // Reset values would be handled by parent
  }

  const handleEditToggle = () => {
    setEditMode(true)
  }

  const handlePriceFormat = (value: string, setter: (value: string) => void) => {
    const numericValue = value.replace(/\D/g, "")
    if (numericValue) {
      setter(parseInt(numericValue, 10).toLocaleString("vi-VN"))
    } else {
      setter("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <DialogTitle className="text-base">Thông tin xe chi tiết</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const phone = lead?.phone || lead?.additional_phone || ""
                  const picId = lead?.pic_id || ""
                  if (phone && picId) {
                    const crmUrl = `https://dashboard.vucar.vn/crm-v2?pic=${picId}&search=${phone}`
                    window.open(crmUrl, '_blank')
                  }
                }}
                disabled={!lead?.pic_id || (!lead?.phone && !lead?.additional_phone)}
                className="flex items-center gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
              >
                <ExternalLink className="h-4 w-4" />
                Xem trên CRM
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLeadInfo}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Sao chép
              </Button>
            </div>
          </div>
        </DialogHeader>

        {lead && (
          <div className="space-y-4">
            {/* Car Title and Price */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {[lead.brand, lead.model, lead.variant]
                    .filter(Boolean)
                    .join(" ") || "N/A"}
                </h2>
                <div className="flex items-center gap-2">
                  {lead.year && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded">
                      {lead.year}
                    </span>
                  )}
                  {lead.location && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                      {lead.location}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase mb-1">Giá mong muốn</p>
                {editMode ? (
                  <Input
                    type="text"
                    value={editedPriceCustomer}
                    onChange={(e) => setEditedPriceCustomer(e.target.value)}
                    onBlur={(e) => handlePriceFormat(e.target.value, setEditedPriceCustomer)}
                    className="text-right text-xl font-bold text-emerald-600 h-12"
                    placeholder="Nhập giá"
                  />
                ) : (
                  <p className="text-2xl font-bold text-emerald-600">
                    {lead.price_customer ? formatPrice(lead.price_customer) : "N/A"}
                  </p>
                )}
              </div>
            </div>

            {/* Car Images - Now in 2nd position */}
            {lead.additional_images && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Hình ảnh thực tế ({imageCount})
                  </h3>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {processedImages.length > 0 ? (
                    processedImages.slice(0, 8).map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                        onClick={() => {
                          if (onImageClick) {
                            onImageClick(processedImages, idx)
                          }
                        }}
                      >
                        <img
                          src={imgUrl}
                          alt={`Car ${idx}`}
                          className="w-full h-full object-cover hover:scale-110 transition-transform"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af"%3ENo Image%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="col-span-4 text-center py-8 text-gray-400">
                      <p className="text-sm">Chưa có ảnh</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Car Details Grid */}
            <div className="grid grid-cols-2 gap-4 py-4 border-y">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">ODO</p>
                <p className="text-base font-semibold text-gray-900">
                  {lead.mileage ? `${lead.mileage.toLocaleString()} km` : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Phiên bản</p>
                <p className="text-base font-semibold text-gray-900">
                  {lead.variant || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Màu sắc</p>
                <p className="text-base font-semibold text-gray-900">N/A</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Động cơ</p>
                <p className="text-base font-semibold text-gray-900">N/A</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Hộp số</p>
                <p className="text-base font-semibold text-gray-900">N/A</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Biển số</p>
                <p className="text-base font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded inline-block">
                  {lead.plate || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Giai đoạn</p>
                {editMode ? (
                  <Select value={editedStage} onValueChange={setEditedStage}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn giai đoạn..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CANNOT_CONTACT">Không liên lạc được</SelectItem>
                      <SelectItem value="CONTACTED">Đã liên hệ</SelectItem>
                      <SelectItem value="NEGOTIATION">Đang đàm phán</SelectItem>
                      <SelectItem value="CAR_VIEW">Xem xe</SelectItem>
                      <SelectItem value="DEPOSIT_PAID">Đã đặt cọc</SelectItem>
                      <SelectItem value="COMPLETED">Hoàn thành</SelectItem>
                      <SelectItem value="FAILED">Thất bại</SelectItem>
                      <SelectItem value="UNDEFINED">Chưa xác định</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={`text-base font-semibold px-3 py-1 ${getStageStyle(lead.stage)} border-0`}>
                    {lead.stage || "N/A"}
                  </Badge>
                )}
              </div>
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">SKU</p>
                <p className="text-sm font-medium text-gray-900">{lead.sku || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Ngày tạo xe</p>
                <p className="text-sm font-medium text-gray-900">
                  {lead.car_created_at ? new Date(lead.car_created_at).toLocaleDateString("vi-VN") : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Tên khách hàng</p>
                <p className="text-sm font-medium text-gray-900">{lead.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Số điện thoại</p>
                <p className="text-sm font-medium text-gray-900">
                  {lead.phone ? maskPhone(lead.phone) : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">PIC</p>
                <p className="text-sm font-medium text-gray-900">{lead.pic_name || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Giá cao nhất (Dealer)</p>
                {editMode ? (
                  <Input
                    type="text"
                    value={editedPriceHighestBid}
                    onChange={(e) => setEditedPriceHighestBid(e.target.value)}
                    onBlur={(e) => handlePriceFormat(e.target.value, setEditedPriceHighestBid)}
                    className="text-sm font-semibold text-blue-600"
                    placeholder="Nhập giá"
                  />
                ) : (
                  <p className="text-sm font-semibold text-blue-600">
                    {lead.price_highest_bid ? formatPrice(lead.price_highest_bid) :
                      (lead.dealer_bidding?.maxPrice ? formatPrice(lead.dealer_bidding.maxPrice) : "N/A")}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => {
            onOpenChange(false)
            setEditMode(false)
          }}>
            Đóng
          </Button>
          {editMode ? (
            <>
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                Hủy
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  "Lưu"
                )}
              </Button>
            </>
          ) : (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleEditToggle}
            >
              Chỉnh sửa
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
