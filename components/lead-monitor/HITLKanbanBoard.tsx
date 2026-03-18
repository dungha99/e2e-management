"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { HITLLead, StepKey } from "./types"
import { HITLKanbanColumn } from "./HITLKanbanColumn"

interface HITLKanbanBoardProps {
  picId: string
  searchQuery: string
  refreshKey: number
  onResolve: (id: string) => void
  onDetail: (id: string) => void
}

const COLUMNS: { key: StepKey; title: string; dotColor: string }[] = [
  { key: "zalo_connect",       title: "Kết nối Zalo",         dotColor: "bg-blue-500"   },
  { key: "thu_thap_thong_tin", title: "Thu thập thông tin",   dotColor: "bg-purple-500" },
  { key: "dat_lich_kiem_dinh", title: "Đặt lịch KĐ",         dotColor: "bg-amber-500"  },
  { key: "dam_phan_1",         title: "Đàm phán lần 1",       dotColor: "bg-orange-500" },
  { key: "escalation",         title: "Escalation",           dotColor: "bg-red-500"    },
]

const SLA_COLUMN_KEYS: StepKey[] = [
  "zalo_connect",
  "thu_thap_thong_tin",
  "dat_lich_kiem_dinh",
  "dam_phan_1",
]

const DEFAULT_COLUMN: StepKey = "zalo_connect"

/**
 * Return every Kanban column a lead should appear in.
 *
 * Rules:
 * 1. ESCALATION trigger → ["escalation"] only.
 * 2. Collect every step whose condition_end_met === false and whose step_key
 *    maps to a defined SLA column — the lead is shown in ALL of those columns.
 * 3. If no such step exists, fall back to [DEFAULT_COLUMN] so the lead is
 *    always visible somewhere.
 *
 * A lead with multiple failing steps will be duplicated across those columns.
 */
function getColumnKeys(lead: HITLLead): StepKey[] {
  if (lead.trigger.type === "ESCALATION") return ["escalation"]

  const failingKeys = lead.steps
    .filter((s) => s.condition_end_met === false && SLA_COLUMN_KEYS.includes(s.step_key))
    .map((s) => s.step_key)

  return failingKeys.length > 0 ? failingKeys : [DEFAULT_COLUMN]
}

const sortLeads = (a: HITLLead, b: HITLLead): number => {
  const aOvr = a.time_overdue_minutes ?? -Infinity
  const bOvr = b.time_overdue_minutes ?? -Infinity
  if (aOvr !== bOvr) return bOvr - aOvr                                          // most overdue first
  return new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime() // newest LIFO
}

export function HITLKanbanBoard({
  picId,
  searchQuery,
  refreshKey,
  onResolve,
  onDetail,
}: HITLKanbanBoardProps) {
  const [allLeads, setAllLeads] = useState<HITLLead[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (picId !== "all") params.set("pic_id", picId)
      const res = await fetch(`/api/lead-monitor/queue?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAllLeads(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error("[HITLKanbanBoard]", e)
    } finally {
      setIsLoading(false)
    }
  }, [picId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll, refreshKey])

  const handleResolve = (id: string) => {
    setAllLeads((prev) => prev.filter((l) => l.id !== id))
    onResolve(id)
  }

  /**
   * Group and sort leads into columns using getColumnKey.
   * Search filtering is applied here before grouping so every column
   * reflects the same filtered dataset.
   */
  const groupedLeads = useMemo<Record<StepKey, HITLLead[]>>(() => {
    // Initialise empty buckets for every column
    const groups = Object.fromEntries(
      COLUMNS.map((c) => [c.key, [] as HITLLead[]])
    ) as Record<StepKey, HITLLead[]>

    // Optional client-side text search
    const visible = searchQuery
      ? allLeads.filter((lead) => {
          const q = searchQuery.toLowerCase()
          return (
            lead.customer.name.toLowerCase().includes(q) ||
            (lead.customer.phone && lead.customer.phone.includes(q)) ||
            lead.car.model.toLowerCase().includes(q)
          )
        })
      : allLeads

    // Assign each lead to every column where it has a failing step.
    // A lead with multiple condition_end_met=false steps appears in all of them.
    for (const lead of visible) {
      for (const key of getColumnKeys(lead)) {
        groups[key].push(lead)
      }
    }

    // Sort each column independently
    for (const key of Object.keys(groups) as StepKey[]) {
      groups[key].sort(sortLeads)
    }

    return groups
  }, [allLeads, searchQuery])

  return (
    <div className="w-full h-full overflow-x-auto overflow-y-hidden">
      <div className="flex h-full min-h-0 min-w-max">
        {COLUMNS.map((col, index) => {
          const leads = groupedLeads[col.key]
          const hasOverdue = leads.some(
            (l) => l.time_overdue_minutes != null && l.time_overdue_minutes > 0
          )
          return (
            <div key={col.key} className="flex h-full min-h-0">
              <HITLKanbanColumn
                title={col.title}
                dotColor={hasOverdue ? "bg-red-500" : col.dotColor}
                leads={leads}
                isLoading={isLoading}
                onResolve={handleResolve}
                onDetail={onDetail}
              />
              {index < COLUMNS.length - 1 && (
                <div className="w-px bg-gray-200 self-stretch my-2" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
