import { useState, useEffect } from "react"
import { Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { useToast } from "@/hooks/use-toast"
import { Lead } from "../types"

interface ZnsTemplate {
    code: string
    name: string
    description?: string
}

interface SendNotificationActionProps {
    lead: Lead
    className?: string
}

export function SendNotificationAction({ lead, className }: SendNotificationActionProps) {
    const { toast } = useToast()

    const [znsTemplates, setZnsTemplates] = useState<ZnsTemplate[]>([])
    const [loadingTemplates, setLoadingTemplates] = useState(false)
    const [sendingZns, setSendingZns] = useState(false)
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
    const [selectedTemplate, setSelectedTemplate] = useState<ZnsTemplate | null>(null)
    const [templatesDropdownOpen, setTemplatesDropdownOpen] = useState(false)
    const [templatesFetched, setTemplatesFetched] = useState(false)

    useEffect(() => {
        if (templatesDropdownOpen && !templatesFetched && !loadingTemplates) {
            setLoadingTemplates(true)
            fetch('/api/e2e/notification-templates')
                .then(res => res.json())
                .then(response => {
                    if (response.success && Array.isArray(response.data)) {
                        setZnsTemplates(response.data)
                    } else if (Array.isArray(response)) {
                        setZnsTemplates(response)
                    }
                    setTemplatesFetched(true)
                })
                .catch(err => {
                    console.error('[ZNS Templates] Failed to fetch:', err)
                    toast({
                        title: "Lỗi",
                        description: "Không thể tải danh sách template ZNS",
                        variant: "destructive",
                    })
                    setTemplatesFetched(true)
                })
                .finally(() => setLoadingTemplates(false))
        }
    }, [templatesDropdownOpen, templatesFetched, loadingTemplates])

    const handleTemplateSelect = (template: ZnsTemplate) => {
        setSelectedTemplate(template)
        setConfirmDialogOpen(true)
    }

    const handleSendZns = async () => {
        if (!selectedTemplate || !lead) return

        const phone = lead.phone || lead.additional_phone
        if (!phone) {
            toast({
                title: "Lỗi",
                description: "Không tìm thấy số điện thoại của lead",
                variant: "destructive",
            })
            setConfirmDialogOpen(false)
            return
        }

        setSendingZns(true)
        try {
            const response = await fetch('/api/e2e/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: selectedTemplate.code,
                    phoneNumbers: [phone],
                    leadId: lead.id,
                }),
            })

            const data = await response.json()

            if (response.ok) {
                toast({
                    title: "Thành công",
                    description: `Đã gửi ZNS "${selectedTemplate.name}" thành công`,
                })
            } else {
                throw new Error(data.error || 'Gửi ZNS thất bại')
            }
        } catch (error) {
            console.error('[ZNS Send] Error:', error)
            toast({
                title: "Lỗi",
                description: error instanceof Error ? error.message : "Gửi ZNS thất bại",
                variant: "destructive",
            })
        } finally {
            setSendingZns(false)
            setConfirmDialogOpen(false)
            setSelectedTemplate(null)
        }
    }

    return (
        <>
            <DropdownMenu open={templatesDropdownOpen} onOpenChange={setTemplatesDropdownOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={sendingZns}
                        className={`bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 text-xs sm:text-sm ${className || ''}`}
                    >
                        {sendingZns ? (
                            <Loader2 className="h-3.5 sm:h-4 w-3.5 sm:w-4 animate-spin" />
                        ) : (
                            <>
                                <Send className="h-3.5 sm:h-4 w-3.5 sm:w-4 mr-1.5 sm:mr-2" />
                                <span className="hidden sm:inline">Gửi noti</span>
                                <span className="sm:hidden">Noti</span>
                            </>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto w-64">
                    {loadingTemplates ? (
                        <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span className="text-sm text-gray-500">Đang tải...</span>
                        </div>
                    ) : znsTemplates.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500 text-center">
                            Không có template nào
                        </div>
                    ) : (
                        znsTemplates.map((template) => (
                            <DropdownMenuItem
                                key={template.code}
                                onClick={() => handleTemplateSelect(template)}
                                className="cursor-pointer"
                            >
                                <div className="flex flex-col">
                                    <span className="font-medium">{template.name}</span>
                                    {template.description && (
                                        <span className="text-xs text-gray-500">{template.description}</span>
                                    )}
                                </div>
                            </DropdownMenuItem>
                        ))
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận gửi ZNS</AlertDialogTitle>
                        <AlertDialogDescription>
                            Bạn có chắc chắn muốn gửi ZNS <strong>"{selectedTemplate?.name}"</strong> đến số điện thoại <strong>{lead.phone || lead.additional_phone}</strong>?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={sendingZns}>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleSendZns}
                            disabled={sendingZns}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {sendingZns ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Đang gửi...
                                </>
                            ) : (
                                'Gửi'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
