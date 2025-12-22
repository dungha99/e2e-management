"use client"

import { useState, useEffect } from "react"
import { Lead } from "../types"
import { SaleActivitiesTab } from "../tabs/SaleActivitiesTab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileText, Pencil, Check, X, Loader2, PanelRightClose, PanelRightOpen, Clock, RefreshCw, AlertCircle } from "lucide-react"

// Lead summary type from the webhook
interface LeadSummaryItem {
    lead_summary: string
    created_at: string
}

interface SaleActivitiesPanelProps {
    selectedLead: Lead | null
    isMobile: boolean
    mobileView: "list" | "detail"
    refreshKey?: number  // Increment to trigger refresh
    onUpdateNotes?: (notes: string) => Promise<void>
    isCollapsed?: boolean  // For tablet collapsible toggle
    onToggleCollapse?: () => void  // Toggle handler
}

export function SaleActivitiesPanel({
    selectedLead,
    isMobile,
    mobileView,
    refreshKey,
    onUpdateNotes,
    isCollapsed = false,
    onToggleCollapse,
}: SaleActivitiesPanelProps) {
    const [activeTab, setActiveTab] = useState<string>("activities")

    // Notes editing state
    const [isEditingNotes, setIsEditingNotes] = useState(false)
    const [editedNotes, setEditedNotes] = useState("")
    const [savingNotes, setSavingNotes] = useState(false)

    // Lead summary state
    const [leadSummaries, setLeadSummaries] = useState<LeadSummaryItem[]>([])
    const [loadingSummaries, setLoadingSummaries] = useState(false)
    const [summaryError, setSummaryError] = useState<string | null>(null)

    // Fetch lead summaries when phone changes or tab becomes active
    const phone = selectedLead?.phone || selectedLead?.additional_phone || null

    const fetchLeadSummaries = async () => {
        if (!phone) {
            setLeadSummaries([])
            return
        }

        setLoadingSummaries(true)
        setSummaryError(null)

        try {
            const response = await fetch("https://n8n.vucar.vn/webhook/c87920ee-2cc1-4493-a692-a5e4df64569e", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ phone }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const data = await response.json()

            // Handle both array and single object response
            const summaries: LeadSummaryItem[] = Array.isArray(data) ? data : [data]

            // Sort by created_at (newest first)
            const sortedSummaries = summaries
                .filter((item) => item.lead_summary && item.created_at)
                .sort((a, b) => {
                    // Parse DD/MM/YYYY HH:mm format
                    const parseDate = (dateStr: string) => {
                        const [datePart, timePart] = dateStr.split(" ")
                        const [day, month, year] = datePart.split("/")
                        return new Date(`${year}-${month}-${day}T${timePart}:00`)
                    }
                    return parseDate(b.created_at).getTime() - parseDate(a.created_at).getTime()
                })

            setLeadSummaries(sortedSummaries)
        } catch (error) {
            console.error("Error fetching lead summaries:", error)
            setSummaryError("Không thể tải dữ liệu summary")
            setLeadSummaries([])
        } finally {
            setLoadingSummaries(false)
        }
    }

    // Fetch summaries when phone changes
    useEffect(() => {
        if (activeTab === "summary") {
            fetchLeadSummaries()
        }
    }, [phone, activeTab])

    // Notes editing handlers
    const handleStartEditNotes = () => {
        setEditedNotes(selectedLead?.notes || "")
        setIsEditingNotes(true)
    }

    const handleCancelEditNotes = () => {
        setIsEditingNotes(false)
        setEditedNotes("")
    }

    const handleSaveNotes = async () => {
        if (!onUpdateNotes) return

        setSavingNotes(true)
        try {
            await onUpdateNotes(editedNotes)
            setIsEditingNotes(false)
            setEditedNotes("")
        } finally {
            setSavingNotes(false)
        }
    }

    // Hide on mobile when in list view
    if (isMobile && mobileView === "list") {
        return null
    }

    // Only show when a lead is selected
    if (!selectedLead) {
        return null
    }


    // Collapsed state - show narrow strip with expand button
    if (isCollapsed && onToggleCollapse) {
        return (
            <div className="w-10 flex-shrink-0 border-l border-gray-200 bg-gray-50 hidden md:flex flex-col items-center py-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleCollapse}
                    className="h-8 w-8 p-0"
                    title="Mở rộng panel"
                >
                    <PanelRightOpen className="h-4 w-4 text-gray-500" />
                </Button>
            </div>
        )
    }

    return (
        <div className="w-60 lg:w-80 flex-shrink-0 border-l border-gray-200 overflow-hidden flex flex-col hidden md:flex">
            {/* Collapse Toggle Button - visible on all md+ screens */}
            {onToggleCollapse && (
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
                    <span className="text-xs font-medium text-gray-500">Activities</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleCollapse}
                        className="h-6 w-6 p-0"
                        title="Thu gọn panel"
                    >
                        <PanelRightClose className="h-4 w-4 text-gray-500" />
                    </Button>
                </div>
            )}

            {/* Notes Section - Above Tabs */}
            <div className="bg-white border-b border-gray-200 p-3">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        Ghi chú
                    </h4>
                    {!isEditingNotes && onUpdateNotes && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-gray-500 hover:text-blue-600"
                            onClick={handleStartEditNotes}
                        >
                            <Pencil className="h-3 w-3 mr-1" />
                            Sửa
                        </Button>
                    )}
                </div>

                {isEditingNotes ? (
                    <div className="space-y-2">
                        <Textarea
                            value={editedNotes}
                            onChange={(e) => setEditedNotes(e.target.value)}
                            placeholder="Nhập ghi chú..."
                            className="min-h-[80px] max-h-[120px] text-sm resize-none"
                            autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancelEditNotes}
                                disabled={savingNotes}
                                className="h-7"
                            >
                                <X className="h-3 w-3 mr-1" />
                                Hủy
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSaveNotes}
                                disabled={savingNotes}
                                className="h-7 bg-blue-600 hover:bg-blue-700"
                            >
                                {savingNotes ? (
                                    <>
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        Đang lưu...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-3 w-3 mr-1" />
                                        Lưu
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="max-h-[150px] overflow-y-auto scrollbar-hide">
                        {selectedLead.notes ? (
                            <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedLead.notes}</p>
                        ) : (
                            <p className="text-sm text-gray-400 italic">Chưa có ghi chú</p>
                        )}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <div className="px-3 pt-3">
                    <TabsList className="w-full">
                        <TabsTrigger value="summary" className="flex-1">Summary</TabsTrigger>
                        <TabsTrigger value="activities" className="flex-1">Activities</TabsTrigger>
                    </TabsList>
                </div>

                {/* Summary Tab Content */}
                <TabsContent value="summary" className="flex-1 overflow-y-auto scrollbar-hide p-3 mt-0">
                    {/* Header with Refresh Button */}
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-700">Lead Summary Timeline</h4>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={fetchLeadSummaries}
                            disabled={loadingSummaries}
                            className="h-7 px-2"
                        >
                            <RefreshCw className={`h-3 w-3 ${loadingSummaries ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    {/* Loading State */}
                    {loadingSummaries && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            <span className="ml-2 text-sm text-gray-500">Đang tải...</span>
                        </div>
                    )}

                    {/* Error State */}
                    {!loadingSummaries && summaryError && (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
                            <p className="text-sm text-red-500">{summaryError}</p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchLeadSummaries}
                                className="mt-3"
                            >
                                Thử lại
                            </Button>
                        </div>
                    )}

                    {/* Empty State */}
                    {!loadingSummaries && !summaryError && leadSummaries.length === 0 && (
                        <div className="text-sm text-gray-500 text-center py-8">
                            Chưa có dữ liệu summary cho lead này
                        </div>
                    )}

                    {/* Timeline Content */}
                    {!loadingSummaries && !summaryError && leadSummaries.length > 0 && (
                        <div className="space-y-4">
                            {leadSummaries.map((item, index) => (
                                <div key={index} className="relative pl-6 pb-4 border-l-2 border-blue-200 last:border-l-0 last:pb-0">
                                    {/* Timeline Dot */}
                                    <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm" />

                                    {/* Timestamp */}
                                    <div className="flex items-center gap-1 mb-1">
                                        <Clock className="h-3 w-3 text-gray-400" />
                                        <span className="text-xs text-gray-500 font-medium">
                                            {item.created_at}
                                        </span>
                                    </div>

                                    {/* Summary Content */}
                                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100 shadow-sm">
                                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                            {item.lead_summary}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Activities Tab Content */}
                <TabsContent value="activities" className="flex-1 overflow-y-auto scrollbar-hide p-3 mt-0">
                    <SaleActivitiesTab phone={phone} refreshKey={refreshKey} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

