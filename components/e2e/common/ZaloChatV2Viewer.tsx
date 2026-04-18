"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, X, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { ZaloChatViewer } from "./ZaloChatViewer"

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ZaloV2Message {
  _id: string
  content: string
  uidFrom: string
  fromMe: boolean
  timestamp: number
  dateAction: string
  type: string
  img?: string | null
  displayName?: string | null
  accountId?: string
  threadId?: string
  quote?: any
}

export interface ZaloV2Account {
  account_id: string
  friend_id: string
  lead_name: string | null
  conversation_name: string | null
  last_message_at: string | null
  message_count: number
}

// ── Hook: useZaloChatV2 ────────────────────────────────────────────────────────
// Encapsulates data fetching logic so any component can use it.

export function useZaloChatV2(phone: string | null | undefined) {
  const [messages, setMessages] = useState<ZaloV2Message[]>([])
  const [accounts, setAccounts] = useState<ZaloV2Account[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedAccountIdx, setSelectedAccountIdx] = useState(0)
  const { toast } = useToast()

  const fetchMessages = useCallback(async () => {
    if (!phone) return
    setLoading(true)
    setSelectedAccountIdx(0)
    try {
      const res = await fetch("/api/e2e/messages-zalo-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setAccounts(data.accounts || [])
      } else {
        setMessages([])
        setAccounts([])
      }
    } catch {
      setMessages([])
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }, [phone])

  // Filter messages by selected account (thread)
  const filteredMessages =
    accounts.length > 1 && accounts[selectedAccountIdx]
      ? messages.filter(
          (m) =>
            m.accountId === accounts[selectedAccountIdx].account_id &&
            m.threadId === accounts[selectedAccountIdx].friend_id
        )
      : messages

  return {
    messages: filteredMessages,
    allMessages: messages,
    accounts,
    loading,
    selectedAccountIdx,
    setSelectedAccountIdx,
    fetchMessages,
  }
}

// ── Component: ZaloChatV2Dialog ────────────────────────────────────────────────
// A self-contained dialog that fetches and displays Zalo V2 messages.
// Can be used standalone or composed inside other components.

export interface ZaloChatV2DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  phone: string | null | undefined
  customerName?: string
  /** Auto-fetch on open — set false if you want to manage fetching externally */
  autoFetch?: boolean
}

export function ZaloChatV2Dialog({
  open,
  onOpenChange,
  phone,
  customerName,
  autoFetch = true,
}: ZaloChatV2DialogProps) {
  const {
    messages,
    accounts,
    loading,
    selectedAccountIdx,
    setSelectedAccountIdx,
    fetchMessages,
  } = useZaloChatV2(phone)

  // Auto-fetch when the dialog opens
  useEffect(() => {
    if (open && autoFetch && phone) {
      fetchMessages()
    }
  }, [open, autoFetch, phone, fetchMessages])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-4 border-b shrink-0 bg-white relative">
          <div className="pr-8">
            <DialogTitle className="text-base font-bold text-gray-900 truncate flex items-center gap-2">
              {customerName || "Khách hàng"}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                <Database className="w-3 h-3" />
                V2
              </span>
            </DialogTitle>
            <p className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-2">
              <span>Tin nhắn từ Zalo Vucar DB</span>
              {phone && (
                <span className="text-gray-400 font-mono">· {phone}</span>
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 h-8 w-8 rounded-full hover:bg-gray-100"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4 text-gray-500" />
          </Button>
        </DialogHeader>

        {/* Account Selector (if multiple Zalo threads exist) */}
        {accounts.length > 1 && (
          <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">
              Thread:
            </span>
            {accounts.map((acc, idx) => (
              <button
                key={`${acc.account_id}-${acc.friend_id}`}
                onClick={() => setSelectedAccountIdx(idx)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all ${
                  idx === selectedAccountIdx
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                }`}
              >
                {acc.conversation_name || acc.lead_name || `Thread ${idx + 1}`}
                {acc.message_count > 0 && (
                  <span className="ml-1 opacity-70">
                    ({acc.message_count})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Account info bar */}
        {accounts.length > 0 && accounts[selectedAccountIdx] && (
          <div className="px-4 py-1.5 border-b bg-gradient-to-r from-blue-50 to-white flex items-center gap-3 text-[10px] text-gray-500">
            <span>
              <span className="font-bold text-gray-600">Tên:</span>{" "}
              {accounts[selectedAccountIdx].conversation_name ||
                accounts[selectedAccountIdx].lead_name ||
                "—"}
            </span>
            {accounts[selectedAccountIdx].last_message_at && (
              <span>
                <span className="font-bold text-gray-600">Tin cuối:</span>{" "}
                {new Date(
                  accounts[selectedAccountIdx].last_message_at!
                ).toLocaleDateString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <span>
              <span className="font-bold text-gray-600">Tổng:</span>{" "}
              {messages.length} tin nhắn
            </span>
          </div>
        )}

        <div className="flex-1 min-h-0 bg-gray-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-muted-foreground">
                Đang tải tin nhắn từ Zalo Vucar...
              </p>
            </div>
          ) : (
            <ZaloChatViewer
              messages={messages as any}
              customerName={customerName}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Component: ZaloChatV2Inline ────────────────────────────────────────────────
// An inline (non-dialog) version that can be embedded directly in a page/panel.

export interface ZaloChatV2InlineProps {
  phone: string | null | undefined
  customerName?: string
  className?: string
  /** Auto-fetch on mount */
  autoFetch?: boolean
}

export function ZaloChatV2Inline({
  phone,
  customerName,
  className,
  autoFetch = true,
}: ZaloChatV2InlineProps) {
  const {
    messages,
    accounts,
    loading,
    selectedAccountIdx,
    setSelectedAccountIdx,
    fetchMessages,
  } = useZaloChatV2(phone)

  useEffect(() => {
    if (autoFetch && phone) {
      fetchMessages()
    }
  }, [autoFetch, phone, fetchMessages])

  return (
    <div className={`flex flex-col h-full ${className || ""}`}>
      {/* Account Selector */}
      {accounts.length > 1 && (
        <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">
            Thread:
          </span>
          {accounts.map((acc, idx) => (
            <button
              key={`${acc.account_id}-${acc.friend_id}`}
              onClick={() => setSelectedAccountIdx(idx)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all ${
                idx === selectedAccountIdx
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {acc.conversation_name || acc.lead_name || `Thread ${idx + 1}`}
              {acc.message_count > 0 && (
                <span className="ml-1 opacity-70">({acc.message_count})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Info bar */}
      {accounts.length > 0 && accounts[selectedAccountIdx] && (
        <div className="px-4 py-1.5 border-b bg-gradient-to-r from-blue-50 to-white flex items-center gap-3 text-[10px] text-gray-500">
          <span>
            <span className="font-bold text-gray-600">Tên:</span>{" "}
            {accounts[selectedAccountIdx].conversation_name ||
              accounts[selectedAccountIdx].lead_name ||
              "—"}
          </span>
          {accounts[selectedAccountIdx].last_message_at && (
            <span>
              <span className="font-bold text-gray-600">Tin cuối:</span>{" "}
              {new Date(
                accounts[selectedAccountIdx].last_message_at!
              ).toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <span>
            <span className="font-bold text-gray-600">Tổng:</span>{" "}
            {messages.length} tin nhắn
          </span>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 min-h-0 bg-gray-50">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground">
              Đang tải tin nhắn từ Zalo Vucar...
            </p>
          </div>
        ) : (
          <ZaloChatViewer
            messages={messages as any}
            customerName={customerName}
          />
        )}
      </div>
    </div>
  )
}
