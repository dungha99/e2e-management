import { useState } from "react"
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

interface RenameLeadActionProps {
    onClick?: () => void
    loading?: boolean
    disabled?: boolean
    className?: string
}

export function RenameLeadAction({ onClick, loading = false, disabled = false, className }: RenameLeadActionProps) {
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
                {loading ? "Đang xử lý..." : "Đổi tên Lead"}
            </Button>

            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận Đổi tên Lead</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bạn có chắc chắn muốn đồng bộ tên Lead này không? Cập nhật này sẽ thay đổi tên hiển thị của khách hàng trong hệ thống.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setOpen(false)}>Hủy thao tác</AlertDialogCancel>
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
