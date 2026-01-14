"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowRight, Workflow, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface WorkflowTransition {
    id: string
    to_workflow_id: string
    to_workflow_name: string
    condition_logic: string | null
}

interface TransitionWorkflowDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    instanceId: string
    currentWorkflowName: string
    carInfo: string
    availableTransitions: WorkflowTransition[]
    onTransition: (instanceId: string, transitionId: string, toWorkflowId: string) => Promise<void>
}

export function TransitionWorkflowDialog({
    open,
    onOpenChange,
    instanceId,
    currentWorkflowName,
    carInfo,
    availableTransitions,
    onTransition
}: TransitionWorkflowDialogProps) {
    const [selectedTransition, setSelectedTransition] = useState<WorkflowTransition | null>(null)
    const [isTransitioning, setIsTransitioning] = useState(false)

    const handleConfirmTransition = async () => {
        if (!selectedTransition) return

        setIsTransitioning(true)
        try {
            await onTransition(instanceId, selectedTransition.id, selectedTransition.to_workflow_id)
            onOpenChange(false)
            setSelectedTransition(null)
        } catch (error) {
            console.error("[TransitionWorkflowDialog] Error transitioning:", error)
        } finally {
            setIsTransitioning(false)
        }
    }

    const handleClose = () => {
        setSelectedTransition(null)
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Workflow className="h-5 w-5 text-amber-600" />
                        Chuyển Workflow
                    </DialogTitle>
                    <DialogDescription>
                        Chọn workflow tiếp theo cho <span className="font-medium text-gray-900">{carInfo}</span>
                    </DialogDescription>
                </DialogHeader>

                {/* Current workflow indicator */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-xs text-gray-500">Hiện tại:</span>
                    <span className="text-sm font-medium text-gray-900">{currentWorkflowName}</span>
                </div>

                {/* Available transitions list */}
                <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                        {availableTransitions.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <Workflow className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Không có workflow khả dụng</p>
                                <p className="text-xs mt-1">Hãy cấu hình transitions trong quản lý workflow</p>
                            </div>
                        ) : (
                            availableTransitions.map((transition) => (
                                <button
                                    key={transition.id}
                                    onClick={() => setSelectedTransition(transition)}
                                    className={cn(
                                        "w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                                        selectedTransition?.id === transition.id
                                            ? "bg-amber-50 border-amber-300 ring-2 ring-amber-200"
                                            : "bg-white border-gray-200 hover:border-amber-200 hover:bg-amber-50/50"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center",
                                            selectedTransition?.id === transition.id
                                                ? "bg-amber-500 text-white"
                                                : "bg-gray-100 text-gray-500"
                                        )}>
                                            <Workflow className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {transition.to_workflow_name}
                                            </p>
                                            {transition.condition_logic && (
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {transition.condition_logic}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <ArrowRight className={cn(
                                        "h-4 w-4",
                                        selectedTransition?.id === transition.id
                                            ? "text-amber-600"
                                            : "text-gray-300"
                                    )} />
                                </button>
                            ))
                        )}
                    </div>
                </ScrollArea>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleClose}
                        disabled={isTransitioning}
                    >
                        Hủy
                    </Button>
                    <Button
                        className="flex-1 bg-amber-600 hover:bg-amber-700"
                        onClick={handleConfirmTransition}
                        disabled={!selectedTransition || isTransitioning}
                    >
                        {isTransitioning ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Đang chuyển...
                            </>
                        ) : (
                            <>
                                <ArrowRight className="h-4 w-4 mr-2" />
                                Xác nhận chuyển
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
