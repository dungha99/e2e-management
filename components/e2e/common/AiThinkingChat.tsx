import { useState, useRef, useEffect, memo } from "react"
import { Bot, Target, Loader2, Sparkles, Send, User, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, History, BrainCircuit, Hand, Power, Play, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { AiInsight } from "../types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AiThinkingChatProps {
  insights: AiInsight | null
  isLoading: boolean
  onSubmitFeedback: (feedback: string) => Promise<void>
  onRate?: (id: string, isHistory: boolean, isPositive: boolean | null) => Promise<void>
  onSendScript?: (scriptText: string) => void
  onExecuteConnector?: (connectorName: string, defaultValues: Record<string, any>, title: string) => void
  onUseFlow?: (steps: {
    stepName: string;
    connectorId: string;
    connectorLabel: string;
    defaultValues: Record<string, any>;
    aiMetadata?: {
      action?: string
      expectedReaction?: string
      successSignal?: string
      failureSignal?: string
      ifSuccess?: string
      ifFailure?: string
    }
  }[]) => void
  carId?: string  // Current lead's car_id for default values
  currentUserId?: string | null
  leadPhone?: string
}

const TypingText = memo(({ text, speed = 5, onComplete }: { text: string; speed?: number; onComplete?: () => void }) => {
  const [displayedText, setDisplayedText] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, speed)
      return () => clearTimeout(timeout)
    } else if (onComplete) {
      onComplete()
    }
  }, [currentIndex, text, speed, onComplete])

  return <>{displayedText}</>
})

TypingText.displayName = "TypingText"

const DynamicInsightValue = ({ value, isNew, onComplete, onSendScript, onExecuteConnector, carId, currentUserId, leadPhone }: {
  value: any,
  isNew: boolean,
  onComplete?: () => void,
  onSendScript?: (scriptText: string) => void,
  onExecuteConnector?: (connectorName: string, defaultValues: Record<string, any>, title: string) => void,
  carId?: string,
  currentUserId?: string | null,
  leadPhone?: string
}) => {
  if (typeof value === 'string') {
    return isNew ? <TypingText text={value} onComplete={onComplete} /> : <>{value}</>
  }
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc pl-4 space-y-1">
        {value.map((item, idx) => (
          <li key={idx} className="text-sm text-gray-700 leading-relaxed">
            <DynamicInsightValue
              value={item}
              isNew={isNew}
              onComplete={idx === value.length - 1 ? onComplete : undefined}
              onSendScript={onSendScript}
              onExecuteConnector={onExecuteConnector}
              carId={carId}
              currentUserId={currentUserId}
              leadPhone={leadPhone}
            />
          </li>
        ))}
      </ul>
    )
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).filter(([key]) =>
      !['id', 'created_at', 'selected_transition_id', 'target_workflow_id', 'target_workflow_name'].includes(key)
    );

    return (
      <div className="space-y-4">
        {entries.map(([key, val], idx) => (
          <div key={key} className="flex flex-col gap-1.5">
            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-indigo-200"></span>
              {key.replace(/_/g, ' ')}
            </div>
            <div className="pl-2.5 border-l border-indigo-100/50">
              <DynamicInsightValue
                value={val}
                isNew={isNew}
                onComplete={idx === entries.length - 1 ? onComplete : undefined}
                onSendScript={onSendScript}
                onExecuteConnector={onExecuteConnector}
                carId={carId}
                currentUserId={currentUserId}
                leadPhone={leadPhone}
              />
            </div>
          </div>
        ))}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-3">
          {/* Gửi Script Button */}
          {typeof value.script === 'string' && value.script.trim() && onExecuteConnector && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={(e) => {
                e.stopPropagation();
                const defaultValues: Record<string, any> = {};
                if (currentUserId) defaultValues.picId = currentUserId;
                if (leadPhone) defaultValues.customer_phone = leadPhone;
                if (value.script) defaultValues.messages = [value.script];

                // Use connector ID for Send Message to Customer (05b6afa5-786f-4062-9d53-de9cb89450ee)
                onExecuteConnector('05b6afa5-786f-4062-9d53-de9cb89450ee', defaultValues, 'Gửi Script');
              }}
            >
              <Send className="h-3 w-3 mr-1.5" />
              Gửi Script
            </Button>
          )}

          {/* Create Bidding Session Button */}
          {typeof value.action === 'string' && (
            value.action.toLowerCase().includes('tạo phiên đấu giá') ||
            value.action.toLowerCase().includes('tạo phiên') ||
            value.action.toLowerCase().includes('đấu giá') ||
            value.action.toLowerCase().includes('bidding')
          ) && onExecuteConnector && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                onClick={(e) => {
                  e.stopPropagation();
                  // Use car_id from props (current lead)
                  const defaultValues: Record<string, any> = {};
                  if (carId) defaultValues.carId = carId;
                  // Use connector ID instead of name to avoid string comparison issues
                  onExecuteConnector('6e98e9e6-87a6-41b8-9694-294472419351', defaultValues, 'Tạo phiên đấu giá');
                }}
              >
                <Target className="h-3 w-3 mr-1.5" />
                Create Bidding Session
              </Button>
            )}

        </div>
      </div>
    )
  }
  if (onComplete) onComplete();
  return <span className="text-sm font-medium text-gray-900">{String(value)}</span>
}


export function AiThinkingChat({
  insights,
  isLoading,
  onSubmitFeedback,
  onRate,
  onSendScript,
  onExecuteConnector,
  onUseFlow,
  carId,
  currentUserId,
  leadPhone
}: AiThinkingChatProps) {
  const [feedback, setFeedback] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRewriting, setIsRewriting] = useState(false)
  const [isAutoFlowing, setIsAutoFlowing] = useState(false)
  const [expandedIndices, setExpandedIndices] = useState<number[]>([])
  const [hasAnimated, setHasAnimated] = useState<string | null>(null) // Tracks last animated unique state
  const [showHistory, setShowHistory] = useState(false) // Toggle for chat history visibility
  const scrollRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const [localRatings, setLocalRatings] = useState<Record<string, boolean | null>>({})

  // External Action States
  const [isBlacklisted, setIsBlacklisted] = useState(false)
  const [togglingBlacklist, setTogglingBlacklist] = useState(false)
  const [retriggeringAi, setRetriggeringAi] = useState(false)

  // Fetch Backlist status on mount or carId change
  useEffect(() => {
    async function fetchBlacklistStatus() {
      if (!carId) return
      try {
        const res = await fetch(`/api/e2e/ai-process-status/${carId}`)
        if (res.ok) {
          const data = await res.json()
          setIsBlacklisted(!!data.isBlacklisted)
        }
      } catch (err) {
        console.error("Failed to fetch blacklist status:", err)
      }
    }
    fetchBlacklistStatus()
  }, [carId])

  async function toggleBlacklist(action: "deactivate" | "rerun") {
    if (!carId) return
    setTogglingBlacklist(true)
    try {
      const res = await fetch(`/api/e2e/ai-process-status/${carId}`, {
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
    if (!leadPhone || !carId) {
      toast({ title: "Lỗi", description: "Không tìm thấy thông tin Lead", variant: "destructive" })
      return
    }

    setRetriggeringAi(true)
    try {
      const res = await fetch("/api/e2e/retrigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: leadPhone, carId }),
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
      }
    } catch (err) {
      console.error("Failed to retrigger:", err)
    } finally {
      setRetriggeringAi(false)
    }
  }

  const handleSendFeedback = async () => {
    if (!feedback.trim()) return
    setIsSubmitting(true)
    try {
      await onSubmitFeedback(feedback)
      setFeedback("")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAutoUseFlow = async (aiInsightSummary: any) => {
    if (!carId || !aiInsightSummary) return
    setIsAutoFlowing(true)
    try {
      const res = await fetch("/api/e2e/auto-use-flow-ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId,
          aiInsightSummary,
          picId: currentUserId || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        // Optionally notify parent that a workflow was created
        if (onUseFlow) {
          // Pass an empty array to signal "auto flow created" - parent can refresh
          onUseFlow([])
        }
      } else {
        console.error("[Auto Use Flow] Failed:", data.error)
      }
    } catch (err) {
      console.error("[Auto Use Flow] Error:", err)
    } finally {
      setIsAutoFlowing(false)
    }
  }

  const handleRewritePrompt = async () => {
    setIsRewriting(true)
    try {
      const res = await fetch("/api/e2e/rewrite-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: feedback,
          carId,
          phone: leadPhone
        })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.rewrittenPrompt) {
          setFeedback(data.rewrittenPrompt)
        }
      } else {
        console.error("Failed to rewrite prompt")
      }
    } catch (err) {
      console.error("Error rewriting prompt:", err)
    } finally {
      setIsRewriting(false)
    }
  }

  const handleRate = async (id: string, isHistory: boolean, isPositive: boolean | null) => {
    // Optimistic update
    const rateId = isHistory ? `hist-${id}` : `current-${id}`
    const currentVal = localRatings[rateId] === undefined ?
      (isHistory ? history.find(h => h.id === id)?.is_positive : insights?.is_positive) :
      localRatings[rateId];

    // Toggle logic: if clicking the same rating, set to null
    const newVal = currentVal === isPositive ? null : isPositive

    setLocalRatings(prev => ({ ...prev, [rateId]: newVal }))

    try {
      await fetch("/api/e2e/ai-insights/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isHistory, isPositive: newVal })
      })
      if (onRate) await onRate(id, isHistory, newVal)
    } catch (error) {
      console.error("[AiThinkingChat] Failed to rate:", error)
      // Rollback on error? Maybe not necessary for this tiny feature
    }
  }

  const toggleExpand = (idx: number) => {
    setExpandedIndices(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    )
  }

  // Auto-scroll to bottom when insights change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [insights, isLoading])

  const animationKey = insights ? `${insights.aiInsightId}-${insights.created_at}` : null

  // Clear local ratings for current insight when a new analysis starts
  useEffect(() => {
    if (insights?.aiInsightId) {
      const key = `current-${insights.aiInsightId}`
      setLocalRatings(prev => {
        if (prev[key] !== undefined) {
          const newState = { ...prev }
          delete newState[key]
          return newState
        }
        return prev
      })
    }
  }, [animationKey])

  if (isLoading && !insights) {
    return (
      <div className="flex items-start gap-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-pulse mt-6">
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <Loader2 className="h-4 w-4 text-indigo-600 animate-spin" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-indigo-100 rounded w-1/4"></div>
          <div className="h-3 bg-indigo-100 rounded w-3/4"></div>
          <div className="h-3 bg-indigo-100 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (!insights || (!insights.analysis && !insights.history?.length)) return null

  const analysis = insights.analysis as any
  const { targetWorkflowName, history = [] } = insights
  const isNew = insights.isNew && hasAnimated !== animationKey

  return (
    <div className="bg-white rounded-lg p-3 sm:p-5 shadow-sm mb-4 flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <h4 className="text-sm font-semibold text-gray-900">AI Assistant Thinking</h4>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-gray-500 hover:text-gray-700 h-7 px-2 gap-1.5"
            >
              <History className="h-3.5 w-3.5" />
              {showHistory ? "Ẩn lịch sử" : `Xem lịch sử (${history.length})`}
            </Button>
          )}

          {insights?.currentDiary && (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50"
                  title="Xem nhật ký tri thức (AI Memory)"
                >
                  <BrainCircuit className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-indigo-500" />
                    Knowledge Diary
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 mt-4 pr-4">
                  <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-mono bg-gray-50 p-4 rounded-xl border border-gray-100 italic">
                    {insights.currentDiary}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Scrollable Conversation History */}
        <div
          ref={scrollRef}
          className="max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-transparent space-y-6"
        >
          {/* History Loop - Only show when showHistory is true */}
          {showHistory && history.map((item, idx) => {
            const isExpanded = expandedIndices.includes(idx)
            return (
              <div key={idx} className="space-y-4">
                {/* AI Old Thought */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200">
                    <Bot className="h-5 w-5 text-gray-400" />
                  </div>
                  <div
                    onClick={() => toggleExpand(idx)}
                    className={`flex-1 bg-white rounded-xl p-3 border border-gray-200 text-xs text-gray-600 cursor-pointer hover:border-indigo-200 transition-colors shadow-sm group relative ${isExpanded ? '' : 'opacity-70 grayscale-[0.3]'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-gray-700">AI re-evaluated</p>
                      {isExpanded ? <ChevronUp className="h-3 w-3 text-gray-400" /> : <ChevronDown className="h-3 w-3 text-gray-400 group-hover:text-indigo-400" />}
                    </div>

                    <div className={isExpanded ? 'mt-2' : ''}>
                      {isExpanded ? (
                        <DynamicInsightValue
                          value={item.ai_insight_summary}
                          isNew={false}
                          onExecuteConnector={onExecuteConnector}
                          carId={carId}
                          currentUserId={currentUserId}
                          leadPhone={leadPhone}
                        />
                      ) : (
                        <p className="line-clamp-1 font-medium">
                          {typeof item.ai_insight_summary === 'object'
                            ? (Object.values(item.ai_insight_summary)[0] as any)?.toString() || "Previous Thought"
                            : "Previous Thought"}
                        </p>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRate(item.id, true, true); }}
                          className={`p-1.5 hover:bg-green-50 rounded transition-colors group/rate-up ${(localRatings[`hist-${item.id}`] ?? item.is_positive) === true ? 'text-green-600 bg-green-50' : 'text-gray-300 hover:text-green-500'}`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRate(item.id, true, false); }}
                          className={`p-1.5 hover:bg-red-50 rounded transition-colors group/rate-down ${(localRatings[`hist-${item.id}`] ?? item.is_positive) === false ? 'text-red-500 bg-red-50' : 'text-gray-300 hover:text-red-400'}`}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* User Old Feedback */}
                <div className="flex items-start gap-3 justify-end">
                  <div className="flex-1 bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 text-xs text-indigo-700 max-w-[85%] shadow-sm">
                    <p className="font-bold text-indigo-800 mb-1">User Feedback</p>
                    <p className="whitespace-pre-wrap">{item.user_feedback}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 border border-indigo-200">
                    <User className="h-5 w-5 text-indigo-600" />
                  </div>
                </div>
              </div>
            )
          })}

          {/* Current AI Analysis (Always Expanded) */}
          {analysis && (
            <div className={`flex items-start gap-3 p-4 bg-gradient-to-br from-indigo-50 to-white rounded-xl border border-indigo-200 shadow-md ring-1 ring-indigo-500/10 transition-opacity ${isLoading ? 'opacity-50' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-white">
                {isLoading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Bot className="h-6 w-6 text-white" />}
              </div>

              <div className="flex-1 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Latest Analysis</span>
                    {isLoading && <Badge variant="outline" className="text-[10px] py-0 h-4 border-indigo-200 text-indigo-600 animate-pulse">Thinking...</Badge>}
                  </div>
                  {targetWorkflowName && (
                    <Badge variant="secondary" className="bg-indigo-600 text-white hover:bg-indigo-700 border-none shadow-sm">
                      <Target className="h-3 w-3 mr-1" />
                      Rec: {targetWorkflowName}
                    </Badge>
                  )}
                </div>

                <div className="py-2">
                  <DynamicInsightValue
                    value={typeof analysis === 'object' && analysis !== null && !Array.isArray(analysis)
                      ? (() => {
                        const keys = Object.keys(analysis);
                        const startIdx = keys.indexOf('final_synthesis');
                        if (startIdx === -1) return analysis;
                        return Object.fromEntries(
                          keys.slice(startIdx)
                            .filter(k => !['id', 'created_at', 'selected_transition_id', 'target_workflow_id', 'target_workflow_name'].includes(k))
                            .map(k => [k, analysis[k]])
                        );
                      })()
                      : analysis}
                    isNew={!!isNew}
                    onComplete={() => {
                      setHasAnimated(animationKey)
                    }}
                    onSendScript={onSendScript}
                    onExecuteConnector={onExecuteConnector}
                    carId={carId}
                    currentUserId={currentUserId}
                    leadPhone={leadPhone}
                  />
                </div>

                {analysis.fit_score !== undefined && (
                  <div className="mt-2 pt-3 border-t border-indigo-100 flex items-center justify-between">
                    <div className="flex-1 flex flex-col gap-0.5">
                      <span className="text-xs text-gray-500 font-bold">Độ phù hợp (Fit Score)</span>
                      <span className="text-[10px] text-gray-400">Confidence based on context</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-full border border-indigo-50 shadow-sm ml-4">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 ${analysis.fit_score > 70 ? 'bg-emerald-500' : analysis.fit_score > 40 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                          style={{ width: `${analysis.fit_score}%` }}
                        />
                      </div>
                      <span className={`text-sm font-black ${analysis.fit_score > 70 ? 'text-emerald-600' : analysis.fit_score > 40 ? 'text-amber-600' : 'text-rose-600'
                        }`}>
                        {analysis.fit_score}%
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-indigo-100 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 font-medium">Was this analysis helpful?</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => insights.aiInsightId && handleRate(insights.aiInsightId, false, true)}
                      className={`p-2 hover:bg-green-50 rounded-lg transition-all ${(localRatings[`current-${insights.aiInsightId}`] ?? insights.is_positive) === true ? 'text-green-600 bg-green-50 ring-1 ring-green-200 shadow-sm' : 'text-gray-400 hover:text-green-500'}`}
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => insights.aiInsightId && handleRate(insights.aiInsightId, false, false)}
                      className={`p-2 hover:bg-red-50 rounded-lg transition-all ${(localRatings[`current-${insights.aiInsightId}`] ?? insights.is_positive) === false ? 'text-red-500 bg-red-50 ring-1 ring-red-200 shadow-sm' : 'text-gray-400 hover:text-red-400'}`}
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Use Flow Button */}
                {onUseFlow && !isLoading && analysis && (() => {
                  // Extract steps from final_synthesis
                  const extractSteps = () => {
                    const flowSteps: {
                      stepName: string;
                      connectorId: string;
                      connectorLabel: string;
                      defaultValues: Record<string, any>;
                      aiMetadata?: {
                        action?: string
                        expectedReaction?: string
                        successSignal?: string
                        failureSignal?: string
                        ifSuccess?: string
                        ifFailure?: string
                      }
                    }[] = []
                    const synthesis = analysis.final_synthesis || analysis

                    // Walk through the analysis looking for actionable steps
                    const walkObject = (obj: any) => {
                      if (!obj || typeof obj !== 'object') return

                      // Detect script → Gửi Script connector
                      if (typeof obj.script === 'string' && obj.script.trim()) {
                        const defaults: Record<string, any> = {}
                        if (currentUserId) defaults.picId = currentUserId
                        if (leadPhone) defaults.customer_phone = leadPhone
                        defaults.messages = [obj.script]
                        flowSteps.push({
                          stepName: 'Gửi Script',
                          connectorId: '05b6afa5-786f-4062-9d53-de9cb89450ee',
                          connectorLabel: 'Gửi Script',
                          defaultValues: defaults,
                          aiMetadata: {
                            action: obj.action,
                            expectedReaction: obj.expected_customer_reaction || obj.expected_reaction,
                            successSignal: obj.success_signal,
                            failureSignal: obj.failure_signal,
                            ifSuccess: obj.if_success,
                            ifFailure: obj.if_failure,
                          }
                        })
                      }

                      // Detect action → Create Bidding Session connector
                      const action = typeof obj.action === 'string' ? obj.action.toLowerCase() : ""
                      if (action.includes('tạo phiên đấu giá') ||
                        action.includes('tạo phiên') ||
                        action.includes('đấu giá') ||
                        action.includes('bidding')) {
                        const defaults: Record<string, any> = {}
                        if (carId) defaults.carId = carId
                        flowSteps.push({
                          stepName: 'Tạo phiên đấu giá',
                          connectorId: '6e98e9e6-87a6-41b8-9694-294472419351',
                          connectorLabel: 'Tạo phiên đấu giá',
                          defaultValues: defaults,
                          aiMetadata: {
                            action: obj.action,
                            expectedReaction: obj.expected_customer_reaction || obj.expected_reaction,
                            successSignal: obj.success_signal,
                            failureSignal: obj.failure_signal,
                            ifSuccess: obj.if_success,
                            ifFailure: obj.if_failure,
                          }
                        })
                      }

                      // Recurse into arrays and objects
                      if (Array.isArray(obj)) {
                        obj.forEach(walkObject)
                      } else {
                        Object.values(obj).forEach(v => {
                          if (typeof v === 'object' && v !== null) walkObject(v)
                        })
                      }
                    }

                    walkObject(synthesis)
                    return flowSteps
                  }

                  const flowSteps = extractSteps()
                  if (flowSteps.length === 0) return null

                  // We now render this button in the action Box above the prompt instead of here.
                  return null
                })()}

              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Box (Above Textarea) */}
        <div className="flex flex-wrap items-center gap-2 mt-2 pt-4 border-t border-gray-100 bg-white/50 p-2 rounded-xl">
          {onUseFlow && !isLoading && analysis && (
            <Button
              size="sm"
              disabled={isAutoFlowing}
              onClick={() => handleAutoUseFlow(analysis)}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-sm text-xs h-8 px-3"
            >
              {isAutoFlowing
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Đang tạo...</>
                : <><Bot className="h-3.5 w-3.5 mr-1.5" />Kích hoạt Flow tự động</>
              }
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs px-3 border-orange-300 text-orange-600 hover:bg-orange-50 shadow-sm"
            onClick={retriggerAi}
            disabled={retriggeringAi}
          >
            {retriggeringAi
              ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Đang xử lý...</>
              : <><RefreshCw className="h-3 w-3 mr-1" />RE-TRIGGER</>
            }
          </Button>

          {isBlacklisted ? (
            <Button
              variant="default"
              size="sm"
              className="h-8 text-xs px-3 bg-blue-600 hover:bg-blue-700 shadow-sm"
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
              className="h-8 text-xs px-3 shadow-sm"
              onClick={() => toggleBlacklist("deactivate")}
              disabled={togglingBlacklist}
            >
              {togglingBlacklist ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Power className="h-3 w-3 mr-1" />}
              DEACTIVATE AI
            </Button>
          )}
        </div>

        {/* Feedback Input Area (Sticky at bottom if container grows too large) */}
        <div className="flex items-start gap-3 border-t pt-4 border-gray-100">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 border border-indigo-100 shadow-inner">
            <User className="h-6 w-6 text-indigo-400" />
          </div>
          <div className="flex-1 relative">
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={isLoading || isSubmitting || isRewriting}
              placeholder={isLoading ? "AI đang xử lý, vui lòng chờ..." : "Nhập thêm thông tin thực tế để AI tối ưu kịch bản... (Ví dụ: Khách đang rất cứng giá, không thích nhắn tin nhiều, thích nói chuyện ngoài lề, gap giá 20tr, giá dealer căng nhất rồi, tiếp theo gọi điện chốt lịch tối nay"}
              className="pr-[90px] min-h-[90px] max-h-[400px] text-sm focus-visible:ring-indigo-500 border-indigo-100 shadow-sm resize-y rounded-xl"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isLoading && !isSubmitting && !isRewriting) {
                  handleSendFeedback()
                }
              }}
            />
            <Button
              size="icon"
              variant="outline"
              disabled={isRewriting || isLoading || isSubmitting}
              onClick={handleRewritePrompt}
              title="Nhờ AI viết lại hoặc gợi ý yêu cầu"
              className="absolute bottom-[3.25rem] right-3 bg-white/80 hover:bg-white text-indigo-600 border-indigo-200 h-9 w-9 rounded-xl shadow-sm transition-transform active:scale-95 z-10"
            >
              {isRewriting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              disabled={!feedback.trim() || isSubmitting || isLoading || isRewriting}
              onClick={handleSendFeedback}
              className="absolute bottom-3 right-3 bg-indigo-600 hover:bg-indigo-700 h-9 w-9 text-white rounded-xl shadow-lg transition-transform active:scale-95"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
            <div className="absolute -bottom-5 left-1">
              <span className="text-[10px] text-gray-400">Press Cmd/Ctrl + Enter to send</span>
            </div>
          </div>
        </div>
      </div>
    </div >
  )
}
