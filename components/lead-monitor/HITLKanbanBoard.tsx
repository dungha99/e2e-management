"use client"

import { useMemo } from "react"
import { HITLLead, StepKey } from "./types"
import { HITLKanbanColumn } from "./HITLKanbanColumn"

interface HITLKanbanBoardProps {
  leads: HITLLead[]
  onResolve: (id: string) => void
  onDetail: (id: string) => void
}

const COLUMNS: { key: StepKey; title: string; dotColor: string }[] = [
  { key: "zalo_connect", title: "Kết nối Zalo", dotColor: "bg-blue-500" },
  { key: "thu_thap_thong_tin", title: "Thu thập thông tin", dotColor: "bg-purple-500" },
  { key: "dat_lich_kiem_dinh", title: "Đặt lịch KĐ", dotColor: "bg-amber-500" },
  { key: "dam_phan_1", title: "Đàm phán lần 1", dotColor: "bg-orange-500" },
  { key: "escalation", title: "Escalation", dotColor: "bg-red-500" },
]

export function HITLKanbanBoard({ leads, onResolve, onDetail }: HITLKanbanBoardProps) {
  // Sort and group leads
  const groupedLeads = useMemo(() => {
    // Initialize groups
    const groups: Record<StepKey, HITLLead[]> = {
      zalo_connect: [],
      thu_thap_thong_tin: [],
      dat_lich_kiem_dinh: [],
      dam_phan_1: [],
      escalation: []
    }

    // Sort: most overdue first → closest to breach → newest LIFO
    const sortLeads = (a: HITLLead, b: HITLLead) => {
      const aOvr = a.time_overdue_minutes ?? -Infinity
      const bOvr = b.time_overdue_minutes ?? -Infinity
      if (aOvr !== bOvr) return bOvr - aOvr
      return new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
    }

    // Group leads
    leads.forEach(lead => {
      if (groups[lead.step_key]) {
        groups[lead.step_key].push(lead)
      }
    })

    // Sort each group
    Object.keys(groups).forEach(key => {
      groups[key as StepKey].sort(sortLeads)
    })

    return groups
  }, [leads])

  return (
    <div className="w-full h-full overflow-x-auto overflow-y-hidden">
      <div className="flex h-full min-h-0 min-w-max">
        {COLUMNS.map((col, index) => (
          <div key={col.key} className="flex h-full min-h-0">
            <HITLKanbanColumn
              title={col.title}
              dotColor={col.dotColor}
              leads={groupedLeads[col.key]}
              onResolve={onResolve}
              onDetail={onDetail}
            />
            {index < COLUMNS.length - 1 && (
              <div className="w-px bg-gray-200 self-stretch my-2" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
