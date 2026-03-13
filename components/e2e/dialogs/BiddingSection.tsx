"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Gavel, Pencil, Check, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatPrice } from "../utils"

interface Campaign {
  id: string
  start_date: string
  duration: string
  is_active: boolean
  min_bid: number
  views: number
  shares: number
  followers: number
  highlight_point: number
}

interface BiddingSectionProps {
  carId: string | undefined | null
}

export function BiddingSection({ carId }: BiddingSectionProps) {
  const { toast } = useToast()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [editingMinBid, setEditingMinBid] = useState<string | null>(null) // campaign id being edited
  const [minBidInput, setMinBidInput] = useState("")
  const [savingMinBid, setSavingMinBid] = useState(false)

  const fetchBidding = useCallback(async () => {
    if (!carId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/vucar/bidding?carId=${encodeURIComponent(carId)}`)
      if (!res.ok) throw new Error(`Failed to fetch bidding: ${res.status}`)
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    } catch (err) {
      console.error("[BiddingSection] Error:", err)
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }, [carId])

  useEffect(() => {
    fetchBidding()
  }, [fetchBidding])

  const handleStartEdit = (campaign: Campaign) => {
    setEditingMinBid(campaign.id)
    // Convert VND to "triệu" display (e.g. 113000000 → "113")
    setMinBidInput(String(Math.round(campaign.min_bid / 1_000_000)))
  }

  const handleCancelEdit = () => {
    setEditingMinBid(null)
    setMinBidInput("")
  }

  const handleSaveMinBid = async (campaign: Campaign) => {
    const trieuValue = parseFloat(minBidInput.replace(/,/g, "").replace(/\./g, ""))
    if (isNaN(trieuValue) || trieuValue <= 0) {
      toast({ title: "Lỗi", description: "Vui lòng nhập giá hợp lệ (đơn vị triệu)", variant: "destructive" })
      return
    }
    const minBidVnd = Math.round(trieuValue * 1_000_000)
    setSavingMinBid(true)
    try {
      const res = await fetch("/api/vucar/bidding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId, minBid: minBidVnd }),
      })
      if (!res.ok) throw new Error(`Failed to update: ${res.status}`)
      toast({ title: "Thành công", description: `Đã cập nhật giá sàn: ${formatPrice(minBidVnd)}` })
      setEditingMinBid(null)
      setMinBidInput("")
      fetchBidding()
    } catch (err) {
      console.error("[BiddingSection] Save error:", err)
      toast({ title: "Lỗi", description: "Không thể cập nhật giá sàn", variant: "destructive" })
    } finally {
      setSavingMinBid(false)
    }
  }

  if (!carId) return null

  return (
    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
      <div className="flex items-center gap-2 mb-4">
        <Gavel className="h-5 w-5 text-amber-600" />
        <h3 className="text-sm font-bold text-amber-800 uppercase">Phiên đấu giá (Bidding)</h3>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-amber-500 ml-auto" />}
      </div>

      {!loading && campaigns.length === 0 && (
        <p className="text-sm text-amber-600 italic">Chưa có phiên đấu giá nào</p>
      )}

      {campaigns.map((campaign) => (
        <div key={campaign.id} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Start Date */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Ngày bắt đầu</p>
            <p className="text-sm font-semibold text-gray-900">
              {campaign.start_date
                ? new Date(campaign.start_date).toLocaleString("vi-VN", {
                  hour: "2-digit", minute: "2-digit",
                  day: "2-digit", month: "2-digit", year: "numeric",
                })
                : "N/A"}
            </p>
          </div>

          {/* Duration */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Thời gian (giờ)</p>
            <p className="text-sm font-semibold text-gray-900">
              {campaign.duration ? `${parseFloat(campaign.duration)} giờ` : "N/A"}
            </p>
          </div>

          {/* Min Bid */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Giá sàn</p>
            {editingMinBid === campaign.id ? (
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  value={minBidInput}
                  onChange={(e) => setMinBidInput(e.target.value)}
                  className="h-8 text-sm w-24 font-semibold text-amber-700"
                  placeholder="Triệu"
                  autoFocus
                />
                <span className="text-xs text-gray-500">tr</span>
                <Button
                  size="sm"
                  className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700"
                  onClick={() => handleSaveMinBid(campaign)}
                  disabled={savingMinBid}
                >
                  {savingMinBid ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={handleCancelEdit}
                  disabled={savingMinBid}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-amber-700">
                  {campaign.min_bid ? formatPrice(campaign.min_bid) : "N/A"}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-amber-600 hover:bg-amber-100"
                  onClick={() => handleStartEdit(campaign)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Trạng thái</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${campaign.is_active
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
              }`}>
              {campaign.is_active ? "🟢 Đang chạy" : "⚪ Đã kết thúc"}
            </span>
          </div>

          {/* Stats row */}
          <div className="col-span-2 md:col-span-4 flex gap-4 pt-1 border-t border-amber-100 mt-1">
            <span className="text-xs text-gray-500">👁️ {campaign.views} lượt xem</span>
            <span className="text-xs text-gray-500">🔗 {campaign.shares} chia sẻ</span>
            <span className="text-xs text-gray-500">⭐ {campaign.followers} theo dõi</span>
          </div>
        </div>
      ))}
    </div>
  )
}
