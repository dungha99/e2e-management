"use client"

import { useState } from "react"
import { Lead } from "../types"
import { SaleActivitiesTab } from "../tabs/SaleActivitiesTab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileText, Pencil, Check, X, Loader2, PanelRightClose, PanelRightOpen } from "lucide-react"

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

    const phone = selectedLead.phone || selectedLead.additional_phone || null

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
                    <div className="max-h-[150px] overflow-y-auto">
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
                <TabsContent value="summary" className="flex-1 overflow-y-auto p-3 mt-0">
                    <div className="text-sm text-gray-500 text-center py-8">
                        Summary content will be added here
                    </div>
                </TabsContent>

                {/* Activities Tab Content */}
                <TabsContent value="activities" className="flex-1 overflow-y-auto p-3 mt-0">
                    <SaleActivitiesTab phone={phone} refreshKey={refreshKey} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

