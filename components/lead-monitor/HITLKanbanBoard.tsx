"use client"

import { StepKey } from "./types"
import { HITLKanbanColumn } from "./HITLKanbanColumn"

interface HITLKanbanBoardProps {
  picId: string
  searchQuery: string
  qualifiedFilter: string
  refreshKey: number
  onResolve: (id: string) => void
  onDetail: (id: string) => void
}

const COLUMNS: { key: StepKey; title: string }[] = [
  { key: "zalo_connect", title: "Kết nối Zalo" },
  { key: "thu_thap_thong_tin", title: "Thu thập thông tin" },
  { key: "dat_lich_kiem_dinh", title: "Đặt lịch KĐ" },
  { key: "dam_phan_1", title: "Đàm phán lần 1" },
  { key: "escalation", title: "Escalation" },
]

export function HITLKanbanBoard({
  picId,
  searchQuery,
  qualifiedFilter,
  refreshKey,
  onResolve,
  onDetail,
}: HITLKanbanBoardProps) {
  return (
    <div className="w-full h-full overflow-x-auto overflow-y-hidden">
      <div className="flex h-full min-h-0 min-w-max">
        {COLUMNS.map((col, index) => (
          <div key={col.key} className="flex h-full min-h-0">
            <HITLKanbanColumn
              stepKey={col.key}
              title={col.title}
              picId={picId}
              searchQuery={searchQuery}
              qualifiedFilter={qualifiedFilter}
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
