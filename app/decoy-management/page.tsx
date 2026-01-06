"use client"

import { useRouter } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toaster"
import { CampaignCreationPanel } from "@/components/campaign-creation-panel"
import { JobsDashboard } from "@/components/jobs-dashboard"
import { AccountStatusPanel } from "@/components/account-status-panel"
import { MobileNavigationHeader } from "@/components/e2e/layout/MobileNavigationHeader"
import { useAccounts } from "@/contexts/AccountsContext"
import { createPortal } from "react-dom"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

// Account Selector Component for Decoy Management
function DecoyAccountSelector({
    selectedAccount,
    onAccountChange,
}: {
    selectedAccount: string
    onAccountChange: (value: string) => void
}) {
    const { accounts: ACCOUNTS } = useAccounts()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    const portalTarget = document.getElementById("header-account-selector")
    if (!portalTarget) return null

    return createPortal(
        <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Người phụ trách:</span>
            <Select value={selectedAccount} onValueChange={onAccountChange}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Chọn tài khoản" />
                </SelectTrigger>
                <SelectContent>
                    {ACCOUNTS.map((account) => (
                        <SelectItem key={account.uid} value={account.uid}>
                            {account.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>,
        portalTarget
    )
}

// Compact mobile account selector
function MobileAccountSelector({
    selectedAccount,
    onAccountChange,
}: {
    selectedAccount: string
    onAccountChange: (value: string) => void
}) {
    const { accounts: ACCOUNTS } = useAccounts()

    return (
        <Select value={selectedAccount} onValueChange={onAccountChange}>
            <SelectTrigger className="w-32 h-9 text-xs">
                <SelectValue placeholder="Tài khoản" />
            </SelectTrigger>
            <SelectContent>
                {ACCOUNTS.map((account) => (
                    <SelectItem key={account.uid} value={account.uid}>
                        {account.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

// Separate component to use search params
function DecoyManagementPageContent() {
    const router = useRouter()
    const { accounts: ACCOUNTS } = useAccounts()
    const [selectedAccount, setSelectedAccount] = useState("")

    // Load account from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem("e2e-selectedAccount")
        if (stored) {
            setSelectedAccount(stored)
        } else if (ACCOUNTS.length > 0) {
            setSelectedAccount(ACCOUNTS[0].uid)
        }
    }, [ACCOUNTS])

    // Handle account change
    function handleAccountChange(value: string) {
        setSelectedAccount(value)
        localStorage.setItem("e2e-selectedAccount", value)
    }

    function handleTabChange(value: string) {
        if (value === "dashboard") {
            router.push("/")
        } else if (value === "e2e") {
            const picId = selectedAccount || "placeholder"
            router.push(`/e2e/${picId}?tab=priority&page=1`)
        } else if (value === "workflow") {
            router.push("/workflow-management")
        }
        // If value is "campaigns", stay on current page
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Mobile Navigation Header */}
            <MobileNavigationHeader
                currentPage="campaigns"
                selectedAccount={selectedAccount}
                accountSelector={
                    <MobileAccountSelector
                        selectedAccount={selectedAccount}
                        onAccountChange={handleAccountChange}
                    />
                }
            />

            <main className="px-2 md:px-4 py-4">
                <Tabs value="campaigns" onValueChange={handleTabChange} className="w-full">
                    {/* Desktop Navigation - Hidden on mobile */}
                    <div className="hidden md:flex items-center justify-between mb-6">
                        <TabsList>
                            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                            <TabsTrigger value="campaigns">Quản lý Decoy</TabsTrigger>
                            <TabsTrigger value="e2e">Quản lý E2E</TabsTrigger>
                            <TabsTrigger value="workflow">Quản lý Workflow</TabsTrigger>
                        </TabsList>
                        {/* Portal target for AccountSelector */}
                        <div id="header-account-selector"></div>
                    </div>

                    {/* Account Selector */}
                    <DecoyAccountSelector
                        selectedAccount={selectedAccount}
                        onAccountChange={handleAccountChange}
                    />

                    <TabsContent value="campaigns" className="mt-0">
                        <div className="flex gap-6">
                            {/* Left Sidebar - Account Status Panel (Sticky) */}
                            <div className="w-72 flex-shrink-0">
                                <div className="sticky top-4">
                                    <AccountStatusPanel />
                                </div>
                            </div>

                            {/* Right Side - Main Content */}
                            <div className="flex-1 space-y-6 min-w-0">
                                {/* Campaign Creation Panel - Gửi bot */}
                                <CampaignCreationPanel />

                                {/* Jobs Dashboard */}
                                <JobsDashboard />
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </main>
            <Toaster />
        </div>
    )
}

export default function DecoyManagementPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <DecoyManagementPageContent />
        </Suspense>
    )
}
