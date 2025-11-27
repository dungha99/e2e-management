"use client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface OnboardingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OnboardingModal({ open, onOpenChange }: OnboardingModalProps) {
  const handleClose = () => {
    // Save to localStorage that user has seen the intro
    localStorage.setItem("decoyToolIntroSeen", "true")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">⭐️ Chào mừng đến với DECOY</DialogTitle>
          <DialogDescription className="sr-only">
            Hướng dẫn sử dụng công cụ Zalo Decoy để quản lý chiến dịch tin nhắn
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Section 1: Purpose */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Tại sao chúng ta sử dụng DECOY?</h3>
            <ul className="space-y-2 text-sm ml-4">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>
                  <strong>🤯 Tiếp cận lại các lead "nguội"</strong>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>
                  <strong>😎 Đóng vai người mua:</strong> Thăm dò ý định bán xe thật sự và mức độ thiện chí của khách
                  hàng.
                </span>
              </li>
            </ul>
          </div>

          {/* Section 2: How it works */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Chỉ với 3 bước đơn giản:</h3>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  1
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold">Chọn vai & Dán SĐT</h4>
                  <p className="text-sm text-muted-foreground">
                    Chọn vai phù hợp với lead và dán danh sách SĐT cần tiếp cận vào ô nhập liệu.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  2
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold">Chọn & Gửi</h4>
                  <p className="text-sm text-muted-foreground">
                    Bạn bắt buộc cập nhật đủ Giá mong muốn và Giá bid cao nhất cho bot trước khi gửi.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  3
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold">Theo dõi phản hồi của khách hàng!!!</h4>
                  <ul className="space-y-1.5 text-sm text-muted-foreground ml-4">
                    <li className="flex gap-2">
                      <span>•</span>
                      <span>Bot sẽ tự động nói chuyện với khách hàng qua Vai đã chọn.</span>
                    </li>
                    <li className="flex gap-2">
                      <span>•</span>
                      <span>Bạn hãy theo dõi trạng thái đã gửi, full chat của từng lead qua hệ thống.</span>
                    </li>
                    <li className="flex gap-2">
                      <span>•</span>
                      <span>Khi khách phản hồi bot, bạn sẽ nhận được thông báo qua Slack và Zalo.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full sm:w-auto" size="lg">
            Đã hiểu, bắt đầu thôi!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
