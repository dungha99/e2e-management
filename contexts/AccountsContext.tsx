"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { Account } from "@/components/e2e/types"

interface AccountsContextType {
  accounts: Account[]
  loading: boolean
  error: string | null
  refreshAccounts: () => Promise<void>
}

const AccountsContext = createContext<AccountsContextType | undefined>(undefined)

export function AccountsProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/accounts")

      if (!response.ok) {
        throw new Error("Failed to fetch accounts")
      }

      const data = await response.json()
      setAccounts(data)
    } catch (err) {
      console.error("Error fetching accounts:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch accounts")
      // Set empty array on error to prevent crashes
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  const refreshAccounts = async () => {
    await fetchAccounts()
  }

  return (
    <AccountsContext.Provider value={{ accounts, loading, error, refreshAccounts }}>
      {children}
    </AccountsContext.Provider>
  )
}

export function useAccounts() {
  const context = useContext(AccountsContext)
  if (context === undefined) {
    throw new Error("useAccounts must be used within an AccountsProvider")
  }
  return context
}
