export interface DealerBiddingStatus {
  status: "not_sent" | "sent" | "got_price"
  maxPrice?: number
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

export const ACCOUNTS: Account[] = [
  { name: "Dũng", uid: "9ee91b08-448b-4cf4-8b3d-79c6f1c71fef" },
  { name: "Trường", uid: "286af2a8-a866-496a-8ed0-da30df3120ec" },
  { name: "Thư", uid: "2ffa8389-2641-4d8b-98a6-5dc2dd2d20a4" },
  { name: "PTr", uid: "3c9c5780-5e95-44b5-8b9a-ae5b9f8c9053" },
  { name: "Huân Đạt", uid: "0ae61721-214f-49f7-8514-f64ee8438c4f" },
  { name: "Minh Châu", uid: "456cf5f7-2b77-4be4-87bb-43038216dacb" },
  { name: "Bảo Ngân", uid: "d4a2fc3a-2212-4299-b8bb-7ebded7e77c0" },
  { name: "Thanh Hòa", uid: "00d0d47e-2041-4857-a828-83e0c28cb615" },
  { name: "Phát", uid: "4cb28319-9dd0-4951-b9c9-e35e1e8dd578" },
  { name: "Thành Đạt", uid: "66d484b5-91ae-4f27-bf5d-93a8993ab6d7" },
  { name: "Xuân Mai", uid: "b8dec215-1fd3-41e8-8ff0-6d5c103849a8" },
]

export const DECOY_ACCOUNTS: DecoyAccount[] = [
  {
    name: "Minh Anh",
    account: "MA",
    shop_id: "68f5f0f907039cf6ae4581e8",
    default_message: "em dc bên kết nối chào xe. xe nhà mình còn hong. gđ e xin thêm thông tin á anh",
  },
  {
    name: "Huy Hồ",
    account: "HH",
    shop_id: "68c11ae4b7f53ee376145cc2",
    default_message:
      "Em được giới thiệu mình có nhu cầu bán xe em kết bạn để hỏi thêm ít thông tin được không ạ? Xe còn ko a",
  },
]

export const SEGMENT_TO_REASON_MAP: Record<string, string> = {
  negotiation: "Đàm phán/Cứng giá",
  ghost: "Ghost/Lead nguội",
  check_sold: "Check var đã bán chưa",
}

export const ITEMS_PER_PAGE = 10
