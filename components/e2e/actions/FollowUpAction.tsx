import { useState } from "react"
import { Bell, Clock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Lead } from "../types"

interface FollowUpActionProps {
    lead: Lead
    onSuccess?: () => void
    disabled?: boolean
    className?: string
    isSidebarVariant?: boolean
}

export function FollowUpAction({ lead, onSuccess, disabled = false, className, isSidebarVariant = false }: FollowUpActionProps) {
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()

    const handleFollowUp = async (e: React.MouseEvent) => {
        e.stopPropagation()
        const phone = lead.phone || lead.additional_phone
        if (!phone) {
            toast({
                title: "Lỗi",
                description: "Không tìm thấy số điện thoại của lead",
                variant: "destructive",
            })
            return
        }

        setIsLoading(true)
        try {
            const response = await fetch('https://n8n.vucar.vn/webhook/7c06fc96-f8dc-4c5d-af17-57c2bab57864', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ phone }),
            })

            if (response.ok) {
                toast({
                    title: "Thành công",
                    description: "Đã gửi yêu cầu Follow up",
                })

                // Log activity
                try {
                    await fetch('/api/e2e/log-activity', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            leadId: lead.id,
                            activityType: 'BOT_FOLLOW_UP_SENT',
                            actorType: 'USER',
                            metadata: {
                                field_name: 'bot_follow_up',
                                new_value: 'Triggered manually',
                                channel: 'SYSTEM'
                            },
                            field: 'bot_follow_up'
                        }),
                    })
                } catch (logError) {
                    console.error('[Follow Up] Failed to log activity:', logError)
                }

                if (onSuccess) {
                    onSuccess()
                }
            } else {
                throw new Error('Gửi yêu cầu thất bại')
            }
        } catch (error) {
            console.error('[Follow Up] Error:', error)
            toast({
                title: "Lỗi",
                description: "Có lỗi xảy ra khi gửi yêu cầu",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    // Uses different styling if it's placed in the LeadListSidebar
    if (isSidebarVariant) {
        return (
            <Button
                size="sm"
                className={`h-6 px-3 text-[10px] bg-orange-500 hover:bg-orange-600 text-white font-medium ${className || ''}`}
                onClick={handleFollowUp}
                disabled={isLoading || disabled}
            >
                {isLoading ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                    <Clock className="h-3 w-3 mr-1" />
                )}
                Follow up
            </Button>
        )
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleFollowUp}
            disabled={isLoading || disabled}
            className={`bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100 hover:border-purple-300 text-xs sm:text-sm ${className || ''}`}
        >
            {isLoading ? (
                <Loader2 className="h-3.5 sm:h-4 w-3.5 sm:w-4 animate-spin" />
            ) : (
                <>
                    <Bell className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1.5 sm:mr-2" />
                    <span className="hidden sm:inline">Follow up</span>
                    <span className="sm:hidden">Follow</span>
                </>
            )}
        </Button>
    )
}
