"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw } from "lucide-react"

interface Job {
  phone: string
  account: string
  is_sent: boolean
}

interface LeadEnrichment {
  carInfo: string
  leadInfo: string
  loading: boolean
}

export function JobsDashboard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [leadEnrichments, setLeadEnrichments] = useState<Map<string, LeadEnrichment>>(new Map())
  const cacheRef = useRef<Map<string, any>>(new Map())

  useEffect(() => {
    console.log("[v0] JobsDashboard mounted, fetching jobs...")
    fetchJobs()
  }, [])

  useEffect(() => {
    console.log("[v0] Search query changed:", searchQuery)
    if (searchQuery.trim()) {
      const filtered = jobs.filter(
        (job) => job.phone.includes(searchQuery) || job.account.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      console.log("[v0] Filtered jobs:", filtered.length, "of", jobs.length)
      setFilteredJobs(filtered)
    } else {
      console.log("[v0] Showing all jobs:", jobs.length)
      setFilteredJobs(jobs)
    }
  }, [searchQuery, jobs])

  async function fetchJobs() {
    console.log("[v0] Fetching all jobs from API...")
    setLoading(true)
    try {
      const response = await fetch("/api/decoy/all")
      const data = await response.json()
      console.log("[v0] Fetched", data.length, "jobs:", data)
      setJobs(data)
      setFilteredJobs(data)

      console.log("[v0] Starting lead data enrichment for", data.length, "jobs...")
      enrichLeadData(data)
    } catch (error) {
      console.error("[v0] Error fetching jobs:", error)
    } finally {
      setLoading(false)
    }
  }

  async function enrichLeadData(jobsList: Job[]) {
    console.log("[v0] Initializing enrichment for", jobsList.length, "jobs...")
    const newEnrichments = new Map<string, LeadEnrichment>()

    jobsList.forEach((job) => {
      newEnrichments.set(job.phone, {
        carInfo: "",
        leadInfo: "",
        loading: true,
      })
    })
    setLeadEnrichments(newEnrichments)

    for (const job of jobsList) {
      // Check cache first
      if (cacheRef.current.has(job.phone)) {
        console.log("[v0] Using cached data for phone:", job.phone)
        const cachedData = cacheRef.current.get(job.phone)
        updateEnrichment(job.phone, cachedData)
        continue
      }

      // Fetch from API
      console.log("[v0] Fetching lead context for phone:", job.phone)
      try {
        const response = await fetch("/api/leads/lead-context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: job.phone }),
        })

        const data = await response.json()
        console.log("[v0] Lead context response for", job.phone, ":", data)

        cacheRef.current.set(job.phone, data)
        console.log("[v0] Cached data for phone:", job.phone)

        updateEnrichment(job.phone, data)
      } catch (error) {
        console.error("[v0] Error enriching phone:", job.phone, error)
        setLeadEnrichments((prev) => {
          const updated = new Map(prev)
          updated.set(job.phone, {
            carInfo: "Error loading",
            leadInfo: "Error loading",
            loading: false,
          })
          return updated
        })
      }
    }
    console.log("[v0] Lead data enrichment complete!")
  }

  function updateEnrichment(phone: string, data: any) {
    const carInfo = data.car_info
      ? `${data.car_info.year || ""} ${data.car_info.brand || ""} ${data.car_info.model || ""} - ${data.car_info.mileage || 0}km`.trim()
      : "No data"

    const leadInfo = data.lead_info
      ? `${data.lead_info.name || "Unknown"} - ${data.lead_info.stage || "N/A"}`
      : "No data"

    console.log("[v0] Updated enrichment for", phone, "- Car:", carInfo, "Lead:", leadInfo)

    setLeadEnrichments((prev) => {
      const updated = new Map(prev)
      updated.set(phone, {
        carInfo,
        leadInfo,
        loading: false,
      })
      return updated
    })
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Campaign Jobs Status</CardTitle>
          <Button onClick={fetchJobs} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Input
            placeholder="Search by phone or account..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Phone Number</th>
                      <th className="px-4 py-3 text-left font-medium">Account</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Thông tin xe</th>
                      <th className="px-4 py-3 text-left font-medium">Thông tin Lead</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredJobs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                          No jobs found
                        </td>
                      </tr>
                    ) : (
                      filteredJobs.map((job, idx) => {
                        const enrichment = leadEnrichments.get(job.phone)
                        return (
                          <tr key={idx} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs">{job.phone}</td>
                            <td className="px-4 py-3">{job.account}</td>
                            <td className="px-4 py-3">
                              <Badge variant={job.is_sent ? "default" : "secondary"}>
                                {job.is_sent ? "Sent" : "Pending"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              {enrichment?.loading ? (
                                <div className="flex gap-2">
                                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">{enrichment?.carInfo || "—"}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {enrichment?.loading ? (
                                <div className="flex gap-2">
                                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">{enrichment?.leadInfo || "—"}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Showing {filteredJobs.length} of {jobs.length} jobs
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
