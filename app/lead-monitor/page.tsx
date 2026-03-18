"use client"

import { Suspense } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { NavigationHeader } from "@/components/e2e/layout/NavigationHeader"
import { LeadMonitorPage } from "@/components/lead-monitor/LeadMonitorPage"

function LeadMonitorPageContent() {
  const router = useRouter()

  function handleTabChange(value: string) {
    if (value === "dashboard") router.push("/")
    else if (value === "campaigns") router.push("/decoy-management")
    else if (value === "e2e") router.push("/e2e/placeholder?tab=priority&page=1")
    else if (value === "workflow") router.push("/workflow-management")
    // "lead-monitor" stays on current page
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Tabs value="lead-monitor" onValueChange={handleTabChange} className="w-full">
        <NavigationHeader
          currentPage="lead-monitor"
          selectedAccount="placeholder"
          accountSelector={<div className="font-semibold text-gray-700">Lead Monitor</div>}
        />
        <main className="px-2 sm:px-4 py-2">
          <TabsContent value="lead-monitor" className="mt-0">
            <LeadMonitorPage />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  )
}

export default function LeadMonitorRoute() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]">Loading...</div>}>
      <LeadMonitorPageContent />
    </Suspense>
  )
}
