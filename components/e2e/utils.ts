import { Lead, DealerBiddingStatus } from "./types"

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price)
}

export function formatPriceShort(price: number | null | undefined): string {
  if (!price || price === 0) return "N/A"

  // Convert to millions and format as "Xtr"
  const millions = price / 1000000
  if (millions >= 1) {
    // Round to nearest integer for millions
    return `${Math.round(millions)}tr`
  }
  // For values less than 1 million, show in thousands
  const thousands = price / 1000
  return `${Math.round(thousands)}k`
}

export function calculateCampaignProgress(publishedAt: string, duration: number | null): number {
  if (!duration || duration <= 0) return 0

  const startDate = new Date(publishedAt)
  const now = new Date()
  const elapsedMs = now.getTime() - startDate.getTime()
  const elapsedHours = elapsedMs / (1000 * 60 * 60) // duration is in HOURS

  // Progress as percentage of duration (hours)
  const progress = (elapsedHours / duration) * 100
  return Math.min(100, Math.max(0, Math.round(progress)))
}

export function calculateRemainingTime(publishedAt: string, duration: number | null): string {
  if (!duration || duration <= 0) return ""

  const startDate = new Date(publishedAt)
  const now = new Date()
  const elapsedMs = now.getTime() - startDate.getTime()
  const durationMs = duration * 60 * 60 * 1000 // duration is in HOURS to ms
  const remainingMs = durationMs - elapsedMs

  if (remainingMs <= 0) return "Hết hạn"

  // Convert to hours, minutes, seconds
  const totalSeconds = Math.floor(remainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  // Format as hh:mm:ss
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  return `Còn ${hh}:${mm}:${ss}`
}

export function getDealerBiddingDisplay(status?: DealerBiddingStatus): string {
  if (!status) return "Not Sent"
  switch (status.status) {
    case "not_sent":
      return "Not Sent"
    case "sent":
      return "Sent"
    case "got_price":
      return status.maxPrice ? formatPrice(status.maxPrice) : "Got Price"
    default:
      return "Not Sent"
  }
}

export function formatCarInfo(lead: Lead): string {
  const parts = []
  if (lead.brand) parts.push(lead.brand)
  if (lead.model) parts.push(lead.model)
  if (lead.variant) parts.push(lead.variant)
  if (lead.year) parts.push(lead.year.toString())
  if (lead.mileage) parts.push(`${lead.mileage.toLocaleString()}km`)
  return parts.length > 0 ? parts.join(" ") : "N/A"
}

export function handlePriceFormat(
  value: string,
  setter: (value: string) => void
): void {
  // Remove non-digits
  const rawValue = value.replace(/\D/g, "")
  if (rawValue === "") {
    setter("")
    return
  }

  const numValue = parseFloat(rawValue)

  // Format with dots for thousands (standard vi-VN)
  setter(numValue.toLocaleString("vi-VN"))
}

/**
 * Parse shorthand price input. If value < 10,000, treat as millions (e.g., 500 -> 500,000,000)
 * This makes it easier for users to input large VND values.
 */
export function parseShorthandPrice(priceStr: string): number | undefined {
  if (!priceStr) return undefined
  // Remove all dots and commas before parsing
  const cleaned = priceStr.replace(/[.,]/g, "")
  let val = parseFloat(cleaned)

  // If value < 10,000, assume it's a shortcut for millions (e.g. 350 -> 350,000,000)
  if (!isNaN(val) && val < 10000) {
    val *= 1000000
  }
  return isNaN(val) ? undefined : val
}

/**
 * Format a full price value for editing display.
 * Converts to shorthand if it's a clean million value.
 * E.g., 500,000,000 -> "500" (for display in input field)
 */
export function formatPriceForEdit(price: number | null | undefined): string {
  if (!price || price === 0) return ""

  // If price is a clean million value (divisible by 1,000,000 with no remainder),
  // AND the result is less than 10,000, show shorthand
  if (price >= 1000000 && price % 1000000 === 0) {
    const millions = price / 1000000
    if (millions < 10000) {
      return millions.toString()
    }
  }

  // Otherwise, show full formatted value
  return price.toLocaleString("vi-VN")
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-"
  return new Date(dateString).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function getStageStyle(stage: string | null | undefined): string {
  switch (stage) {
    case "T1.1":
    case "T1.2":
    case "T1.3":
      return "bg-red-100 text-red-800 border-red-200"
    case "T0":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "T99":
      return "bg-green-100 text-green-800 border-green-200"
    case "T1.0":
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

/**
 * Format a date as relative time in Vietnamese
 * e.g., "2 giờ trước", "3 ngày trước", "1 tuần trước"
 */
export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Chưa có hoạt động"

  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  if (diffMs < 0) return "Vừa xong"

  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (diffMinutes < 1) return "Vừa xong"
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  if (diffHours < 24) return `${diffHours} giờ trước`
  if (diffDays < 7) return `${diffDays} ngày trước`
  if (diffWeeks < 4) return `${diffWeeks} tuần trước`
  if (diffMonths < 12) return `${diffMonths} tháng trước`

  return formatDate(dateStr)
}

/**
 * Get activity freshness status based on last activity time
 * Returns: 'fresh' (< 24h), 'recent' (1-3 days), 'stale' (> 3 days)
 */
export type ActivityFreshness = 'fresh' | 'recent' | 'stale' | 'none'

export function getActivityFreshness(dateStr: string | null | undefined): ActivityFreshness {
  if (!dateStr) return 'none'

  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours < 24) return 'fresh'
  if (diffHours < 72) return 'recent' // 3 days
  return 'stale'
}

/**
 * Get CSS class for activity freshness color
 */
export function getActivityFreshnessClass(freshness: ActivityFreshness): string {
  switch (freshness) {
    case 'fresh':
      return 'text-green-600'
    case 'recent':
      return 'text-yellow-600'
    case 'stale':
      return 'text-red-500'
    case 'none':
    default:
      return 'text-gray-400'
  }
}
