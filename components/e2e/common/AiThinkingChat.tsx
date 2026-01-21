import { useState, useRef, useEffect, memo } from "react"
import { Bot, Target, BarChart, Loader2, Sparkles, Send, User, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AiInsight } from "../types"

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

export function AiThinkingChat({ insights, isLoading, onSubmitFeedback, onRate }: AiThinkingChatProps) {
  const [feedback, setFeedback] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedIndices, setExpandedIndices] = useState<number[]>([])
  const [hasAnimated, setHasAnimated] = useState<string | null>(null) // Tracks last animated unique state
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
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="h-4 w-4 text-indigo-500" />
        <h4 className="text-sm font-semibold text-gray-900">AI Assistant Thinking</h4>
      </div>

      <div className="flex flex-col gap-6">
        {/* Scrollable Conversation History */}
        <div
          ref={scrollRef}
          className="max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-transparent space-y-6"
        >
          {/* History Loop */}
          {history.map((item, idx) => {
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

                    <p className={`font-medium mb-1 ${isExpanded ? '' : 'line-clamp-1'}`}>
                      {item.ai_insight_summary.current_intent_detected}
                    </p>
                    <p className={`italic ${isExpanded ? '' : 'line-clamp-1'}`}>
                      {item.ai_insight_summary.price_gap_evaluation}
                    </p>

                    {isExpanded && item.ai_insight_summary.fit_score !== undefined && (
                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">Fit Score: {item.ai_insight_summary.fit_score}%</span>
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-300"
                              style={{ width: `${item.ai_insight_summary.fit_score}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-1 ml-2 border-l pl-2 border-gray-100">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRate(item.id, true, true); }}
                              className={`p-1 hover:bg-green-50 rounded transition-colors group/rate-up ${(localRatings[`hist-${item.id}`] ?? item.is_positive) === true ? 'text-green-600 bg-green-50' : 'text-gray-300 hover:text-green-500'}`}
                            >
                              <ThumbsUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRate(item.id, true, false); }}
                              className={`p-1 hover:bg-red-50 rounded transition-colors group/rate-down ${(localRatings[`hist-${item.id}`] ?? item.is_positive) === false ? 'text-red-500 bg-red-50' : 'text-gray-300 hover:text-red-400'}`}
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
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

                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
                      <Target className="h-3 w-3" />
                      Dự đoán ý định
                    </div>
                    <div className="text-sm text-gray-900 leading-relaxed font-semibold bg-white/50 p-2 rounded-lg border border-indigo-50 min-h-[40px]">
                      {isNew ? (
                        <TypingText
                          text={analysis.current_intent_detected}
                        />
                      ) : (
                        analysis.current_intent_detected
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
                      <BarChart className="h-3 w-3" />
                      Đánh giá khoảng giá
                    </div>
                    <div className="text-sm text-gray-800 leading-relaxed italic border-l-2 border-indigo-200 pl-3 min-h-[20px]">
                      {isNew ? (
                        <TypingText
                          text={analysis.price_gap_evaluation}
                          onComplete={() => {
                            setHasAnimated(animationKey)
                          }}
                        />
                      ) : (
                        analysis.price_gap_evaluation
                      )}
                    </div>
                  </div>

                  {analysis.fit_score !== undefined && (
                    <div className="mt-2 pt-3 border-t border-indigo-100 flex items-center justify-between">
                      <div className="flex-1 flex flex-col gap-0.5">
                        <span className="text-xs text-gray-500 font-bold">Độ phù hợp (Fit Score)</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">Confidence based on context</span>
                          <div className="flex items-center gap-1 ml-auto border-l pl-2 border-indigo-100">
                            <button
                              onClick={() => insights.aiInsightId && handleRate(insights.aiInsightId, false, true)}
                              className={`p-1.5 hover:bg-green-50 rounded-md transition-colors ${(localRatings[`current-${insights.aiInsightId}`] ?? insights.is_positive) === true ? 'text-green-600 bg-green-50 ring-1 ring-green-200' : 'text-gray-400 hover:text-green-500 hover:ring-1 hover:ring-green-100'}`}
                            >
                              <ThumbsUp className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => insights.aiInsightId && handleRate(insights.aiInsightId, false, false)}
                              className={`p-1.5 hover:bg-red-50 rounded-md transition-colors ${(localRatings[`current-${insights.aiInsightId}`] ?? insights.is_positive) === false ? 'text-red-500 bg-red-50 ring-1 ring-red-200' : 'text-gray-400 hover:text-red-400 hover:ring-1 hover:ring-red-100'}`}
                            >
                              <ThumbsDown className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
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
              placeholder="Nhập phản hồi hoặc yêu cầu AI đánh giá lại..."
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
