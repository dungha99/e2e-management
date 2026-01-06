"use client"

import { KanbanCard } from "./KanbanCard"
import { ScrollArea } from "@/components/ui/scroll-area"
import { WorkflowInstanceForKanban, KanbanWorkflow } from "./CampaignKanbanView"

interface KanbanColumnProps {
    workflow: KanbanWorkflow
    onInstanceClick?: (instance: WorkflowInstanceForKanban) => void
    onTransition?: (instanceId: string, transitionId: string, toWorkflowId: string) => void
    onNote?: (leadId: string, leadName: string) => void
    onNoteUpdate?: (leadId: string, notes: string) => Promise<void>
    onOpenTransitionDialog?: (instance: WorkflowInstanceForKanban) => void
}

export function KanbanColumn({ workflow, onInstanceClick, onTransition, onNote, onNoteUpdate, onOpenTransitionDialog }: KanbanColumnProps) {
    // Check if this is the "No Workflow" column
    const isNoWorkflowColumn = workflow.id === 'no-workflow'

    // Get badge color based on order
    const getBadgeColor = (order: number) => {
        if (isNoWorkflowColumn) return "bg-gray-400"

        const colors = [
            "bg-blue-500",      // Stage 1
            "bg-orange-500",    // Stage 2
            "bg-green-500",     // Stage 3
            "bg-purple-500",    // Stage 4
            "bg-pink-500",      // Stage 5
            "bg-cyan-500",      // Stage 6
        ]
        return colors[(order - 1) % colors.length]
    }

    return (
        <div className="flex-shrink-0 w-[340px] min-w-[340px] border-r border-gray-200 px-3">
            {/* Column Header */}
            <div className="flex items-center gap-2 mb-4">
                <span className={`w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold ${getBadgeColor(workflow.order)}`}>
                    {isNoWorkflowColumn ? "—" : workflow.order}
                </span>
                <h3 className="font-semibold text-gray-700 text-sm truncate flex-1" title={workflow.name}>
                    {workflow.name}
                </h3>
                <span className="ml-auto text-xs text-gray-400">
                    {workflow.instances.length}
                </span>
            </div>

            {/* Column Content */}
            <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="space-y-3 pr-1">
                    {workflow.instances.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">
                            <p className="italic">Chưa có instance</p>
                        </div>
                    ) : (
                        workflow.instances.map(instance => (
                            <KanbanCard
                                key={instance.id}
                                instance={instance}
                                onClick={() => onInstanceClick?.(instance)}
                                onTransition={onTransition}
                                onNote={onNote}
                                onNoteUpdate={onNoteUpdate}
                                onOpenTransitionDialog={onOpenTransitionDialog}
                            />
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
