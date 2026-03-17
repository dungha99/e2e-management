export type BlockerType = "SLA_BREACH" | "ESCALATION" | "MANUAL"
export type BlockerStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "BYPASSED"
export type Severity = "NORMAL" | "WARN" | "CRITICAL"

export type StepKey = "zalo_connect" | "thu_thap_thong_tin" | "dat_lich_kiem_dinh" | "dam_phan_1" | "escalation"

export interface CustomerInfo {
  name: string
  avatar: string | null
  phone: string | null
  location: string | null
}

export interface CarInfoBlock {
  model: string
  year: number
  odo: number | null
  location: string | null
  price_expected: number | null // Giá kỳ vọng
  price_max: number | null // Giá trần
  thumbnail: string | null
  has_images: boolean
}

export type StepStatus = "success" | "failed" | "ongoing" | "not_started" | "terminated"

export interface StepProgress {
  step_key: StepKey
  label: string
  status: StepStatus
  is_overdue: boolean
  condition_end_met: boolean
}

export interface TriggerInfo {
  type: BlockerType
  severity: Severity
  // Only for SLA
  hours_breached?: number
  time_string?: string // e.g. "Vượt 2:05:00" or "Còn 1:30:00"
  // Only for Escalation
  intent?: string // e.g. "Nghi ngờ lừa đảo"
  keywords?: string[] // e.g. ["lừa đảo", "không tin"]
}

export interface HITLLead {
  id: string
  car_id: string
  pic_id: string
  pic_name?: string
  step_key: StepKey
  customer: CustomerInfo
  car: CarInfoBlock
  trigger: TriggerInfo
  is_bot_active: boolean
  triggered_at: string
  steps: StepProgress[]
  time_overdue_minutes?: number // positive = overdue, negative = time remaining
}

export interface KPISummary {
  critical_alerts: number
  total_alerts: number
  sla_breach: number
  escalation: number
  bot_handled_percent: number
  bot_handled_count: number
  total_active_leads: number
}
