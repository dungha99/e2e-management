import { Button } from "@/components/ui/button"

interface BookInspectionActionProps {
    onClick: () => void
    className?: string
}

export function BookInspectionAction({ onClick, className }: BookInspectionActionProps) {
    return (
        <Button
            size="sm"
            className={`bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm shadow-sm ${className || ''}`}
            onClick={onClick}
        >
            <span className="hidden sm:inline">Đặt lịch KD</span>
            <span className="sm:hidden">Lịch KD</span>
        </Button>
    )
}
