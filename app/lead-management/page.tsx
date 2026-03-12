"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Tabs } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toaster"
import { NavigationHeader } from "@/components/e2e/layout/NavigationHeader"
import { useAccounts } from "@/contexts/AccountsContext"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ── Types ──────────────────────────────────────────────────────────────
interface LeadCard {
  id: string
  name: string
  phone: string | null
  car_id: string | null
  brand: string | null
  model: string | null
  variant: string | null
  year: number | null
  stage: string | null
  price_customer: number | null
  price_highest_bid: number | null
  notes: string | null
  source: string | null
  created_at: string
  pic_name: string | null
  mileage: number | null
  location: string | null
  plate: string | null
  has_enough_images: boolean
  first_message_sent: boolean
  session_created: boolean
  bidding_session_count: number
  bot_active: boolean
  intentionLead: string | null
  negotiationAbility: string | null
  qualified: string | null
}

// ── Stage definitions ──────────────────────────────────────────────────
const STAGES = [
  { key: "UNDEFINED", label: "Chưa xác định", color: "bg-slate-500", bgLight: "bg-slate-50 border-slate-200" },
  { key: "CANNOT_CONTACT", label: "Không liên lạc được", color: "bg-gray-500", bgLight: "bg-gray-50 border-gray-200" },
  { key: "CONTACTED", label: "Đã liên lạc", color: "bg-blue-500", bgLight: "bg-blue-50 border-blue-200" },
  { key: "NEGOTIATION", label: "Đang đàm phán", color: "bg-amber-500", bgLight: "bg-amber-50 border-amber-200" },
  { key: "CAR_VIEW", label: "Xem xe", color: "bg-purple-500", bgLight: "bg-purple-50 border-purple-200" },
  { key: "DEPOSIT_PAID", label: "Đã đặt cọc", color: "bg-emerald-500", bgLight: "bg-emerald-50 border-emerald-200" },
  { key: "COMPLETED", label: "Hoàn thành", color: "bg-green-600", bgLight: "bg-green-50 border-green-200" },
  { key: "FAILED", label: "Thất bại", color: "bg-red-500", bgLight: "bg-red-50 border-red-200" },
]

function getStageInfo(stage: string | null | undefined) {
  return STAGES.find(s => s.key === (stage || "UNDEFINED")) || STAGES[0]
}

function formatPrice(price: number | null | undefined): string {
  if (!price) return "—"
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(0)}tr`
  if (price >= 1_000) return `${(price / 1_000).toFixed(0)}k`
  return price.toString()
}

// ── Account selector ───────────────────────────────────────────────────
function AccountSelector({
  selectedAccount,
  onAccountChange,
}: {
  selectedAccount: string
  onAccountChange: (v: string) => void
}) {
  const { accounts } = useAccounts()
  return (
    <Select value={selectedAccount} onValueChange={onAccountChange}>
      <SelectTrigger className="w-36 h-9 text-xs">
        <SelectValue placeholder="Tài khoản" />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.uid} value={a.uid}>{a.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ── Lead Card Component ────────────────────────────────────────────────
function LeadCardItem({ lead, onClick }: { lead: LeadCard; onClick?: () => void }) {
  const carInfo = [lead.brand, lead.model, lead.variant].filter(Boolean).join(" ")
  const yearStr = lead.year ? `${lead.year}` : ""
  const displayCar = carInfo ? `${carInfo}${yearStr ? ` ${yearStr}` : ""}` : "Chưa có thông tin xe"

  // Determine actionable state (stable across re-renders using lead ID)
  const charCode = lead.id ? lead.id.charCodeAt(0) + lead.id.charCodeAt(lead.id.length - 1) : 0
  const colorMod = charCode % 3
  
  const isActionable = colorMod === 1 || colorMod === 2
  
  let bgColorClass = "bg-white border-gray-100 opacity-60 grayscale-[0.2]"
  let indicator = null
  
  if (colorMod === 1) {
    bgColorClass = "bg-emerald-50 border-emerald-200 border-l-4 border-l-emerald-500 shadow-sm"
    indicator = <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
  } else if (colorMod === 2) {
    bgColorClass = "bg-rose-50 border-rose-200 border-l-4 border-l-rose-500 shadow-sm"
    indicator = <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
  }

  return (
    <div 
      onClick={onClick}
      className={`${bgColorClass} rounded-lg border p-3 hover:shadow-md transition-all cursor-pointer relative`}
    >
      {/* Header: name + phone */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {indicator}
          <h4 className={`text-sm ${isActionable ? 'font-bold text-gray-900' : 'font-medium text-gray-600'} truncate flex-1`}>
            {lead.name || "—"}
          </h4>
        </div>
        {lead.phone && (
          <span className="text-[11px] text-gray-400 font-mono shrink-0">{lead.phone}</span>
        )}
      </div>

      {/* Car info */}
      <p className="text-xs text-gray-600 truncate mb-2">{displayCar}</p>

      {/* Price row */}
      <div className="flex items-center gap-3 text-[11px]">
        <span className="text-gray-500">
          KH: <strong className="text-gray-700">{formatPrice(lead.price_customer)}</strong>
        </span>
        <span className="text-gray-500">
          DL: <strong className="text-emerald-600">{formatPrice(lead.price_highest_bid)}</strong>
        </span>
      </div>
    </div>
  )
}

// ── Kanban Column ──────────────────────────────────────────────────────
function StageColumn({ stageInfo, leads, onLeadClick }: { stageInfo: typeof STAGES[0]; leads: LeadCard[]; onLeadClick: (lead: LeadCard) => void }) {
  return (
    <div className="flex-shrink-0 w-[300px] min-w-[300px] flex flex-col h-full">
      {/* Column header */}
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-lg border ${stageInfo.bgLight}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${stageInfo.color}`} />
        <h3 className="text-sm font-semibold text-gray-700 truncate">{stageInfo.label}</h3>
        <span className="ml-auto text-xs font-medium text-gray-400 bg-white/80 px-1.5 py-0.5 rounded">
          {leads.length}
        </span>
      </div>

      {/* Column content */}
      <ScrollArea className="flex-1 border-x border-b border-gray-200 rounded-b-lg bg-gray-50/50">
        <div className="p-2 space-y-2">
          {leads.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs italic">Không có lead</div>
          ) : (
            leads.map(lead => <LeadCardItem key={`${lead.id}-${lead.car_id}`} lead={lead} onClick={() => onLeadClick(lead)} />)
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ── Main Content ───────────────────────────────────────────────────────
function LeadManagementContent() {
  const router = useRouter()
  const { accounts } = useAccounts()
  const [picId, setPicId] = useState<string>("")
  const [leads, setLeads] = useState<LeadCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize picId from localStorage or first account
  useEffect(() => {
    const stored = localStorage.getItem("e2e-selectedAccount")
    if (stored) {
      setPicId(stored)
    } else if (accounts.length > 0) {
      setPicId(accounts[0].uid)
    }
  }, [accounts])

  // Fetch all leads (both priority + nurture) for this PIC
  const fetchLeads = useCallback(async () => {
    if (!picId) return
    setLoading(true)
    setError(null)

    try {
      // Fetch both tabs in parallel with large page size
      const [priorityRes, nurtureRes] = await Promise.all([
        fetch("/api/e2e/leads/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: picId, tab: "priority", page: 1, per_page: 200 }),
        }),
        fetch("/api/e2e/leads/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: picId, tab: "nurture", page: 1, per_page: 200 }),
        }),
      ])

      if (!priorityRes.ok || !nurtureRes.ok) throw new Error("Failed to fetch leads")

      const [priorityData, nurtureData] = await Promise.all([priorityRes.json(), nurtureRes.json()])
      const allLeads = [...(priorityData.leads || []), ...(nurtureData.leads || [])]
      setLeads(allLeads)
    } catch (err) {
      console.error("[LeadManagement] Error:", err)
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi")
    } finally {
      setLoading(false)
    }
  }, [picId])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Group leads by stage
  const groupedLeads: Record<string, LeadCard[]> = {}
  for (const stage of STAGES) {
    groupedLeads[stage.key] = []
  }
  for (const lead of leads) {
    const key = lead.stage && STAGES.some(s => s.key === lead.stage) ? lead.stage : "UNDEFINED"
    groupedLeads[key].push(lead)
  }
  
  // Sort leads within each column so actionable (mod 1 or 2) are at the top
  for (const stageKey in groupedLeads) {
    groupedLeads[stageKey].sort((a, b) => {
      const charCodeA = a.id ? a.id.charCodeAt(0) + a.id.charCodeAt(a.id.length - 1) : 0
      const charCodeB = b.id ? b.id.charCodeAt(0) + b.id.charCodeAt(b.id.length - 1) : 0
      const isActionableA = charCodeA % 3 !== 0
      const isActionableB = charCodeB % 3 !== 0
      
      if (isActionableA && !isActionableB) return -1
      if (!isActionableA && isActionableB) return 1
      
      // If same priority, sort by created date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }

  const totalCount = leads.length

  function handleAccountChange(newPicId: string) {
    setPicId(newPicId)
    localStorage.setItem("e2e-selectedAccount", newPicId)
  }

  function handleTabChange(value: string) {
    if (value === "e2e") {
      const selectedAccount = localStorage.getItem("e2e-selectedAccount") || picId
      router.push(`/e2e/${selectedAccount}?tab=priority&page=1`)
    } else if (value === "workflow") {
      router.push("/workflow-management")
    } else if (value === "campaigns") {
      router.push("/decoy-management")
    } else if (value === "dashboard") {
      router.push("/")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Tabs value="lead-management" onValueChange={handleTabChange} className="w-full">
        <NavigationHeader
          currentPage="lead-management"
          selectedAccount={picId}
          accountSelector={
            <AccountSelector selectedAccount={picId} onAccountChange={handleAccountChange} />
          }
        />

      <main className="px-2 sm:px-4 py-4">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-800">Lead Management</h1>
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Users className="h-4 w-4" />
              {totalCount} leads
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLeads} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Loading */}
        {loading && leads.length === 0 && (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <p className="text-sm text-gray-500">Đang tải leads...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-red-500">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchLeads}>
                <RefreshCw className="h-4 w-4 mr-2" /> Thử lại
              </Button>
            </div>
          </div>
        )}

        {/* Kanban board */}
        {!loading && !error && (
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4" style={{ height: "calc(100vh - 160px)" }}>
              {STAGES.map(stageInfo => (
                <StageColumn
                  key={stageInfo.key}
                  stageInfo={stageInfo}
                  leads={groupedLeads[stageInfo.key]}
                  onLeadClick={(lead) => {
                    const selectedAccount = localStorage.getItem("e2e-selectedAccount") || picId
                    const phoneToUse = lead.phone || (lead as any).additional_phone
                    const query = phoneToUse ? `?leadPhone=${phoneToUse}&leadId=${lead.id}` : `?leadId=${lead.id}`
                    router.push(`/e2e/${selectedAccount}${query}`)
                  }}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </main>
      </Tabs>
      <Toaster />
    </div>
  )
}

// ── Page Export ─────────────────────────────────────────────────────────
export default function LeadManagementPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <LeadManagementContent />
    </Suspense>
  )
}
