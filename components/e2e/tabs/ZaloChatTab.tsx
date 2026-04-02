"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Lead, ChatMessage } from "../types"
import { ZaloChatViewer } from "../common/ZaloChatViewer"

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
      const e2eResponse = await fetch("https://n8nai.vucar.vn/webhook/e2e-chat-vucar", {
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
      <div className="flex-1 min-h-0 bg-gray-50 border-t">
        {loadingE2eMessages ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground">Đang tải tin nhắn...</p>
          </div>
        ) : (
          <ZaloChatViewer 
            messages={e2eMessages} 
            customerName={selectedLead?.name || "Khách hàng"} 
            className="h-full"
          />
        )}
      </div>
    </div>
  )
}
