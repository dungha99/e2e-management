"use client"

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
  return (
    <div className={`bg-white border-b ${isMobile ? 'px-4 py-3' : 'px-8 py-4'}`}>
      <div className="flex items-center justify-between">
        <h1 className={`font-bold text-gray-900 ${isMobile ? 'text-lg' : 'text-2xl'}`}>
          {isMobile && mobileView === 'detail' ? (
            <button
              onClick={onBackToList}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="h-5 w-5" />
              <span>Lead OS</span>
            </button>
          ) : (
            isMobile ? 'Lead OS' : 'Quản lý E2E'
          )}
        </h1>
        <div className="flex items-center gap-2">
          {!isMobile && <Label className="text-sm font-medium text-gray-700">Chọn tài khoản:</Label>}
          <Select value={selectedAccount} onValueChange={onAccountChange} disabled={loading || loadingCarIds}>
            <SelectTrigger className={isMobile ? 'w-32' : 'w-48'}>
              <SelectValue placeholder={isMobile ? 'Chọn...' : 'Chọn tài khoản...'} />
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
