"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Lead, ChatMessage } from "../types"

interface ZaloChatTabProps {
  selectedLead: Lead | null
  chatMessages: ChatMessage[]
  selectedAccount: string
  onUpdateLeadBotStatus: (botActive: boolean) => void
  onOpenCreateThread?: () => void
}

export function ZaloChatTab({
  selectedLead,
  chatMessages,
  selectedAccount,
  onUpdateLeadBotStatus
}: ZaloChatTabProps) {
  const { toast } = useToast()
  const [e2eMessages, setE2eMessages] = useState<ChatMessage[]>([])
  const [loadingE2eMessages, setLoadingE2eMessages] = useState(false)
  const [runningE2E, setRunningE2E] = useState(false)

  // Fetch messages when car_id changes
  useEffect(() => {
    if (selectedLead?.car_id) {
      fetchChatMessages(selectedLead.car_id)
    } else {
      setE2eMessages([])
    }
  }, [selectedLead?.car_id])

  async function fetchChatMessages(car_id: string) {
    setLoadingE2eMessages(true)
    try {
      const response = await fetch("/api/e2e/messages-zalo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id }),
      })

      if (!response.ok) {
        setE2eMessages([])
        return
      }

      const data = await response.json()
      setE2eMessages(data.messages_zalo || [])
    } catch (error) {
      console.error("[E2E] Error fetching chat messages for car_id:", car_id, error)
      setE2eMessages([])
    } finally {
      setLoadingE2eMessages(false)
    }
  }

  async function handleRunE2E() {
    if (!selectedLead) return

    const phone = selectedLead.phone || selectedLead.additional_phone
    if (!phone) {
      toast({
        title: "Lỗi",
        description: "Không có số điện thoại",
        variant: "destructive",
      })
      return
    }

    setRunningE2E(true)

    try {
      // Step 1: Check and update bot status if needed
      if (!selectedLead.bot_active) {
        console.log("[E2E] Bot is not active, activating...")
        const updateResponse = await fetch("/api/e2e/bot-status/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot_status: true, phone }),
        })

        const updateData = await updateResponse.json()

        if (!updateResponse.ok || !updateData.success) {
          toast({
            title: "Không thể kích hoạt bot",
            description: "Vui lòng kích hoạt bot trước khi chạy E2E",
            variant: "destructive",
          })
          setRunningE2E(false)
          return
        }

        // Update bot status
        onUpdateLeadBotStatus(true)
      }

      // Step 2: Call E2E webhook
      console.log("[E2E] Calling E2E webhook...")
      const e2eResponse = await fetch("https://n8n.vucar.vn/webhook/bdb8f9b8-4b12-4a08-9a94-d0406e0d16b0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          chat_history: chatMessages,
        }),
      })

      if (!e2eResponse.ok) {
        throw new Error("E2E webhook failed")
      }

      const e2eData = await e2eResponse.json()

      // Step 3: Check if there are message suggestions and send them
      if (Array.isArray(e2eData) && e2eData.length > 0) {
        const firstResult = e2eData[0]
        const messageSuggestions = firstResult?.output?.message_suggestions

        if (Array.isArray(messageSuggestions) && messageSuggestions.length > 0) {
          const sendMessageResponse = await fetch("https://crm-vucar-api.vucar.vn/api/v1/akabiz/send-customer-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_phone: phone,
              messages: messageSuggestions,
              picId: selectedAccount,
            }),
          })

          if (!sendMessageResponse.ok) {
            console.error("[E2E] Failed to send messages")
            toast({
              title: "Cảnh báo",
              description: "E2E hoàn thành nhưng không thể gửi tin nhắn gợi ý",
              variant: "destructive",
            })
            return
          }

          toast({
            title: "Thành công",
            description: `E2E hoàn thành và đã gửi ${messageSuggestions.length} tin nhắn`,
          })
        } else {
          toast({
            title: "Thành công",
            description: "E2E hoàn thành, không có tin nhắn gợi ý",
          })
        }
      } else {
        toast({
          title: "Thành công",
          description: "E2E đã được khởi chạy",
        })
      }
    } catch (error) {
      console.error("[E2E] Error running E2E:", error)
      toast({
        title: "Lỗi",
        description: "Không thể chạy E2E",
        variant: "destructive",
      })
    } finally {
      setRunningE2E(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm h-[600px] flex flex-col overflow-hidden">
      {/* E2E Action Button - Fixed at top */}
      <div className="border-b p-4 bg-purple-50">
        <Button
          onClick={handleRunE2E}
          disabled={runningE2E}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
        >
          {runningE2E ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Đang chạy E2E...
            </>
          ) : (
            "Chạy E2E"
          )}
        </Button>
      </div>

      {/* Messages Display */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loadingE2eMessages ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Đang tải tin nhắn...</span>
          </div>
        ) : e2eMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Chưa có tin nhắn
          </div>
        ) : (
          <div className="space-y-3">
            {e2eMessages.map((msg: ChatMessage, index: number) => {
              const isVuCar = msg.uidFrom === "0" || msg.uidFrom === "bot" || msg.uidFrom === "system"
              const timestamp = msg.timestamp
                ? new Date(msg.timestamp).toLocaleString("vi-VN")
                : msg.dateAction || ""

              return (
                <div
                  key={msg._id || index}
                  className={`flex ${isVuCar ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${isVuCar
                      ? "bg-purple-500 text-white"
                      : "bg-gray-200 text-gray-900"
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold">
                        {isVuCar ? "VuCar" : "Khách hàng"}
                      </span>
                      <span className="text-xs opacity-70">{timestamp}</span>
                    </div>
                    {msg.img && (
                      <img
                        src={msg.img}
                        alt="Message image"
                        className="max-w-[200px] max-h-[200px] object-cover rounded mb-2"
                      />
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                    {msg.type && msg.type !== "text" && (
                      <span className="text-xs opacity-70 mt-1 block">
                        Type: {msg.type}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
