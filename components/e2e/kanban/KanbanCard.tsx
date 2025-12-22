"use client"

import { Progress } from "@/components/ui/progress"
import { CheckCircle, MoreVertical, MapPin, Gauge } from "lucide-react"
import { Button } from "@/components/ui/button"
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

    // Calculate remaining days
    const calculateRemainingDays = () => {
        if (!campaign.duration || campaign.duration <= 0) return null

        const createdDate = new Date(campaign.created_at)
        const now = new Date()
        const elapsedMs = now.getTime() - createdDate.getTime()
        const durationMs = campaign.duration * 60 * 60 * 1000
        const remainingMs = durationMs - elapsedMs

        if (remainingMs <= 0) return 0

        const days = Math.ceil(remainingMs / (1000 * 60 * 60 * 24))
        return days
    }

    const progress = calculateProgress()
    const remainingTime = calculateRemainingTime()
    const remainingDays = calculateRemainingDays()
    const isCompleted = progress >= 100 || remainingDays === 0

    // Format car name: "Brand Model Year"
    const carName = [campaign.car_brand, campaign.car_model, campaign.car_year]
        .filter(Boolean)
        .join(" ")

    // Format time from created_at
    const formatTime = (dateStr: string): string => {
        const date = new Date(dateStr)
        return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    }

    // Format date from created_at
    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr)
        return date.toLocaleDateString("vi-VN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        })
    }

    // Get first letter for avatar
    const getInitial = (name: string | null): string => {
        if (!name) return "?"
        return name.charAt(0).toUpperCase()
    }

    return (
        <div
            className="bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
            onClick={onClick}
        >
            {/* Header - Lead Info */}
            <div className="p-4 pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        {/* Avatar - Simple gray circle with initial */}
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium">
                            {getInitial(campaign.lead_name)}
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-gray-900 text-sm">
                                    {campaign.lead_name || "Chưa có tên"}
                                </span>
                                {campaign.is_active && (
                                    <CheckCircle className="h-4 w-4 text-gray-400" />
                                )}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                                {formatTime(campaign.created_at)} • {formatDate(campaign.created_at)}
                            </div>
                        </div>
                    </div>
                    <button
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <MoreVertical className="h-4 w-4 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Car Info Section */}
            <div className="px-4 pb-3">
                <h4 className="font-bold text-gray-900 text-sm mb-0.5">
                    {carName || "Chưa có thông tin xe"}
                </h4>
                {campaign.car_plate && (
                    <div className="text-xs text-gray-400 font-mono mb-1">
                        {campaign.car_plate}
                    </div>
                )}
                {/* Lead phone */}
                {campaign.lead_phone && (
                    <div className="text-xs text-gray-500">
                        {maskPhone(campaign.lead_phone)}
                    </div>
                )}
            </div>

            {/* Progress / Action Section */}
            {isCompleted ? (
                <Button
                    className="w-full rounded-none rounded-b-xl bg-green-50 hover:bg-green-100 text-green-600 border-t border-gray-100 py-3 h-auto font-medium"
                    variant="ghost"
                    onClick={(e) => {
                        e.stopPropagation()
                        // Handle action
                    }}
                >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Hoàn thành • Tiếp theo
                </Button>
            ) : (
                <div className="px-4 pb-4 pt-1">
                    <div className="flex items-center gap-3">
                        <Progress
                            value={progress}
                            className="h-1.5 flex-1 bg-gray-100 [&>div]:bg-blue-500"
                        />
                        {remainingDays !== null && (
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                                {remainingDays} ngày
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
