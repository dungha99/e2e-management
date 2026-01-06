"use client"

import { useEffect, useState, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, MessageCircle, Send, Bot } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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

interface SaleStatus {
    sale_status_id: string
    bot_status: boolean
    updated_at: string
}

interface CarBotStatus {
    car_id: string
    brand: string
    model: string
    variant: string
    year: number
    sale_statuses: SaleStatus[]
}

interface BotStatusData {
    phone: string
    lead_id: string
    cars: CarBotStatus[]
}

interface AkabizChatMessage {
    id: string
    shopId: string
    messageId: string
    uidFrom: string
    avatarFrom: string | null
    dateAction: string
    content: string
    img: string
    file: any
    type: string
    actionId: string | null
    msgId: string | null
    cliMsgId: string | null
    ts: number | null
    reacts: any[]
    quote: any
    isUndo: boolean
    sendingStatus: string | null
    createdAt: string
    updatedAt: string
    _id: string
}

interface AkabizChatHistoryResponse {
    is_successful: boolean
    phone: string
    shop_id: string
    uid: string
    contact_name: string
    chat_history: AkabizChatMessage[]
    error_message: string | null
}

const DECOY_ACCOUNTS = [
    {
        name: "Hùng Taxi",
        account: "HT",
        shop_id: "68ff3282-a3cd-ba1d-a71a-1b7100000000",
        default_message: "Anh ơi, em là tài xế công nghệ đang cần mua xe gấp để chạy kiếm sống. Em thấy xe nhà anh đăng bán, không biết xe còn không ạ?",
    },
    {
        name: "Huy Hồ",
        account: "HH",
        shop_id: "68c11ae4-b7f5-3ee3-7614-5cc200000000",
        default_message: "Em được giới thiệu mình có nhu cầu bán xe em kết bạn để hỏi thêm ít thông tin được không ạ? Xe còn ko a",
    },
    {
        name: "Minh Anh",
        account: "MA",
        shop_id: "68f5f0f9-0703-9cf6-ae45-81e800000000",
        default_message: "em dc bên kết nối chào xe. xe nhà mình còn hong. gđ e xin thêm thông tin á anh",
    },
]

export function DecoyHistoryTab({ phone, leadId, onSuccess }: DecoyHistoryTabProps) {
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    // Chat modal state
    const [selectedChat, setSelectedChat] = useState<Job | null>(null)
    const [chatModalOpen, setChatModalOpen] = useState(false)
    const [realTimeChatHistory, setRealTimeChatHistory] = useState<AkabizChatMessage[]>([])
    const [loadingChatHistory, setLoadingChatHistory] = useState(false)

    // Send other bot modal state
    const [sendOtherBotModalOpen, setSendOtherBotModalOpen] = useState(false)
    const [sendOtherBotAccount, setSendOtherBotAccount] = useState<string>("")
    const [sendingOtherBot, setSendingOtherBot] = useState(false)

    // Chat message input state
    const [newMessage, setNewMessage] = useState("")
    const [sendingMessage, setSendingMessage] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Bot status state
    const [botStatusData, setBotStatusData] = useState<BotStatusData | null>(null)
    const [loadingBotStatus, setLoadingBotStatus] = useState(false)
    const [togglingBotStatus, setTogglingBotStatus] = useState<string | null>(null) // car_id being toggled

    const { toast } = useToast()

    // Scroll to bottom when new message is added
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        if (phone) {
            fetchJobs()
            fetchBotStatus()
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

    async function fetchBotStatus() {
        if (!phone) return

        console.log("[DecoyHistoryTab] Fetching bot status for phone:", phone)
        setLoadingBotStatus(true)
        try {
            const response = await fetch("/api/leads/bot-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone }),
            })

            if (!response.ok) {
                throw new Error("Failed to fetch bot status")
            }

            const data = await response.json()
            console.log("[DecoyHistoryTab] Bot status data:", data)
            setBotStatusData(data)
        } catch (error) {
            console.error("[DecoyHistoryTab] Error fetching bot status:", error)
            setBotStatusData(null)
        } finally {
            setLoadingBotStatus(false)
        }
    }

    async function toggleBotStatus(carId: string, currentStatus: boolean) {
        if (!phone) return

        console.log("[DecoyHistoryTab] Toggling bot status for phone:", phone, "to:", !currentStatus)
        setTogglingBotStatus(carId)

        try {
            const response = await fetch("/api/leads/bot-status", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone,
                    bot_status: !currentStatus,
                }),
            })

            if (!response.ok) {
                throw new Error("Failed to update bot status")
            }

            // Refresh bot status data
            await fetchBotStatus()

            toast({
                title: !currentStatus ? "✓ Bot đã bật" : "✓ Bot đã tắt",
                description: !currentStatus 
                    ? "Bot sẽ tự động trả lời tin nhắn từ khách hàng" 
                    : "Bot sẽ không trả lời tin nhắn tự động",
                className: !currentStatus ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200",
            })
        } catch (error) {
            console.error("[DecoyHistoryTab] Error toggling bot status:", error)
            toast({
                title: "✗ Lỗi",
                description: "Không thể cập nhật trạng thái bot. Vui lòng thử lại.",
                variant: "destructive",
            })
        } finally {
            setTogglingBotStatus(null)
        }
    }

    async function openChatModal(job: Job) {
        setSelectedChat(job)
        setChatModalOpen(true)
        setRealTimeChatHistory([])
        
        // Fetch real-time chat history from Akabiz
        await fetchRealTimeChatHistory(job)
    }

    async function fetchRealTimeChatHistory(job: Job) {
        const accountConfig = DECOY_ACCOUNTS.find(acc => acc.account === job.account)
        if (!accountConfig || !job.phone) {
            console.warn("[DecoyHistoryTab] Cannot fetch chat history - missing account config or phone")
            return
        }

        setLoadingChatHistory(true)
        try {
            const response = await fetch("/api/akabiz/get-chat-history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: job.phone,
                    shop_id: accountConfig.shop_id,
                }),
            })

            if (!response.ok) {
                throw new Error("Failed to fetch chat history")
            }

            const data: AkabizChatHistoryResponse = await response.json()
            
            if (data.is_successful && data.chat_history) {
                console.log("[DecoyHistoryTab] Fetched", data.chat_history.length, "messages from Akabiz")
                setRealTimeChatHistory(data.chat_history)
            } else {
                console.warn("[DecoyHistoryTab] No chat history available:", data.error_message)
                setRealTimeChatHistory([])
            }
        } catch (error) {
            console.error("[DecoyHistoryTab] Error fetching real-time chat history:", error)
            setRealTimeChatHistory([])
        } finally {
            setLoadingChatHistory(false)
        }
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

    async function handleSendMessage() {
        if (!selectedChat || !newMessage.trim()) return

        const accountConfig = DECOY_ACCOUNTS.find(acc => acc.account === selectedChat.account)
        if (!accountConfig) {
            toast({
                title: "✗ Lỗi",
                description: "Không tìm thấy thông tin tài khoản",
                variant: "destructive",
            })
            return
        }

        setSendingMessage(true)
        try {
            const response = await fetch("/api/akabiz/send-customer-message-decoy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customer_phone: selectedChat.phone,
                    messages: [newMessage.trim()],
                    shop_id: accountConfig.shop_id,
                }),
            })

            if (!response.ok) {
                throw new Error("Failed to send message")
            }

            setNewMessage("")

            toast({
                title: "✓ Đã gửi tin nhắn",
                description: `Tin nhắn đã được gửi từ ${accountConfig.name}`,
                className: "bg-green-50 border-green-200",
            })

            // Refresh chat history to show the new message
            setTimeout(() => {
                fetchRealTimeChatHistory(selectedChat)
                scrollToBottom()
            }, 1000) // Wait 1 second for the message to be processed by the server
        } catch (error) {
            console.error("[DecoyHistoryTab] Error sending message:", error)
            toast({
                title: "✗ Gửi thất bại",
                description: "Không thể gửi tin nhắn. Vui lòng thử lại.",
                variant: "destructive",
            })
        } finally {
            setSendingMessage(false)
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

                    {/* Bot Status Section */}
                    {loadingBotStatus ? (
                        <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-xl border">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm text-gray-500">Đang tải trạng thái bot...</span>
                        </div>
                    ) : botStatusData && botStatusData.cars && botStatusData.cars.length > 0 ? (
                        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                            <div className="flex items-center gap-2 mb-3">
                                <Bot className="h-5 w-5 text-blue-600" />
                                <h4 className="font-semibold text-blue-900">Trạng thái Bot tự động</h4>
                            </div>
                            <div className="space-y-3">
                                {botStatusData.cars.map((car) => {
                                    // Get the first sale status (most relevant one)
                                    const saleStatus = car.sale_statuses?.[0]
                                    const isActive = saleStatus?.bot_status ?? false
                                    const isToggling = togglingBotStatus === car.car_id

                                    return (
                                        <div 
                                            key={car.car_id} 
                                            className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm"
                                        >
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900">
                                                    {car.brand} {car.model} {car.variant}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    Năm {car.year}
                                                    {saleStatus?.updated_at && (
                                                        <span className="ml-2">
                                                            · Cập nhật: {new Date(saleStatus.updated_at).toLocaleString("vi-VN")}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge 
                                                    variant={isActive ? "default" : "secondary"}
                                                    className={isActive ? "bg-green-500" : ""}
                                                >
                                                    {isActive ? "Đang bật" : "Đã tắt"}
                                                </Badge>
                                                <div className="flex items-center gap-2">
                                                    {isToggling && (
                                                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                                    )}
                                                    <Switch
                                                        checked={isActive}
                                                        onCheckedChange={() => toggleBotStatus(car.car_id, isActive)}
                                                        disabled={isToggling}
                                                        className="data-[state=checked]:bg-green-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <p className="text-xs text-blue-600 mt-3">
                                💡 Khi bật, bot sẽ tự động trả lời tin nhắn từ khách hàng qua các tài khoản Decoy
                            </p>
                        </div>
                    ) : botStatusData && (!botStatusData.cars || botStatusData.cars.length === 0) ? (
                        <div className="p-4 bg-gray-50 rounded-xl border text-center text-gray-500 text-sm">
                            Không có thông tin xe để hiển thị trạng thái bot
                        </div>
                    ) : null}

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
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle>
                                Hội thoại với {selectedChat ? maskPhone(selectedChat.phone) : ""}
                                {selectedChat && (
                                    <span className="ml-2 text-sm font-normal text-gray-500">
                                        ({DECOY_ACCOUNTS.find(acc => acc.account === selectedChat.account)?.name})
                                    </span>
                                )}
                            </DialogTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => selectedChat && fetchRealTimeChatHistory(selectedChat)}
                                disabled={loadingChatHistory}
                                className="h-8 w-8 p-0"
                            >
                                <RefreshCw className={`h-4 w-4 ${loadingChatHistory ? "animate-spin" : ""}`} />
                            </Button>
                        </div>
                    </DialogHeader>
                    
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-gray-50 rounded-lg min-h-[300px] max-h-[50vh]">
                        {loadingChatHistory ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                <span className="ml-2 text-sm text-gray-500">Đang tải tin nhắn...</span>
                            </div>
                        ) : realTimeChatHistory.length > 0 ? (
                            realTimeChatHistory.map((message, idx) => {
                                // Skip event messages (like "Đã gửi lời mời kết bạn")
                                if (message.type === "event") {
                                    return (
                                        <div key={message._id || idx} className="text-center py-1">
                                            <span className="text-xs text-gray-400 bg-gray-200 px-3 py-1 rounded-full">
                                                {message.content}
                                            </span>
                                        </div>
                                    )
                                }

                                // Determine if message is from bot (uidFrom === "0") or user
                                const isBot = message.uidFrom === "0"
                                const timestamp = new Date(message.dateAction).toLocaleString("vi-VN", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                })

                                return (
                                    <div key={message._id || idx} className={`flex ${isBot ? "justify-end" : "justify-start"}`}>
                                        <div
                                            className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                                                isBot 
                                                    ? "bg-blue-500 text-white" 
                                                    : "bg-gray-100 text-gray-900"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-semibold opacity-80">
                                                    {isBot ? "Bot" : "Khách hàng"}
                                                </span>
                                                <span className="text-xs opacity-60">{timestamp}</span>
                                            </div>
                                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                            {message.img && (
                                                <img 
                                                    src={message.img} 
                                                    alt="Message attachment" 
                                                    className="mt-2 max-w-full rounded-lg"
                                                />
                                            )}
                                            {message.sendingStatus && (
                                                <div className="text-xs opacity-60 mt-1">
                                                    {message.sendingStatus === "seen" && "✓✓ Đã xem"}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="text-center text-gray-500 py-4">
                                Chưa có tin nhắn
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Message Input Area */}
                    <div className="border-t pt-4 mt-2">
                        <div className="flex gap-2">
                            <Textarea
                                placeholder="Nhập tin nhắn..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                className="flex-1 min-h-[60px] max-h-[120px] resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault()
                                        handleSendMessage()
                                    }
                                }}
                                disabled={sendingMessage}
                            />
                            <Button
                                onClick={handleSendMessage}
                                disabled={!newMessage.trim() || sendingMessage}
                                className="bg-blue-500 hover:bg-blue-600 self-end h-10 px-4"
                            >
                                {sendingMessage ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Nhấn Enter để gửi · Shift + Enter để xuống dòng
                        </p>
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
