"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, ExternalLink, Copy, ChevronLeft, ChevronRight } from "lucide-react"
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
  editedQualified: string
  setEditedQualified: (value: string) => void
  editedIntentionLead: string
  setEditedIntentionLead: (value: string) => void
  editedNegotiationAbility: string
  setEditedNegotiationAbility: (value: string) => void

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
  editedQualified,
  setEditedQualified,
  editedIntentionLead,
  setEditedIntentionLead,
  editedNegotiationAbility,
  setEditedNegotiationAbility,
  processedImages,
  onImageClick,
  onSave,
  saving,
  getStageStyle,
}: EditLeadDialogProps) {
  const { toast } = useToast()
  const [imagePage, setImagePage] = useState(0)
  const IMAGES_PER_PAGE = 4

  if (!lead) return null

  const imageCount = processedImages.length
  const totalImagePages = Math.ceil(imageCount / IMAGES_PER_PAGE)
  const currentPageImages = processedImages.slice(
    imagePage * IMAGES_PER_PAGE,
    (imagePage + 1) * IMAGES_PER_PAGE
  )

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
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
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
          <div className="space-y-6">
            {/* Section 1: Lead Information */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <h3 className="text-sm font-bold text-blue-800 uppercase">Thông tin khách hàng (Lead)</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tên khách hàng</p>
                  <p className="text-sm font-semibold text-gray-900">{lead.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Số điện thoại</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {lead.phone ? maskPhone(lead.phone) : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">PIC</p>
                  <p className="text-sm font-semibold text-gray-900">{lead.pic_name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Ngày tạo Lead</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {lead.created_at ? new Date(lead.created_at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Car Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
                <h3 className="text-sm font-bold text-gray-700 uppercase">Thông tin xe (Car)</h3>
              </div>

              {/* Car Title with all details in one line */}
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {[lead.brand, lead.model, lead.variant].filter(Boolean).join(" ") || "N/A"}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {lead.year && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      {lead.year}
                    </span>
                  )}
                  {lead.location && (
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                      📍 {lead.location}
                    </span>
                  )}
                  {lead.mileage && (
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                      🛣️ {lead.mileage.toLocaleString()} km
                    </span>
                  )}
                  {lead.plate && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                      🚗 {lead.plate}
                    </span>
                  )}
                  {lead.sku && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                      SKU: {lead.sku}
                    </span>
                  )}
                  {lead.car_id && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-mono rounded truncate max-w-[120px]" title={lead.car_id}>
                      ID: {lead.car_id.slice(0, 8)}...
                    </span>
                  )}
                </div>
              </div>

              {/* Car Images - First in view, with pagination */}
              {lead.additional_images && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <h4 className="text-sm font-semibold text-gray-700">Hình ảnh thực tế ({imageCount})</h4>
                    </div>
                    {/* Pagination Controls */}
                    {totalImagePages > 1 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setImagePage(p => Math.max(0, p - 1))}
                          disabled={imagePage === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-gray-500">
                          {imagePage + 1} / {totalImagePages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setImagePage(p => Math.min(totalImagePages - 1, p + 1))}
                          disabled={imagePage === totalImagePages - 1}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {currentPageImages.length > 0 ? (
                      currentPageImages.map((imgUrl, idx) => {
                        const actualIndex = imagePage * IMAGES_PER_PAGE + idx
                        return (
                          <div
                            key={actualIndex}
                            className="aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                            onClick={() => {
                              if (onImageClick) {
                                onImageClick(processedImages, actualIndex)
                              }
                            }}
                          >
                            <img
                              src={imgUrl}
                              alt={`Car ${actualIndex}`}
                              className="w-full h-full object-cover hover:scale-105 transition-transform"
                              onError={(e) => {
                                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af"%3ENo Image%3C/text%3E%3C/svg%3E';
                              }}
                            />
                          </div>
                        )
                      })
                    ) : (
                      <div className="col-span-4 text-center py-8 text-gray-400 bg-gray-50 rounded-lg">
                        <svg className="h-8 w-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">Chưa có ảnh</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Sale Status Information */}
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
              <div className="flex items-center gap-2 mb-4">
                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="text-sm font-bold text-emerald-800 uppercase">Trạng thái bán hàng (Sale Status)</h3>
              </div>

              {/* All Sale Status Fields in 4-column grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Stage */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Giai đoạn</p>
                  {editMode ? (
                    <Select value={editedStage} onValueChange={setEditedStage}>
                      <SelectTrigger className="w-full h-8 text-sm">
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
                    <Badge className={`text-xs font-semibold px-2 py-0.5 ${getStageStyle(lead.stage)} border-0`}>
                      {lead.stage || "N/A"}
                    </Badge>
                  )}
                </div>

                {/* Price Customer */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Giá mong muốn</p>
                  {editMode ? (
                    <Input
                      type="text"
                      value={editedPriceCustomer}
                      onChange={(e) => setEditedPriceCustomer(e.target.value)}
                      onBlur={(e) => handlePriceFormat(e.target.value, setEditedPriceCustomer)}
                      className="h-8 text-sm font-semibold text-emerald-600"
                      placeholder="Nhập giá"
                    />
                  ) : (
                    <p className="text-sm font-bold text-emerald-600">
                      {lead.price_customer ? formatPrice(lead.price_customer) : "N/A"}
                    </p>
                  )}
                </div>

                {/* Price Highest Bid */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Giá cao nhất (Dealer)</p>
                  {editMode ? (
                    <Input
                      type="text"
                      value={editedPriceHighestBid}
                      onChange={(e) => setEditedPriceHighestBid(e.target.value)}
                      onBlur={(e) => handlePriceFormat(e.target.value, setEditedPriceHighestBid)}
                      className="h-8 text-sm font-semibold text-blue-600"
                      placeholder="Nhập giá"
                    />
                  ) : (
                    <p className="text-sm font-bold text-blue-600">
                      {lead.price_highest_bid ? formatPrice(lead.price_highest_bid) :
                        (lead.dealer_bidding?.maxPrice ? formatPrice(lead.dealer_bidding.maxPrice) : "N/A")}
                    </p>
                  )}
                </div>

                {/* Qualified */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Qualified</p>
                  {editMode ? (
                    <Select value={editedQualified} onValueChange={setEditedQualified}>
                      <SelectTrigger className="w-full h-8 text-sm">
                        <SelectValue placeholder="Chọn Qualified..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STRONG_QUALIFIED">Strong</SelectItem>
                        <SelectItem value="WEAK_QUALIFIED">Weak</SelectItem>
                        <SelectItem value="NON_QUALIFIED">Non</SelectItem>
                        <SelectItem value="UNDEFINED_QUALIFIED">Undefined</SelectItem>
                        <SelectItem value="TEST">Test</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge
                      className={`text-xs font-semibold px-2 py-1 border-0 ${lead.qualified === 'STRONG_QUALIFIED'
                        ? 'bg-green-100 text-green-800'
                        : lead.qualified === 'WEAK_QUALIFIED'
                          ? 'bg-red-100 text-red-800'
                          : lead.qualified === 'NON_QUALIFIED'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                    >
                      {lead.qualified || "N/A"}
                    </Badge>
                  )}
                </div>

                {/* Intention Lead (Nhu cầu bán) */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Nhu cầu bán</p>
                  {editMode ? (
                    <Select value={editedIntentionLead} onValueChange={setEditedIntentionLead}>
                      <SelectTrigger className="w-full h-8 text-sm">
                        <SelectValue placeholder="Chọn nhu cầu..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FAST">Nhanh</SelectItem>
                        <SelectItem value="SLOW">Chậm</SelectItem>
                        <SelectItem value="DELAY">Hoãn</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge
                      className={`text-xs font-semibold px-2 py-1 border-0 ${lead.intentionLead === 'FAST'
                        ? 'bg-green-100 text-green-800'
                        : lead.intentionLead === 'SLOW'
                          ? 'bg-yellow-100 text-yellow-800'
                          : lead.intentionLead === 'DELAY'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                    >
                      {lead.intentionLead || "N/A"}
                    </Badge>
                  )}
                </div>

                {/* Negotiation Ability (Khả năng đàm phán giá) */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Khả năng đàm phán</p>
                  {editMode ? (
                    <Select value={editedNegotiationAbility} onValueChange={setEditedNegotiationAbility}>
                      <SelectTrigger className="w-full h-8 text-sm">
                        <SelectValue placeholder="Chọn khả năng..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MAYBE">Có thể</SelectItem>
                        <SelectItem value="HARD">Cao</SelectItem>
                        <SelectItem value="EASY">Thấp/Cứng giá</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge
                      className={`text-xs font-semibold px-2 py-1 border-0 ${lead.negotiationAbility === 'HARD'
                        ? 'bg-green-100 text-green-800'
                        : lead.negotiationAbility === 'MAYBE'
                          ? 'bg-yellow-100 text-yellow-800'
                          : lead.negotiationAbility === 'EASY'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                    >
                      {lead.negotiationAbility || "N/A"}
                    </Badge>
                  )}
                </div>
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
