export interface DealerBiddingStatus {
  status: "not_sent" | "sent" | "got_price"
  maxPrice?: number
}

export interface InspectionSchedule {
  location: string
  inspector: string
  scheduled_at: string  // ISO timestamp from sale_activities.created_at
}

export interface LatestCampaignInfo {
  id: string
  is_active: boolean
  duration: number | null
  published_at: string
  workflow_order: number
  created_by: string | null
}

export interface ChatMessage {
  _id: string
  content: string
  uidFrom: string
  timestamp: number
  dateAction: string
  type: string
  img?: string
}

export interface Lead {
  id: string
  name: string
  phone: string | null
  identify_number: string | null
  bank_account_number: string | null
  otp_verified: string
  created_at: string
  pic_id: string | null
  pic_og: string
  source: string | null
  url: string | null
  additional_phone: string | null
  qx_qc_scoring: string | null
  customer_feedback: string | null
  is_referral: boolean
  car_id?: string | null
  dealer_bidding?: DealerBiddingStatus
  bot_active?: boolean
  price_customer?: number | null
  brand?: string | null
  model?: string | null
  variant?: string | null
  display_name?: string | null
  year?: number | null
  plate?: string | null
  stage?: string | null
  has_enough_images?: boolean
  first_message_sent?: boolean
  session_created?: boolean
  decoy_thread_count?: number
  total_decoy_messages?: number  // Customer reply count for new reply detection
  notes?: string | null
  price_highest_bid?: number | null
  pic_name?: string | null
  location?: string | null
  mileage?: number | null
  is_primary?: boolean
  bidding_session_count?: number
  workflow2_is_active?: boolean | null
  car_auction_id?: string | null
  has_active_campaigns?: boolean
  additional_images?: {
    paper?: Array<{ key: string, url: string, name: string, type: string }>
    inside?: Array<{ key: string, url: string, name: string, type: string }>
    outside?: Array<{ key: string, url: string, name: string, type: string }>
    [key: string]: Array<{ key: string, url: string, name: string, type: string }> | undefined
  }
  sku?: string | null
  car_created_at?: string | null
  image?: string | null
  qualified?: string | null
  intentionLead?: string | null
  negotiationAbility?: string | null
  latest_campaign?: LatestCampaignInfo | null
  last_activity_at?: string | null  // ISO timestamp of most recent sale activity
  inspection_schedule?: InspectionSchedule | null  // Parsed from INSPECTION_COMPLETED activity
}

export interface DecoyMessage {
  content: string
  sender: string
  displayed_at: string
}

export interface DecoyThread {
  id: string
  bot_name: string
  created_at: string
  messages: DecoyMessage[]
}

export interface BiddingHistory {
  id: string
  dealer_id: string
  dealer_name: string
  car_id: string
  price: number
  created_at: string
  comment: string | null
}

export interface WinCaseHistory {
  id: string
  car_id: string
  dealer_id: string | null
  dealer_name: string
  sold_date: string
  price_sold: number | null
  negotiation_ability: string | null
  car_condition: string | null
  phone: string | null
  car_info: {
    brand: string
    model: string
    variant: string | null
    year: number | null
    mileage?: number | null
  }
}

export interface Dealer {
  id: string
  name: string
  group_zalo_name: string | null
}

export interface DealerGroup {
  groupId: string
  groupName: string
  dealerId: string | null
}

export interface Account {
  name: string
  uid: string
}

export interface DecoyAccount {
  name: string
  account: string
  shop_id: string
  default_message: string
}

// ACCOUNTS is now loaded dynamically from the database via /api/accounts
// Use the useAccounts hook from @/contexts/AccountsContext to access accounts

export const DECOY_ACCOUNTS: DecoyAccount[] = [
  {
    name: "Hùng Taxi",
    account: "HT",
    shop_id: "68ff3282-a3cd-ba1d-a71a-1b7100000000",
    default_message: "Anh ơi, em là tài xế công nghệ đang cần mua xe gấp để chạy kiếm sống. Em thấy xe nhà anh đăng bán, không biết xe còn không ạ?",
  },
  {
    name: "Huy Hồ",
    account: "HH",
    shop_id: "68c11ae4-b7f5-3ee3-7614-5cc200000000",
    default_message: "Em được giới thiệu mình có nhu cầu bán xe em kết bạn để hỏi thêm ít thông tin được không ạ? Xe còn ko a",
  },
  {
    name: "Minh Anh",
    account: "MA",
    shop_id: "68f5f0f9-0703-9cf6-ae45-81e800000000",
    default_message: "em dc bên kết nối chào xe. xe nhà mình còn hong. gđ e xin thêm thông tin á anh",
  },
]

export const SEGMENT_TO_REASON_MAP: Record<string, string> = {
  negotiation: "Đàm phán/Cứng giá",
  ghost: "Ghost/Lead nguội",
  check_sold: "Check var đã bán chưa",
}

export const ITEMS_PER_PAGE = 10

// E2E Workflow Tracking Types
export type OutcomeType = "discount" | "original_price" | "lost"
export type InstanceStatus = "running" | "completed" | "terminated"
export type StepStatus = "pending" | "success" | "failed"

export interface WorkflowStage {
  id: string
  name: string
}

export type CustomFieldType = "text" | "number" | "date" | "select" | "textarea"

export interface CustomFieldDefinition {
  name: string
  label: string
  type: CustomFieldType
  required: boolean
  placeholder?: string
  options?: string[] // For select type
  default_value?: any
}

export interface Workflow {
  id: string
  name: string
  stage_id: string
  sla_hours: number
  is_active: boolean
  description: string | null
  custom_fields_schema?: CustomFieldDefinition[]
}

export interface WorkflowStep {
  id: string
  workflow_id: string
  step_name: string
  step_order: number
  is_automated: boolean
}

export interface WorkflowInstance {
  id: string
  car_id: string
  workflow_id: string
  parent_instance_id: string | null
  current_step_id: string | null
  status: InstanceStatus
  final_outcome: OutcomeType | null
  started_at: string
  sla_deadline: string | null
  completed_at: string | null
  transition_properties?: {
    insight: string
    car_snapshot: {
      display_name: string | null
      intention: string | null
      sales_stage: string | null
      qualified_status: string | null
      price_customer: number | null
      price_highest_bid: number | null
      gap_price: number | null
    }
    custom_fields: Record<string, any>
  } | null
  // Joined data
  workflow_name?: string
  workflow_description?: string
  stage_name?: string
}

export interface StepExecution {
  id: string
  instance_id: string
  step_id: string
  status: StepStatus
  error_message: string | null
  executed_at: string
  // Joined data
  step_name?: string
  step_order?: number
  is_automated?: boolean
}

export interface WorkflowTransition {
  id: string
  from_workflow_id: string
  to_workflow_id: string
  condition_logic: any
  priority: number
  transition_sla_hours: number | null
}

export interface WorkflowInstanceWithDetails {
  instance: WorkflowInstance
  steps: (WorkflowStep & { execution?: StepExecution })[]
  canActivateWF2: boolean
  potentialNextWorkflows?: { id: string; name: string }[]
}

export interface AiInsightAnalysis {
  current_intent_detected: string
  price_gap_evaluation: string
  fit_score: number
}

export interface AiInsight {
  id: string
  car_id: string
  source_instance_id: string
  ai_insight_summary: AiInsightAnalysis
  selected_transition_id: string
  target_workflow_id: string
  created_at: string
  // Joined data
  target_workflow_name?: string
}
