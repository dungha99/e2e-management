"use client"

import { useSearchParams } from "next/navigation"

export default function LeadDetailPage({
  params,
}: {
  params: { userId: string; leadId: string }
}) {
  const searchParams = useSearchParams()
  const view = searchParams.get("view") || "workflow"

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-8 py-8">
        <h1>Lead Detail: {params.leadId}</h1>
        <p>User: {params.userId}</p>
        <p>Current View: {view}</p>
        {/* Lead detail component will go here */}
      </main>
    </div>
  )
}
