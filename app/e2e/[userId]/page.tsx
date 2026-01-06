"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, use, useState } from "react"
import { E2EManagement } from "@/components/e2e-management"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toaster"
import { MobileNavigationHeader } from "@/components/e2e/layout/MobileNavigationHeader"
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
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Navigation Header */}
      <MobileNavigationHeader
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

      <main className="px-2 md:px-4 py-4">
        <Tabs value="e2e" onValueChange={handleTabChange} className="w-full">
          {/* Desktop Navigation - Hidden on mobile */}
          <div className="hidden md:flex items-center justify-between mb-6">
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="campaigns">Quản lý Decoy</TabsTrigger>
              <TabsTrigger value="e2e">Quản lý E2E</TabsTrigger>
              <TabsTrigger value="workflow">Quản lý Workflow</TabsTrigger>
            </TabsList>
            {/* Portal targets for AccountSelector and View Mode Toggle */}
            <div className="flex items-center gap-4">
              <div id="header-account-selector"></div>
              <div id="header-view-toggle"></div>
            </div>
          </div>

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
        </Tabs>
      </main>
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
