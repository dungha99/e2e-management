"use client"

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
    // Get badge color based on order
    const getBadgeColor = (order: number) => {
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
        <div className="flex-shrink-0 w-[280px] min-w-[280px]">
            {/* Column Header */}
            <div className="flex items-center gap-2 mb-4">
                <span className={`w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold ${getBadgeColor(workflow.order)}`}>
                    {workflow.order}
                </span>
                <h3 className="font-semibold text-gray-700 text-sm">
                    Stage {workflow.order}
                </h3>
                <span className="ml-auto text-xs text-gray-400">
                    {workflow.campaigns.length}
                </span>
            </div>

            {/* Column Content */}
            <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="space-y-3 pr-1">
                    {workflow.campaigns.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">
                            <p className="italic">Chưa có campaign</p>
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
