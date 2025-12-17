"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, MessageCircle, Send } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { maskPhone } from "@/lib/utils"

interface Job {
    id: string
    phone: string
    account: string
    is_sent: boolean
    created_at: string
    shop_id?: string
    first_message?: string
    chat_history: {
        messages: Array<{
            role: "user" | "bot"
            content: string
        }>
    } | null
    length_of_chat_history: number
}

interface DecoyHistoryTabProps {
    phone: string | null
    leadId?: string  // For activity logging
    onSuccess?: () => void  // Callback after successful send
}

const DECOY_ACCOUNTS = [
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
    {
        name: "Hùng Taxi",
        account: "HT",
        shop_id: "68ff3282a3cdba1da71a1b71",
        default_message:
            "Anh ơi, em là tài xế công nghệ đang cần mua xe gấp để chạy kiếm sống. Em thấy xe nhà anh đăng bán, không biết xe còn không ạ? Em muốn hỏi thêm thông tin với giá cả để tính toán xem có phù hợp không ạ.",
    },
]

export function DecoyHistoryTab({ phone, leadId, onSuccess }: DecoyHistoryTabProps) {
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    // Chat modal state
    const [selectedChat, setSelectedChat] = useState<Job | null>(null)
    const [chatModalOpen, setChatModalOpen] = useState(false)

    // Send other bot modal state
    const [sendOtherBotModalOpen, setSendOtherBotModalOpen] = useState(false)
    const [sendOtherBotAccount, setSendOtherBotAccount] = useState<string>("")
    const [sendingOtherBot, setSendingOtherBot] = useState(false)

    const { toast } = useToast()

    useEffect(() => {
        if (phone) {
            fetchJobs()
        }
    }, [phone])

    async function fetchJobs() {
        if (!phone) return

        console.log("[DecoyHistoryTab] Fetching decoy history for phone:", phone)
        setLoading(true)
        try {
            const response = await fetch("/api/decoy/all")
            const data = await response.json()
            // Filter jobs by this lead's phone
            const filteredJobs = data.filter((job: Job) => job.phone === phone)
            console.log("[DecoyHistoryTab] Found", filteredJobs.length, "jobs for phone:", phone)
            setJobs(filteredJobs)
            setLastUpdated(new Date())
        } catch (error) {
            console.error("[DecoyHistoryTab] Error fetching jobs:", error)
        } finally {
            setLoading(false)
        }
    }

    function openChatModal(job: Job) {
        setSelectedChat(job)
        setChatModalOpen(true)
    }

    function openSendOtherBotModal(currentAccount: string) {
        // Determine which account hasn't sent to this phone yet
        const usedAccounts = jobs.map(j => j.account)
        const availableAccounts = DECOY_ACCOUNTS.filter(acc => !usedAccounts.includes(acc.account))

        if (availableAccounts.length > 0) {
            setSendOtherBotAccount(availableAccounts[0].account)
        } else {
            // If all accounts used, suggest a different one than current
            const otherAccount = currentAccount === "MA" ? "HH" : "MA"
            setSendOtherBotAccount(otherAccount)
        }
        setSendOtherBotModalOpen(true)
    }

    async function sendWithOtherBot() {
        if (!phone) return

        console.log("[DecoyHistoryTab] Sending campaign with bot:", sendOtherBotAccount, "to phone:", phone)
        setSendingOtherBot(true)

        try {
            const accountConfig = DECOY_ACCOUNTS.find(acc => acc.account === sendOtherBotAccount)
            if (!accountConfig) {
                throw new Error("Account not found")
            }

            // Step 1: Create job
            const createResponse = await fetch("/api/decoy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: phone,
                    shop_id: accountConfig.shop_id,
                    first_message: accountConfig.default_message,
                    account: accountConfig.account,
                    is_sent: false,
                }),
            })

            const createdJob = await createResponse.json()

            if (!createdJob.id) {
                throw new Error("Failed to create job")
            }

            // Step 2: Trigger webhook
            await fetch("https://n8n.vucar.vn/webhook/57039721-04a9-42a1-945c-fdd24250e6a8", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    job_id: createdJob.id,
                    phone: phone,
                    shop_id: accountConfig.shop_id,
                    first_message: accountConfig.default_message,
                    account: accountConfig.account,
                }),
            })

            toast({
                title: "✓ Đã gửi thành công",
                description: `Đã gửi tin nhắn từ ${accountConfig.name} đến ${maskPhone(phone)}`,
                className: "bg-green-50 border-green-200",
            })

            // Log sale activity for decoy zalo creation
            if (leadId) {
                console.log("[DecoyHistoryTab] Logging activity for lead:", leadId)
                try {
                    const activityResponse = await fetch("/api/e2e/log-activity", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            leadId: leadId,
                            activityType: "DECOY_SUMMARY",
                            metadata: {
                                field_name: "decoy_zalo",
                                previous_value: null,
                                new_value: `Gửi bằng tài khoản ${accountConfig.name}`,
                                channel: "ZALO",
                                account: accountConfig.name
                            },
                            actorType: "USER",
                            field: "decoy_zalo",
                        }),
                    })
                    const responseData = await activityResponse.json()
                    console.log("[DecoyHistoryTab] Activity API response:", activityResponse.status, responseData)

                    // Trigger Sale Activities panel refresh
                    onSuccess?.()
                } catch (err) {
                    console.error("[DecoyHistoryTab] Error logging activity:", err)
                }
            }

            setSendOtherBotModalOpen(false)
            fetchJobs() // Refresh the table
        } catch (error) {
            console.error("[DecoyHistoryTab] Error sending with other bot:", error)
            toast({
                title: "✗ Gửi thất bại",
                description: "Không thể gửi tin nhắn. Vui lòng thử lại.",
                variant: "destructive",
            })
        } finally {
            setSendingOtherBot(false)
        }
    }

    // Helper function to adjust timezone by adding 7 hours
    function adjustTimezone(dateString: string) {
        const date = new Date(dateString)
        date.setTime(date.getTime() + 7 * 60 * 60 * 1000)
        return date
    }

    function formatDateTime(dateString: string) {
        const date = adjustTimezone(dateString)
        return date.toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    // Get available accounts (not yet used)
    const usedAccounts = jobs.map(j => j.account)
    const availableAccounts = DECOY_ACCOUNTS.filter(acc => !usedAccounts.includes(acc.account))

    if (!phone) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                <p>Không có số điện thoại để hiển thị lịch sử</p>
            </div>
        )
    }

    return (
        <>
            <TooltipProvider>
                <div className="p-6 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold">Lịch sử Quây khách 💸</h3>
                            {lastUpdated && (
                                <p className="text-xs text-gray-500">
                                    Cập nhật lần cuối:{" "}
                                    {lastUpdated.toLocaleTimeString("vi-VN", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit",
                                    })}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {availableAccounts.length > 0 && (
                                <Button
                                    onClick={() => openSendOtherBotModal("")}
                                    size="sm"
                                    className="bg-orange-600 hover:bg-orange-700 text-white"
                                >
                                    <Send className="h-4 w-4 mr-2" />
                                    Gửi Bot mới
                                </Button>
                            )}
                            <Button onClick={fetchJobs} variant="outline" size="sm" disabled={loading}>
                                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            </Button>
                        </div>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : jobs.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <p className="text-lg font-medium">Chưa có lịch sử quây khách</p>
                            <p className="text-sm mt-1">Lead này chưa được tiếp cận qua Decoy Bot</p>
                            {availableAccounts.length > 0 && (
                                <Button
                                    onClick={() => openSendOtherBotModal("")}
                                    className="mt-4 bg-orange-600 hover:bg-orange-700 text-white"
                                >
                                    <Send className="h-4 w-4 mr-2" />
                                    Bắt đầu Quây khách
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="border rounded-xl overflow-hidden bg-white">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Thời gian</th>
                                        <th className="px-4 py-3 text-left font-medium">Account</th>
                                        <th className="px-4 py-3 text-left font-medium">Trạng thái gửi</th>
                                        <th className="px-4 py-3 text-left font-medium">Trạng thái phản hồi</th>
                                        <th className="px-4 py-3 text-left font-medium">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {jobs
                                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                        .map((job) => {
                                            const hasReplied = job.length_of_chat_history > 1
                                            const hasChat = job.chat_history && job.chat_history.messages && job.chat_history.messages.length > 0
                                            const accountInfo = DECOY_ACCOUNTS.find(acc => acc.account === job.account)

                                            return (
                                                <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3 text-gray-600">
                                                        {formatDateTime(job.created_at)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline">{job.account}</Badge>
                                                            <span className="text-xs text-gray-500">{accountInfo?.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={job.is_sent ? "default" : "secondary"}>
                                                            {job.is_sent ? "Đã gửi" : "Chưa gửi/Lỗi"}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge
                                                            variant={hasReplied ? "default" : "secondary"}
                                                            className={hasReplied ? "bg-purple-500" : ""}
                                                        >
                                                            {hasReplied ? "Đã phản hồi" : "Chưa phản hồi"}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex gap-2">
                                                            {hasChat ? (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => openChatModal(job)}
                                                                            className="h-8 w-8 p-0"
                                                                        >
                                                                            <MessageCircle className="h-4 w-4" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>Xem tin nhắn</TooltipContent>
                                                                </Tooltip>
                                                            ) : (
                                                                <span className="h-8 w-8 inline-flex items-center justify-center text-gray-400 text-xs">
                                                                    —
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Summary */}
                    {jobs.length > 0 && (
                        <div className="text-center text-xs text-gray-500">
                            Đã tiếp cận bằng {jobs.length} tài khoản ·
                            Còn {availableAccounts.length} tài khoản chưa sử dụng
                        </div>
                    )}
                </div>
            </TooltipProvider>

            {/* Chat History Modal */}
            <Dialog open={chatModalOpen} onOpenChange={setChatModalOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>
                            Hội thoại với {selectedChat ? maskPhone(selectedChat.phone) : ""}
                            {selectedChat && (
                                <span className="ml-2 text-sm font-normal text-gray-500">
                                    ({DECOY_ACCOUNTS.find(acc => acc.account === selectedChat.account)?.name})
                                </span>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="overflow-y-auto max-h-[60vh] space-y-3 p-4">
                        {selectedChat?.chat_history?.messages?.map((message, idx) => (
                            <div key={idx} className={`flex ${message.role === "bot" ? "justify-end" : "justify-start"}`}>
                                <div
                                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${message.role === "bot" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"
                                        }`}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                </div>
                            </div>
                        ))}
                        {(!selectedChat?.chat_history?.messages || selectedChat.chat_history.messages.length === 0) && (
                            <div className="text-center text-gray-500 py-4">
                                Chưa có tin nhắn
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Send Other Bot Modal */}
            <Dialog open={sendOtherBotModalOpen} onOpenChange={setSendOtherBotModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Gửi Bot đến {phone ? maskPhone(phone) : ""}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Chọn tài khoản</Label>
                            <Select value={sendOtherBotAccount} onValueChange={setSendOtherBotAccount}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn tài khoản..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {DECOY_ACCOUNTS.map((acc) => {
                                        const isUsed = usedAccounts.includes(acc.account)
                                        return (
                                            <SelectItem key={acc.account} value={acc.account} disabled={isUsed}>
                                                {acc.name} {isUsed && "(Đã sử dụng)"}
                                            </SelectItem>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Tin nhắn mẫu</Label>
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                                {DECOY_ACCOUNTS.find(acc => acc.account === sendOtherBotAccount)?.default_message || "Chọn tài khoản để xem tin nhắn mẫu"}
                            </p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setSendOtherBotModalOpen(false)}>
                                Hủy
                            </Button>
                            <Button
                                onClick={sendWithOtherBot}
                                disabled={sendingOtherBot || !sendOtherBotAccount || usedAccounts.includes(sendOtherBotAccount)}
                                className="bg-orange-600 hover:bg-orange-700"
                            >
                                {sendingOtherBot && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Gửi
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
