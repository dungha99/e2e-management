"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { PicOption } from "./types"
import { KPIRibbon } from "./KPIRibbon"
import { HITLKanbanBoard } from "./HITLKanbanBoard"
import { PerformanceWatch } from "./PerformanceWatch"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Search, RotateCcw, LayoutList, LayoutGrid, Filter, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SubTab = "monitor" | "performance"

export function LeadMonitorPage() {
  const [picOptions, setPicOptions] = useState<PicOption[]>([])
  const [picOptionsLoading, setPicOptionsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [subTab, setSubTab] = useState<SubTab>("monitor")
  const [selectedPicId, setSelectedPicId] = useState<string>("all")
  const [refreshKey, setRefreshKey] = useState(0)
  const [picPopoverOpen, setPicPopoverOpen] = useState(false)

  const fetchMeta = useCallback(async () => {
    setPicOptionsLoading(true)
    try {
      const res = await fetch("/api/lead-monitor/pic-options")
      if (res.ok) {
        const pics = await res.json()
        setPicOptions(Array.isArray(pics) ? pics : [])
      }
    } catch (error) {
      console.error("Failed to fetch Lead Monitor meta:", error)
    } finally {
      setPicOptionsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMeta()
  }, [fetchMeta])

  const handleRefresh = () => {
    fetchMeta()
    setRefreshKey((k) => k + 1)
  }

  const displayKpis = useMemo(() => {
    if (selectedPicId === "all") {
      return {
        needsAction: picOptions.reduce((s, p) => s + p.slaBreachCount, 0),
        escalation: picOptions.reduce((s, p) => s + p.escalationCount, 0),
        botActive: picOptions.reduce((s, p) => s + p.botActiveCount, 0),
      }
    }
    const pic = picOptions.find((p) => p.id === selectedPicId)
    return {
      needsAction: pic?.slaBreachCount ?? 0,
      escalation: pic?.escalationCount ?? 0,
      botActive: pic?.botActiveCount ?? 0,
    }
  }, [selectedPicId, picOptions])

  const handleResolve = async (id: string) => {
    try {
      await fetch("/api/lead-monitor/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocker_id: id }),
      })
    } catch (error) {
      console.error("Failed to resolve blocker:", error)
    }
  }

  const handleDetail = (id: string) => {
    console.log("Open detail for lead:", id)
  }

  const selectedPicName =
    selectedPicId === "all"
      ? "Tất cả PIC"
      : (picOptions.find((p) => p.id === selectedPicId)?.name ?? "Tất cả PIC")

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] w-full overflow-hidden bg-white/50">
      {/* Top Section */}
      <div className="px-4 pt-4">
        {/* Sub-navigation & Actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">Lead Monitor</h2>
              <span className="w-2 h-2 rounded-full bg-red-500 translate-y-[-6px]" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sub-tabs */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSubTab("monitor")}
                className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${subTab === "monitor" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                Monitor Queue
              </button>
              <button
                onClick={() => setSubTab("performance")}
                className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${subTab === "performance" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                Watch Performance
              </button>
            </div>

            {/* View toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button className="px-2.5 py-1.5 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 rounded-md">
                <LayoutList className="w-3.5 h-3.5" /> List
              </button>
              <button className="px-2.5 py-1.5 text-sm font-semibold bg-white shadow-sm rounded-md text-gray-900 flex items-center gap-1.5 border border-gray-200">
                <LayoutGrid className="w-3.5 h-3.5" /> Kanban
              </button>
            </div>

            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5 h-9 font-medium">
              <RotateCcw className={`w-3.5 h-3.5 ${picOptionsLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <KPIRibbon
          needsAction={displayKpis.needsAction}
          escalation={displayKpis.escalation}
          botActive={displayKpis.botActive}
          loading={picOptionsLoading}
        />

        {/* Search & Filters — only on Monitor tab */}
        {subTab === "monitor" && (
          <div className="flex items-center gap-3 mb-5">
            {/* Search */}
            <div className="relative flex-1 max-w-[340px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Tìm theo tên, SĐT, xe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-white border-gray-200 rounded-lg focus-visible:ring-1 focus-visible:ring-blue-500 text-sm"
              />
            </div>

            {/* PIC filter — Combobox */}
            <Popover open={picPopoverOpen} onOpenChange={setPicPopoverOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 w-[220px] h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left truncate">
                  <Filter className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="flex-1 truncate text-gray-700">{selectedPicName}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Tìm tên PIC..." className="h-9 text-sm" />
                  <CommandList>
                    <CommandEmpty>Không tìm thấy PIC.</CommandEmpty>
                    <CommandGroup>
                      {/* "Tất cả PIC" option */}
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setSelectedPicId("all")
                          setPicPopoverOpen(false)
                        }}
                        className="flex items-center gap-2"
                      >
                        <Check className={cn("w-3.5 h-3.5 shrink-0", selectedPicId === "all" ? "opacity-100" : "opacity-0")} />
                        <span className="flex-1">Tất cả PIC</span>
                      </CommandItem>

                      {/* Per-PIC options */}
                      {picOptions.map((pic) => (
                        <CommandItem
                          key={pic.id}
                          value={pic.name}
                          onSelect={() => {
                            setSelectedPicId(pic.id)
                            setPicPopoverOpen(false)
                          }}
                          className="flex items-center gap-2"
                        >
                          <Check className={cn("w-3.5 h-3.5 shrink-0", selectedPicId === pic.id ? "opacity-100" : "opacity-0")} />
                          <span className="flex-1 truncate">{pic.name}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {pic.slaBreachCount > 0 && (
                              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                                {pic.slaBreachCount} SLA
                              </span>
                            )}
                            {pic.escalationCount > 0 && (
                              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">
                                {pic.escalationCount} ESC
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Workspace */}
      <div className="flex-1 overflow-hidden px-1">
        {subTab === "monitor" ? (
          <HITLKanbanBoard
            picId={selectedPicId}
            searchQuery={searchQuery}
            refreshKey={refreshKey}
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
