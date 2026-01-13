"use client"

import { useRouter } from "next/navigation"
import { Suspense, useEffect, useState, useMemo, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Plus, Trash2, Layers, CheckCircle, Search, Settings, Activity, AlertTriangle, Car, X, Eye, GitBranch, Save, ChevronRight, ArrowRight, MoreHorizontal, Workflow, LayoutGrid, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { CampaignKanbanView } from "@/components/e2e/kanban/CampaignKanbanView"
import { NavigationHeader } from "@/components/e2e/layout/NavigationHeader"

// Types
interface WorkflowType { id: string; name: string; description: string; stage_id: string; sla_hours: number; is_active: boolean; tooltip: string | null }
interface WorkflowStep { id: string; workflow_id: string; step_name: string; step_order: number; is_automated: boolean; template: string | null }
interface Stage { id: string; name: string }
interface Transition { id: string; from_workflow_id: string; to_workflow_id: string; condition_logic: string; priority: number; transition_sla_hours?: number }
interface WorkflowInstance { id: string; car_id: string; workflow_id: string; status: string; started_at: string; completed_at?: string }

// Node position for flow diagram
interface NodePosition { x: number; y: number }

function WorkflowManagementContent() {
    const router = useRouter()
    const { toast } = useToast()

    const [mainTab, setMainTab] = useState<"flow" | "monitor">("flow")
    const [workflows, setWorkflows] = useState<WorkflowType[]>([])
    const [steps, setSteps] = useState<WorkflowStep[]>([])
    const [allSteps, setAllSteps] = useState<WorkflowStep[]>([])
    const [stages, setStages] = useState<Stage[]>([])
    const [transitions, setTransitions] = useState<Transition[]>([])
    const [instances, setInstances] = useState<WorkflowInstance[]>([])
    const [selectedStage, setSelectedStage] = useState<Stage | null>(null)
    const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>(null)
    const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null)
    const [monitorSearch, setMonitorSearch] = useState("")
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Dialog states
    const [createWorkflowOpen, setCreateWorkflowOpen] = useState(false)
    const [createStepOpen, setCreateStepOpen] = useState(false)
    const [createTransitionOpen, setCreateTransitionOpen] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{ type: string, item: any } | null>(null)

    // Form states
    const [editingStep, setEditingStep] = useState<Partial<WorkflowStep> | null>(null)
    const [editingWorkflow, setEditingWorkflow] = useState<Partial<WorkflowType> | null>(null)
    const [workflowForm, setWorkflowForm] = useState<Partial<WorkflowType>>({})
    const [stepForm, setStepForm] = useState<Partial<WorkflowStep>>({})
    const [transitionForm, setTransitionForm] = useState<Partial<Transition>>({})

    // Flow diagram node positions
    const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({})

    // Right panel resize state
    const [panelWidth, setPanelWidth] = useState(450)
    const [isResizing, setIsResizing] = useState(false)

    useEffect(() => { fetchAllData() }, [])

    useEffect(() => {
        if (selectedStage) {
            const wfs = workflows.filter(w => w.stage_id === selectedStage.id)
            if (wfs.length > 0 && (!selectedWorkflow || selectedWorkflow.stage_id !== selectedStage.id)) {
                setSelectedWorkflow(wfs[0])
            } else if (wfs.length === 0) {
                setSelectedWorkflow(null)
            }
        }
    }, [selectedStage, workflows])

    useEffect(() => {
        if (selectedWorkflow) fetchSteps(selectedWorkflow.id)
        else { setSteps([]); setSelectedStep(null); setEditingStep(null); setEditingWorkflow(null) }
    }, [selectedWorkflow])

    // Calculate node positions for flow diagram - horizontal layout
    useEffect(() => {
        if (workflows.length === 0) return

        const positions: Record<string, NodePosition> = {}

        // Arrange workflows horizontally in a row
        workflows.forEach((wf, idx) => {
            positions[wf.id] = {
                x: 30 + idx * 280,
                y: 30
            }
        })

        setNodePositions(positions)
    }, [workflows])

    async function fetchAllData() {
        setLoading(true)
        try {
            const [wfRes, stRes, trRes, instRes, stepsRes] = await Promise.all([
                fetch("/api/e2e/tables/workflows?limit=100"),
                fetch("/api/e2e/tables/workflow_stages?limit=100"),
                fetch("/api/e2e/tables/workflow_transitions?limit=100"),
                fetch("/api/e2e/tables/workflow_instances?limit=100&orderBy=started_at&orderDir=desc"),
                fetch("/api/e2e/tables/workflow_steps?limit=500")
            ])
            const [wfData, stData, trData, instData, stepsData] = await Promise.all([wfRes.json(), stRes.json(), trRes.json(), instRes.json(), stepsRes.json()])
            if (stData.success) { setStages(stData.data); if (!selectedStage && stData.data.length > 0) setSelectedStage(stData.data[0]) }
            if (wfData.success) setWorkflows(wfData.data)
            if (trData.success) setTransitions(trData.data)
            if (instData.success) setInstances(instData.data)
            if (stepsData.success) setAllSteps(stepsData.data)
        } catch (error) { console.error("Error:", error) }
        finally { setLoading(false) }
    }

    async function fetchSteps(workflowId: string) {
        const filtered = allSteps.filter((s: WorkflowStep) => s.workflow_id === workflowId).sort((a: WorkflowStep, b: WorkflowStep) => a.step_order - b.step_order)
        setSteps(filtered)
        setSelectedStep(null)
        setEditingStep(null)
    }

    const filteredWorkflows = useMemo(() => selectedStage ? workflows.filter(w => w.stage_id === selectedStage.id) : [], [workflows, selectedStage])
    const getWorkflowTransitions = (workflowId: string) => transitions.filter(t => t.from_workflow_id === workflowId)
    const getWorkflowSteps = (workflowId: string) => allSteps.filter(s => s.workflow_id === workflowId).sort((a, b) => a.step_order - b.step_order)

    // CRUD Handlers
    async function handleCreateWorkflow() {
        setSaving(true)
        try {
            const res = await fetch("/api/e2e/tables/workflows", { method: "POST", body: JSON.stringify({ ...workflowForm, stage_id: selectedStage?.id }), headers: { "Content-Type": "application/json" } })
            if ((await res.json()).success) { toast({ title: "Thành công" }); setCreateWorkflowOpen(false); fetchAllData() }
        } finally { setSaving(false) }
    }

    async function handleCreateStep() {
        if (!selectedWorkflow) return
        setSaving(true)
        try {
            const res = await fetch("/api/e2e/tables/workflow_steps", { method: "POST", body: JSON.stringify({ ...stepForm, workflow_id: selectedWorkflow.id, step_order: steps.length + 1 }), headers: { "Content-Type": "application/json" } })
            if ((await res.json()).success) { toast({ title: "Thành công" }); setCreateStepOpen(false); fetchAllData() }
        } finally { setSaving(false) }
    }

    async function handleCreateTransition() {
        if (!selectedWorkflow) return
        setSaving(true)
        try {
            const res = await fetch("/api/e2e/tables/workflow_transitions", {
                method: "POST",
                body: JSON.stringify({ ...transitionForm, from_workflow_id: selectedWorkflow.id, priority: transitionForm.priority || 1 }),
                headers: { "Content-Type": "application/json" }
            })
            if ((await res.json()).success) {
                toast({ title: "Thành công" })
                setCreateTransitionOpen(false)
                setTransitionForm({})
                fetchAllData()
            }
        } finally { setSaving(false) }
    }

    async function handleSaveStep() {
        if (!editingStep || !selectedStep) return
        setSaving(true)
        try {
            const res = await fetch("/api/e2e/tables/workflow_steps", { method: "PUT", body: JSON.stringify({ ...editingStep, id: selectedStep.id }), headers: { "Content-Type": "application/json" } })
            if ((await res.json()).success) { toast({ title: "Đã lưu" }); fetchAllData() }
        } finally { setSaving(false) }
    }

    async function handleSaveWorkflow() {
        if (!editingWorkflow || !selectedWorkflow) return
        setSaving(true)
        try {
            const res = await fetch("/api/e2e/tables/workflows", { method: "PUT", body: JSON.stringify({ ...editingWorkflow, id: selectedWorkflow.id }), headers: { "Content-Type": "application/json" } })
            if ((await res.json()).success) {
                toast({ title: "Đã lưu workflow" })
                setEditingWorkflow(null)
                fetchAllData()
            }
        } finally { setSaving(false) }
    }

    async function handleDelete() {
        if (!deleteTarget) return
        setSaving(true)
        try {
            const tableName = deleteTarget.type === "workflow" ? "workflows" : deleteTarget.type === "transition" ? "workflow_transitions" : "workflow_steps"
            const res = await fetch(`/api/e2e/tables/${tableName}?id=${deleteTarget.item.id}`, { method: "DELETE" })
            if ((await res.json()).success) {
                toast({ title: "Đã xóa" })
                setDeleteConfirmOpen(false)
                fetchAllData()
            }
        } finally { setSaving(false) }
    }

    function selectStepForEdit(step: WorkflowStep) {
        setSelectedStep(step)
        setEditingStep({ step_name: step.step_name, step_order: step.step_order, is_automated: step.is_automated, template: step.template })
    }

    function selectWorkflowInFlow(wf: WorkflowType) {
        setSelectedWorkflow(wf)
        setSelectedStep(null)
        setEditingStep(null)
        setEditingWorkflow(null)
    }

    const filteredInstances = useMemo(() => monitorSearch ? instances.filter(i => i.car_id.toLowerCase().includes(monitorSearch.toLowerCase())) : instances, [instances, monitorSearch])
    const stats = useMemo(() => ({ total: instances.length, active: instances.filter(i => i.status === 'running').length, completed: instances.filter(i => i.status === 'completed').length, failed: instances.filter(i => i.status === 'failed' || i.status === 'terminated').length }), [instances])

    // Handle panel resize
    const handleMouseDown = () => {
        setIsResizing(true)
    }

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return
            const newWidth = window.innerWidth - e.clientX
            if (newWidth >= 350 && newWidth <= 800) {
                setPanelWidth(newWidth)
            }
        }

        const handleMouseUp = () => {
            setIsResizing(false)
        }

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing])

    function handleNavTabChange(value: string) {
        if (value === "dashboard") router.push("/")
        else if (value === "campaigns") router.push("/decoy-management")
        else if (value === "e2e") router.push(`/e2e/${localStorage.getItem("e2e-selectedAccount") || "placeholder"}?tab=priority&page=1`)
    }

    // Get stage name
    const getStageName = (stageId: string) => stages.find(s => s.id === stageId)?.name || "Unknown"

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin h-6 w-6 border-2 border-gray-400 border-t-transparent rounded-full" /></div>

    return (
        <div className={`w-full ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
            {/* Navigation Header */}
            <Tabs value="workflow" onValueChange={handleNavTabChange}>
                <NavigationHeader
                    currentPage="workflow"
                    viewMode={mainTab === "flow" ? "list" : "kanban"}
                    onViewModeChange={(mode) => setMainTab(mode === "list" ? "flow" : "monitor")}
                    showViewToggle={true}
                />

                <TabsContent value="workflow" className="mt-0">
                    <div className="flex h-[calc(100vh-100px)] bg-gray-50">


                        {/* ============ FLOW VIEW (Diagram) ============ */}
                        {mainTab === "flow" && (
                            <div className="flex w-full">
                                {/* LEFT: Flow Diagram Canvas */}
                                <div className="flex-1 relative overflow-auto" style={{ background: 'linear-gradient(to right, #f9fafb 1px, transparent 1px), linear-gradient(to bottom, #f9fafb 1px, transparent 1px)', backgroundSize: '20px 20px', backgroundColor: '#fafafa' }}>


                                    {/* SVG for connection lines */}
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minHeight: 800, minWidth: stages.length * 280 }}>
                                        <defs>
                                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                                <polygon points="0 0, 10 3.5, 0 7" fill="#a855f7" />
                                            </marker>
                                        </defs>
                                        {transitions.map(t => {
                                            const fromPos = nodePositions[t.from_workflow_id]
                                            const toPos = nodePositions[t.to_workflow_id]
                                            if (!fromPos || !toPos) return null

                                            // Offset for node center (half of ~120px card height)
                                            const startX = fromPos.x + 240
                                            const startY = fromPos.y + 60
                                            const endX = toPos.x
                                            const endY = toPos.y + 60

                                            // Curved path
                                            const midX = (startX + endX) / 2
                                            const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`

                                            return (
                                                <g key={t.id}>
                                                    <path d={path} stroke="#a855f7" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" />
                                                    {typeof t.condition_logic === 'string' && (
                                                        <text x={midX} y={(startY + endY) / 2 - 8} textAnchor="middle" fontSize="10" fill="#a855f7">{t.condition_logic}</text>
                                                    )}
                                                </g>
                                            )
                                        })}
                                    </svg>

                                    {/* Workflow Nodes */}
                                    <div className="relative p-4" style={{ minHeight: 800, minWidth: stages.length * 280 }}>
                                        {workflows.map(wf => {
                                            const pos = nodePositions[wf.id]
                                            if (!pos) return null
                                            const isSelected = selectedWorkflow?.id === wf.id
                                            const wfSteps = getWorkflowSteps(wf.id)
                                            const wfTransitions = getWorkflowTransitions(wf.id)

                                            return (
                                                <div
                                                    key={wf.id}
                                                    onClick={() => selectWorkflowInFlow(wf)}
                                                    className={cn(
                                                        "absolute w-[240px] bg-white rounded-xl border-2 shadow-sm cursor-pointer transition-all hover:shadow-md",
                                                        isSelected ? "border-purple-400 shadow-purple-100" : "border-gray-200"
                                                    )}
                                                    style={{ left: pos.x, top: pos.y }}
                                                >
                                                    {/* Node Header */}
                                                    <div className={cn("px-4 py-3 rounded-t-xl border-b", isSelected ? "bg-purple-50" : "bg-gray-50")}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", isSelected ? "bg-purple-500" : "bg-gray-400")}>
                                                                    <Workflow className="h-4 w-4 text-white" />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-xs text-gray-400 truncate">{getStageName(wf.stage_id)}</p>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <p className="text-sm font-semibold text-gray-900 truncate">{wf.name}</p>
                                                                        {wf.tooltip && (
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help flex-shrink-0" />
                                                                                </TooltipTrigger>
                                                                                <TooltipContent side="right" className="max-w-xs">
                                                                                    <p className="whitespace-pre-wrap">{wf.tooltip}</p>
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Badge variant={wf.is_active ? "default" : "secondary"} className={cn("text-xs flex-shrink-0 ml-2", wf.is_active && "bg-emerald-500")}>{wf.is_active ? "Bật" : "Tắt"}</Badge>
                                                        </div>
                                                    </div>

                                                    {/* Node Body */}
                                                    <div className="px-4 py-3 space-y-2">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-gray-500">SLA</span>
                                                            <span className="font-medium text-gray-700">{wf.sla_hours} giờ</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-gray-500">Các bước</span>
                                                            <span className="font-medium text-gray-700">{wfSteps.length}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-gray-500">Transitions</span>
                                                            <span className="font-medium text-purple-600">{wfTransitions.length}</span>
                                                        </div>
                                                    </div>

                                                    {/* Add transition button */}
                                                    {isSelected && (
                                                        <div className="absolute -right-3 top-1/2 -translate-y-1/2">
                                                            <button onClick={(e) => { e.stopPropagation(); setTransitionForm({}); setCreateTransitionOpen(true) }} className="w-6 h-6 bg-purple-500 hover:bg-purple-600 text-white rounded-full flex items-center justify-center shadow-md">
                                                                <Plus className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* RIGHT: Details Panel */}
                                <div
                                    className="bg-white border-l flex flex-col overflow-hidden relative"
                                    style={{ width: `${panelWidth}px`, minWidth: '350px', maxWidth: '800px' }}
                                >
                                    {/* Resize Handle */}
                                    <div
                                        className={`absolute left-0 top-0 bottom-0 w-1 hover:w-2 cursor-col-resize group z-10 ${isResizing ? 'bg-blue-500 w-2' : 'bg-gray-200 hover:bg-blue-400'} transition-all`}
                                        onMouseDown={handleMouseDown}
                                        style={{ marginLeft: '-1px' }}
                                    >
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-blue-500 rounded-r opacity-50 group-hover:opacity-100 transition-opacity shadow-sm"></div>
                                    </div>
                                    <div className="p-4 border-b flex-shrink-0">
                                        <div className="flex items-center gap-2">
                                            {selectedWorkflow ? (
                                                <>
                                                    <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
                                                        <Workflow className="h-5 w-5 text-white" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-semibold text-gray-900 truncate">{selectedWorkflow.name}</p>
                                                        <p className="text-xs text-gray-400 truncate">{getStageName(selectedWorkflow.stage_id)}</p>
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="text-sm text-gray-400">Chọn một workflow</p>
                                            )}
                                        </div>
                                    </div>

                                    {selectedWorkflow && (
                                        <ScrollArea className="flex-1 overflow-y-auto">
                                            <div className="p-4 space-y-6">
                                                {/* Workflow Details */}
                                                <div>
                                                    <div className="mb-3">
                                                        <div className="flex items-center justify-between gap-2 mb-2">
                                                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Thông tin Workflow</p>
                                                            {!editingWorkflow ? (
                                                                <Button size="sm" variant="outline" onClick={() => setEditingWorkflow({ name: selectedWorkflow.name, sla_hours: selectedWorkflow.sla_hours, is_active: selectedWorkflow.is_active, tooltip: selectedWorkflow.tooltip })} className="h-6 text-xs">Sửa</Button>
                                                            ) : (
                                                                <div className="flex gap-2">
                                                                    <Button size="sm" variant="ghost" onClick={() => setEditingWorkflow(null)} className="h-6 text-xs">Hủy</Button>
                                                                    <Button size="sm" onClick={handleSaveWorkflow} disabled={saving} className="h-6 text-xs">Lưu</Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {!editingWorkflow ? (
                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                                <span className="text-sm text-gray-600">Trạng thái</span>
                                                                <Badge variant={selectedWorkflow.is_active ? "default" : "secondary"} className={cn("text-xs", selectedWorkflow.is_active && "bg-emerald-500")}>{selectedWorkflow.is_active ? "Bật" : "Tắt"}</Badge>
                                                            </div>
                                                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                                <span className="text-sm text-gray-600">SLA</span>
                                                                <span className="text-sm font-medium text-gray-900">{selectedWorkflow.sla_hours} giờ</span>
                                                            </div>
                                                            {selectedWorkflow.tooltip && (
                                                                <div className="p-3 bg-gray-50 rounded-lg">
                                                                    <span className="text-sm text-gray-600 block mb-1">Tooltip</span>
                                                                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedWorkflow.tooltip}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                            <div>
                                                                <Label className="text-xs text-gray-500">Tên workflow</Label>
                                                                <Input value={editingWorkflow.name || ""} onChange={e => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })} className="mt-1 h-9 bg-white" />
                                                            </div>
                                                            <div>
                                                                <Label className="text-xs text-gray-500">Tooltip</Label>
                                                                <Textarea value={editingWorkflow.tooltip || ""} onChange={e => setEditingWorkflow({ ...editingWorkflow, tooltip: e.target.value })} className="mt-1 bg-white min-h-[60px]" placeholder="Mô tả ngắn gọn (có thể xuống dòng)" />
                                                            </div>
                                                            <div>
                                                                <Label className="text-xs text-gray-500">SLA (giờ)</Label>
                                                                <Input type="number" value={editingWorkflow.sla_hours || 24} onChange={e => setEditingWorkflow({ ...editingWorkflow, sla_hours: parseInt(e.target.value) })} className="mt-1 h-9 bg-white" />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Switch checked={editingWorkflow.is_active} onCheckedChange={c => setEditingWorkflow({ ...editingWorkflow, is_active: c })} />
                                                                <span className="text-sm text-gray-600">{editingWorkflow.is_active ? "Bật" : "Tắt"}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Steps */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Các bước ({steps.length})</p>
                                                        <button onClick={() => { setStepForm({ is_automated: false }); setCreateStepOpen(true) }} className="text-xs text-purple-600 hover:text-purple-700 font-medium">+ Thêm</button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {steps.map(step => (
                                                            <div
                                                                key={step.id}
                                                                onClick={() => selectStepForEdit(step)}
                                                                className={cn(
                                                                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                                                                    selectedStep?.id === step.id ? "bg-purple-50 border-purple-200" : "bg-white border-gray-100 hover:border-gray-200"
                                                                )}
                                                            >
                                                                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium", selectedStep?.id === step.id ? "bg-purple-500 text-white" : "bg-gray-200 text-gray-600")}>{step.step_order}</div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <p className="text-sm font-medium text-gray-900 truncate">{step.step_name}</p>
                                                                        {step.template && <Badge variant="outline" className="text-[9px] h-4 px-1 bg-blue-50 text-blue-600 border-blue-200">T</Badge>}
                                                                    </div>
                                                                    <p className="text-xs text-gray-400">{step.is_automated ? "Tự động" : "Thủ công"}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {steps.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Chưa có bước nào</p>}
                                                    </div>
                                                </div>

                                                {/* Step Detail Editor */}
                                                {selectedStep && editingStep && (
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Chi tiết bước</p>
                                                        <div className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                                                            <div>
                                                                <Label className="text-xs text-gray-500">Tên bước</Label>
                                                                <Input value={editingStep.step_name || ""} onChange={e => setEditingStep({ ...editingStep, step_name: e.target.value })} className="mt-1 h-9 bg-white" />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Switch checked={editingStep.is_automated} onCheckedChange={c => setEditingStep({ ...editingStep, is_automated: c })} />
                                                                <span className="text-sm text-gray-600">{editingStep.is_automated ? "Tự động" : "Thủ công"}</span>
                                                            </div>
                                                            <div>
                                                                <Label className="text-xs text-gray-500">Template</Label>
                                                                <div className="flex flex-wrap gap-1 mb-2 p-2 bg-gray-50 rounded border border-gray-200">
                                                                    {[
                                                                        { key: '{{display_name}}', label: 'Tên xe' },
                                                                        { key: '{{year}}', label: 'Năm' },
                                                                        { key: '{{similar_car}}', label: 'Xe tương tự' },
                                                                        { key: '{{similar_year}}', label: 'Năm tương tự' },
                                                                        { key: '{{price_reference}}', label: 'Giá tham khảo' },
                                                                        { key: '{{price_range}}', label: 'Khoảng giá' },
                                                                        { key: '{{session_url}}', label: 'Link phiên' },
                                                                        { key: '{{mileage}}', label: 'Số km' }
                                                                    ].map(item => (
                                                                        <button
                                                                            key={item.key}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const textarea = document.getElementById('edit-step-template') as HTMLTextAreaElement
                                                                                if (textarea) {
                                                                                    const start = textarea.selectionStart
                                                                                    const end = textarea.selectionEnd
                                                                                    const text = editingStep.template || ''
                                                                                    const newText = text.substring(0, start) + item.key + text.substring(end)
                                                                                    setEditingStep({ ...editingStep, template: newText })
                                                                                    setTimeout(() => {
                                                                                        textarea.focus()
                                                                                        textarea.setSelectionRange(start + item.key.length, start + item.key.length)
                                                                                    }, 0)
                                                                                }
                                                                            }}
                                                                            className="px-2 py-1 text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 rounded border border-blue-300 cursor-pointer transition-colors"
                                                                        >
                                                                            {item.label}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                <Textarea
                                                                    id="edit-step-template"
                                                                    value={editingStep.template || ""}
                                                                    onChange={e => setEditingStep({ ...editingStep, template: e.target.value })}
                                                                    className="mt-1 bg-white min-h-[80px]"
                                                                    placeholder="Mẫu nội dung cho bước này (tuỳ chọn)"
                                                                />
                                                            </div>
                                                            <div className="flex gap-2 pt-2">
                                                                <Button size="sm" className="flex-1 h-8" onClick={handleSaveStep} disabled={saving}><Save className="h-3 w-3 mr-1" /> Lưu</Button>
                                                                <Button size="sm" variant="ghost" className="h-8 text-red-500 hover:text-red-600" onClick={() => { setDeleteTarget({ type: "step", item: selectedStep }); setDeleteConfirmOpen(true) }}><Trash2 className="h-3 w-3" /></Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Transitions */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Transitions ({getWorkflowTransitions(selectedWorkflow.id).length})</p>
                                                        <button onClick={() => { setTransitionForm({}); setCreateTransitionOpen(true) }} className="text-xs text-purple-600 hover:text-purple-700 font-medium">+ Thêm</button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {getWorkflowTransitions(selectedWorkflow.id).map(t => {
                                                            const toWf = workflows.find(w => w.id === t.to_workflow_id)
                                                            return (
                                                                <div key={t.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100 group">
                                                                    <div className="flex items-center gap-2">
                                                                        <ArrowRight className="h-4 w-4 text-purple-500" />
                                                                        <span className="text-sm font-medium text-purple-700">{toWf?.name}</span>
                                                                    </div>
                                                                    <button onClick={() => { setDeleteTarget({ type: "transition", item: t }); setDeleteConfirmOpen(true) }} className="text-purple-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-4 w-4" /></button>
                                                                </div>
                                                            )
                                                        })}
                                                        {getWorkflowTransitions(selectedWorkflow.id).length === 0 && <p className="text-xs text-gray-400 text-center py-4">Không có transition</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ============ MONITOR VIEW (Kanban) ============ */}
                        {mainTab === "monitor" && (
                            <div className="flex-1 p-4">
                                <CampaignKanbanView picId="" />
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            <Dialog open={createWorkflowOpen} onOpenChange={setCreateWorkflowOpen}>
                <DialogContent><DialogHeader><DialogTitle>Tạo Workflow trong {selectedStage?.name}</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <div><Label className="text-xs">Tên</Label><Input value={workflowForm.name || ""} onChange={e => setWorkflowForm({ ...workflowForm, name: e.target.value })} className="mt-1" /></div>
                        <div><Label className="text-xs">Tooltip (mô tả ngắn gọn)</Label><Textarea value={workflowForm.tooltip || ""} onChange={e => setWorkflowForm({ ...workflowForm, tooltip: e.target.value })} className="mt-1 min-h-[60px]" placeholder="Thông tin hiển thị khi hover (có thể xuống dòng)" /></div>
                        <div className="grid grid-cols-2 gap-3"><div><Label className="text-xs">SLA (giờ)</Label><Input type="number" value={workflowForm.sla_hours || 24} onChange={e => setWorkflowForm({ ...workflowForm, sla_hours: parseInt(e.target.value) })} className="mt-1" /></div><div className="flex items-end pb-1"><div className="flex items-center gap-2"><Switch checked={workflowForm.is_active} onCheckedChange={c => setWorkflowForm({ ...workflowForm, is_active: c })} /><Label className="text-xs">Hoạt động</Label></div></div></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setCreateWorkflowOpen(false)}>Hủy</Button><Button onClick={handleCreateWorkflow} disabled={saving}>Tạo</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={createStepOpen} onOpenChange={setCreateStepOpen}>
                <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Thêm bước vào {selectedWorkflow?.name}</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <div><Label className="text-xs">Tên bước</Label><Input value={stepForm.step_name || ""} onChange={e => setStepForm({ ...stepForm, step_name: e.target.value })} className="mt-1" /></div>
                        <div className="flex items-center gap-2"><Switch checked={stepForm.is_automated} onCheckedChange={c => setStepForm({ ...stepForm, is_automated: c })} /><Label className="text-xs">Tự động</Label></div>
                        <div>
                            <Label className="text-xs">Template</Label>
                            <div className="flex flex-wrap gap-1 mb-2 p-2 bg-gray-50 rounded border border-gray-200">
                                {[
                                    { key: '{{display_name}}', label: 'Tên xe' },
                                    { key: '{{year}}', label: 'Năm' },
                                    { key: '{{similar_car}}', label: 'Xe tương tự' },
                                    { key: '{{similar_year}}', label: 'Năm tương tự' },
                                    { key: '{{price_reference}}', label: 'Giá tham khảo' },
                                    { key: '{{price_range}}', label: 'Khoảng giá' },
                                    { key: '{{session_url}}', label: 'Link phiên' },
                                    { key: '{{mileage}}', label: 'Số km' }
                                ].map(item => (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => {
                                            const textarea = document.getElementById('create-step-template') as HTMLTextAreaElement
                                            if (textarea) {
                                                const start = textarea.selectionStart
                                                const end = textarea.selectionEnd
                                                const text = stepForm.template || ''
                                                const newText = text.substring(0, start) + item.key + text.substring(end)
                                                setStepForm({ ...stepForm, template: newText })
                                                setTimeout(() => {
                                                    textarea.focus()
                                                    textarea.setSelectionRange(start + item.key.length, start + item.key.length)
                                                }, 0)
                                            }
                                        }}
                                        className="px-2 py-1 text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 rounded border border-blue-300 cursor-pointer transition-colors"
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                            <Textarea
                                id="create-step-template"
                                value={stepForm.template || ""}
                                onChange={e => setStepForm({ ...stepForm, template: e.target.value })}
                                className="mt-1 min-h-[80px]"
                                placeholder="Mẫu nội dung cho bước này (tuỳ chọn)"
                            />
                        </div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setCreateStepOpen(false)}>Hủy</Button><Button onClick={handleCreateStep} disabled={saving}>Thêm</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={createTransitionOpen} onOpenChange={setCreateTransitionOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Thêm Transition từ {selectedWorkflow?.name}</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <Label className="text-xs">Đến Workflow</Label>
                            <Select value={transitionForm.to_workflow_id || ""} onValueChange={v => setTransitionForm({ ...transitionForm, to_workflow_id: v })}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Chọn workflow đích" /></SelectTrigger>
                                <SelectContent>{workflows.filter(w => w.id !== selectedWorkflow?.id).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div><Label className="text-xs">Điều kiện (condition_logic)</Label><Input value={transitionForm.condition_logic || ""} onChange={e => setTransitionForm({ ...transitionForm, condition_logic: e.target.value })} className="mt-1" placeholder="VD: outcome = 'success'" /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><Label className="text-xs">Ưu tiên</Label><Input type="number" value={transitionForm.priority || 1} onChange={e => setTransitionForm({ ...transitionForm, priority: parseInt(e.target.value) })} className="mt-1" /></div>
                            <div><Label className="text-xs">SLA (giờ)</Label><Input type="number" value={transitionForm.transition_sla_hours || ""} onChange={e => setTransitionForm({ ...transitionForm, transition_sla_hours: parseInt(e.target.value) || undefined })} className="mt-1" placeholder="Optional" /></div>
                        </div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setCreateTransitionOpen(false)}>Hủy</Button><Button onClick={handleCreateTransition} disabled={saving || !transitionForm.to_workflow_id}>Tạo</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">Xóa</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>

            <Toaster />
        </div>
    )
}

export default function WorkflowManagementPage() {
    return <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin h-6 w-6 border-2 border-gray-400 border-t-transparent rounded-full" /></div>}><WorkflowManagementContent /></Suspense>
}
