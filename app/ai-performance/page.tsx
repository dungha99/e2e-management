"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useState, useEffect } from "react"
import { NavigationHeader } from "@/components/e2e/layout/NavigationHeader"
import { AiFunnelDashboard } from "@/components/ai-funnel/AiFunnelDashboard"
import { useAccounts } from "@/contexts/AccountsContext"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown, ChevronLeft } from "lucide-react"
import { DateRange } from "react-day-picker"
import { startOfMonth, endOfDay, format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

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

function AiPerformanceContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const dateFromParam = searchParams.get("dateFrom")
  const dateToParam = searchParams.get("dateTo")
  const picIdParam = searchParams.get("picId") || "all"

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (dateFromParam) {
      return {
        from: new Date(dateFromParam),
        to: dateToParam ? new Date(dateToParam) : new Date(dateFromParam)
      }
    }
    return {
      from: startOfMonth(new Date()),
      to: endOfDay(new Date())
    }
  })

  const [picId, setPicId] = useState<string>(picIdParam)

  useEffect(() => {
    setLoading(true)
    let url = "/api/ai-funnel/dashboard"
    const params = new URLSearchParams()
    
    if (dateRange?.from) {
      params.append("startDate", dateRange.from.toISOString())
      if (dateRange?.to) {
        params.append("endDate", dateRange.to.toISOString())
      } else {
        params.append("endDate", dateRange.from.toISOString())
      }
    }
    
    if (picId && picId !== "all") {
      params.append("picId", picId)
    }
    
    const queryString = params.toString()
    if (queryString) url += `?${queryString}`

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(resData => {
        setData(resData)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [dateRange, picId])

  const handleAccountChange = (newPicId: string) => {
    setPicId(newPicId)
    const params = new URLSearchParams(searchParams.toString())
    if (newPicId !== "all") {
      params.set("picId", newPicId)
    } else {
      params.delete("picId")
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavigationHeader
        currentPage="ai-performance"
        selectedAccount={picId}
        accountSelector={
          <MobileAccountSelector
            selectedAccount={picId}
            onAccountChange={handleAccountChange}
          />
        }
      />
      
      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack} className="flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              Quay lại
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">AI Performance</h1>
          </div>
        </div>

        {error && !data ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <p className="text-destructive font-medium">Lỗi tải dữ liệu</p>
              <p className="text-muted-foreground text-sm mt-1">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
              >
                Thử lại
              </button>
            </div>
          </div>
        ) : (
          <AiFunnelDashboard 
            data={data} 
            loading={loading}
            filters={{ dateRange, picId }}
            onFilterChange={(newFilters: any) => {
              if (newFilters.dateRange !== undefined) {
                setDateRange(newFilters.dateRange)
                const params = new URLSearchParams(searchParams.toString())
                if (newFilters.dateRange?.from) {
                  params.set("dateFrom", format(newFilters.dateRange.from, "yyyy-MM-dd"))
                  if (newFilters.dateRange.to) {
                    params.set("dateTo", format(newFilters.dateRange.to, "yyyy-MM-dd"))
                  } else {
                    params.delete("dateTo")
                  }
                } else {
                  params.delete("dateFrom")
                  params.delete("dateTo")
                }
                router.push(`?${params.toString()}`, { scroll: false })
              }
            }}
          />
        )}
      </main>
    </div>
  )
}

export default function AiPerformancePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <AiPerformanceContent />
    </Suspense>
  )
}
