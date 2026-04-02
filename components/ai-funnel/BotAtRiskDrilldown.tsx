"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, MessageSquare, Phone, User, Calendar, X, Clock } from "lucide-react"
import { format, isSameYear } from "date-fns"
import { ZaloChatViewer } from "@/components/e2e/common/ZaloChatViewer"

interface LeadDetail {
  phone: string
  name: string
  carId: string
  carDisplayName: string
  carCreatedAt: string
  picName: string
  qualified: string
  sellerSentiment: string
  crmStage: string
  messagesZalo: any
  lastCustomerContent: string
  minsWaiting: number
}

interface BotAtRiskDrilldownProps {
  isOpen: boolean
  onClose: () => void
  threshold: number
  carIds: string[]
  picId?: string
}

export function BotAtRiskDrilldown({ isOpen, onClose, threshold, carIds, picId }: BotAtRiskDrilldownProps) {
  const [loading, setLoading] = useState(false)
  const [leads, setLeads] = useState<LeadDetail[]>([])
  const [selectedChat, setSelectedChat] = useState<any>(null)

  useEffect(() => {
    if (isOpen && carIds.length > 0) {
      fetchLeads()
    } else if (!isOpen) {
      setLeads([])
    }
  }, [isOpen, carIds])

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/ai-funnel/bot-at-risk/drilldown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carIds, picId }),
      })
      const data = await res.json()
      setLeads(data.leads || [])
    } catch (error) {
      console.error("Error fetching drilldown leads:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return "N/A"
    const date = new Date(dateStr)
    if (isSameYear(date, new Date())) {
      return format(date, "dd/MM")
    }
    return format(date, "dd/MM/yyyy")
  }

  const formatPhone = (phone: string) => {
    if (!phone) return "N/A"
    return phone.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3")
  }

  const formatWaiting = (mins: number) => {
    if (mins < 60) return `${Math.round(mins)} phút`
    const hours = Math.floor(mins / 60)
    const m = Math.round(mins % 60)
    return `${hours}h ${m}m`
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-[900px] p-0 flex flex-col">
          <SheetHeader className="p-6 border-b shrink-0 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-xl font-bold flex items-center gap-2">
                  Bot chưa reply — {'>'} {threshold} phút
                  <Badge variant="secondary" className="ml-2 font-mono text-red-600 bg-red-50">
                    {carIds.length} leads
                  </Badge>
                </SheetTitle>
                <SheetDescription className="text-sm font-medium text-muted-foreground mt-1">
                  Danh sách leads khách nhắn nhưng bot chưa phản hồi lâu hơn ngưỡng cho phép
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-auto bg-gray-50/30">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-red-500" />
                <p className="text-sm text-muted-foreground">Đang tải danh sách...</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-20 bg-white m-4 rounded-lg border border-dashed">
                <p className="text-muted-foreground">Không có dữ liệu</p>
              </div>
            ) : (
              <div className="p-4">
                <Table>
                  <TableHeader className="bg-white">
                    <TableRow className="text-xs uppercase tracking-wider">
                      <TableHead className="w-10">#</TableHead>
                      <TableHead className="min-w-[200px]">KHÁCH HÀNG & XE</TableHead>
                      <TableHead>PIC</TableHead>
                      <TableHead>LOẠI</TableHead>
                      <TableHead>NGÀY</TableHead>
                      <TableHead className="min-w-[200px]">TIN NHẮN CUỐI</TableHead>
                      <TableHead>CHỜ</TableHead>
                      <TableHead className="text-right">THAO TÁC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead, idx) => (
                      <TableRow key={lead.carId} className="bg-white hover:bg-gray-50 transition-colors">
                        <TableCell className="font-mono text-[10px] text-muted-foreground align-top pt-4">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 leading-tight">
                              <Phone className="h-3 w-3 text-gray-400" />
                              {formatPhone(lead.phone)}
                            </div>
                            <div className="text-sm text-gray-700 font-medium truncate max-w-[180px]">{lead.name || "Khách hàng"}</div>
                            <div className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded inline-block uppercase tracking-tight">
                              {lead.carDisplayName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top pt-4">
                          <div className="flex items-center gap-2 text-xs truncate max-w-[100px]">
                            <User className="h-3 w-3 text-gray-400" />
                            {lead.picName || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="align-top pt-4">
                          <Badge 
                            variant={lead.qualified === 'strong_qualified' ? "default" : "outline"}
                            className={lead.qualified === 'strong_qualified' ? "bg-emerald-500 hover:bg-emerald-600 text-[10px] h-5" : "text-[10px] h-5"}
                          >
                            {lead.qualified === 'strong_qualified' ? "STRONG" : "WEAK"}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top pt-4">
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDateLabel(lead.carCreatedAt)}
                          </div>
                        </TableCell>
                        <TableCell className="align-top pt-4">
                          <div className="text-xs text-gray-600 italic line-clamp-3 leading-relaxed bg-gray-50/50 p-2 rounded border border-gray-100">
                            "{lead.lastCustomerContent || "—"}"
                          </div>
                        </TableCell>
                        <TableCell className="align-top pt-4">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
                            <Clock className="h-3.5 w-3.5" />
                            {formatWaiting(lead.minsWaiting)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right align-top pt-4">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => setSelectedChat(lead)}
                            disabled={!lead.messagesZalo || lead.messagesZalo.length === 0}
                            title={(!lead.messagesZalo || lead.messagesZalo.length === 0) ? "Chưa có tin nhắn Zalo" : "Xem tin nhắn Zalo"}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Zalo Chat Viewer Modal */}
      <Dialog open={!!selectedChat} onOpenChange={(open) => !open && setSelectedChat(null)}>
        <DialogContent className="sm:max-w-[500px] h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-4 border-b shrink-0 bg-white flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold text-gray-900 truncate">
                {selectedChat?.name || "Khách hàng"}
              </DialogTitle>
              {selectedChat?.carDisplayName && (
                <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">
                  {selectedChat.carDisplayName}
                </p>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full hover:bg-gray-100"
              onClick={() => setSelectedChat(null)}
            >
              <X className="h-4 w-4 text-gray-500" />
            </Button>
          </div>
          
          <div className="flex-1 min-h-0">
            <ZaloChatViewer 
              messages={selectedChat?.messagesZalo || []} 
              customerName={selectedChat?.name}
              carDisplayName={selectedChat?.carDisplayName}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
