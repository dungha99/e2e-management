# Script to add detail button and dialog to e2e-management.tsx

$filePath = "d:\Antigravity\projects\minh-thu-decoy-campaign-manager\components\e2e-management.tsx"
$content = Get-Content $filePath -Raw

# 1. Add detail button before "Đặt lịch KD" button
$buttonToAdd = @"
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailDialogOpen(true)}
                      className="text-blue-600 border-blue-600 hover:bg-blue-50"
                    >
                      Chi tiết
                    </Button>
"@

$content = $content -replace '(\s+<Button\s+size="sm"\s+className="bg-emerald-600 hover:bg-emerald-700 text-white"\s+onClick=\{\(\) => setInspectionSystemOpen\(true\)\})', "$buttonToAdd`r`n`$1"

# 2. Add detail dialog before Inspection System Dialog comment
$dialogToAdd = @"

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Thông tin chi tiết</DialogTitle>
            <DialogDescription>
              Thông tin đầy đủ về lead và xe
            </DialogDescription>
          </DialogHeader>
          
          {selectedLead && (
            <div className="space-y-6 py-4">
              {/* Lead Information */}
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">Thông tin Lead</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Tên khách hàng</p>
                    <p className="text-base font-medium text-gray-900">{selectedLead.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Số điện thoại</p>
                    <p className="text-base font-medium text-gray-900">
                      {selectedLead.phone ? maskPhone(selectedLead.phone) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">SĐT phụ</p>
                    <p className="text-base font-medium text-gray-900">
                      {selectedLead.additional_phone ? maskPhone(selectedLead.additional_phone) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Ngày tạo lead</p>
                    <p className="text-base font-medium text-gray-900">
                      {new Date(selectedLead.created_at).toLocaleString("vi-VN")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">PIC</p>
                    <p className="text-base font-medium text-gray-900">{selectedLead.pic_name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Nguồn</p>
                    <p className="text-base font-medium text-gray-900">{selectedLead.source || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Trạng thái</p>
                    <p className="text-base font-medium text-gray-900">
                      {selectedLead.is_primary ? "Ưu tiên" : "Nuôi dưỡng"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Stage</p>
                    <p className="text-base font-medium text-gray-900">{selectedLead.stage || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Car Information */}
              <div className="bg-emerald-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-emerald-900 mb-4">Thông tin Xe</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Hãng xe</p>
                    <p className="text-base font-medium text-gray-900">{selectedLead.brand || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Dòng xe</p>
                    <p className="text-base font-medium text-gray-900">{selectedLead.model || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phiên bản</p>
                    <p className="text-base font-medium text-gray-900">{selectedLead.variant || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Năm sản xuất</p>
                    <p className="text-base font-medium text-gray-900">{selectedLead.year || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Biển số</p>
                    <p className="text-base font-medium text-gray-900">{selectedLead.plate || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">SKU</p>
                    <p className="text-base font-medium text-gray-900">{selectedLead.sku || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Số km</p>
                    <p className="text-base font-medium text-gray-900">
                      {selectedLead.mileage ? `${selectedLead.mileage.toLocaleString()} km` : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Địa điểm</p>
                    <p className="text-base font-medium text-gray-900">{selectedLead.location || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Ngày tạo xe</p>
                    <p className="text-base font-medium text-gray-900">
                      {selectedLead.car_created_at ? new Date(selectedLead.car_created_at).toLocaleString("vi-VN") : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Car ID</p>
                    <p className="text-base font-medium text-gray-900 text-xs">{selectedLead.car_id || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Sale Status Information */}
              <div className="bg-purple-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-purple-900 mb-4">Thông tin Bán hàng</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Giá khách mong muốn</p>
                    <p className="text-base font-semibold text-emerald-600">
                      {selectedLead.price_customer ? formatPrice(selectedLead.price_customer) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Giá cao nhất (Dealer)</p>
                    <p className="text-base font-semibold text-blue-600">
                      {selectedLead.price_highest_bid ? formatPrice(selectedLead.price_highest_bid) : 
                       (selectedLead.dealer_bidding?.maxPrice ? formatPrice(selectedLead.dealer_bidding.maxPrice) : "N/A")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Trạng thái Bot</p>
                    <p className="text-base font-medium text-gray-900">
                      {selectedLead.bot_active ? "Đang hoạt động" : "Tắt"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Đủ ảnh</p>
                    <p className="text-base font-medium text-gray-900">
                      {selectedLead.has_enough_images ? "Có" : "Chưa"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Tin nhắn đầu</p>
                    <p className="text-base font-medium text-gray-900">
                      {selectedLead.first_message_sent ? "Đã gửi" : "Chưa gửi"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phiên đấu giá</p>
                    <p className="text-base font-medium text-gray-900">
                      {selectedLead.session_created ? "Đã tạo" : "Chưa tạo"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">Ghi chú</p>
                    <p className="text-base font-medium text-gray-900">{selectedLead.notes || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

"@

# Find the line with "Inspection System Dialog" comment and insert before it
$lines = $content -split "`r?`n"
$insertIndex = -1
for ($i = 0; $i < $lines.Count; $i++) {
    if ($lines[$i] -match "Inspection System Dialog") {
        $insertIndex = $i
        break
    }
}

if ($insertIndex -gt 0) {
    $newLines = @()
    $newLines += $lines[0..($insertIndex-1)]
    $newLines += $dialogToAdd -split "`r?`n"
    $newLines += $lines[$insertIndex..($lines.Count-1)]
    $content = $newLines -join "`r`n"
}

# Save the file
Set-Content -Path $filePath -Value $content -NoNewline

Write-Host "Successfully added detail button and dialog to e2e-management.tsx"
