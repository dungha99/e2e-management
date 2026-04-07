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
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, MessageSquare, Phone, User, Calendar, ExternalLink, MessageCircle, X } from "lucide-react"
import { format, isSameYear } from "date-fns"
import { ZaloChatViewer } from "@/components/e2e/common/ZaloChatViewer"

interface LeadDetail {
  phone: string
  name: string
  carId: string
  carDisplayName: string
  carCreatedAt: string
  picName: string
  aiStage: string
  sellerSentiment: string
  crmStage: string
  crmQualified: string
  messagesZalo: any
}

interface DrilldownPanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  carIds: string[]
}

export function DrilldownPanel({ isOpen, onClose, title, subtitle, carIds }: DrilldownPanelProps) {
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
      const res = await fetch("/api/ai-funnel/drilldown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carIds }),
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

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-[800px] p-0 flex flex-col">
          <SheetHeader className="p-6 border-b shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-xl font-bold flex items-center gap-2">
                  Danh sách xe
                  <Badge variant="secondary" className="ml-2 font-mono text-blue-600">
                    {carIds.length} leads
                  </Badge>
                </SheetTitle>
                <SheetDescription className="text-sm font-medium text-blue-600 mt-1">
                  {subtitle || title}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-auto bg-gray-50/30">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
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
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="min-w-[250px]">KHÁCH HÀNG & XE</TableHead>
                      <TableHead>PIC</TableHead>
                      <TableHead>LOẠI</TableHead>
                      <TableHead>NGÀY</TableHead>
                      <TableHead className="text-right">THAO TÁC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead, idx) => (
                      <TableRow key={lead.carId} className="bg-white hover:bg-gray-50 transition-colors">
                        <TableCell className="font-mono text-xs text-muted-foreground align-top pt-4">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                              <Phone className="h-3 w-3 text-gray-400" />
                              {formatPhone(lead.phone)}
                            </div>
                            <div className="text-sm text-gray-700">{lead.name || formatPhone(lead.phone)}</div>
                            <div className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded inline-block">
                              {lead.carDisplayName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top pt-4">
                          <div className="flex items-center gap-2 text-xs">
                            <User className="h-3 w-3 text-gray-400" />
                            {lead.picName || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="align-top pt-4">
                          <Badge 
                            variant={lead.crmQualified === 'STRONG_QUALIFIED' ? "default" : "outline"}
                            className={lead.crmQualified === 'STRONG_QUALIFIED' ? "bg-emerald-500 hover:bg-emerald-600 text-xs" : "text-xs"}
                          >
                            {lead.crmQualified === 'STRONG_QUALIFIED' ? "STRONG" : "WEAK"}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top pt-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDateLabel(lead.carCreatedAt)}
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

      {/* Zalo Chat Display Modal */}
      <Dialog open={!!selectedChat} onOpenChange={(open) => !open && setSelectedChat(null)}>
        <DialogContent className="sm:max-w-[500px] h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-4 border-b shrink-0 bg-white relative">
            <div className="pr-8">
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
              className="absolute right-3 top-3 h-8 w-8 rounded-full hover:bg-gray-100"
              onClick={() => setSelectedChat(null)}
            >
              <X className="h-4 w-4 text-gray-500" />
            </Button>
          </DialogHeader>
          
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
