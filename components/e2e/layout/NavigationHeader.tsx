"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Menu, LayoutList, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"

interface NavigationHeaderProps {
    currentPage: "dashboard" | "campaigns" | "e2e" | "workflow"
    selectedAccount?: string
    accountSelector?: React.ReactNode
    viewMode?: "list" | "kanban"
    onViewModeChange?: (mode: "list" | "kanban") => void
    showViewToggle?: boolean
}

const NAV_ITEMS = [
    { value: "dashboard", label: "Dashboard", href: "/" },
    { value: "campaigns", label: "Quản lý Decoy", href: "/decoy-management" },
    { value: "e2e", label: "Quản lý E2E", href: (accountId: string) => `/e2e/${accountId}?tab=priority&page=1` },
    { value: "workflow", label: "Quản lý Workflow", href: "/workflow-management" },
]

export function NavigationHeader({
    currentPage,
    selectedAccount,
    accountSelector,
    viewMode = "list",
    onViewModeChange,
    showViewToggle = false,
}: NavigationHeaderProps) {
    const router = useRouter()
    const [menuOpen, setMenuOpen] = useState(false)

    // Handle mobile navigation
    const handleMobileNavigation = (value: string) => {
        const item = NAV_ITEMS.find(i => i.value === value)
        if (!item) return

        let href: string
        if (value === "e2e" && typeof item.href === "function") {
            href = item.href(selectedAccount || "placeholder")
        } else {
            href = typeof item.href === "string" ? item.href : "/"
        }

        router.push(href)
        setMenuOpen(false)
    }

    return (
        <>
            {/* MOBILE HEADER (sm:hidden) */}
            <div className="sm:hidden sticky top-0 z-40 bg-white border-b px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    {/* Left: Burger Menu */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => setMenuOpen(true)}
                    >
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Open menu</span>
                    </Button>

                    {/* Center: Account Selector (Passed as Prop) */}
                    <div className="flex-1 flex justify-center">
                        {accountSelector}
                    </div>

                    {/* Right: View Mode Toggle */}
                    {showViewToggle && onViewModeChange && (
                        <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
                            <Button
                                variant={viewMode === "list" ? "secondary" : "ghost"}
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => onViewModeChange("list")}
                            >
                                <LayoutList className="h-4 w-4" />
                                <span className="sr-only">List view</span>
                            </Button>
                            <Button
                                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => onViewModeChange("kanban")}
                            >
                                <LayoutGrid className="h-4 w-4" />
                                <span className="sr-only">Kanban view</span>
                            </Button>
                        </div>
                    )}
                </div>

                {/* Navigation Sheet */}
                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                    <SheetContent side="left" className="w-64">
                        <SheetHeader>
                            <SheetTitle>Navigation</SheetTitle>
                        </SheetHeader>
                        <nav className="flex flex-col gap-2 mt-6">
                            {NAV_ITEMS.map((item) => (
                                <Button
                                    key={item.value}
                                    variant={currentPage === item.value ? "secondary" : "ghost"}
                                    className={cn(
                                        "justify-start h-11",
                                        currentPage === item.value && "bg-blue-50 text-blue-700 font-medium"
                                    )}
                                    onClick={() => handleMobileNavigation(item.value)}
                                >
                                    {item.label}
                                </Button>
                            ))}
                        </nav>
                    </SheetContent>
                </Sheet>
            </div>

            {/* DESKTOP HEADER (hidden sm:flex) */}
            <div className="hidden sm:flex items-center justify-between mb-6 gap-4 px-4 pt-4">
                <div className="overflow-x-auto flex-shrink min-w-0">
                    <TabsList>
                        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                        <TabsTrigger value="campaigns">Quản lý Decoy</TabsTrigger>
                        <TabsTrigger value="e2e">Quản lý E2E</TabsTrigger>
                        <TabsTrigger value="workflow">Quản lý Workflow</TabsTrigger>
                    </TabsList>
                </div>

                {/* Portal targets for AccountSelector and View Mode Toggle */}
                {/* Note: The functionality for these is portaled in from child components */}
                <div className="flex items-center gap-4">
                    <div id="header-account-selector"></div>
                    <div id="header-view-toggle"></div>
                </div>
            </div>
        </>
    )
}
