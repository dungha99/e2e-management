"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, use, useState } from "react"
import { E2EManagement } from "@/components/e2e-management"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toaster"
import { NavigationHeader } from "@/components/e2e/layout/NavigationHeader"
import { useAccounts } from "@/contexts/AccountsContext"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Mobile account selector
function MobileAccountSelector({
  selectedAccount,
  onAccountChange,
}: {
  selectedAccount: string
  onAccountChange: (value: string) => void
}) {
  const { accounts } = useAccounts()
  const [open, setOpen] = useState(false)
  const selectedName = accounts.find((a) => a.uid === selectedAccount)?.name ?? "Tài khoản"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center justify-between gap-1 w-32 h-9 px-2.5 text-xs bg-background border border-input rounded-md hover:bg-accent transition-colors truncate">
          <span className="truncate">{selectedName}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="end">
        <Command>
          <CommandInput placeholder="Tìm tài khoản..." className="h-9 text-sm" />
          <CommandList>
            <CommandEmpty>Không tìm thấy.</CommandEmpty>
            <CommandGroup>
              {accounts.map((account) => (
                <CommandItem
                  key={account.uid}
                  value={account.name}
                  onSelect={() => {
                    onAccountChange(account.uid)
                    setOpen(false)
                  }}
                  className="flex items-center gap-2 text-sm"
                >
                  <Check className={cn("w-3.5 h-3.5 shrink-0", selectedAccount === account.uid ? "opacity-100" : "opacity-0")} />
                  {account.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// Separate component to use search params
function E2EPageContent({ userId }: { userId: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()

  // View mode state
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list")

  // Read URL params
  const tab = (searchParams.get("tab") as "priority" | "nurture") || "priority"
  const page = parseInt(searchParams.get("page") || "1")
  const search = searchParams.get("search") || ""
  const sources = searchParams.get("sources")?.split(",").filter(Boolean) || []

  function handleTabChange(value: string) {
    if (value === "dashboard") {
      router.push("/")
    } else if (value === "campaigns") {
      router.push(`/decoy-management`)
    } else if (value === "lead-monitor") {
      router.push("/lead-monitor")
    } else if (value === "workflow") {
      router.push("/workflow-management")
    }
    // If value is "e2e", stay on current page
  }

  function handleAccountChange(newUserId: string) {
    router.push(`/e2e/${newUserId}?tab=priority&page=1`)
    // Also update localStorage for backward compatibility if needed, though E2EManagement seems to handle it too.
    if (typeof window !== 'undefined') {
      localStorage.setItem('e2e-selectedAccount', newUserId);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Tabs value="e2e" onValueChange={handleTabChange} className="w-full">
        {/* Unified Navigation Header (Mobile + Desktop) */}
        <NavigationHeader
          currentPage="e2e"
          selectedAccount={userId}
          accountSelector={
            <MobileAccountSelector
              selectedAccount={userId}
              onAccountChange={handleAccountChange}
            />
          }
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showViewToggle={true}
        />

        <main className="px-2 sm:px-4 py-4">
          <TabsContent value="e2e" className="mt-0">
            <E2EManagement
              userId={userId}
              initialTab={tab}
              initialPage={page}
              initialSearch={search}
              initialSources={sources}
              initialViewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </TabsContent>
        </main>
      </Tabs>
      <Toaster />
    </div>
  )
}

export default function E2EPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <E2EPageContent userId={userId} />
    </Suspense>
  )
}
