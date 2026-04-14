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
            const response = await fetch('/api/e2e/followup-v2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone,
                    contactName: lead.name || lead.display_name || "",
                }),
            })

            if (!response.ok || !response.body) {
                throw new Error('Gửi yêu cầu thất bại')
            }

            // Read streaming response
            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let resultJson: any = null

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                const chunk = decoder.decode(value, { stream: true }).trim()
                if (chunk) {
                    try {
                        resultJson = JSON.parse(chunk)
                    } catch {
                        // heartbeat newline — ignore
                    }
                }
            }

            if (!resultJson) {
                throw new Error('Không nhận được phản hồi')
            }

            if (!resultJson.success) {
                throw new Error(resultJson.error || 'Gửi tin nhắn thất bại')
            }

            toast({
                title: "Thành công",
                description: "Đã gửi yêu cầu Follow up",
            })

            // Log activity
            try {
                await fetch('/api/e2e/log-activity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        leadId: lead.id,
                        activityType: 'BOT_FOLLOW_UP_SENT',
                        actorType: 'USER',
                        metadata: {
                            field_name: 'bot_follow_up',
                            new_value: 'Triggered manually',
                            channel: 'ZALO',
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
        } catch (error) {
            console.error('[Follow Up] Error:', error)
            toast({
                title: "Lỗi",
                description: error instanceof Error ? error.message : "Có lỗi xảy ra khi gửi tin nhắn",
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
