import { Lead, DealerBiddingStatus } from "./types"

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price)
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
