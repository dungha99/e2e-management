"use client"

import { useState, useEffect, useCallback } from "react"
import { Bot, ChevronDown, Pencil, Save, X, RotateCcw, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface Agent {
  id: string
  name: string
  description: string | null
}

interface PicConfig {
  id: string
  version: number
  prompt: string
  createdAt: string
  isPicSpecific: boolean
}

interface AgentPromptsTabProps {
  picId: string | null
}

export function AgentPromptsTab({ picId }: AgentPromptsTabProps) {
  const { toast } = useToast()

  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [config, setConfig] = useState<PicConfig | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Load agent list once
  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch("/api/e2e/ai-agents")
        const data = await res.json()
        if (data.success) {
          setAgents(data.agents)
          if (data.agents.length > 0) setSelectedAgentId(data.agents[0].id)
        }
      } catch {
        toast({ title: "Không tải được danh sách Agent", variant: "destructive" })
      } finally {
        setLoadingAgents(false)
      }
    }
    fetchAgents()
  }, [])

  // Load PIC config when agent or picId changes
  const fetchConfig = useCallback(async () => {
    if (!selectedAgentId || !picId) {
      setConfig(null)
      return
    }
    setLoadingConfig(true)
    setEditing(false)
    try {
      const res = await fetch(
        `/api/e2e/ai-agents/pic-configs?agentId=${selectedAgentId}&picId=${encodeURIComponent(picId)}`
      )
      const data = await res.json()
      setConfig(data.success ? data.config : null)
    } catch {
      setConfig(null)
    } finally {
      setLoadingConfig(false)
    }
  }, [selectedAgentId, picId])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  function startEditing() {
    setDraft(config?.prompt ?? "")
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setDraft("")
  }

  async function savePrompt() {
    if (!selectedAgentId || !picId || !draft.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/e2e/ai-agents/pic-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selectedAgentId, picId, prompt: draft.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: `Đã lưu v${data.version}` })
        setEditing(false)
        fetchConfig()
      } else {
        toast({ title: "Lưu thất bại", description: data.error, variant: "destructive" })
      }
    } catch (e) {
      toast({ title: "Lỗi kết nối", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function resetToGlobal() {
    if (!selectedAgentId || !picId) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/e2e/ai-agents/pic-configs?agentId=${selectedAgentId}&picId=${encodeURIComponent(picId)}`,
        { method: "DELETE" }
      )
      const data = await res.json()
      if (data.success) {
        toast({ title: "Đã xóa prompt riêng, Agent sẽ dùng cấu hình mặc định" })
        fetchConfig()
      } else {
        toast({ title: "Xóa thất bại", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Lỗi kết nối", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const selectedAgent = agents.find((a) => a.id === selectedAgentId)

  if (!picId) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
        <Bot className="h-8 w-8" />
        <p className="text-sm">Lead này chưa có PIC được gán</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-semibold text-gray-800">Agent Prompts</span>
        </div>
        <Badge variant="outline" className="text-xs font-mono text-gray-500">
          PIC: {picId}
        </Badge>
      </div>

      {/* Agent selector */}
      {loadingAgents ? (
        <div className="h-9 w-full animate-pulse rounded-md bg-gray-100" />
      ) : (
        <Select
          value={selectedAgentId ?? ""}
          onValueChange={(v) => setSelectedAgentId(v)}
        >
          <SelectTrigger className="w-full text-sm">
            <SelectValue placeholder="Chọn Agent..." />
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {selectedAgent?.description && (
        <p className="text-xs text-gray-400 -mt-2">{selectedAgent.description}</p>
      )}

      {/* Config area */}
      {loadingConfig ? (
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
          <div className="h-36 animate-pulse rounded-md bg-gray-100" />
        </div>
      ) : (
        <>
          {/* Status row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {config ? (
                <>
                  <Badge className={config.isPicSpecific
                    ? "bg-violet-100 text-violet-700 border-violet-200 text-xs"
                    : "bg-gray-100 text-gray-500 border-gray-200 text-xs"
                  }>
                    {config.isPicSpecific ? `Prompt riêng · v${config.version}` : `Mặc định · v${config.version}`}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {new Date(config.createdAt).toLocaleDateString("vi-VN")}
                  </span>
                </>
              ) : (
                <Badge variant="outline" className="text-xs text-gray-400">
                  Chưa có prompt
                </Badge>
              )}
            </div>

            {!editing && (
              <div className="flex items-center gap-1.5">
                {config?.isPicSpecific && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-red-500 hover:text-red-600"
                    onClick={resetToGlobal}
                    disabled={deleting}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Xóa prompt riêng
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={startEditing}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  {config ? "Chỉnh sửa" : "Tạo prompt riêng"}
                </Button>
              </div>
            )}
          </div>

          {/* Read-only view */}
          {!editing && config && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-[calc(100vh-460px)] overflow-y-auto scrollbar-hide">
              {config.prompt}
            </div>
          )}

          {!editing && !config && (
            <div className="rounded-md border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-xs text-gray-400">
              PIC này chưa có prompt riêng cho Agent <strong>{selectedAgent?.name}</strong>.
              <br />
              Nhấn &quot;Tạo prompt riêng&quot; để ghi đè cấu hình mặc định.
            </div>
          )}

          {/* Edit mode */}
          {editing && (
            <div className="flex flex-col gap-2">
              <Textarea
                className="font-mono text-xs min-h-[280px] resize-none leading-relaxed"
                placeholder="Nhập nội dung prompt cho PIC này..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  <X className="h-3 w-3 mr-1" />
                  Hủy
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-violet-600 hover:bg-violet-700"
                  onClick={savePrompt}
                  disabled={saving || !draft.trim()}
                >
                  <Save className="h-3 w-3 mr-1" />
                  {saving ? "Đang lưu..." : "Lưu"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
