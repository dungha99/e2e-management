"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Loader2, RefreshCw, Search, Layers, ChevronLeft, ChevronRight, ChevronDown, Check } from "lucide-react"
import { KanbanColumn } from "./KanbanColumn"
import { NoteDialog } from "../dialogs/NoteDialog"
import { EditLeadDialog } from "../dialogs/EditLeadDialog"
import { TransitionWorkflowDialog } from "../dialogs/TransitionWorkflowDialog"
import { Lead } from "../types"
import { useToast } from "@/hooks/use-toast"

// Types matching the API response
export interface WorkflowInstanceForKanban {
    id: string
    car_id: string
    workflow_id: string
    workflow_name: string
    workflow_order: number
    status: string
    started_at: string
    sla_deadline: string | null
    completed_at: string | null
    pending_step_name: string | null
    pending_step_order: number | null
    total_steps: number | null
    all_steps_complete: boolean
    // Car info
    car_brand: string | null
    car_model: string | null
    car_year: number | null
    car_plate: string | null
    car_mileage: number | null
    car_location: string | null
    car_image: string | null
    // Lead info
    lead_id: string | null
    lead_name: string | null
    lead_phone: string | null
    lead_status: string | null
    last_activity_at: string | null
    notes: string | null
    // Pricing
    expected_price: number | null
    dealer_price: number | null
    // Transitions
    available_transitions: {
        id: string
        to_workflow_id: string
        to_workflow_name: string
        condition_logic: string | null
    }[]
}

export interface KanbanWorkflow {
    id: string
    name: string
    order: number
    sla_hours: number
    instances: WorkflowInstanceForKanban[]
}

interface CampaignKanbanViewProps {
    picId: string
}

// Helper function to get stage style
function getStageStyle(stage: string | undefined | null): string {
    switch (stage) {
        case "CANNOT_CONTACT":
            return "bg-gray-100 text-gray-800"
        case "CONTACTED":
            return "bg-blue-100 text-blue-800"
        case "NEGOTIATION":
            return "bg-yellow-100 text-yellow-800"
        case "CAR_VIEW":
            return "bg-purple-100 text-purple-800"
        case "DEPOSIT_PAID":
            return "bg-green-100 text-green-800"
        case "COMPLETED":
            return "bg-emerald-100 text-emerald-800"
        case "FAILED":
            return "bg-red-100 text-red-800"
        default:
            return "bg-gray-100 text-gray-800"
    }
}

// Helper to process images from lead's additional_images
function processImages(lead: Lead | null): string[] {
    if (!lead?.additional_images) return []
    const images: string[] = []
    const categories = ['outside', 'inside', 'paper']
    for (const cat of categories) {
        const arr = lead.additional_images[cat]
        if (Array.isArray(arr)) {
            for (const img of arr) {
                if (img.url) images.push(img.url)
            }
        }
    }
    return images
}

export function CampaignKanbanView({ picId }: CampaignKanbanViewProps) {
    const { toast } = useToast()
    const [workflows, setWorkflows] = useState<KanbanWorkflow[]>([])
    const [stats, setStats] = useState({ total: 0, active: 0 })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")

    // Mobile workflow navigation state
    const [currentWorkflowIndex, setCurrentWorkflowIndex] = useState(0)
    const [workflowSelectorOpen, setWorkflowSelectorOpen] = useState(false)

    // Note dialog state
    const [noteDialogOpen, setNoteDialogOpen] = useState(false)
    const [selectedLeadForNote, setSelectedLeadForNote] = useState<{
        leadId: string
        leadName: string
    } | null>(null)

    // Edit Lead Dialog state
    const [editLeadDialogOpen, setEditLeadDialogOpen] = useState(false)
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
    const [loadingLead, setLoadingLead] = useState(false)
    const [editMode, setEditMode] = useState(false)
    const [saving, setSaving] = useState(false)

    // Edit form state
    const [editedPriceCustomer, setEditedPriceCustomer] = useState("")
    const [editedPriceHighestBid, setEditedPriceHighestBid] = useState("")
    const [editedStage, setEditedStage] = useState("")
    const [editedQualified, setEditedQualified] = useState("")
    const [editedIntentionLead, setEditedIntentionLead] = useState("")
    const [editedNegotiationAbility, setEditedNegotiationAbility] = useState("")
    const [editedNotes, setEditedNotes] = useState("")

    // Transition dialog state
    const [transitionDialogOpen, setTransitionDialogOpen] = useState(false)
    const [selectedInstanceForTransition, setSelectedInstanceForTransition] = useState<WorkflowInstanceForKanban | null>(null)

    const fetchKanbanData = useCallback(async () => {
        if (!picId) return

        setLoading(true)
        setError(null)

        try {
            const response = await fetch("/api/e2e/campaigns/kanban", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pic_id: picId })
            })

            if (!response.ok) {
                throw new Error("Failed to fetch kanban data")
            }

            const data = await response.json()
            if (data.success) {
                setWorkflows(data.workflows || [])
                setStats(data.stats || { total: 0, active: 0 })
            } else {
                throw new Error(data.error || "Unknown error")
            }
        } catch (err) {
            console.error("[CampaignKanbanView] Error fetching data:", err)
            setError(err instanceof Error ? err.message : "Đã xảy ra lỗi")
        } finally {
            setLoading(false)
        }
    }, [picId])

    useEffect(() => {
        fetchKanbanData()
    }, [fetchKanbanData])

    // Filter workflows based on search query
    const filteredWorkflows = workflows.map(wf => ({
        ...wf,
        instances: searchQuery
            ? wf.instances.filter(inst =>
                inst.car_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                inst.car_plate?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                inst.lead_name?.toLowerCase().includes(searchQuery.toLowerCase())
            )
            : wf.instances
    }))

    // Count total visible instances
    const visibleInstancesCount = filteredWorkflows.reduce((acc, wf) => acc + wf.instances.length, 0)

    // Fetch lead details when clicking on a card
    const fetchLeadDetails = async (leadId: string) => {
        setLoadingLead(true)
        try {
            const response = await fetch(`/api/e2e/leads/${leadId}`)
            if (!response.ok) {
                throw new Error("Failed to fetch lead details")
            }
            const lead = await response.json()
            setSelectedLead(lead)
            setEditLeadDialogOpen(true)
        } catch (err) {
            console.error("[CampaignKanbanView] Error fetching lead:", err)
            toast({
                title: "Lỗi",
                description: "Không thể tải thông tin lead",
                variant: "destructive"
            })
        } finally {
            setLoadingLead(false)
        }
    }

    const handleInstanceClick = (instance: WorkflowInstanceForKanban) => {
        console.log("[CampaignKanbanView] Instance clicked:", instance)
        if (instance.lead_id) {
            fetchLeadDetails(instance.lead_id)
        } else {
            toast({
                title: "Thông báo",
                description: "Workflow này không có lead liên kết",
            })
        }
    }

    const handleOpenNote = (leadId: string, leadName: string) => {
        setSelectedLeadForNote({ leadId, leadName })
        setNoteDialogOpen(true)
    }

    const handleTransition = async (instanceId: string, transitionId: string, toWorkflowId: string) => {
        console.log("[CampaignKanbanView] Transition:", { instanceId, transitionId, toWorkflowId })

        try {
            // Call API to execute the transition
            const response = await fetch("/api/e2e/workflow-management/transition", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instance_id: instanceId,
                    transition_id: transitionId,
                    to_workflow_id: toWorkflowId
                })
            })

            const data = await response.json()

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Failed to transition workflow")
            }

            toast({
                title: "Thành công",
                description: "Workflow đã được chuyển",
            })

            // Refresh kanban data
            await fetchKanbanData()
        } catch (error) {
            console.error("[CampaignKanbanView] Transition error:", error)
            toast({
                title: "Lỗi",
                description: error instanceof Error ? error.message : "Không thể chuyển workflow",
                variant: "destructive"
            })
            throw error
        }
    }

    const handleOpenTransitionDialog = (instance: WorkflowInstanceForKanban) => {
        setSelectedInstanceForTransition(instance)
        setTransitionDialogOpen(true)
    }

    // Handle inline note update from KanbanCard
    const handleNoteUpdate = async (leadId: string, notes: string) => {
        try {
            const response = await fetch(`/api/e2e/leads/${leadId}/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notes })
            })

            if (!response.ok) {
                throw new Error("Failed to update notes")
            }

            toast({
                title: "Đã lưu",
                description: "Ghi chú đã được cập nhật",
            })

            // Refresh kanban data to get updated notes
            await fetchKanbanData()
        } catch (error) {
            console.error("[CampaignKanbanView] Error updating notes:", error)
            toast({
                title: "Lỗi",
                description: "Không thể cập nhật ghi chú",
                variant: "destructive"
            })
            throw error
        }
    }

    // Handle save changes for EditLeadDialog
    const handleSaveChanges = async () => {
        if (!selectedLead) return

        // Validate prices
        const cleanPrice = (priceStr: string) => {
            if (!priceStr) return undefined
            const cleaned = priceStr.replace(/[.,]/g, "")
            let val = parseFloat(cleaned)
            if (!isNaN(val) && val < 10000) {
                val *= 1000000
            }
            return val
        }

        const priceCustomer = cleanPrice(editedPriceCustomer)
        const priceHighestBid = cleanPrice(editedPriceHighestBid)

        if (priceCustomer !== undefined && (isNaN(priceCustomer) || priceCustomer < 0)) {
            toast({
                title: "Lỗi",
                description: "Giá mong muốn phải là số >= 0",
                variant: "destructive",
            })
            return
        }

        if (priceHighestBid !== undefined && (isNaN(priceHighestBid) || priceHighestBid < 0)) {
            toast({
                title: "Lỗi",
                description: "Giá cao nhất phải là số >= 0",
                variant: "destructive",
            })
            return
        }

        setSaving(true)

        try {
            const carId = selectedLead.car_id

            if (!carId) {
                toast({
                    title: "Lỗi",
                    description: "Không tìm thấy Car ID",
                    variant: "destructive",
                })
                setSaving(false)
                return
            }

            const payload: any = {
                carId,
                leadId: selectedLead.id,
                previousValues: {
                    stage: selectedLead.stage,
                    price_customer: selectedLead.price_customer,
                    price_highest_bid: selectedLead.price_highest_bid,
                    qualified: selectedLead.qualified,
                    intentionLead: selectedLead.intentionLead,
                    negotiationAbility: selectedLead.negotiationAbility,
                    notes: selectedLead.notes,
                }
            }

            let hasChanges = false

            if (editedStage && editedStage !== selectedLead.stage) {
                payload.stage = editedStage
                hasChanges = true
            }

            if (priceCustomer !== undefined && priceCustomer !== selectedLead.price_customer) {
                payload.price_customer = priceCustomer
                hasChanges = true
            }

            if (priceHighestBid !== undefined && priceHighestBid !== selectedLead.price_highest_bid) {
                payload.price_highest_bid = priceHighestBid
                hasChanges = true
            }

            if (editedQualified && editedQualified !== selectedLead.qualified) {
                payload.qualified = editedQualified
                hasChanges = true
            }

            if (editedIntentionLead && editedIntentionLead !== selectedLead.intentionLead) {
                payload.intentionLead = editedIntentionLead
                hasChanges = true
            }

            if (editedNegotiationAbility && editedNegotiationAbility !== selectedLead.negotiationAbility) {
                payload.negotiationAbility = editedNegotiationAbility
                hasChanges = true
            }

            if (editedNotes !== undefined && editedNotes !== (selectedLead.notes || "")) {
                payload.notes = editedNotes
                hasChanges = true
            }

            if (!hasChanges) {
                toast({
                    title: "Thông báo",
                    description: "Không có thay đổi nào",
                })
                setSaving(false)
                return
            }

            const response = await fetch("/api/e2e/update-sale-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            const data = await response.json()

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Failed to update")
            }

            // Update local state
            const updatedLead = {
                ...selectedLead,
                stage: editedStage || selectedLead.stage,
                price_customer: priceCustomer !== undefined ? priceCustomer : selectedLead.price_customer,
                price_highest_bid: priceHighestBid !== undefined ? priceHighestBid : selectedLead.price_highest_bid,
                qualified: editedQualified || selectedLead.qualified,
                intentionLead: editedIntentionLead || selectedLead.intentionLead,
                negotiationAbility: editedNegotiationAbility || selectedLead.negotiationAbility,
                notes: editedNotes !== undefined ? editedNotes : selectedLead.notes,
            }

            setSelectedLead(updatedLead)

            toast({
                title: "Thành công",
                description: "Đã cập nhật thông tin",
            })

            // Exit edit mode and reset form
            setEditMode(false)
            resetEditForm()

            // Refresh kanban data
            fetchKanbanData()
        } catch (error) {
            console.error("[CampaignKanbanView] Error updating lead:", error)
            toast({
                title: "Lỗi",
                description: error instanceof Error ? error.message : "Không thể cập nhật thông tin",
                variant: "destructive",
            })
        } finally {
            setSaving(false)
        }
    }

    const resetEditForm = () => {
        setEditedPriceCustomer("")
        setEditedPriceHighestBid("")
        setEditedStage("")
        setEditedQualified("")
        setEditedIntentionLead("")
        setEditedNegotiationAbility("")
        setEditedNotes("")
    }

    const handleDialogClose = (open: boolean) => {
        setEditLeadDialogOpen(open)
        if (!open) {
            setEditMode(false)
            resetEditForm()
            setSelectedLead(null)
        }
    }

    // Process images for EditLeadDialog
    const processedImages = processImages(selectedLead)

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    <p className="text-sm text-gray-500">Đang tải...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="flex flex-col items-center gap-3 text-center">
                    <p className="text-red-500">{error}</p>
                    <Button variant="outline" size="sm" onClick={fetchKanbanData}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Thử lại
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full space-y-4">
            {/* Header with stats and search - Responsive */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-1">
                <div className="flex items-center gap-3 md:gap-4 text-sm">
                    <span className="flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-gray-400" />
                        Total: <strong>{stats.total}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Active: <strong className="text-green-600">{stats.active}</strong>
                    </span>
                </div>
                <div className="relative flex-1 md:flex-initial">
                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Tìm kiếm..."
                        className="pl-8 h-9 w-full md:w-64 text-sm"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Mobile Workflow Navigation - Only visible on mobile */}
            {workflows.length > 0 && (
                <div className="md:hidden flex items-center justify-between gap-2 px-1">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => setCurrentWorkflowIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentWorkflowIndex === 0}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="flex-1 h-9 justify-between"
                        onClick={() => setWorkflowSelectorOpen(true)}
                    >
                        <span className="font-medium">
                            {filteredWorkflows[currentWorkflowIndex]?.name || "Select Workflow"}
                        </span>
                        <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => setCurrentWorkflowIndex(prev => Math.min(filteredWorkflows.length - 1, prev + 1))}
                        disabled={currentWorkflowIndex === filteredWorkflows.length - 1}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Kanban Board */}
            {workflows.length === 0 ? (
                <div className="flex items-center justify-center h-[400px] text-center">
                    <div className="text-gray-400">
                        <p className="text-lg">Chưa có workflow instances</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Desktop view - Horizontal scroll */}
                    <ScrollArea className="hidden md:block w-full h-[calc(100vh-200px)]">
                        <div className="flex gap-6 pb-4">
                            {filteredWorkflows.map(workflow => (
                                <KanbanColumn
                                    key={workflow.id}
                                    workflow={workflow}
                                    onInstanceClick={handleInstanceClick}
                                    onTransition={handleTransition}
                                    onNote={handleOpenNote}
                                    onNoteUpdate={handleNoteUpdate}
                                    onOpenTransitionDialog={handleOpenTransitionDialog}
                                />
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>

                    {/* Mobile view - Single column slider */}
                    <div className="md:hidden w-full h-[calc(100vh-250px)]">
                        {filteredWorkflows[currentWorkflowIndex] && (
                            <KanbanColumn
                                workflow={filteredWorkflows[currentWorkflowIndex]}
                                onInstanceClick={handleInstanceClick}
                                onTransition={handleTransition}
                                onNote={handleOpenNote}
                                onNoteUpdate={handleNoteUpdate}
                                onOpenTransitionDialog={handleOpenTransitionDialog}
                            />
                        )}
                    </div>
                </>
            )}

            {/* Note Dialog */}
            <NoteDialog
                open={noteDialogOpen}
                onOpenChange={setNoteDialogOpen}
                leadId={selectedLeadForNote?.leadId || null}
                leadName={selectedLeadForNote?.leadName || null}
            />

            {/* Edit Lead Dialog */}
            <EditLeadDialog
                open={editLeadDialogOpen}
                onOpenChange={handleDialogClose}
                lead={selectedLead}
                editMode={editMode}
                setEditMode={setEditMode}
                editedPriceCustomer={editedPriceCustomer}
                setEditedPriceCustomer={setEditedPriceCustomer}
                editedPriceHighestBid={editedPriceHighestBid}
                setEditedPriceHighestBid={setEditedPriceHighestBid}
                editedStage={editedStage}
                setEditedStage={setEditedStage}
                editedQualified={editedQualified}
                setEditedQualified={setEditedQualified}
                editedIntentionLead={editedIntentionLead}
                setEditedIntentionLead={setEditedIntentionLead}
                editedNegotiationAbility={editedNegotiationAbility}
                setEditedNegotiationAbility={setEditedNegotiationAbility}
                editedNotes={editedNotes}
                setEditedNotes={setEditedNotes}
                processedImages={processedImages}
                onSave={handleSaveChanges}
                saving={saving}
                getStageStyle={getStageStyle}
            />

            {/* Transition Workflow Dialog */}
            <TransitionWorkflowDialog
                open={transitionDialogOpen}
                onOpenChange={(open) => {
                    setTransitionDialogOpen(open)
                    if (!open) setSelectedInstanceForTransition(null)
                }}
                instanceId={selectedInstanceForTransition?.id || ""}
                currentWorkflowName={selectedInstanceForTransition?.workflow_name || ""}
                carInfo={selectedInstanceForTransition ?
                    `${selectedInstanceForTransition.car_brand || ''} ${selectedInstanceForTransition.car_model || ''} ${selectedInstanceForTransition.car_year || ''}`.trim() || selectedInstanceForTransition.car_id
                    : ""}
                availableTransitions={selectedInstanceForTransition?.available_transitions || []}
                onTransition={handleTransition}
            />

            {/* Workflow Selector Bottom Sheet - Mobile only */}
            <Sheet open={workflowSelectorOpen} onOpenChange={setWorkflowSelectorOpen}>
                <SheetContent side="bottom" className="h-[60vh]">
                    <SheetHeader>
                        <SheetTitle>Select Workflow</SheetTitle>
                    </SheetHeader>
                    <div className="flex flex-col gap-2 mt-4 overflow-y-auto">
                        {filteredWorkflows.map((workflow, index) => (
                            <Button
                                key={workflow.id}
                                variant={currentWorkflowIndex === index ? "secondary" : "ghost"}
                                className="w-full justify-between h-auto py-3 px-4"
                                onClick={() => {
                                    setCurrentWorkflowIndex(index)
                                    setWorkflowSelectorOpen(false)
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${index % 4 === 0 ? "bg-orange-500" :
                                            index % 4 === 1 ? "bg-blue-500" :
                                                index % 4 === 2 ? "bg-green-500" :
                                                    "bg-purple-500"
                                        }`} />
                                    <span className="font-medium">{workflow.name}</span>
                                    <span className="text-sm text-gray-500">- {workflow.instances.length} items</span>
                                </div>
                                {currentWorkflowIndex === index && (
                                    <Check className="h-5 w-5" />
                                )}
                            </Button>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Loading overlay when fetching lead */}
            {loadingLead && (
                <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-4 flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        <span className="text-sm">Đang tải thông tin...</span>
                    </div>
                </div>
            )}
        </div>
    )
}
