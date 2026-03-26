"use client"

import { ZaloErrorSegment, ZaloErrorCategory } from "./types"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"

// ── Badge config per error category ────────────────────────────────────────
const CATEGORY_CONFIG: Record<ZaloErrorCategory, {
    label: string
    shortLabel: string
    className: string
    icon: string
}> = {
    BLOCKED_STRANGER: {
        label: "Chặn tin nhắn người lạ",
        shortLabel: "Chặn TN",
        className: "bg-red-50 text-red-600 border-red-200",
        icon: "🚫",
    },
    DECLINED_MESSAGES: {
        label: "Từ chối nhận tin",
        shortLabel: "Từ chối",
        className: "bg-orange-50 text-orange-600 border-orange-200",
        icon: "✋",
    },
    NO_UID_FOUND: {
        label: "Không tìm thấy Zalo",
        shortLabel: "No UID",
        className: "bg-amber-50 text-amber-700 border-amber-200",
        icon: "🔍",
    },
    CONTACT_NOT_FOUND: {
        label: "Không tìm thấy contact",
        shortLabel: "No Contact",
        className: "bg-purple-50 text-purple-600 border-purple-200",
        icon: "👤",
    },
    TIMEOUT: {
        label: "Hết thời gian chờ",
        shortLabel: "Timeout",
        className: "bg-sky-50 text-sky-600 border-sky-200",
        icon: "⏱",
    },
    SEARCH_FAILED: {
        label: "Lỗi tìm kiếm",
        shortLabel: "Search Err",
        className: "bg-indigo-50 text-indigo-600 border-indigo-200",
        icon: "⚠",
    },
    OTHER: {
        label: "Lỗi khác",
        shortLabel: "Khác",
        className: "bg-gray-50 text-gray-600 border-gray-200",
        icon: "❓",
    },
}

const ACTION_LABELS: Record<string, string> = {
    addFriend: "Kết bạn",
    firstMessage: "Tin nhắn đầu",
    rename: "Đổi tên",
}

interface ZaloErrorBadgesProps {
    errors: ZaloErrorSegment[]
}

export function ZaloErrorBadges({ errors }: ZaloErrorBadgesProps) {
    if (!errors || errors.length === 0) return null

    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex flex-wrap gap-1 mt-1.5">
                {errors.map((seg, i) => {
                    const cfg = CATEGORY_CONFIG[seg.category]
                    const actionLabel = ACTION_LABELS[seg.action_type] ?? seg.action_type
                    const timeAgo = (() => {
                        try {
                            return formatDistanceToNow(new Date(seg.latest_at), { addSuffix: true, locale: vi })
                        } catch {
                            return ""
                        }
                    })()

                    return (
                        <Tooltip key={`${seg.category}-${seg.action_type}-${i}`}>
                            <TooltipTrigger asChild>
                                <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border cursor-help transition-all hover:shadow-sm ${cfg.className}`}
                                >
                                    <span className="text-[9px] leading-none">{cfg.icon}</span>
                                    {cfg.shortLabel}
                                    {seg.count > 1 && (
                                        <span className="font-bold opacity-80">×{seg.count}</span>
                                    )}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent
                                side="top"
                                className="max-w-[320px] p-3 space-y-1.5"
                            >
                                <div className="flex items-center gap-1.5 text-xs font-bold">
                                    <span>{cfg.icon}</span>
                                    <span>{cfg.label}</span>
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    <span className="font-medium text-foreground">Action:</span>{" "}
                                    {actionLabel}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    <span className="font-medium text-foreground">Số lần:</span>{" "}
                                    {seg.count}
                                </div>
                                <div className="text-[11px] text-muted-foreground leading-snug break-words border-t pt-1.5 mt-1.5">
                                    <span className="font-medium text-foreground">Chi tiết:</span>{" "}
                                    {seg.latest_detail}
                                </div>
                                {timeAgo && (
                                    <div className="text-[10px] text-muted-foreground/70 italic">
                                        {timeAgo}
                                    </div>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    )
                })}
            </div>
        </TooltipProvider>
    )
}
