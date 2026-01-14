"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, use, useState } from "react"
import { E2EManagement } from "@/components/e2e-management"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toaster"
import { NavigationHeader } from "@/components/e2e/layout/NavigationHeader"
import { useAccounts } from "@/contexts/AccountsContext"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Mobile account selector
function MobileAccountSelector({
  selectedAccount,
  onAccountChange,
}: {
  selectedAccount: string
  onAccountChange: (value: string) => void
}) {
  const { accounts } = useAccounts()

  return (
    <Select value={selectedAccount} onValueChange={onAccountChange}>
      <SelectTrigger className="w-32 h-9 text-xs">
        <SelectValue placeholder="Tài khoản" />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.uid} value={account.uid}>
            {account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
