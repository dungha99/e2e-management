import { Loader2, PhoneCall } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface CallBotActionProps {
    onCallBot: (action: 'CHECK_VAR' | 'FIRST_CALL') => void
    loading?: boolean
    className?: string
}

export function CallBotAction({ onCallBot, loading = false, className }: CallBotActionProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    className={`bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 hover:border-orange-300 text-xs sm:text-sm ${className || ''}`}
                >
                    {loading ? (
                        <Loader2 className="h-3.5 sm:h-4 w-3.5 sm:w-4 animate-spin" />
                    ) : (
                        <>
                            <PhoneCall className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1.5 sm:mr-2" />
                            <span className="hidden sm:inline">GỌI BOT</span>
                            <span className="sm:hidden">Gọi</span>
                        </>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onCallBot('CHECK_VAR')}>
                    Check Var (Còn bán không?)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCallBot('FIRST_CALL')}>
                    First Call (Lấy thông tin)
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
