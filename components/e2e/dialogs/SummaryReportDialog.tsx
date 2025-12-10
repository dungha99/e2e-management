"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface SummaryReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedAccount: string | null
  selectedDate: Date | undefined
  setSelectedDate: (date: Date | undefined) => void
  fetchSummaryReport: () => void
  loadingSummary: boolean
  summaryReport: any
  summaryError: string | null
}

export function SummaryReportDialog({
  open,
  onOpenChange,
  selectedAccount,
  selectedDate,
  setSelectedDate,
  fetchSummaryReport,
  loadingSummary,
  summaryReport,
  summaryError
}: SummaryReportDialogProps) {

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Báo cáo tổng hợp</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Chọn ngày xem báo cáo</label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP", { locale: vi }) : <span>Chọn ngày</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Button onClick={fetchSummaryReport} disabled={!selectedDate || loadingSummary || !selectedAccount}>
                  {loadingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xem báo cáo"}
                </Button>
              </div>
            </div>
          </div>

          {summaryError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-200">
              {summaryError}
            </div>
          )}

          {summaryReport && (
            <div className="space-y-6 animate-in fade-in-50">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <p className="text-sm text-blue-600 font-medium">Tổng Lead</p>
                  <p className="text-2xl font-bold text-blue-700">{summaryReport.total_leads}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <p className="text-sm text-green-600 font-medium">Có xe (Car ID)</p>
                  <p className="text-2xl font-bold text-green-700">{summaryReport.leads_with_car_id}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                  <p className="text-sm text-orange-600 font-medium">Đã chào Dealer</p>
                  <p className="text-2xl font-bold text-orange-700">{summaryReport.leads_sent_to_dealer}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                  <p className="text-sm text-purple-600 font-medium">Đã có giá</p>
                  <p className="text-2xl font-bold text-purple-700">{summaryReport.leads_with_price}</p>
                </div>
              </div>

              {/* Detailed Table */}
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên CRM</TableHead>
                      <TableHead className="text-right">Tổng Lead</TableHead>
                      <TableHead className="text-right">Có xe</TableHead>
                      <TableHead className="text-right">Chào Dealer</TableHead>
                      <TableHead className="text-right">Có giá</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryReport.details?.map((detail: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{detail.account_name}</TableCell>
                        <TableCell className="text-right">{detail.total}</TableCell>
                        <TableCell className="text-right">{detail.with_car_id}</TableCell>
                        <TableCell className="text-right">{detail.sent_to_dealer}</TableCell>
                        <TableCell className="text-right">{detail.with_price}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {!summaryReport && !loadingSummary && !summaryError && (
            <div className="text-center py-12 text-gray-500">
              Chọn ngày và nhấn "Xem báo cáo" để hiển thị dữ liệu
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
