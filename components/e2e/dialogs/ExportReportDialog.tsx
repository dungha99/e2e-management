"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Copy, CheckCircle2 } from "lucide-react"
import { Lead } from "../types"
import { formatCarInfo, formatPriceShort } from "../utils"
import { useToast } from "@/hooks/use-toast"

interface ExportReportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    leads: Lead[]
}

// Keywords to identify different activity types for engagement calculation
const SESSION_VIEW_KEYWORDS = ['page_view', 'view', 'visit', 'session', 'load', 'open', 'click', 'scroll']
const CHAT_KEYWORDS = ['chat', 'message', 'send', 'reply', 'conversation', 'support', 'gửi', 'tin nhắn']

export function ExportReportDialog({
    open,
    onOpenChange,
    leads
}: ExportReportDialogProps) {
    const { toast } = useToast()
    const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())
    const [exporting, setExporting] = useState(false)

    const toggleLead = (leadId: string) => {
        const newSelected = new Set(selectedLeadIds)
        if (newSelected.has(leadId)) {
            newSelected.delete(leadId)
        } else {
            newSelected.add(leadId)
        }
        setSelectedLeadIds(newSelected)
    }

    const toggleAll = () => {
        if (selectedLeadIds.size === leads.length) {
            setSelectedLeadIds(new Set())
        } else {
            setSelectedLeadIds(new Set(leads.map(l => l.id)))
        }
    }

    const generateReportForLead = async (lead: Lead): Promise<string> => {
        // Fetch activity log for engagement calculation
        const phone = lead.phone || lead.additional_phone
        let engagementText = ""

        if (phone) {
            try {
                const response = await fetch(`/api/e2e/activity-log?phone=${encodeURIComponent(phone)}`)
                if (response.ok) {
                    const activityLog = await response.json()
                    if (Array.isArray(activityLog) && activityLog.length > 0) {
                        // Count session views
                        const sessionViews = activityLog.filter((activity: { event_name: string }) =>
                            SESSION_VIEW_KEYWORDS.some(keyword =>
                                activity.event_name.toLowerCase().includes(keyword)
                            )
                        ).length || activityLog.length

                        // Count chat exchanges
                        const chatExchanges = activityLog.filter((activity: { event_name: string }) =>
                            CHAT_KEYWORDS.some(keyword =>
                                activity.event_name.toLowerCase().includes(keyword)
                            )
                        ).length

                        // Determine engagement level based on session views
                        if (sessionViews >= 10 || chatExchanges >= 3) {
                            engagementText = "Khách có tương tác cao trên website"
                        } else if (sessionViews >= 5 || chatExchanges >= 1) {
                            engagementText = "Khách có tương tác trung bình trên website"
                        } else if (sessionViews > 0) {
                            engagementText = "Khách có tương tác thấp trên website"
                        } else {
                            engagementText = "Khách chưa có tương tác trên website"
                        }
                    } else {
                        engagementText = "Khách chưa có tương tác trên website"
                    }
                }
            } catch {
                engagementText = ""
            }
        }

        // Build car information
        const carInfo = formatCarInfo(lead)
        const mileage = lead.mileage ? `${lead.mileage.toLocaleString('vi-VN')}km` : ""

        // Build price comparison
        let priceComparison = ""
        const customerPrice = lead.price_customer
        const highestBid = lead.price_highest_bid

        if (customerPrice && customerPrice > 0) {
            const formattedCustomerPrice = formatPriceShort(customerPrice)
            if (highestBid && highestBid > 0) {
                const formattedHighestBid = formatPriceShort(highestBid)
                const gap = customerPrice - highestBid
                const formattedGap = formatPriceShort(gap)
                priceComparison = `${formattedCustomerPrice} vs ${formattedHighestBid} -> Gap ${formattedGap}`
            } else {
                priceComparison = `Giá mong muốn: ${formattedCustomerPrice}`
            }
        }

        // Build the report content
        const reportLines: string[] = []
        if (carInfo) reportLines.push(carInfo)
        if (mileage) reportLines.push(mileage)
        if (priceComparison) reportLines.push(priceComparison)
        if (engagementText) reportLines.push(engagementText)

        return reportLines.join('\n')
    }

    const handleExport = async () => {
        if (selectedLeadIds.size === 0) {
            toast({
                title: "Lỗi",
                description: "Vui lòng chọn ít nhất một lead để xuất báo cáo",
                variant: "destructive",
            })
            return
        }

        setExporting(true)

        try {
            const selectedLeads = leads.filter(l => selectedLeadIds.has(l.id))
            const reports: string[] = []

            for (const lead of selectedLeads) {
                const report = await generateReportForLead(lead)
                if (report) {
                    reports.push(report)
                }
            }

            const finalReport = reports.join('\n\n---\n\n')

            // Copy to clipboard
            await navigator.clipboard.writeText(finalReport)

            toast({
                title: "Đã sao chép",
                description: `Đã xuất báo cáo cho ${selectedLeads.length} lead`,
            })

            // Reset selection and close dialog
            setSelectedLeadIds(new Set())
            onOpenChange(false)
        } catch (error) {
            console.error("[E2E] Error exporting reports:", error)
            toast({
                title: "Lỗi",
                description: "Không thể xuất báo cáo",
                variant: "destructive",
            })
        } finally {
            setExporting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Xuất báo cáo</DialogTitle>
                    <DialogDescription>
                        Chọn các lead bạn muốn xuất báo cáo. Báo cáo sẽ được sao chép vào clipboard.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0">
                    {/* Select All */}
                    <div className="flex items-center gap-2 pb-3 border-b mb-3">
                        <Checkbox
                            id="select-all"
                            checked={selectedLeadIds.size === leads.length && leads.length > 0}
                            onCheckedChange={toggleAll}
                        />
                        <label
                            htmlFor="select-all"
                            className="text-sm font-medium cursor-pointer"
                        >
                            Chọn tất cả ({leads.length} leads)
                        </label>
                        {selectedLeadIds.size > 0 && (
                            <span className="ml-auto text-xs text-blue-600 font-medium">
                                Đã chọn: {selectedLeadIds.size}
                            </span>
                        )}
                    </div>

                    {/* Lead List */}
                    <ScrollArea className="h-[300px] pr-4">
                        <div className="space-y-2">
                            {leads.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm">
                                    Không có lead nào để xuất
                                </div>
                            ) : (
                                leads.map((lead) => {
                                    const isSelected = selectedLeadIds.has(lead.id)
                                    return (
                                        <div
                                            key={lead.id}
                                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected
                                                    ? 'bg-blue-50 border-blue-200'
                                                    : 'bg-white border-gray-200 hover:bg-gray-50'
                                                }`}
                                            onClick={() => toggleLead(lead.id)}
                                        >
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => toggleLead(lead.id)}
                                                className="mt-0.5"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium text-gray-900 truncate">
                                                        {lead.name || 'Không có tên'}
                                                    </span>
                                                    {lead.source && (
                                                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                                            {lead.source === "zalo" ? "Zalo" : lead.source === "facebook" ? "Facebook" : lead.source}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600 truncate">
                                                    {formatCarInfo(lead)}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1 text-xs">
                                                    {lead.price_customer && lead.price_customer > 0 && (
                                                        <span className="text-emerald-600 font-medium">
                                                            {formatPriceShort(lead.price_customer)}
                                                        </span>
                                                    )}
                                                    {lead.price_highest_bid && lead.price_highest_bid > 0 && (
                                                        <>
                                                            <span className="text-gray-400">vs</span>
                                                            <span className="text-blue-600 font-medium">
                                                                {formatPriceShort(lead.price_highest_bid)}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={exporting}
                    >
                        Hủy
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={exporting || selectedLeadIds.size === 0}
                    >
                        {exporting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Đang xuất...
                            </>
                        ) : (
                            <>
                                <Copy className="h-4 w-4 mr-2" />
                                Xuất báo cáo ({selectedLeadIds.size})
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
