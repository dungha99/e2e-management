"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Image as ImageIcon } from "lucide-react"
import { Lead } from "../types"
import { formatPrice, formatCarInfo } from "../utils"

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
  if (!lead) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chi tiết Lead</DialogTitle>
          <DialogDescription>
            {formatCarInfo(lead)}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Thông tin</TabsTrigger>
            <TabsTrigger value="images">Hình ảnh ({processedImages.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="py-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Lead Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 border-b pb-2">Thông tin khách hàng</h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <span className="text-gray-500">Tên:</span>
                  <span className="col-span-2 font-medium">{lead.name}</span>

                  <span className="text-gray-500">SĐT:</span>
                  <span className="col-span-2 font-medium">{lead.phone}</span>

                  <span className="text-gray-500">SĐT phụ:</span>
                  <span className="col-span-2 font-medium">{lead.additional_phone || "-"}</span>

                  <span className="text-gray-500">Khu vực:</span>
                  <span className="col-span-2 font-medium">{lead.location || "-"}</span>

                  <span className="text-gray-500">Nguồn:</span>
                  <span className="col-span-2 font-medium">{lead.source}</span>
                </div>
              </div>

              {/* Right Column: Car Info & Status */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-semibold text-gray-900">Trạng thái & Giá</h3>
                  {!editMode ? (
                    <Button variant="ghost" size="sm" onClick={() => setEditMode(true)}>
                      Chỉnh sửa
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditMode(false)} disabled={saving}>
                        Hủy
                      </Button>
                      <Button size="sm" onClick={onSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Lưu
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 items-center text-sm">
                    <span className="text-gray-500">Stage:</span>
                    <div className="col-span-2">
                      {editMode ? (
                        <Select value={editedStage} onValueChange={setEditedStage}>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn stage" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="T1.1">T1.1 - KHL</SelectItem>
                            <SelectItem value="T1.2">T1.2 - KHL</SelectItem>
                            <SelectItem value="T1.3">T1.3 - KHL</SelectItem>
                            <SelectItem value="T0">T0 - Quan tâm</SelectItem>
                            <SelectItem value="T99">T99 - KHL</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={getStageStyle(lead.stage || editedStage)} variant="outline">
                          {lead.stage || "N/A"}
                        </Badge>
                      )}
                    </div>

                    <span className="text-gray-500">Giá khách mong muốn:</span>
                    <div className="col-span-2">
                      {editMode ? (
                        <Input
                          value={editedPriceCustomer}
                          onChange={(e) => setEditedPriceCustomer(e.target.value)}
                          placeholder="Nhập giá..."
                        />
                      ) : (
                        <span className="font-medium text-green-600">
                          {formatPrice(lead.price_customer || parseFloat(editedPriceCustomer) || 0)}
                        </span>
                      )}
                    </div>

                    <span className="text-gray-500">Giá bid cao nhất:</span>
                    <div className="col-span-2">
                      {editMode ? (
                        <Input
                          value={editedPriceHighestBid}
                          onChange={(e) => setEditedPriceHighestBid(e.target.value)}
                          placeholder="Nhập giá..."
                        />
                      ) : (
                        <span className="font-medium text-orange-600">
                          {formatPrice(lead.price_highest_bid || parseFloat(editedPriceHighestBid) || 0)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="images" className="py-4">
            {processedImages.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {processedImages.map((img, index) => (
                  <div
                    key={index}
                    className="aspect-square relative rounded-lg overflow-hidden border cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => onImageClick?.(processedImages, index)}
                  >
                    <img
                      src={img}
                      alt={`Car image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
                <p>Không có hình ảnh</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
