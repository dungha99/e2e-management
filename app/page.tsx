"use client"

import { useRef, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AccountStatusPanel } from "@/components/account-status-panel"
import { CampaignCreationPanel } from "@/components/campaign-creation-panel"
import { CampaignHistory } from "@/components/campaign-history"
import { Dashboard } from "@/components/dashboard"
import { E2EManagement } from "@/components/e2e-management"
import { OnboardingModal } from "@/components/onboarding-modal"
import { PasskeyGate } from "@/components/passkey-gate"
import { Toaster } from "@/components/ui/toaster"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function DecoyCampaignManager() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const accountStatusRef = useRef<{ refresh: () => void }>(null)
  const campaignHistoryRef = useRef<{ refresh: () => void }>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    const authStatus = localStorage.getItem("decoy_authenticated")
    setIsAuthenticated(authStatus === "true")
    setIsCheckingAuth(false)
  }, [])

  useEffect(() => {
    const hasSeenIntro = localStorage.getItem("decoyToolIntroSeen")
    if (!hasSeenIntro || hasSeenIntro === "false") {
      setShowOnboarding(true)
    }
  }, [])

  function handleCampaignExecuted() {
    console.log("[v0] Campaign executed, refreshing Account Status and Campaign History...")
    accountStatusRef.current?.refresh()
    campaignHistoryRef.current?.refresh()
  }

  function handleOpenOnboarding() {
    setShowOnboarding(true)
  }

  function handleTabChange(value: string) {
    if (value === "e2e") {
      // When E2E tab is selected, redirect to dedicated E2E route
      const selectedAccount = localStorage.getItem('e2e-selectedAccount')
      if (selectedAccount) {
        // Preserve any existing URL params or use defaults
        const tab = searchParams.get("tab") || "priority"
        const page = searchParams.get("page") || "1"
        router.push(`/e2e/${selectedAccount}?tab=${tab}&page=${page}`)
      } else {
        // If no account selected, still navigate but let the page handle showing account selector
        router.push('/e2e/placeholder?tab=priority&page=1')
      }
    } else if (value === "dashboard") {
      // Navigate to root without tab param (default)
      router.push('/')
    } else {
      // For other tabs (campaigns), update URL with tab param
      router.push(`/?tab=${value}`)
    }
  }

  if (isCheckingAuth) {
    return null // or a loading spinner
  }

  if (!isAuthenticated) {
    return <PasskeyGate onAuthenticated={() => setIsAuthenticated(true)} />
  }

  // Read tab from URL or default to dashboard
  const currentTab = searchParams.get("tab") || "dashboard"

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="container mx-auto px-8 py-8 flex-1">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="campaigns">Quản lý Decoy</TabsTrigger>
              <TabsTrigger value="e2e">Quản lý E2E</TabsTrigger>
            </TabsList>
            <div id="header-account-selector"></div>
          </div>

          <TabsContent value="dashboard">
            <Dashboard />
          </TabsContent>

          <TabsContent value="campaigns">
            <div className="flex gap-8">
              {/* Left Column - Account Status (30%) */}
              <div className="w-[30%]">
                <AccountStatusPanel ref={accountStatusRef} />
              </div>

              {/* Right Column - Campaign Creation + Campaign History (70%) */}
              <div className="w-[70%] flex flex-col gap-8">
                <CampaignCreationPanel
                  onCampaignExecuted={handleCampaignExecuted}
                  onOpenOnboarding={handleOpenOnboarding}
                />
                <CampaignHistory ref={campaignHistoryRef} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="e2e">
            <E2EManagement />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border bg-card mt-auto">
        <div className="container mx-auto px-8 py-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-semibold text-amber-900 mb-2">Lưu ý:</h3>
            <div className="text-sm text-amber-800 space-y-2">
              <p>
                Việc bạn sử dụng công cụ này đồng nghĩa với việc bạn tuân thủ{" "}
                <strong>Thỏa thuận Không tiết lộ Thông tin (NDA)</strong> đã ký trong hợp đồng lao động.
              </p>
              <p>
                <strong>Sử dụng có trách nhiệm:</strong> sử dụng công cụ một cách cẩn trọng và phù hợp, tuyệt đối không
                chia sẻ, sao chép hay tiết lộ ra bên ngoài dưới mọi hình thức.
              </p>
            </div>
          </div>
        </div>
      </footer>

      <OnboardingModal open={showOnboarding} onOpenChange={setShowOnboarding} />
      <Toaster />
    </div>
  )
}
