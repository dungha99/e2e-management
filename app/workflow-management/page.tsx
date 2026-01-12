"use client"

import { useRouter } from "next/navigation"
import { Suspense, useEffect, useState, useMemo, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Layers, CheckCircle, Search, Settings, Activity, AlertTriangle, Car, X, Eye, GitBranch, Save, ChevronRight, ArrowRight, MoreHorizontal, Workflow, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"
import { CampaignKanbanView } from "@/components/e2e/kanban/CampaignKanbanView"
import { NavigationHeader } from "@/components/e2e/layout/NavigationHeader"

// Types
interface WorkflowType { id: string; name: string; description: string; stage_id: string; sla_hours: number; is_active: boolean }
interface WorkflowStep { id: string; workflow_id: string; connector_id?: string; step_name: string; step_order: number; is_automated: boolean; input_mapping?: any; output_mapping?: any; retry_policy?: any; timeout_ms?: number; sla_hours?: number }
interface Stage { id: string; name: string }
interface Transition { id: string; from_workflow_id: string; to_workflow_id: string; condition_logic: string; priority: number; transition_sla_hours?: number }
interface WorkflowInstance { id: string; car_id: string; workflow_id: string; status: string; started_at: string; completed_at?: string }
interface ApiConnector { id: string; name: string; base_url: string; method: string; auth_config?: any; input_schema?: any; output_schema?: any }

// Node position for flow diagram
interface NodePosition { x: number; y: number }

function WorkflowManagementContent() {
    const router = useRouter()
    const { toast } = useToast()

    const [mainTab, setMainTab] = useState<"flow" | "monitor">("flow")
    const [flowSubTab, setFlowSubTab] = useState<"workflows" | "apis">("workflows")
    const [workflows, setWorkflows] = useState<WorkflowType[]>([])
    const [steps, setSteps] = useState<WorkflowStep[]>([])
    const [allSteps, setAllSteps] = useState<WorkflowStep[]>([])
    const [stages, setStages] = useState<Stage[]>([])
    const [transitions, setTransitions] = useState<Transition[]>([])
    const [instances, setInstances] = useState<WorkflowInstance[]>([])
    const [apiConnectors, setApiConnectors] = useState<ApiConnector[]>([])
    const [selectedStage, setSelectedStage] = useState<Stage | null>(null)
    const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>(null)
    const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null)
    const [selectedApiConnector, setSelectedApiConnector] = useState<ApiConnector | null>(null)
    const [monitorSearch, setMonitorSearch] = useState("")
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Dialog states
    const [createWorkflowOpen, setCreateWorkflowOpen] = useState(false)
    const [createStepOpen, setCreateStepOpen] = useState(false)
    const [createTransitionOpen, setCreateTransitionOpen] = useState(false)
    const [createApiConnectorOpen, setCreateApiConnectorOpen] = useState(false)
    const [editApiConnectorOpen, setEditApiConnectorOpen] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{ type: string, item: any } | null>(null)

    // Form states
    const [editingStep, setEditingStep] = useState<Partial<WorkflowStep> | null>(null)
    const [workflowForm, setWorkflowForm] = useState<Partial<WorkflowType>>({})
    const [stepForm, setStepForm] = useState<Partial<WorkflowStep>>({})
    const [transitionForm, setTransitionForm] = useState<Partial<Transition>>({})
    const [apiConnectorForm, setApiConnectorForm] = useState<Partial<ApiConnector>>({})
    const [editingApiConnector, setEditingApiConnector] = useState<Partial<ApiConnector> | null>(null)

    // Flow diagram node positions
    const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({})

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
        else { setSteps([]); setSelectedStep(null); setEditingStep(null) }
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
            const [wfRes, stRes, trRes, instRes, stepsRes, apiRes] = await Promise.all([
                fetch("/api/e2e/tables/workflows?limit=100"),
                fetch("/api/e2e/tables/workflow_stages?limit=100"),
                fetch("/api/e2e/tables/workflow_transitions?limit=100"),
                fetch("/api/e2e/tables/workflow_instances?limit=100&orderBy=started_at&orderDir=desc"),
                fetch("/api/e2e/tables/workflow_steps?limit=500"),
                fetch("/api/e2e/tables/api_connectors?limit=100")
            ])
            const [wfData, stData, trData, instData, stepsData, apiData] = await Promise.all([wfRes.json(), stRes.json(), trRes.json(), instRes.json(), stepsRes.json(), apiRes.json()])
            if (stData.success) { setStages(stData.data); if (!selectedStage && stData.data.length > 0) setSelectedStage(stData.data[0]) }
            if (wfData.success) setWorkflows(wfData.data)
            if (trData.success) setTransitions(trData.data)
            if (instData.success) setInstances(instData.data)
            if (stepsData.success) setAllSteps(stepsData.data)
            if (apiData.success) setApiConnectors(apiData.data)
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

    async function handleDelete() {
        if (!deleteTarget) return
        setSaving(true)
        try {
            const tableName = deleteTarget.type === "workflow" ? "workflows" : deleteTarget.type === "transition" ? "workflow_transitions" : deleteTarget.type === "api_connector" ? "api_connectors" : "workflow_steps"
            const res = await fetch(`/api/e2e/tables/${tableName}?id=${deleteTarget.item.id}`, { method: "DELETE" })
            if ((await res.json()).success) {
                toast({ title: "Đã xóa" })
                setDeleteConfirmOpen(false)
                setDeleteTarget(null)
                if (deleteTarget.type === "api_connector") {
                    setSelectedApiConnector(null)
                    setEditingApiConnector(null)
                }
                fetchAllData()
            }
        } finally { setSaving(false) }
    }

    async function handleCreateApiConnector() {
        setSaving(true)
        try {
            const res = await fetch("/api/e2e/tables/api_connectors", {
                method: "POST",
                body: JSON.stringify(apiConnectorForm),
                headers: { "Content-Type": "application/json" }
            })
            if ((await res.json()).success) {
                toast({ title: "Thành công" })
                setCreateApiConnectorOpen(false)
                setApiConnectorForm({})
                fetchAllData()
            }
        } finally { setSaving(false) }
    }

    async function handleSaveApiConnector() {
        if (!editingApiConnector || !selectedApiConnector) return
        setSaving(true)
        try {
            const res = await fetch("/api/e2e/tables/api_connectors", {
                method: "PUT",
                body: JSON.stringify({ ...editingApiConnector, id: selectedApiConnector.id }),
                headers: { "Content-Type": "application/json" }
            })
            if ((await res.json()).success) {
                toast({ title: "Đã lưu" })
                fetchAllData()
            }
        } finally { setSaving(false) }
    }

    function selectApiConnectorForEdit(connector: ApiConnector) {
        setSelectedApiConnector(connector)
        setEditingApiConnector({
            name: connector.name,
            base_url: connector.base_url,
            method: connector.method,
            auth_config: connector.auth_config,
            input_schema: connector.input_schema,
            output_schema: connector.output_schema
        })
    }

    function selectStepForEdit(step: WorkflowStep) {
        setSelectedStep(step)
        setEditingStep({
            step_name: step.step_name,
            step_order: step.step_order,
            is_automated: step.is_automated,
            connector_id: step.connector_id,
            input_mapping: step.input_mapping,
            output_mapping: step.output_mapping,
            retry_policy: step.retry_policy,
            timeout_ms: step.timeout_ms,
            sla_hours: step.sla_hours
        })
    }

    function selectWorkflowInFlow(wf: WorkflowType) {
        setSelectedWorkflow(wf)
        setSelectedStep(null)
        setEditingStep(null)
    }

    const filteredInstances = useMemo(() => monitorSearch ? instances.filter(i => i.car_id.toLowerCase().includes(monitorSearch.toLowerCase())) : instances, [instances, monitorSearch])
    const stats = useMemo(() => ({ total: instances.length, active: instances.filter(i => i.status === 'running').length, completed: instances.filter(i => i.status === 'completed').length, failed: instances.filter(i => i.status === 'failed' || i.status === 'terminated').length }), [instances])

    function handleNavTabChange(value: string) {
        if (value === "dashboard") router.push("/")
        else if (value === "campaigns") router.push("/decoy-management")
        else if (value === "e2e") router.push(`/e2e/${localStorage.getItem("e2e-selectedAccount") || "placeholder"}?tab=priority&page=1`)
    }

    // Get stage name
    const getStageName = (stageId: string) => stages.find(s => s.id === stageId)?.name || "Unknown"

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin h-6 w-6 border-2 border-gray-400 border-t-transparent rounded-full" /></div>

    return (
        <div className="w-full">
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
                            <div className="flex w-full flex-col">
                                {/* Sub-tabs for Workflows and API Connectors */}
                                <div className="bg-white border-b px-4">
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setFlowSubTab("workflows")}
                                            className={cn(
                                                "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                                                flowSubTab === "workflows"
                                                    ? "border-purple-500 text-purple-600"
                                                    : "border-transparent text-gray-500 hover:text-gray-700"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Workflow className="h-4 w-4" />
                                                Workflows
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => setFlowSubTab("apis")}
                                            className={cn(
                                                "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                                                flowSubTab === "apis"
                                                    ? "border-purple-500 text-purple-600"
                                                    : "border-transparent text-gray-500 hover:text-gray-700"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Settings className="h-4 w-4" />
                                                API Connectors
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* Workflows Sub-Tab Content */}
                                {flowSubTab === "workflows" && (
                            <div className="flex w-full flex-1">
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
                                                                    <p className="text-sm font-semibold text-gray-900 truncate">{wf.name}</p>
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
                                <div className="w-80 bg-white border-l flex flex-col overflow-hidden">
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
                                        <ScrollArea className="flex-1">
                                            <div className="p-4 space-y-6">
                                                {/* Workflow Details */}
                                                <div>
                                                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Thông tin Workflow</p>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                            <span className="text-sm text-gray-600">Trạng thái</span>
                                                            <Badge variant={selectedWorkflow.is_active ? "default" : "secondary"} className={cn("text-xs", selectedWorkflow.is_active && "bg-emerald-500")}>{selectedWorkflow.is_active ? "Bật" : "Tắt"}</Badge>
                                                        </div>
                                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                            <span className="text-sm text-gray-600">SLA</span>
                                                            <span className="text-sm font-medium text-gray-900">{selectedWorkflow.sla_hours} giờ</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Steps */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Các bước ({steps.length})</p>
                                                        <button onClick={() => { setStepForm({ is_automated: false }); setCreateStepOpen(true) }} className="text-xs text-purple-600 hover:text-purple-700 font-medium">+ Thêm</button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {steps.map(step => {
                                                            const connectedApi = step.connector_id ? apiConnectors.find(a => a.id === step.connector_id) : null
                                                            return (
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
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-sm font-medium text-gray-900 truncate">{step.step_name}</p>
                                                                        {connectedApi && (
                                                                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-purple-50 text-purple-600 border-purple-200">
                                                                                <Settings className="h-2 w-2 mr-0.5" />
                                                                                API
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-gray-400">
                                                                        {step.is_automated ? "Tự động" : "Thủ công"}
                                                                        {connectedApi && <span className="ml-1">• {connectedApi.name}</span>}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )})}
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
                                                                <Label className="text-xs text-gray-500">API Connector</Label>
                                                                <Select value={editingStep.connector_id || "none"} onValueChange={v => setEditingStep({ ...editingStep, connector_id: v === "none" ? undefined : v })}>
                                                                    <SelectTrigger className="mt-1 h-9 bg-white">
                                                                        <SelectValue placeholder="Chọn API connector" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="none">Không có</SelectItem>
                                                                        {apiConnectors.map(api => (
                                                                            <SelectItem key={api.id} value={api.id}>
                                                                                {api.name} ({api.method})
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                {editingStep.connector_id && apiConnectors.find(a => a.id === editingStep.connector_id) && (
                                                                    <div className="mt-2 p-2 bg-white rounded text-xs">
                                                                        <p className="text-gray-500">Connected API:</p>
                                                                        <p className="font-medium text-purple-600 truncate">
                                                                            {apiConnectors.find(a => a.id === editingStep.connector_id)?.base_url}
                                                                        </p>
                                                                    </div>
                                                                )}
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

                                {/* API Connectors Sub-Tab Content */}
                                {flowSubTab === "apis" && (
                                    <div className="flex w-full flex-1">
                                        {/* LEFT: API Connectors List */}
                                        <div className="flex-1 overflow-auto p-6 bg-gray-50">
                                            <div className="max-w-5xl mx-auto">
                                                <div className="flex items-center justify-between mb-6">
                                                    <div>
                                                        <h2 className="text-2xl font-bold text-gray-900">API Connectors</h2>
                                                        <p className="text-sm text-gray-500 mt-1">Quản lý các API để kết nối với workflow steps</p>
                                                    </div>
                                                    <Button onClick={() => { setApiConnectorForm({ method: "GET" }); setCreateApiConnectorOpen(true) }}>
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Thêm API Connector
                                                    </Button>
                                                </div>

                                                {apiConnectors.length === 0 ? (
                                                    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                                                        <Settings className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                                        <p className="text-gray-500 mb-4">Chưa có API connector nào</p>
                                                        <Button onClick={() => { setApiConnectorForm({ method: "GET" }); setCreateApiConnectorOpen(true) }}>
                                                            <Plus className="h-4 w-4 mr-2" />
                                                            Tạo API Connector đầu tiên
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="grid gap-4">
                                                        {apiConnectors.map(connector => {
                                                            const isSelected = selectedApiConnector?.id === connector.id
                                                            return (
                                                                <div
                                                                    key={connector.id}
                                                                    onClick={() => selectApiConnectorForEdit(connector)}
                                                                    className={cn(
                                                                        "bg-white rounded-lg border-2 p-5 cursor-pointer transition-all hover:shadow-md",
                                                                        isSelected ? "border-purple-400 shadow-purple-100" : "border-gray-200"
                                                                    )}
                                                                >
                                                                    <div className="flex items-start justify-between">
                                                                        <div className="flex items-start gap-4 flex-1">
                                                                            <div className={cn(
                                                                                "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
                                                                                isSelected ? "bg-purple-500" : "bg-gray-400"
                                                                            )}>
                                                                                <Settings className="h-6 w-6 text-white" />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2 mb-2">
                                                                                    <h3 className="text-lg font-semibold text-gray-900">{connector.name}</h3>
                                                                                    <Badge variant="outline" className="text-xs">{connector.method}</Badge>
                                                                                </div>
                                                                                <p className="text-sm text-gray-600 break-all mb-3">{connector.base_url}</p>
                                                                                <div className="flex gap-4 text-xs text-gray-500">
                                                                                    {connector.input_schema && <span>✓ Input Schema</span>}
                                                                                    {connector.output_schema && <span>✓ Output Schema</span>}
                                                                                    {connector.auth_config && <span>✓ Auth Config</span>}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* RIGHT: API Connector Details Panel */}
                                        <div className="w-96 bg-white border-l flex flex-col overflow-hidden">
                                            <div className="p-4 border-b flex-shrink-0">
                                                <div className="flex items-center gap-2">
                                                    {selectedApiConnector ? (
                                                        <>
                                                            <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
                                                                <Settings className="h-5 w-5 text-white" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-semibold text-gray-900 truncate">{selectedApiConnector.name}</p>
                                                                <p className="text-xs text-gray-400 truncate">{selectedApiConnector.method}</p>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <p className="text-sm text-gray-400">Chọn một API connector</p>
                                                    )}
                                                </div>
                                            </div>

                                            {selectedApiConnector && editingApiConnector && (
                                                <ScrollArea className="flex-1">
                                                    <div className="p-4 space-y-4">
                                                        <div>
                                                            <Label className="text-xs text-gray-500">Tên</Label>
                                                            <Input
                                                                value={editingApiConnector.name || ""}
                                                                onChange={e => setEditingApiConnector({ ...editingApiConnector, name: e.target.value })}
                                                                className="mt-1 h-9"
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label className="text-xs text-gray-500">Base URL</Label>
                                                            <Input
                                                                value={editingApiConnector.base_url || ""}
                                                                onChange={e => setEditingApiConnector({ ...editingApiConnector, base_url: e.target.value })}
                                                                className="mt-1 h-9"
                                                                placeholder="https://api.example.com"
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label className="text-xs text-gray-500">HTTP Method</Label>
                                                            <Select
                                                                value={editingApiConnector.method || "GET"}
                                                                onValueChange={v => setEditingApiConnector({ ...editingApiConnector, method: v })}
                                                            >
                                                                <SelectTrigger className="mt-1 h-9">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="GET">GET</SelectItem>
                                                                    <SelectItem value="POST">POST</SelectItem>
                                                                    <SelectItem value="PUT">PUT</SelectItem>
                                                                    <SelectItem value="PATCH">PATCH</SelectItem>
                                                                    <SelectItem value="DELETE">DELETE</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div>
                                                            <Label className="text-xs text-gray-500">Auth Config (JSON)</Label>
                                                            <textarea
                                                                value={editingApiConnector.auth_config ? JSON.stringify(editingApiConnector.auth_config, null, 2) : ""}
                                                                onChange={e => {
                                                                    try {
                                                                        const parsed = e.target.value ? JSON.parse(e.target.value) : null
                                                                        setEditingApiConnector({ ...editingApiConnector, auth_config: parsed })
                                                                    } catch { }
                                                                }}
                                                                className="mt-1 w-full min-h-[80px] p-2 text-xs font-mono border rounded-md"
                                                                placeholder='{"type": "bearer", "token": "..."}'
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label className="text-xs text-gray-500">Input Schema (JSON)</Label>
                                                            <textarea
                                                                value={editingApiConnector.input_schema ? JSON.stringify(editingApiConnector.input_schema, null, 2) : ""}
                                                                onChange={e => {
                                                                    try {
                                                                        const parsed = e.target.value ? JSON.parse(e.target.value) : null
                                                                        setEditingApiConnector({ ...editingApiConnector, input_schema: parsed })
                                                                    } catch { }
                                                                }}
                                                                className="mt-1 w-full min-h-[100px] p-2 text-xs font-mono border rounded-md"
                                                                placeholder='{"properties": {"phone": {"type": "string"}}}'
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label className="text-xs text-gray-500">Output Schema (JSON)</Label>
                                                            <textarea
                                                                value={editingApiConnector.output_schema ? JSON.stringify(editingApiConnector.output_schema, null, 2) : ""}
                                                                onChange={e => {
                                                                    try {
                                                                        const parsed = e.target.value ? JSON.parse(e.target.value) : null
                                                                        setEditingApiConnector({ ...editingApiConnector, output_schema: parsed })
                                                                    } catch { }
                                                                }}
                                                                className="mt-1 w-full min-h-[100px] p-2 text-xs font-mono border rounded-md"
                                                                placeholder='{"properties": {"id": {"type": "string"}}}'
                                                            />
                                                        </div>
                                                        <div className="flex gap-2 pt-2">
                                                            <Button size="sm" className="flex-1" onClick={handleSaveApiConnector} disabled={saving}>
                                                                <Save className="h-3 w-3 mr-1" />
                                                                Lưu
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-red-500 hover:text-red-600"
                                                                onClick={() => {
                                                                    setDeleteTarget({ type: "api_connector", item: selectedApiConnector })
                                                                    setDeleteConfirmOpen(true)
                                                                }}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </ScrollArea>
                                            )}
                                        </div>
                                    </div>
                                )}
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
                        <div className="grid grid-cols-2 gap-3"><div><Label className="text-xs">SLA (giờ)</Label><Input type="number" value={workflowForm.sla_hours || 24} onChange={e => setWorkflowForm({ ...workflowForm, sla_hours: parseInt(e.target.value) })} className="mt-1" /></div><div className="flex items-end pb-1"><div className="flex items-center gap-2"><Switch checked={workflowForm.is_active} onCheckedChange={c => setWorkflowForm({ ...workflowForm, is_active: c })} /><Label className="text-xs">Hoạt động</Label></div></div></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setCreateWorkflowOpen(false)}>Hủy</Button><Button onClick={handleCreateWorkflow} disabled={saving}>Tạo</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={createStepOpen} onOpenChange={setCreateStepOpen}>
                <DialogContent><DialogHeader><DialogTitle>Thêm bước vào {selectedWorkflow?.name}</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <div><Label className="text-xs">Tên bước</Label><Input value={stepForm.step_name || ""} onChange={e => setStepForm({ ...stepForm, step_name: e.target.value })} className="mt-1" /></div>
                        <div className="flex items-center gap-2"><Switch checked={stepForm.is_automated} onCheckedChange={c => setStepForm({ ...stepForm, is_automated: c })} /><Label className="text-xs">Tự động</Label></div>
                        <div>
                            <Label className="text-xs">API Connector (Tùy chọn)</Label>
                            <Select value={stepForm.connector_id || "none"} onValueChange={v => setStepForm({ ...stepForm, connector_id: v === "none" ? undefined : v })}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Chọn API connector" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Không có</SelectItem>
                                    {apiConnectors.map(api => <SelectItem key={api.id} value={api.id}>{api.name} ({api.method})</SelectItem>)}
                                </SelectContent>
                            </Select>
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

            <Dialog open={createApiConnectorOpen} onOpenChange={setCreateApiConnectorOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Tạo API Connector mới</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <Label className="text-xs">Tên</Label>
                            <Input value={apiConnectorForm.name || ""} onChange={e => setApiConnectorForm({ ...apiConnectorForm, name: e.target.value })} className="mt-1" placeholder="VD: Send SMS API" />
                        </div>
                        <div>
                            <Label className="text-xs">Base URL</Label>
                            <Input value={apiConnectorForm.base_url || ""} onChange={e => setApiConnectorForm({ ...apiConnectorForm, base_url: e.target.value })} className="mt-1" placeholder="https://api.example.com/v1/endpoint" />
                        </div>
                        <div>
                            <Label className="text-xs">HTTP Method</Label>
                            <Select value={apiConnectorForm.method || "GET"} onValueChange={v => setApiConnectorForm({ ...apiConnectorForm, method: v })}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GET">GET</SelectItem>
                                    <SelectItem value="POST">POST</SelectItem>
                                    <SelectItem value="PUT">PUT</SelectItem>
                                    <SelectItem value="PATCH">PATCH</SelectItem>
                                    <SelectItem value="DELETE">DELETE</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Auth Config (JSON) - Tùy chọn</Label>
                            <textarea
                                value={apiConnectorForm.auth_config ? JSON.stringify(apiConnectorForm.auth_config, null, 2) : ""}
                                onChange={e => {
                                    try {
                                        const parsed = e.target.value ? JSON.parse(e.target.value) : null
                                        setApiConnectorForm({ ...apiConnectorForm, auth_config: parsed })
                                    } catch { }
                                }}
                                className="mt-1 w-full min-h-[60px] p-2 text-xs font-mono border rounded-md"
                                placeholder='{"type": "bearer", "token": "..."}'
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Input Schema (JSON) - Tùy chọn</Label>
                            <textarea
                                value={apiConnectorForm.input_schema ? JSON.stringify(apiConnectorForm.input_schema, null, 2) : ""}
                                onChange={e => {
                                    try {
                                        const parsed = e.target.value ? JSON.parse(e.target.value) : null
                                        setApiConnectorForm({ ...apiConnectorForm, input_schema: parsed })
                                    } catch { }
                                }}
                                className="mt-1 w-full min-h-[80px] p-2 text-xs font-mono border rounded-md"
                                placeholder='{"properties": {"phone": {"type": "string"}}}'
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Output Schema (JSON) - Tùy chọn</Label>
                            <textarea
                                value={apiConnectorForm.output_schema ? JSON.stringify(apiConnectorForm.output_schema, null, 2) : ""}
                                onChange={e => {
                                    try {
                                        const parsed = e.target.value ? JSON.parse(e.target.value) : null
                                        setApiConnectorForm({ ...apiConnectorForm, output_schema: parsed })
                                    } catch { }
                                }}
                                className="mt-1 w-full min-h-[80px] p-2 text-xs font-mono border rounded-md"
                                placeholder='{"properties": {"id": {"type": "string"}}}'
                            />
                        </div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setCreateApiConnectorOpen(false)}>Hủy</Button><Button onClick={handleCreateApiConnector} disabled={saving || !apiConnectorForm.name || !apiConnectorForm.base_url || !apiConnectorForm.method}>Tạo</Button></DialogFooter>
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
