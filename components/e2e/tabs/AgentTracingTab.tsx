"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Settings2, FileText, Send, RefreshCw, Power, Play, BookOpen, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Lead } from "@/components/e2e/types"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AgentOutput {
  id: string
  agent_id: string
  agent_name: string
  note_version_id: string | null
  note_version: number | null
  note_content: string | null
  source_instance_id: string | null
  input_payload: any
  output_payload: any
  created_at: string
}

interface Agent {
  id: string
  name: string
  description: string | null
}

interface AgentTracingTabProps {
  selectedLead: Lead | null
}

export function AgentTracingTab({ selectedLead }: AgentTracingTabProps) {
  const { toast } = useToast()

  // State for Timeline
  const [outputs, setOutputs] = useState<AgentOutput[]>([])
  const [loadingOutputs, setLoadingOutputs] = useState(false)

  // State for Inspector
  const [selectedOutput, setSelectedOutput] = useState<AgentOutput | null>(null)

  // State for Blacklist
  const [isBlacklisted, setIsBlacklisted] = useState(false)
  const [togglingBlacklist, setTogglingBlacklist] = useState(false)

  // State for Re-trigger
  const [retriggeringAi, setRetriggeringAi] = useState(false)

  // State for Configuration Form
  const [isConfigMode, setIsConfigMode] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>("")
  const [savingNote, setSavingNote] = useState(false)

  // State for current agent note display
  const [currentNoteContent, setCurrentNoteContent] = useState<string | null>(null)
  const [currentNoteVersion, setCurrentNoteVersion] = useState<number | null>(null)
  const [loadingNote, setLoadingNote] = useState(false)
  const [isNoteExpanded, setIsNoteExpanded] = useState(false)

  // Markdown builder inputs
  const [configCategory, setConfigCategory] = useState<"Sửa lỗi" | "Tối ưu hóa" | "Thay đổi phong cách" | "Bổ sung tri thức">("Sửa lỗi")
  const [configContext, setConfigContext] = useState("")
  const [configIssue, setConfigIssue] = useState("")
  const [configSolution, setConfigSolution] = useState("")
  const [configExampleBefore, setConfigExampleBefore] = useState("")
  const [configExampleAfter, setConfigExampleAfter] = useState("")

  useEffect(() => {
    if (selectedLead?.car_id) {
      fetchOutputs()
      fetchBlacklistStatus()
    }
  }, [selectedLead?.car_id])

  async function fetchBlacklistStatus() {
    if (!selectedLead?.car_id) return
    try {
      const res = await fetch(`/api/e2e/ai-process-status/${selectedLead.car_id}`)
      if (res.ok) {
        const data = await res.json()
        setIsBlacklisted(!!data.isBlacklisted)
      }
    } catch (err) {
      console.error("Failed to fetch blacklist status:", err)
    }
  }

  async function toggleBlacklist(action: "deactivate" | "rerun") {
    if (!selectedLead?.car_id) return
    setTogglingBlacklist(true)
    try {
      const res = await fetch(`/api/e2e/ai-process-status/${selectedLead.car_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      })
      if (res.ok) {
        const data = await res.json()
        setIsBlacklisted(!!data.isBlacklisted)
        toast({
          title: "Thành công",
          description: action === "deactivate" ? "Đã dừng AI cho Lead này" : "Đã bật lại AI cho Lead này"
        })
      } else {
        toast({ title: "Lỗi", description: "Không thể cập nhật trạng thái AI", variant: "destructive" })
      }
    } catch (err) {
      console.error("Failed to toggle blacklist:", err)
      toast({ title: "Lỗi", description: "Lỗi hệ thống", variant: "destructive" })
    } finally {
      setTogglingBlacklist(false)
    }
  }

  async function retriggerAi() {
    const phone = selectedLead?.phone || selectedLead?.additional_phone
    const carId = selectedLead?.car_id
    if (!phone || !carId) {
      toast({ title: "Lỗi", description: "Không tìm thấy thông tin Lead", variant: "destructive" })
      return
    }

    setRetriggeringAi(true)
    try {
      const res = await fetch("/api/e2e/retrigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, carId }),
      })

      // Read stream to completion (heartbeat-based streaming)
      let resultText = ""
      if (res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          resultText += decoder.decode(value, { stream: true })
        }
      } else {
        resultText = await res.text()
      }

      // Parse the final JSON from the stream (skip heartbeat newlines)
      const jsonStr = resultText.trim()
      const lastJsonStart = jsonStr.lastIndexOf("{")
      const data = lastJsonStart >= 0 ? JSON.parse(jsonStr.substring(lastJsonStart)) : { success: false, error: "No response" }

      if (data.success) {
        toast({
          title: "Thành công ✅",
          description: `Đã gửi ${data.totalMessagesSent} tin nhắn tự động cho khách hàng.`,
        })
        fetchOutputs() // refresh the timeline
      }
    } catch (err) {
      console.error("Failed to retrigger:", err)
    } finally {
      setRetriggeringAi(false)
    }
  }

  useEffect(() => {
    // Only fetch agents if we open config mode for the first time
    if (isConfigMode && agents.length === 0) {
      fetchAgents()
    }
  }, [isConfigMode, agents.length])

  // Fetch active note when agent is selected in config mode
  const fetchActiveNote = useCallback(async (agentId: string) => {
    if (!agentId) {
      setCurrentNoteContent(null)
      setCurrentNoteVersion(null)
      return
    }
    setLoadingNote(true)
    try {
      const res = await fetch(`/api/e2e/ai-agents/notes?agentId=${agentId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.note) {
          setCurrentNoteContent(data.note.content)
          setCurrentNoteVersion(data.note.version)
        } else {
          setCurrentNoteContent(null)
          setCurrentNoteVersion(null)
        }
      }
    } catch (err) {
      console.error("Failed to fetch active note:", err)
      setCurrentNoteContent(null)
      setCurrentNoteVersion(null)
    } finally {
      setLoadingNote(false)
    }
  }, [])

  useEffect(() => {
    if (isConfigMode && selectedAgentId) {
      fetchActiveNote(selectedAgentId)
    }
  }, [isConfigMode, selectedAgentId, fetchActiveNote])

  async function fetchOutputs() {
    if (!selectedLead?.car_id) return
    setLoadingOutputs(true)
    try {
      const res = await fetch(`/api/e2e/ai-agents/outputs/${selectedLead.car_id}`)
      if (res.ok) {
        const data = await res.json()
        setOutputs(data.outputs || [])
        // Select the first one by default if exists
        if (data.outputs && data.outputs.length > 0 && !selectedOutput) {
          setSelectedOutput(data.outputs[0])
        }
      }
    } catch (err) {
      console.error("Failed to fetch AI agent outputs:", err)
    } finally {
      setLoadingOutputs(false)
    }
  }

  async function fetchAgents() {
    try {
      const res = await fetch(`/api/e2e/ai-agents`)
      if (res.ok) {
        const data = await res.json()
        setAgents(data.agents || [])
      }
    } catch (err) {
      console.error("Failed to fetch AI agents:", err)
    }
  }

  function handleOutputClick(output: AgentOutput) {
    setSelectedOutput(output)
    setIsConfigMode(false) // Close config mode if viewing history
  }

  function handleOpenConfig() {
    setIsConfigMode(true)
    // Pre-select the agent from the currently inspected output if applicable
    if (selectedOutput && selectedAgentId === "") {
      setSelectedAgentId(selectedOutput.agent_id)
    }
  }

  async function handleSubmitNote() {
    if (!selectedAgentId) {
      toast({ title: "Lỗi", description: "Vui lòng chọn Agent cần cấu hình", variant: "destructive" })
      return
    }

    // Construct the markdown
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const markdownContent = `### LOG: [${today}]
**Category:** [${configCategory}]
**Context:** ${configContext}
**Issue** ${configIssue}
**Solution** ${configSolution}
**Ví dụ (Example):**
***Trước:*** "${configExampleBefore}"
***Sau:*** "${configExampleAfter}"`

    setSavingNote(true)
    try {
      const res = await fetch(`/api/e2e/ai-agents/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgentId,
          content: markdownContent
        })
      })

      const data = await res.json()
      if (data.success) {
        toast({ title: "Thành công", description: "Đã lưu cấu hình Agent (phiên bản " + data.version + ")" })
        // Reset form
        setConfigCategory("Sửa lỗi")
        setConfigContext("")
        setConfigIssue("")
        setConfigSolution("")
        setConfigExampleBefore("")
        setConfigExampleAfter("")
        setIsConfigMode(false)
        fetchOutputs() // Refresh to see if anything changes (optional)
      } else {
        toast({ title: "Lỗi", description: data.error || "Không thể lưu cấu hình", variant: "destructive" })
      }
    } catch (err) {
      console.error("Failed to save note:", err)
      toast({ title: "Lỗi", description: "Lỗi hệ thống", variant: "destructive" })
    } finally {
      setSavingNote(false)
    }
  }

  // Simple markdown-to-HTML renderer for agent notes
  const simpleMarkdownToHtml = (md: string): string => {
    return md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') // escape HTML
      .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-gray-800 mt-3 mb-1">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-gray-800 mt-4 mb-1">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-gray-900 mt-4 mb-2">$1</h1>')
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="italic">$1</strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^---$/gm, '<hr class="my-3 border-amber-200" />')
      .replace(/\n/g, '<br />')
  }

  // Formatting helpers for Inspector Output display
  const formatPayload = (payload: any) => {
    if (!payload) return "No data"
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload)
        return JSON.stringify(parsed, null, 2)
      } catch (e) {
        return payload
      }
    }
    return JSON.stringify(payload, null, 2)
  }

  return (
    <div className="flex flex-col md:flex-row h-full rounded-lg border bg-white overflow-hidden">
      {/* LEFT PANEL: TIMELINE */}
      <div className="w-full md:w-1/3 border-r flex flex-col bg-gray-50/50">
        <div className="p-4 border-b flex items-center justify-between bg-white">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-blue-500" />
            EXECUTION TRACING
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 rounded-full bg-blue-50 text-blue-600 border-blue-200"
            onClick={fetchOutputs}
            disabled={loadingOutputs}
          >
            REALTIME
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingOutputs ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : outputs.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">
              Không có dữ liệu thực thi AI cho Lead này.
            </div>
          ) : (
            <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 pb-4">
              {outputs.map((output, idx) => (
                <div
                  key={output.id}
                  className="relative pl-6 cursor-pointer group"
                  onClick={() => handleOutputClick(output)}
                >
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[9px] top-4 w-4 h-4 rounded-full border-2 ${selectedOutput?.id === output.id ? 'bg-blue-500 border-blue-200' : 'bg-white border-green-500'} transition-colors duration-200`} />

                  {/* Card */}
                  <div className={`p-4 rounded-xl border transition-all duration-200 ${selectedOutput?.id === output.id ? 'bg-blue-50/50 border-blue-300 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-gray-900">{output.agent_name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {new Date(output.created_at).toLocaleTimeString('vi-VN')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: INSPECTOR or CONFIG */}
      <div className="w-full md:w-2/3 flex flex-col bg-white h-full relative">
        {isConfigMode ? (
          <div className="flex flex-col h-full bg-orange-50/10">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-orange-500" />
                Feedback Loop (Cấu hình Agent)
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setIsConfigMode(false)}>
                Hủy
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              <div className="space-y-4 p-4 border rounded-xl bg-white shadow-sm">
                {/* Agent Selection */}
                <div className="space-y-2">
                  <Label>Chọn Agent cần cấu hình</Label>
                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn Agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Current Active Note Display */}
                {selectedAgentId && (
                  <div className="space-y-2 border rounded-lg bg-amber-50/50 border-amber-200">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100/50 rounded-lg transition-colors"
                      onClick={() => setIsNoteExpanded(!isNoteExpanded)}
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-amber-600" />
                        Cấu hình hiện tại
                        {currentNoteVersion && (
                          <span className="text-xs bg-amber-200/80 text-amber-700 px-1.5 py-0.5 rounded-full font-mono">
                            v{currentNoteVersion}
                          </span>
                        )}
                      </span>
                      {isNoteExpanded
                        ? <ChevronUp className="h-4 w-4 text-amber-500" />
                        : <ChevronDown className="h-4 w-4 text-amber-500" />
                      }
                    </button>
                    {isNoteExpanded && (
                      <div className="px-3 pb-3">
                        {loadingNote ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                          </div>
                        ) : currentNoteContent ? (
                          <div
                            className="bg-white border border-amber-200 rounded-lg p-3 max-h-60 overflow-y-auto prose-sm text-xs text-gray-700 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(currentNoteContent) }}
                          />
                        ) : (
                          <p className="text-xs text-amber-600 italic py-2">
                            Chưa có cấu hình nào cho Agent này.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={configCategory} onValueChange={(v: any) => setConfigCategory(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sửa lỗi">Sửa lỗi</SelectItem>
                      <SelectItem value="Tối ưu hóa">Tối ưu hóa</SelectItem>
                      <SelectItem value="Thay đổi phong cách">Thay đổi phong cách</SelectItem>
                      <SelectItem value="Bổ sung tri thức">Bổ sung tri thức</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Context (Agent đã làm gì?)</Label>
                  <Input
                    placeholder="VD: Khi viết email sales cho khách hàng doanh nghiệp..."
                    value={configContext}
                    onChange={e => setConfigContext(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-red-500">Issue (Điều gì chưa tốt?)</Label>
                  <Input
                    placeholder="VD: Tone quá thân mật, thiếu sự chuyên nghiệp..."
                    value={configIssue}
                    onChange={e => setConfigIssue(e.target.value)}
                    className="border-red-200 focus-visible:ring-red-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-emerald-600">Solution (Cần thay đổi như thế nào?)</Label>
                  <Input
                    placeholder="VD: Luôn bắt đầu bằng câu hỏi về pain point..."
                    value={configSolution}
                    onChange={e => setConfigSolution(e.target.value)}
                    className="border-emerald-200 focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-gray-500 italic">Ví dụ Trước (Sai)</Label>
                    <Textarea
                      className="h-20 bg-gray-50"
                      placeholder="Chào bạn, mình thấy..."
                      value={configExampleBefore}
                      onChange={e => setConfigExampleBefore(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-500 italic">Ví dụ Sau (Đúng)</Label>
                    <Textarea
                      className="h-20 bg-gray-50"
                      placeholder="Kính gửi [Tên], tôi quan sát thấy..."
                      value={configExampleAfter}
                      onChange={e => setConfigExampleAfter(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button onClick={handleSubmitNote} disabled={savingNote || !selectedAgentId}>
                    {savingNote ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Lưu cấu hình
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Action buttons — always visible */}
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                {selectedOutput ? `Inspector: ${selectedOutput.agent_name}` : 'Agent Actions'}
              </h3>

              <div className="flex items-center gap-2">
                {/* Re-trigger AI button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-3 border-orange-300 text-orange-600 hover:bg-orange-50 min-w-[120px]"
                  onClick={retriggerAi}
                  disabled={retriggeringAi}
                >
                  {retriggeringAi
                    ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Đang xử lý...</>
                    : <><RefreshCw className="h-3 w-3 mr-1" />RE-TRIGGER</>
                  }
                </Button>

                {/* Deactivate / Rerun AI */}
                <div className="flex items-center rounded-lg">
                  {isBlacklisted ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 text-xs px-4 bg-blue-600 hover:bg-blue-700"
                      onClick={() => toggleBlacklist("rerun")}
                      disabled={togglingBlacklist}
                    >
                      {togglingBlacklist ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                      RERUN AI
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 text-xs px-4"
                      onClick={() => toggleBlacklist("deactivate")}
                      disabled={togglingBlacklist}
                    >
                      {togglingBlacklist ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Power className="h-3 w-3 mr-1" />}
                      DEACTIVATE AI
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {selectedOutput ? (
              <>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                  {/* Note Version Indicator */}
                  {selectedOutput.note_version && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full w-fit">
                      <Settings2 className="h-3.5 w-3.5" />
                      Sử dụng Cấu hình Agent (Version {selectedOutput.note_version})
                    </div>
                  )}

                  {/* INPUT CONTEXT */}
                  <div>
                    <Label className="text-xs uppercase text-gray-500 mb-2 block font-semibold tracking-wider">INPUT CONTEXT</Label>
                    <div className="bg-gray-50 border rounded-xl p-4 overflow-x-auto">
                      <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap word-break">
                        {formatPayload(selectedOutput.input_payload)}
                      </pre>
                    </div>
                  </div>

                  {/* AGENT RESULT */}
                  <div>
                    <Label className="text-xs uppercase text-gray-500 mb-2 block font-semibold tracking-wider">AGENT RESULT</Label>
                    <div className="bg-[#1e1e2d] border-[#2d2d44] rounded-xl p-4 overflow-x-auto pr-8">
                      <pre className="text-xs text-[#a0a0c0] font-mono whitespace-pre-wrap word-break">
                        {formatPayload(selectedOutput.output_payload)}
                      </pre>
                    </div>
                  </div>

                </div>

                {/* Feedback Footer */}
                <div className="p-4 border-t bg-gray-50/50 mt-auto">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-orange-600 border-orange-200 hover:bg-orange-50 bg-white"
                    onClick={handleOpenConfig}
                  >
                    <Settings2 className="h-4 w-4 mr-2" />
                    Cấu hình Agent (Feedback Loop)
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Chọn một Execution để xem chi tiết</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div >
  )
}
