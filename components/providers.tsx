"use client"

import { ReactNode } from "react"
import { AccountsProvider } from "@/contexts/AccountsContext"
import { QueryProvider } from "@/components/providers/query-provider"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AccountsProvider>{children}</AccountsProvider>
    </QueryProvider>
  )
}
