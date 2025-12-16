"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { User, ChevronLeft } from "lucide-react"
import { ACCOUNTS } from "../types"

interface AccountSelectorProps {
  selectedAccount: string
  onAccountChange: (account: string) => void
  loading?: boolean
  loadingCarIds?: boolean
  isMobile?: boolean
  mobileView?: "list" | "detail"
  onBackToList?: () => void
}

export function AccountSelector({
  selectedAccount,
  onAccountChange,
  loading = false,
  loadingCarIds = false,
  isMobile = false,
  mobileView = "list",
  onBackToList
}: AccountSelectorProps) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    // Only use portal for desktop view
    if (!isMobile) {
      const container = document.getElementById('header-account-selector')
      setPortalContainer(container)
    }
  }, [isMobile])

  // Account selector dropdown component
  const accountSelectorDropdown = (
    <div className="flex items-center gap-2">
      <Label className="text-sm font-medium text-gray-700">Chọn tài khoản:</Label>
      <Select value={selectedAccount} onValueChange={onAccountChange} disabled={loading || loadingCarIds}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Chọn tài khoản..." />
        </SelectTrigger>
        <SelectContent>
          {ACCOUNTS.map((account) => (
            <SelectItem key={account.uid} value={account.uid}>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {account.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  // For desktop, render dropdown via portal into header, no local header
  if (!isMobile && portalContainer) {
    return createPortal(accountSelectorDropdown, portalContainer)
  }

  // For mobile, render the full header with back button
  if (isMobile) {
    return (
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-gray-900 text-lg">
            {mobileView === 'detail' ? (
              <button
                onClick={onBackToList}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="h-5 w-5" />
                <span>Lead OS</span>
              </button>
            ) : (
              'Lead OS'
            )}
          </h1>
          <div className="flex items-center gap-2">
            <Select value={selectedAccount} onValueChange={onAccountChange} disabled={loading || loadingCarIds}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Chọn..." />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNTS.map((account) => (
                  <SelectItem key={account.uid} value={account.uid}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {account.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    )
  }

  // Fallback: render nothing if portal not ready on desktop (prevents flash)
  return null
}
