export interface DealerBiddingStatus {
  status: "not_sent" | "sent" | "got_price"
  maxPrice?: number
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
