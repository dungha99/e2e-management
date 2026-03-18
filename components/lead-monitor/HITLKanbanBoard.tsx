"use client"

import { StepKey } from "./types"
import { HITLKanbanColumn } from "./HITLKanbanColumn"

interface HITLKanbanBoardProps {
  picId: string
  searchQuery: string
  refreshKey: number
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

export function HITLKanbanBoard({ picId, searchQuery, refreshKey, onResolve, onDetail }: HITLKanbanBoardProps) {
  return (
    <div className="w-full h-full overflow-x-auto overflow-y-hidden">
      <div className="flex h-full min-h-0 min-w-max">
        {COLUMNS.map((col, index) => (
          <div key={col.key} className="flex h-full min-h-0">
            <HITLKanbanColumn
              title={col.title}
              dotColor={col.dotColor}
              stepKey={col.key}
              picId={picId}
              searchQuery={searchQuery}
              refreshKey={refreshKey}
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
