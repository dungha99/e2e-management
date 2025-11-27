"use client"

import { useRef, useEffect, useState } from "react"
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

  if (isCheckingAuth) {
    return null // or a loading spinner
  }

  if (!isAuthenticated) {
    return <PasskeyGate onAuthenticated={() => setIsAuthenticated(true)} />
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-foreground">Decoy Campaign Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage Zalo messaging campaigns</p>
        </div>
      </header>

      <main className="container mx-auto px-8 py-8 flex-1">
        <Tabs defaultValue="campaigns" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="campaigns">Quản lý Decoy</TabsTrigger>
            <TabsTrigger value="e2e">Quản lý E2E</TabsTrigger>
          </TabsList>

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
