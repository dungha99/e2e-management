"use client"

import { Badge } from "@/components/ui/badge"
import { KanbanCard } from "./KanbanCard"
import { ScrollArea } from "@/components/ui/scroll-area"

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

interface KanbanColumnProps {
    workflow: KanbanWorkflow
    onCampaignClick?: (campaign: CampaignForKanban) => void
}

export function KanbanColumn({ workflow, onCampaignClick }: KanbanColumnProps) {
    const activeCampaigns = workflow.campaigns.filter(c => c.is_active).length

    // Determine column color based on order
    const getColumnColor = (order: number) => {
        const colors = [
            "bg-blue-50 border-blue-200",
            "bg-purple-50 border-purple-200",
            "bg-amber-50 border-amber-200",
            "bg-emerald-50 border-emerald-200",
            "bg-rose-50 border-rose-200",
            "bg-cyan-50 border-cyan-200",
        ]
        return colors[(order - 1) % colors.length]
    }

    const getHeaderColor = (order: number) => {
        const colors = [
            "bg-blue-100 text-blue-800",
            "bg-purple-100 text-purple-800",
            "bg-amber-100 text-amber-800",
            "bg-emerald-100 text-emerald-800",
            "bg-rose-100 text-rose-800",
            "bg-cyan-100 text-cyan-800",
        ]
        return colors[(order - 1) % colors.length]
    }

    return (
        <div className={`flex-shrink-0 w-80 rounded-lg border ${getColumnColor(workflow.order)}`}>
            {/* Column Header */}
            <div className={`p-3 rounded-t-lg ${getHeaderColor(workflow.order)}`}>
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{workflow.name}</h3>
                    <div className="flex items-center gap-2">
                        {activeCampaigns > 0 && (
                            <Badge variant="default" className="bg-emerald-500 text-xs">
                                {activeCampaigns} đang chạy
                            </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                            {workflow.campaigns.length}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Column Content */}
            <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="p-3 space-y-3">
                    {workflow.campaigns.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            Chưa có campaign
                        </div>
                    ) : (
                        workflow.campaigns.map(campaign => (
                            <KanbanCard
                                key={campaign.id}
                                campaign={campaign}
                                onClick={() => onCampaignClick?.(campaign)}
                            />
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
