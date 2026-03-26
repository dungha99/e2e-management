import { useState } from "react"
import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface SendFirstMessageActionProps {
    onClick?: () => void
    loading?: boolean
    disabled?: boolean
    className?: string
}

export function SendFirstMessageAction({ onClick, loading = false, disabled = false, className }: SendFirstMessageActionProps) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                    e.stopPropagation()
                    setOpen(true)
                }}
                disabled={loading || disabled}
                className={`text-gray-700 text-xs sm:text-sm ${className || ''}`}
            >
                <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                {loading ? "Đang xử lý..." : "Send First Message"}
            </Button>

            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận gửi First Message</AlertDialogTitle>
                        <AlertDialogDescription>
                            Hệ thống sẽ gửi bộ 3 tin nhắn mặc định cho khách hàng trên Zalo qua tài khoản của PIC. Bạn có chắc chắn muốn gửi không?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setOpen(false)}>Hủy bỏ</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (onClick) onClick()
                                setOpen(false)
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            Đồng ý
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
