"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { KanbanColumn } from "./KanbanColumn"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

interface CampaignForKanban {
    id: string
    car_auction_id: string
    created_at: string
    duration: number | null
    is_active: boolean
    car_brand: string | null
    car_model: string | null
    car_year: number | null
    car_plate: string | null
    lead_name: string | null
    lead_phone: string | null
    workflow_order: number
}

interface KanbanWorkflow {
    order: number
    name: string
    campaigns: CampaignForKanban[]
}

interface CampaignKanbanViewProps {
    picId: string
}

export function CampaignKanbanView({ picId }: CampaignKanbanViewProps) {
    const [workflows, setWorkflows] = useState<KanbanWorkflow[]>([])
    const [totalCampaigns, setTotalCampaigns] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

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
            setWorkflows(data.workflows || [])
            setTotalCampaigns(data.totalCampaigns || 0)
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

    const handleCampaignClick = (campaign: CampaignForKanban) => {
        console.log("[CampaignKanbanView] Campaign clicked:", campaign)
        // TODO: Open campaign detail modal or navigate to campaign detail
    }

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
        <div className="h-full bg-gray-50/50 rounded-lg p-4">
            {workflows.length === 0 ? (
                <div className="flex items-center justify-center h-[400px] text-center">
                    <div className="text-gray-400">
                        <p className="text-lg">Chưa có campaign</p>
                    </div>
                </div>
            ) : (
                <ScrollArea className="w-full h-full">
                    <div className="flex gap-6">
                        {workflows.map(workflow => (
                            <KanbanColumn
                                key={workflow.order}
                                workflow={workflow}
                                onCampaignClick={handleCampaignClick}
                            />
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            )}
        </div>
    )
}
