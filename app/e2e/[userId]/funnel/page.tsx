"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, use, useState, useEffect } from "react"
import { NavigationHeader } from "@/components/e2e/layout/NavigationHeader"
import { LeadFunnelBreakdown } from "@/components/e2e/layout/LeadFunnelBreakdown"
import { KPIDetailPanel } from "@/components/e2e/layout/KPIDetailPanel"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronsUpDown, Check } from "lucide-react"
import { DateRangePickerWithPresets } from "@/components/e2e/common/DateRangePickerWithPresets"
import { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { useAccounts } from "@/contexts/AccountsContext"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"

// Qualification selector component
function QualificationSelector({
  selectedQualified,
  availableQualified,
  onChange,
}: {
  selectedQualified: string[]
  availableQualified: string[]
  onChange: (value: string[]) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center justify-between gap-1 min-w-[140px] h-9 px-2.5 text-xs bg-background border border-input rounded-md hover:bg-accent transition-colors truncate">
          <span className="truncate">
            {selectedQualified.length === 0 
              ? "Tất cả Qualified" 
              : `Qualified (${selectedQualified.length})`}
          </span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="end">
        <Command>
          <CommandInput placeholder="Tìm loại..." className="h-9 text-sm" />
          <CommandList>
            <CommandEmpty>Không tìm thấy.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange([])
                }}
                className="flex items-center gap-2 text-sm"
              >
                <div className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-sm border border-primary transition-all",
                  selectedQualified.length === 0 ? "bg-primary text-primary-foreground" : "opacity-50"
                )}>
                  {selectedQualified.length === 0 && <Check className="h-3 w-3" />}
                </div>
                Tất cả Qualified
              </CommandItem>
              {availableQualified.map((q) => (
                <CommandItem
                  key={q}
                  onSelect={() => {
                    const next = selectedQualified.includes(q)
                      ? selectedQualified.filter((v) => v !== q)
                      : [...selectedQualified, q]
                    onChange(next)
                  }}
                  className="flex items-center gap-2 text-sm"
                >
                  <div className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-sm border border-primary transition-all",
                    selectedQualified.includes(q) ? "bg-primary text-primary-foreground" : "opacity-50"
                  )}>
                    {selectedQualified.includes(q) && <Check className="h-3 w-3" />}
                  </div>
                  {q}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// Account selector component (copied from main page for consistency)
function MobileAccountSelector({
  selectedAccount,
  onAccountChange,
}: {
  selectedAccount: string
  onAccountChange: (value: string) => void
}) {
  const { accounts } = useAccounts()
  const [open, setOpen] = useState(false)
  const selectedName = selectedAccount === 'all' ? "Tất cả PIC (ALL)" : (accounts.find((a) => a.uid === selectedAccount)?.name ?? "Tài khoản")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center justify-between gap-1 w-32 h-9 px-2.5 text-xs bg-background border border-input rounded-md hover:bg-accent transition-colors truncate">
          <span className="truncate">{selectedName}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="end">
        <Command>
          <CommandInput placeholder="Tìm tài khoản..." className="h-9 text-sm" />
          <CommandList>
            <CommandEmpty>Không tìm thấy.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                key="all"
                value="Tất cả PIC (ALL)"
                onSelect={() => {
                  onAccountChange('all')
                  setOpen(false)
                }}
                className="flex items-center gap-2 text-sm"
              >
                <Check className={cn("w-3.5 h-3.5 shrink-0", selectedAccount === 'all' ? "opacity-100" : "opacity-0")} />
                Tất cả PIC (ALL)
              </CommandItem>
              {accounts.map((account) => (
                <CommandItem
                  key={account.uid}
                  value={account.name}
                  onSelect={() => {
                    onAccountChange(account.uid)
                    setOpen(false)
                  }}
                  className="flex items-center gap-2 text-sm"
                >
                  <Check className={cn("w-3.5 h-3.5 shrink-0", selectedAccount === account.uid ? "opacity-100" : "opacity-0")} />
                  {account.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function FunnelPageContent({ userId }: { userId: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const dateFromParam = searchParams.get("dateFrom")
  const dateToParam = searchParams.get("dateTo")
  const qualifiedParam = searchParams.get("qualified")
  
  // Initialize date range from URL params
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (dateFromParam) {
      return {
        from: new Date(dateFromParam),
        to: dateToParam ? new Date(dateToParam) : new Date(dateFromParam)
      }
    }
    return undefined
  })

  // Initialize qualified filter from URL params
  const [selectedQualified, setSelectedQualified] = useState<string[]>(() => {
    return qualifiedParam ? qualifiedParam.split(',').filter(Boolean) : []
  })

  const [availableQualified, setAvailableQualified] = useState<string[]>([])

  const [funnelData, setFunnelData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // KPI Detail Panel state
  const [kpiDetailOpen, setKpiDetailOpen] = useState(false)
  const [kpiDetailMetric, setKpiDetailMetric] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return

    setLoading(true)
    const params = new URLSearchParams({ pic_id: userId })
    
    // Use params from state if available, otherwise from URL
    const from = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : dateFromParam
    const to = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : dateToParam

    if (from) params.set("dateFrom", from)
    if (to) params.set("dateTo", to)
    if (selectedQualified.length > 0) params.set("qualified", selectedQualified.join(","))

    fetch(`/api/e2e/funnel-stats?${params.toString()}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setFunnelData(data)
          if (data.qualifiedValues) {
            setAvailableQualified(data.qualifiedValues)
          }
        }
      })
      .catch((err) => console.error("[FunnelPage] Error:", err))
      .finally(() => setLoading(false))
  }, [userId, dateRange, dateFromParam, dateToParam, selectedQualified])

  const handleBack = () => {
    router.back()
  }

  const handleAccountChange = (newUserId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    router.push(`/e2e/${newUserId}/funnel?${params.toString()}`)
  }

  const handleDateRangeChange = (newRange: DateRange | undefined) => {
    setDateRange(newRange)
    const params = new URLSearchParams(searchParams.toString())
    if (newRange?.from) {
      params.set("dateFrom", format(newRange.from, "yyyy-MM-dd"))
      if (newRange.to) {
        params.set("dateTo", format(newRange.to, "yyyy-MM-dd"))
      } else {
        params.delete("dateTo")
      }
    } else {
      params.delete("dateFrom")
      params.delete("dateTo")
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const handleQualifiedChange = (newQualified: string[]) => {
    setSelectedQualified(newQualified)
    const params = new URLSearchParams(searchParams.toString())
    if (newQualified.length > 0) {
      params.set("qualified", newQualified.join(","))
    } else {
      params.delete("qualified")
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const handleMetricClick = (metric: string) => {
    setKpiDetailMetric(metric)
    setKpiDetailOpen(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader
        currentPage="funnel"
        selectedAccount={userId}
        accountSelector={
          <MobileAccountSelector
            selectedAccount={userId}
            onAccountChange={handleAccountChange}
          />
        }
      />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack} className="flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              Quay lại
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Phân tích Lead Funnel</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Khoảng thời gian:</span>
            <DateRangePickerWithPresets
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
              className="w-[280px]"
            />
            <QualificationSelector
              selectedQualified={selectedQualified}
              availableQualified={availableQualified}
              onChange={handleQualifiedChange}
            />
          </div>
        </div>

        <TooltipProvider delayDuration={200}>
          <LeadFunnelBreakdown 
            data={funnelData} 
            loading={loading} 
            onMetricClick={handleMetricClick}
            picId={userId}
            dateFrom={dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : dateFromParam}
            dateTo={dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : dateToParam}
            qualified={selectedQualified.join(',')}
          />
        </TooltipProvider>

        <KPIDetailPanel
          open={kpiDetailOpen}
          onClose={() => setKpiDetailOpen(false)}
          metric={kpiDetailMetric}
          picId={userId}
          dateFrom={dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : dateFromParam}
          dateTo={dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : dateToParam}
          qualified={selectedQualified.join(',')}
        />

        <div className="mt-8 text-sm text-gray-500 bg-gray-50 p-4 rounded-lg border border-gray-100">
          <h3 className="font-semibold mb-2">Chú thích:</h3>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>1. Nhận lead:</strong> Tổng số lead được phân bổ cho PIC trong khoảng thời gian đã chọn.</li>
            <li><strong>2a. Đã có hình:</strong> Những lead đã được đánh giá là STRONG_QUALIFIED (có đầy đủ hình ảnh xe).</li>
            <li><strong>2b. Chưa có hình:</strong> Những lead chưa đạt STRONG_QUALIFIED hoặc chưa có thông tin Sale Status.</li>
            <li><strong>3a. firstMessage success:</strong> Đã gửi tin nhắn Zalo thành công đến khách hàng.</li>
            <li><strong>3b. firstMessage failed:</strong> Gửi tin nhắn Zalo thất bại (do chặn tin nhắn hoặc lỗi hệ thống).</li>
            <li><strong>3c. Chưa gửi:</strong> Lead chưa được gửi tin nhắn Zalo đầu tiên.</li>
          </ul>
        </div>
      </main>
    </div>
  )
}

export default function FunnelPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <FunnelPageContent userId={userId} />
    </Suspense>
  )
}
