"use client"

import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Car, Calendar, Clock } from "lucide-react"
import { maskPhone } from "@/lib/utils"

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

interface KanbanCardProps {
    campaign: CampaignForKanban
    onClick?: () => void
}

export function KanbanCard({ campaign, onClick }: KanbanCardProps) {
    // Calculate progress based on duration (duration is in HOURS)
    const calculateProgress = () => {
        if (!campaign.duration || campaign.duration <= 0) return 0

        const createdDate = new Date(campaign.created_at)
        const now = new Date()
        const elapsedMs = now.getTime() - createdDate.getTime()
        const elapsedHours = elapsedMs / (1000 * 60 * 60) // Convert to hours

        const progress = Math.min(100, (elapsedHours / campaign.duration) * 100)
        return Math.round(progress)
    }

    // Calculate remaining time in hh:mm:ss format
    const calculateRemainingTime = () => {
        if (!campaign.duration || campaign.duration <= 0) return ""

        const createdDate = new Date(campaign.created_at)
        const now = new Date()
        const elapsedMs = now.getTime() - createdDate.getTime()
        const durationMs = campaign.duration * 60 * 60 * 1000 // duration is in HOURS to ms
        const remainingMs = durationMs - elapsedMs

        if (remainingMs <= 0) return "Hết hạn"

        const totalSeconds = Math.floor(remainingMs / 1000)
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60

        const hh = String(hours).padStart(2, '0')
        const mm = String(minutes).padStart(2, '0')
        const ss = String(seconds).padStart(2, '0')

        return `Còn ${hh}:${mm}:${ss}`
    }

    const progress = calculateProgress()
    const remainingTime = calculateRemainingTime()
    const carName = [campaign.car_year, campaign.car_brand, campaign.car_model]
        .filter(Boolean)
        .join(" ")

    const formattedDate = new Date(campaign.created_at).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    })

    return (
        <Card
            className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${campaign.is_active
                ? "border-l-emerald-500 bg-emerald-50/30"
                : "border-l-gray-300 bg-white"
                }`}
            onClick={onClick}
        >
            <CardContent className="p-3 space-y-3">
                {/* Header with status */}
                <div className="flex items-center justify-between">
                    <Badge
                        variant={campaign.is_active ? "default" : "secondary"}
                        className={`text-xs ${campaign.is_active ? "bg-emerald-500" : ""}`}
                    >
                        {campaign.is_active ? "Đang chạy" : "Tạm dừng"}
                    </Badge>
                    {campaign.car_plate && (
                        <span className="text-xs font-mono text-gray-500">{campaign.car_plate}</span>
                    )}
                </div>

                {/* Car info */}
                <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 truncate">
                        {carName || "Chưa có thông tin xe"}
                    </span>
                </div>

                {/* Lead info */}
                {campaign.lead_name && (
                    <div className="text-xs text-gray-600">
                        {campaign.lead_name} • {campaign.lead_phone ? maskPhone(campaign.lead_phone) : "N/A"}
                    </div>
                )}

                {/* Progress bar */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Tiến độ
                        </span>
                        <span className={`font-medium ${progress >= 100 ? "text-emerald-600" : "text-gray-600"}`}>
                            {progress}%
                        </span>
                    </div>
                    <Progress
                        value={progress}
                        className={`h-2 ${progress >= 100 ? "[&>div]:bg-emerald-500" : "[&>div]:bg-blue-500"}`}
                    />
                </div>

                {/* Footer with date and countdown */}
                <div className="flex items-center gap-1 text-xs text-gray-400 pt-1">
                    <Calendar className="h-3 w-3" />
                    <span>Tạo: {formattedDate}</span>
                    {campaign.duration && campaign.is_active && (
                        <span className="ml-auto text-purple-600 font-medium">{remainingTime}</span>
                    )}
                    {campaign.duration && !campaign.is_active && (
                        <span className="ml-auto">{campaign.duration}h</span>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
