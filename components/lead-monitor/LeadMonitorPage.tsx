"use client"

import { useState, useEffect, useMemo } from "react"
import { HITLLead } from "./types"
import { KPIRibbon } from "./KPIRibbon"
import { HITLKanbanBoard } from "./HITLKanbanBoard"
import { PerformanceWatch } from "./PerformanceWatch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, RotateCcw, LayoutList, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"

type SubTab = "monitor" | "performance"

export function LeadMonitorPage() {
  const [leads, setLeads] = useState<HITLLead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [subTab, setSubTab] = useState<SubTab>("monitor")
  const [selectedPicId, setSelectedPicId] = useState<string>("all")

  const picOptions = useMemo(() => {
    const map = new Map<string, string>()
    leads.forEach((l) => {
      if (l.pic_id && !map.has(l.pic_id)) map.set(l.pic_id, l.pic_name || l.pic_id)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [leads])

  // Derive KPI counts directly from loaded leads
  const kpis = useMemo(() => ({
    total: leads.length,
    escalation: leads.filter((l) => l.trigger.type === "ESCALATION").length,
    botActive: leads.filter((l) => l.is_bot_active).length,
  }), [leads])

  const fetchData = async () => {
    setLoading(true)
    try {
      const queueUrl = selectedPicId !== "all"
        ? `/api/lead-monitor/queue?pic_id=${encodeURIComponent(selectedPicId)}`
        : "/api/lead-monitor/queue"

      const res = await fetch(queueUrl)
      const data = await res.json()
      setLeads(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Failed to fetch Lead Monitor data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch on mount and whenever PIC filter changes
  useEffect(() => {
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPicId])

  const handleResolve = async (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id))
    try {
      await fetch("/api/lead-monitor/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocker_id: id }),
      })
    } catch (error) {
      console.error("Failed to resolve blocker:", error)
      fetchData()
    }
  }

  const handleDetail = (id: string) => {
    console.log("Open detail for lead:", id)
  }

  // Client-side text search (PIC filter is handled server-side)
  const filteredLeads = leads.filter((lead) => {
    const q = searchQuery.toLowerCase()
    return (
      lead.customer.name.toLowerCase().includes(q) ||
      (lead.customer.phone && lead.customer.phone.includes(q)) ||
      lead.car.model.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] w-full overflow-hidden bg-white/50">
      {/* Top Section */}
      <div className="px-4 pt-4">
        {/* Sub-navigation & Actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-gray-400 font-normal">Quản lý Lead</span>
              <span className="text-gray-300">›</span>
              Lead Monitor
              <span className="w-2 h-2 rounded-full bg-red-500 ml-1 translate-y-[-4px]" />
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSubTab("monitor")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${subTab === "monitor" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                Monitor Queue
              </button>
              <button
                onClick={() => setSubTab("performance")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${subTab === "performance" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                Watch Performance
              </button>
            </div>

            <div className="flex bg-gray-100/80 rounded-lg p-1 border">
              <button className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <LayoutList className="w-4 h-4" /> List
              </button>
              <button className="px-2 py-1.5 text-sm font-medium bg-white shadow-sm rounded border border-gray-200 text-gray-900 flex items-center gap-1">
                <LayoutGrid className="w-4 h-4" /> Kanban
              </button>
            </div>

            <Button variant="outline" size="sm" onClick={fetchData} className="gap-2 h-9">
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* KPIs — derived from loaded leads */}
        <KPIRibbon
          total={kpis.total}
          escalation={kpis.escalation}
          botActive={kpis.botActive}
          loading={loading}
        />

        {/* Search & Filters — only on Monitor tab */}
        {subTab === "monitor" && (
          <div className="flex items-center gap-3 mb-6">
            <div className="relative w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Tìm theo tên, SĐT, xe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-transparent border-t-0 border-x-0 border-b-2 rounded-none focus-visible:ring-0 focus-visible:border-blue-500 shadow-none px-0"
              />
            </div>

            <Select value={selectedPicId} onValueChange={setSelectedPicId}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="Tất cả PIC" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả PIC</SelectItem>
                {picOptions.map((pic) => (
                  <SelectItem key={pic.id} value={pic.id}>
                    {pic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Workspace */}
      <div className="flex-1 overflow-hidden px-1">
        {subTab === "monitor" ? (
          <HITLKanbanBoard
            leads={filteredLeads}
            onResolve={handleResolve}
            onDetail={handleDetail}
          />
        ) : (
          <PerformanceWatch />
        )}
      </div>
    </div>
  )
}
