"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Menu, User, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavigationHeaderProps {
  currentPage: "dashboard" | "campaigns" | "e2e" | "workflow" | "lead-monitor" | "lead-management" | "ai-performance"
  selectedAccount?: string
  accountSelector?: React.ReactNode
  // legacy — kept for backward compat, unused in new design
  viewMode?: "list" | "kanban"
  onViewModeChange?: (mode: "list" | "kanban") => void
  showViewToggle?: boolean
}

const NAV_ITEMS = [
  { value: "dashboard",        label: "AI Performance",      href: "/" },
  { value: "e2e",              label: "Quản lý E2E",         href: (id: string) => `/e2e/${id}?tab=priority&page=1` },
  { value: "lead-monitor",     label: "Lead Monitor",        href: "/lead-monitor" },
  { value: "workflow",         label: "Quản lý Workflow",    href: "/workflow-management" },
]


export function NavigationHeader({ currentPage, selectedAccount, accountSelector }: NavigationHeaderProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const navigate = (item: typeof NAV_ITEMS[number]) => {
    const href = typeof item.href === "function"
      ? item.href(selectedAccount || "placeholder")
      : item.href
    router.push(href)
  }

  return (
    <>
      {/* ── MOBILE ────────────────────────────────────────────────────── */}
      <div className="sm:hidden sticky top-0 z-40 bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex-1 flex justify-center">{accountSelector}</div>
        </div>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="w-64">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 mt-6">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => { navigate(item); setMenuOpen(false) }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors",
                    currentPage === item.value
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                  )}
                >
                  {item.label}
                  {item.value === "lead-monitor" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 ml-0.5" />
                  )}
                </button>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* ── DESKTOP ───────────────────────────────────────────────────── */}
      <div className="hidden sm:flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100">

        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">V</span>
          </div>
          <span className="text-sm font-bold text-gray-800 tracking-tight">Vucar</span>
        </div>

        {/* Nav tabs */}
        <nav className="flex items-center gap-0.5 mx-6 overflow-x-auto scrollbar-none">
          {NAV_ITEMS.map((item) => {
            const active = currentPage === item.value
            return (
              <button
                key={item.value}
                onClick={() => navigate(item)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-gray-100 text-gray-900 font-semibold"
                    : "text-gray-500 font-medium hover:text-gray-800 hover:bg-gray-50"
                )}
              >
                {item.label}
                {item.value === "lead-monitor" && (
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full bg-red-500 shrink-0",
                    active ? "opacity-100" : "opacity-70"
                  )} />
                )}
              </button>
            )
          })}
        </nav>

        {/* Right: account selector + user profile */}
        <div className="flex items-center gap-3 shrink-0">
          {accountSelector}
        </div>
      </div>
    </>
  )
}
