import { useState, useRef, useEffect, memo } from "react"
import { Bot, Target, Loader2, Sparkles, Send, User, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, History, BrainCircuit } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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

const DynamicInsightValue = ({ value, isNew, onComplete }: { value: any, isNew: boolean, onComplete?: () => void }) => {
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
              />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (onComplete) onComplete();
  return <span className="text-sm font-medium text-gray-900">{String(value)}</span>
}

export function AiThinkingChat({ insights, isLoading, onSubmitFeedback, onRate }: AiThinkingChatProps) {
  const [feedback, setFeedback] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedIndices, setExpandedIndices] = useState<number[]>([])
  const [hasAnimated, setHasAnimated] = useState<string | null>(null) // Tracks last animated unique state
  const [showHistory, setShowHistory] = useState(false) // Toggle for chat history visibility
  const scrollRef = useRef<HTMLDivElement>(null)

  const [localRatings, setLocalRatings] = useState<Record<string, boolean | null>>({})

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

  const { analysis, targetWorkflowName, history = [] } = insights
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
                        <DynamicInsightValue value={item.ai_insight_summary} isNew={false} />
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
                    value={analysis}
                    isNew={!!isNew}
                    onComplete={() => {
                      setHasAnimated(animationKey)
                    }}
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
              </div>
            </div>
          )}
        </div>

        {/* Feedback Input Area (Sticky at bottom if container grows too large) */}
        <div className="flex items-start gap-3 mt-2 border-t pt-4 border-gray-100">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 border border-indigo-100 shadow-inner">
            <User className="h-6 w-6 text-indigo-400" />
          </div>
          <div className="flex-1 relative">
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Nhập thêm thông tin thực tế để AI tối ưu kịch bản... (Ví dụ: Khách đang rất cứng giá, không thích nhắn tin nhiều, thích nói chuyện ngoài lề, gap giá 20tr, giá dealer căng nhất rồi, tiếp theo gọi điện chốt lịch tối nay"
              className="pr-12 min-h-[90px] text-sm focus-visible:ring-indigo-500 border-indigo-100 shadow-sm resize-none rounded-xl"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSendFeedback()
                }
              }}
            />
            <Button
              size="icon"
              disabled={!feedback.trim() || isSubmitting || isLoading}
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
    </div>
  )
}
