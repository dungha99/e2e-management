"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { PasskeyGate } from "@/components/passkey-gate"
import { Toaster } from "@/components/ui/toaster"

function MainPageContent() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    const authStatus = localStorage.getItem("decoy_authenticated")
    setIsAuthenticated(authStatus === "true")
    setIsCheckingAuth(false)
  }, [])

  useEffect(() => {
    if (!isCheckingAuth && isAuthenticated) {
      // Redirect to E2E management page
      const selectedAccount = localStorage.getItem('e2e-selectedAccount')
      const picId = selectedAccount || 'placeholder'
      router.replace(`/e2e/${picId}?tab=campaigns&page=1`)
    }
  }, [isCheckingAuth, isAuthenticated, router])

  if (isCheckingAuth) {
    return null // or a loading spinner
  }

  if (!isAuthenticated) {
    return <PasskeyGate onAuthenticated={() => setIsAuthenticated(true)} />
  }

  // Show loading while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-muted-foreground">Redirecting...</div>
      <Toaster />
    </div>
  )
}

export default function MainPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <MainPageContent />
    </Suspense>
  )
}
