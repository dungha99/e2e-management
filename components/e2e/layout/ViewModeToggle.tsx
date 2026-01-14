"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { List, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"

interface ViewModeToggleProps {
    viewMode: "list" | "kanban"
    onViewModeChange: (mode: "list" | "kanban") => void
    isMobile?: boolean
}

export function ViewModeToggle({
    viewMode,
    onViewModeChange,
    isMobile = false
}: ViewModeToggleProps) {
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)

    useEffect(() => {
        // Only use portal for desktop view
        if (!isMobile) {
            const container = document.getElementById('header-view-toggle')
            setPortalContainer(container)
        }
    }, [isMobile])

    // Toggle component UI - modern segmented control style
    const toggleComponent = (
        <div className="flex items-center">
            <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-100 p-0.5">
                <button
                    type="button"
                    onClick={() => onViewModeChange("list")}
                    className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                        viewMode === "list"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                    )}
                >
                    <List className="h-3.5 w-3.5" />
                    <span>Danh sách</span>
                </button>
                <button
                    type="button"
                    onClick={() => onViewModeChange("kanban")}
                    className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                        viewMode === "kanban"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                    )}
                >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span>Kanban</span>
                </button>
            </div>
        </div>
    )

    // For desktop, render via portal into header
    if (!isMobile && portalContainer) {
        return createPortal(toggleComponent, portalContainer)
    }

    // For mobile, hidden (cleaner app-like experience)
    if (isMobile) {
        return null
    }

    // Fallback: render nothing if portal not ready
    return null
}
