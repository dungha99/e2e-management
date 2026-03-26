"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { PicOption } from "./types"
import { KPIRibbon } from "./KPIRibbon"
import { HITLKanbanBoard } from "./HITLKanbanBoard"
import { PerformanceWatch } from "./PerformanceWatch"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Search, RotateCcw, User, ChevronsUpDown, Check } from "lucide-react"
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
  const [qualifiedFilter, setQualifiedFilter] = useState<string>("all")
  const [qualifiedPopoverOpen, setQualifiedPopoverOpen] = useState(false)

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
      // Aggregate zaloReasonBreakdown across all PICs
      const mergedBreakdown: Record<string, number> = {}
      picOptions.forEach((p) => {
        if (p.zaloReasonBreakdown) {
          Object.entries(p.zaloReasonBreakdown).forEach(([cat, count]) => {
            mergedBreakdown[cat] = (mergedBreakdown[cat] ?? 0) + count
          })
        }
      })
      return {
        needsAction: picOptions.reduce((s, p) => s + p.slaBreachCount, 0),
        escalation: picOptions.reduce((s, p) => s + p.escalationCount, 0),
        botActive: picOptions.reduce((s, p) => s + p.botActiveCount, 0),
        undefinedCount: picOptions.reduce((s, p) => s + (p.undefinedQualifiedCount ?? 0), 0),
        noZaloActionCount: picOptions.reduce((s, p) => s + (p.noZaloActionCount ?? 0), 0),
        zaloReasonBreakdown: mergedBreakdown,
      }
    }
    const pic = picOptions.find((p) => p.id === selectedPicId)
    return {
      needsAction: pic?.slaBreachCount ?? 0,
      escalation: pic?.escalationCount ?? 0,
      botActive: pic?.botActiveCount ?? 0,
      undefinedCount: pic?.undefinedQualifiedCount ?? 0,
      noZaloActionCount: pic?.noZaloActionCount ?? 0,
      zaloReasonBreakdown: pic?.zaloReasonBreakdown ?? {},
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
          <div className="flex items-center gap-3">
            {/* Search — only on Monitor tab */}
            {subTab === "monitor" && (
              <div className="relative w-[340px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Tìm theo tên, SĐT, xe..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-white border-gray-200 rounded-lg focus-visible:ring-1 focus-visible:ring-blue-500 text-sm"
                />
              </div>
            )}

            {/* PIC filter — only on Monitor tab */}
            {subTab === "monitor" && (
              <Popover open={picPopoverOpen} onOpenChange={setPicPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={picPopoverOpen}
                    className="w-[220px] h-9 justify-between text-sm font-normal bg-white border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <User className="h-4 w-4 shrink-0 text-gray-500" />
                      <span className="truncate">{selectedPicName}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Tìm tên PIC..." className="h-9 text-sm" />
                    <CommandList>
                      <CommandEmpty>Không tìm thấy PIC.</CommandEmpty>
                      <CommandGroup>
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
            )}

            {/* Qualified filter — only on Monitor tab */}
            {subTab === "monitor" && (
              <Popover open={qualifiedPopoverOpen} onOpenChange={setQualifiedPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={qualifiedPopoverOpen}
                    className="w-[160px] h-9 justify-between text-sm font-normal bg-white border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        qualifiedFilter === "all" ? "bg-gray-300" :
                          qualifiedFilter === "strong" ? "bg-emerald-500" :
                            qualifiedFilter === "weak" ? "bg-amber-500" : "bg-gray-400"
                      )} />
                      <span>{qualifiedFilter === "all" ? "Tất cả trạng thái" : qualifiedFilter.toUpperCase()}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <Command>
                    <CommandList>
                      <CommandGroup>
                        {[
                          { id: "all", label: "Tất cả trạng thái", color: "bg-gray-300" },
                          { id: "strong", label: "STRONG", color: "bg-emerald-500" },
                          { id: "weak", label: "WEAK", color: "bg-amber-500" },
                          { id: "undefined", label: "UNDEFINED", color: "bg-gray-400" },
                        ].map((opt) => (
                          <CommandItem
                            key={opt.id}
                            onSelect={() => {
                              setQualifiedFilter(opt.id)
                              setQualifiedPopoverOpen(false)
                            }}
                            className="flex items-center gap-2"
                          >
                            <Check className={cn("w-3.5 h-3.5 shrink-0", qualifiedFilter === opt.id ? "opacity-100" : "opacity-0")} />
                            <div className={cn("w-2 h-2 rounded-full", opt.color)} />
                            <span className="flex-1">{opt.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
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

            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5 h-9 font-medium">
              <RotateCcw className={`w-3.5 h-3.5 ${picOptionsLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

      </div>

        {/* KPI Ribbon — only on Monitor tab */}
        {subTab === "monitor" && (
          <KPIRibbon
            needsAction={displayKpis.needsAction}
            escalation={displayKpis.escalation}
            botActive={displayKpis.botActive}
            undefinedCount={displayKpis.undefinedCount}
            noZaloActionCount={displayKpis.noZaloActionCount}
            zaloReasonBreakdown={displayKpis.zaloReasonBreakdown}
            loading={picOptionsLoading}
          />
        )}

      {/* Workspace */}
      <div className="flex-1 overflow-hidden px-1">
        {subTab === "monitor" ? (
          <HITLKanbanBoard
            picId={selectedPicId}
            searchQuery={searchQuery}
            qualifiedFilter={qualifiedFilter}
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
