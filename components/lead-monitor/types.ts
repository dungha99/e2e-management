export type BlockerType = "SLA_BREACH" | "ESCALATION" | "MANUAL"
export type BlockerStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "BYPASSED"
export type Severity = "NORMAL" | "WARN" | "CRITICAL"

export type StepKey = "zalo_connect" | "thu_thap_thong_tin" | "dat_lich_kiem_dinh" | "dam_phan_1" | "escalation"

export type ZaloErrorCategory =
  | "BLOCKED_STRANGER"
  | "DECLINED_MESSAGES"
  | "NO_UID_FOUND"
  | "CONTACT_NOT_FOUND"
  | "TIMEOUT"
  | "SEARCH_FAILED"
  | "OTHER"

export interface ZaloErrorSegment {
  category: ZaloErrorCategory
  action_type: string        // addFriend | firstMessage | rename
  count: number
  latest_detail: string      // raw error message for tooltip
  latest_at: string          // ISO timestamp
}

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
  // dat_lich_kiem_dinh
  inspection_exists?: boolean
  // dam_phan_1
  price_sold?: number | null
  stage?: string
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
  qualified_status?: string | null // e.g. "STRONG_QUALIFIED", "SLOW", etc.
  zalo_errors?: ZaloErrorSegment[]
}

export interface KPISummary {
  critical_alerts: number
  total_alerts: number
  sla_breach: number
  escalation: number
  needs_action_count: number  // SLA exceeded + condition_end_met=false, each lead = 1
  bot_handled_percent: number
  bot_handled_count: number
  total_active_leads: number
}

export interface PaginatedLeadsResponse {
  items: HITLLead[]
  next_cursor: string | null
  has_more: boolean
  total: number
}

export interface PicOption {
  id: string
  name: string
  slaBreachCount: number   // leads with condition_end_met=false AND exceeds SLA (each = 1)
  escalationCount: number
  botActiveCount: number   // leads in monitoring queue with bot_status = 'active'
  undefinedQualifiedCount: number  // leads with ss.qualified = 'UNDEFINED_QUALIFIED'
  zaloReasonBreakdown: Record<string, number>  // category → #leads (e.g. { BLOCKED_STRANGER: 5 })
  noZaloActionCount: number  // leads in zalo_connect SLA with zero zalo_action records
}
