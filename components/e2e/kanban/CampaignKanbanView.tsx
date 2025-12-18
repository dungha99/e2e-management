"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, LayoutGrid } from "lucide-react"
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
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

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
            setLastUpdated(new Date())
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
            <div className="flex items-center justify-center h-[400px] bg-white rounded-lg shadow-sm">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Đang tải dữ liệu Kanban...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-[400px] bg-white rounded-lg shadow-sm">
                <div className="flex flex-col items-center gap-3 text-center">
                    <p className="text-red-500">{error}</p>
                    <Button variant="outline" onClick={fetchKanbanData}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Thử lại
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg shadow-sm p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <LayoutGrid className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-gray-900">Campaign Kanban</h2>
                    </div>
                    <span className="text-sm text-gray-500">
                        {totalCampaigns} campaigns • {workflows.length} workflows
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-xs text-gray-400">
                            Cập nhật: {lastUpdated.toLocaleTimeString("vi-VN")}
                        </span>
                    )}
                    <Button variant="outline" size="sm" onClick={fetchKanbanData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* Kanban Board */}
            {workflows.length === 0 ? (
                <div className="flex items-center justify-center h-[400px] text-center">
                    <div>
                        <LayoutGrid className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">Chưa có campaign nào</p>
                        <p className="text-sm text-gray-400 mt-1">
                            Campaigns sẽ hiển thị ở đây khi được tạo
                        </p>
                    </div>
                </div>
            ) : (
                <ScrollArea className="w-full">
                    <div className="flex gap-4 pb-4">
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
