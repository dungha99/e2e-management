"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { User, ChevronLeft, Check, ChevronsUpDown } from "lucide-react"
import { useAccounts } from "@/contexts/AccountsContext"
import { cn } from "@/lib/utils"

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
  const { accounts: ACCOUNTS } = useAccounts()
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Only use portal for desktop view
    if (!isMobile) {
      const container = document.getElementById('header-account-selector')
      setPortalContainer(container)
    }
  }, [isMobile])

  const selectedAccountName = ACCOUNTS.find((acc) => acc.uid === selectedAccount)?.name || "Chọn tài khoản..."

  // Account selector dropdown component
  const accountSelectorDropdown = (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-48 justify-between"
            disabled={loading || loadingCarIds}
          >
            <div className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">{selectedAccountName}</span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-0">
          <Command>
            <CommandInput placeholder="Tìm tài khoản..." />
            <CommandList>
              <CommandEmpty>Không tìm thấy tài khoản.</CommandEmpty>
              <CommandGroup>
                {ACCOUNTS.map((account) => (
                  <CommandItem
                    key={account.uid}
                    value={account.name}
                    onSelect={() => {
                      onAccountChange(account.uid)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedAccount === account.uid ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <User className="mr-2 h-4 w-4" />
                    {account.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )

  // For desktop, render dropdown via portal into header, no local header
  if (!isMobile && portalContainer) {
    return createPortal(accountSelectorDropdown, portalContainer)
  }

  // For mobile, render the full header with back button
  if (isMobile) {
    return (
      <div className="bg-white border-b px-4 py-3 safe-area-top">
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
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-32 justify-between"
                  disabled={loading || loadingCarIds}
                >
                  <div className="flex items-center gap-2 truncate">
                    <User className="h-4 w-4 shrink-0" />
                    <span className="truncate text-xs">{selectedAccountName}</span>
                  </div>
                  <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-0">
                <Command>
                  <CommandInput placeholder="Tìm tài khoản..." />
                  <CommandList>
                    <CommandEmpty>Không tìm thấy tài khoản.</CommandEmpty>
                    <CommandGroup>
                      {ACCOUNTS.map((account) => (
                        <CommandItem
                          key={account.uid}
                          value={account.name}
                          onSelect={() => {
                            onAccountChange(account.uid)
                            setOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedAccount === account.uid ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <User className="mr-2 h-4 w-4" />
                          {account.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    )
  }

  // Fallback: render nothing if portal not ready on desktop (prevents flash)
  return null
}
