"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, MessageCircle, RefreshCw } from "lucide-react"
import { Lead, DecoyThread } from "../types"
import { useDecoySignals } from "@/hooks/use-decoy-signals"

interface DecoyWebTabProps {
  selectedLead: Lead | null
  onCreateThread?: () => void
  refreshKey?: number  // Increment this to trigger a refresh
}

export function DecoyWebTab({
  selectedLead,
  onCreateThread,
  refreshKey
}: DecoyWebTabProps) {
  const [decoyWebThreads, setDecoyWebThreads] = useState<DecoyThread[]>([])
  const [selectedDecoyWebThreadId, setSelectedDecoyWebThreadId] = useState<string | null>(null)
  const [loadingDecoyWeb, setLoadingDecoyWeb] = useState(false)

  // Get markAsRead function from decoy signals hook
  const { markAsRead } = useDecoySignals()

  // Mark as read when tab is viewed (component mounts with a lead)
  useEffect(() => {
    if (selectedLead?.id && selectedLead.total_decoy_messages !== undefined) {
      // Mark messages as read when viewing this tab
      markAsRead(selectedLead.id, selectedLead.total_decoy_messages)
    }
  }, [selectedLead?.id, selectedLead?.total_decoy_messages, markAsRead])

  // Fetch decoy web threads when lead changes or refreshKey changes
  useEffect(() => {
    console.log("[DecoyWebTab] useEffect triggered - leadId:", selectedLead?.id, "refreshKey:", refreshKey)
    if (selectedLead?.id) {
      fetchDecoyWebChat(selectedLead.id)
    } else {
      setDecoyWebThreads([])
      setSelectedDecoyWebThreadId(null)
    }
  }, [selectedLead?.id, refreshKey])

  async function fetchDecoyWebChat(leadId: string) {
    console.log("[DecoyWebTab] Fetching decoy web chat for leadId:", leadId)
    setLoadingDecoyWeb(true)
    setDecoyWebThreads([])
    setSelectedDecoyWebThreadId(null)

    try {
      const response = await fetch("/api/e2e/decoy-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      })

      if (!response.ok) {
        setDecoyWebThreads([])
      } else {
        const data = await response.json()
        const threads = data.threads || []
        console.log("[DecoyWebTab] Fetched threads:", threads.length)
        setDecoyWebThreads(threads)
        if (threads.length > 0) {
          setSelectedDecoyWebThreadId(threads[0].id)
        }
      }
    } catch (error) {
      console.error("[E2E] Error fetching decoy web chat:", error)
      setDecoyWebThreads([])
    } finally {
      setLoadingDecoyWeb(false)
    }
  }

  // Manual refresh function
  function handleRefresh() {
    if (selectedLead?.id) {
      fetchDecoyWebChat(selectedLead.id)
    }
  }

  function handleOpenCRM() {
    const phone = selectedLead?.phone || selectedLead?.additional_phone || ""
    if (selectedDecoyWebThreadId && phone) {
      const crmUrl = `https://dashboard.vucar.vn/gui-tin/tin-da-gui?threadId=${selectedDecoyWebThreadId}&phone=${phone}`
      window.open(crmUrl, '_blank')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm h-full min-h-[400px] flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col md:flex-row gap-0 md:gap-4 overflow-hidden">
        {/* Left Panel - Thread List */}
        <div className="w-full md:w-64 lg:w-80 border-b md:border-b-0 md:border-r overflow-y-auto scrollbar-hide flex flex-col shrink-0 max-h-48 md:max-h-none">
          {/* Create Thread Button */}
          <div className="p-3 border-b bg-gray-50 flex gap-2">
            <Button
              onClick={onCreateThread}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              size="sm"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Tạo thread mới
            </Button>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={loadingDecoyWeb}
              title="Làm mới danh sách"
            >
              <RefreshCw className={`h-4 w-4 ${loadingDecoyWeb ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto scrollbar-hide">
            {loadingDecoyWeb ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : decoyWebThreads.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Chưa có threads
              </div>
            ) : (
              <div className="space-y-2">
                {decoyWebThreads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedDecoyWebThreadId(thread.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedDecoyWebThreadId === thread.id
                      ? "bg-orange-100 text-orange-900 border-orange-300"
                      : "bg-muted/30 hover:bg-muted/50"
                      }`}
                  >
                    <div className="font-semibold text-sm mb-1">
                      Bot: {thread.bot_name || "Unknown"}
                    </div>
                    <div className="text-xs opacity-70">
                      {new Date(thread.created_at).toLocaleString("vi-VN")}
                    </div>
                    <div className="text-xs opacity-70 mt-1">
                      {thread.messages.length} tin nhắn
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Messages */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/30">
          {/* CRM Banner */}
          {selectedDecoyWebThreadId && (
            <div className="bg-blue-50 border-b border-blue-100 p-3 px-4 flex items-center justify-between shrink-0 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <MessageCircle className="h-4 w-4" />
                <span>Để chat tiếp hãy vào đường link bên CRM</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="bg-white hover:bg-blue-50 text-blue-600 border-blue-200 h-8 text-xs font-medium shadow-sm transition-all hover:shadow"
                onClick={handleOpenCRM}
              >
                Chat trên CRM (Tab mới)
              </Button>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
            {!selectedDecoyWebThreadId ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Chọn một thread để xem tin nhắn
              </div>
            ) : (
              <div className="space-y-3">
                {decoyWebThreads
                  .find((t) => t.id === selectedDecoyWebThreadId)
                  ?.messages.map((msg, index) => {
                    const isBot = msg.sender === "bot" || msg.sender === "system"
                    const timestamp = msg.displayed_at
                      ? new Date(msg.displayed_at).toLocaleString("vi-VN")
                      : ""

                    return (
                      <div
                        key={index}
                        className={`flex ${isBot ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${isBot
                            ? "bg-orange-500 text-white"
                            : "bg-gray-200 text-gray-900"
                            }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold">
                              {isBot ? "Decoy Bot" : "Khách hàng"}
                            </span>
                            <span className="text-xs opacity-70">{timestamp}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
