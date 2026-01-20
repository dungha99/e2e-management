import { useQuery } from "@tanstack/react-query"

interface LeadsCounts {
  priority: number
  nurture: number
  total: number
}

interface LeadsParams {
  uid: string
  tab: "priority" | "nurture"
  page: number
  per_page: number
  search?: string
  sources?: string[]
  refreshKey?: number
}

interface DealerBiddingsParams {
  car_ids: string[]
}

interface LeadsCountParams {
  uid: string
  search?: string
  sources?: string[]
  refreshKey?: number
}

// Hook for fetching lead counts
export function useLeadsCounts({ uid, search = "", sources = [], refreshKey = 0 }: LeadsCountParams) {
  return useQuery<LeadsCounts>({
    queryKey: ["leads-counts", uid, search, sources, refreshKey],
    queryFn: async () => {
      const response = await fetch("/api/e2e/leads/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, search, sources, refreshKey }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch counts: ${response.status}`)
      }

      return response.json()
    },
    enabled: !!uid,
  })
}

// Hook for fetching paginated leads
export function useLeads({ uid, tab, page, per_page, search = "", sources = [], refreshKey = 0 }: LeadsParams) {
  return useQuery({
    queryKey: ["leads", uid, tab, page, per_page, search, sources, refreshKey],
    queryFn: async () => {
      const response = await fetch("/api/e2e/leads/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, tab, page, per_page, search, sources, refreshKey }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch leads: ${response.status}`)
      }

      return response.json()
    },
    enabled: !!uid,
  })
}

// Hook for fetching lead sources (distinct values from DB)
export function useLeadSources(uid: string) {
  return useQuery({
    queryKey: ["lead-sources", uid],
    queryFn: async () => {
      const response = await fetch("/api/e2e/leads/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch sources: ${response.status}`)
      }

      return response.json()
    },
    enabled: !!uid,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })
}

// Hook for fetching dealer biddings (background)
export function useDealerBiddings({ car_ids }: DealerBiddingsParams) {
  return useQuery({
    queryKey: ["dealer-biddings", car_ids],
    queryFn: async () => {
      if (!car_ids || car_ids.length === 0) {
        return {}
      }

      const response = await fetch("/api/e2e/leads/dealer-biddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_ids }),
      })

      if (!response.ok) {
        console.error("[E2E] Failed to fetch dealer biddings:", response.status)
        return {}
      }

      return response.json()
    },
    enabled: car_ids && car_ids.length > 0,
    // Don't retry if it fails - dealer biddings are not critical
    retry: false,
  })
}

// Hook for fetching workflow instances and their details (beta)
export function useWorkflowInstances(carId: string | null | undefined) {
  return useQuery({
    queryKey: ["workflow-instances", carId],
    queryFn: async () => {
      if (!carId) return null
      const response = await fetch(`/api/e2e/workflow-instances?carId=${carId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch workflow instances: ${response.status}`)
      }
      return response.json()
    },
    enabled: !!carId,
  })
}

// Hook for fetching AI insights (mutation-like query)
// This fetches AI recommendation based on completed workflow
export async function fetchAiInsights(carId: string, sourceInstanceId: string, phoneNumber: string, userFeedback?: string) {
  const response = await fetch("/api/e2e/ai-insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ carId, sourceInstanceId, phoneNumber, userFeedback }),
  })

  const data = await response.json()

  // Handle 202 "still processing" status
  if (response.status === 202) {
    throw new Error(data.message || "AI insights are still being processed")
  }

  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch AI insights")
  }

  return data
}
