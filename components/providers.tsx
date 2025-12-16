"use client"

import { ReactNode } from "react"
import { AccountsProvider } from "@/contexts/AccountsContext"

export function Providers({ children }: { children: ReactNode }) {
  return <AccountsProvider>{children}</AccountsProvider>
}
