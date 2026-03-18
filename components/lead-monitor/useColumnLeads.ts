"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { HITLLead, StepKey, PaginatedLeadsResponse } from "./types"

const LIMIT = 15

interface UseColumnLeadsReturn {
  items: HITLLead[]
  isLoadingInitial: boolean
  isFetchingMore: boolean
  hasMore: boolean
  loadMore: () => void
  removeItem: (id: string) => void
}

export function useColumnLeads(
  stepKey: StepKey,
  picId: string,
  refreshKey: number
): UseColumnLeadsReturn {
  const [items, setItems] = useState<HITLLead[]>([])
  const [isLoadingInitial, setIsLoadingInitial] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const cursorRef = useRef<string | null>(null)
  const fetchingRef = useRef(false)

  const fetchPage = useCallback(
    async (cursor: string | null, isInitial: boolean) => {
      if (fetchingRef.current) return
      fetchingRef.current = true

      if (isInitial) setIsLoadingInitial(true)
      else setIsFetchingMore(true)

      try {
        const params = new URLSearchParams({ step_key: stepKey, limit: String(LIMIT) })
        if (picId !== "all") params.set("pic_id", picId)
        if (cursor) params.set("cursor", cursor)

        const res = await fetch(`/api/lead-monitor/queue?${params}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data: PaginatedLeadsResponse = await res.json()
        cursorRef.current = data.next_cursor ?? null
        setHasMore(data.has_more ?? false)
        setItems((prev) => (isInitial ? data.items : [...prev, ...data.items]))
      } catch (e) {
        console.error(`[useColumnLeads] ${stepKey}:`, e)
      } finally {
        fetchingRef.current = false
        if (isInitial) setIsLoadingInitial(false)
        else setIsFetchingMore(false)
      }
    },
    [stepKey, picId]
  )

  // Reset + initial fetch whenever picId or refreshKey changes
  useEffect(() => {
    cursorRef.current = null
    fetchingRef.current = false
    setItems([])
    setHasMore(true)
    fetchPage(null, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picId, refreshKey, stepKey])

  const loadMore = useCallback(() => {
    if (!hasMore || fetchingRef.current) return
    fetchPage(cursorRef.current, false)
  }, [hasMore, fetchPage])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((l) => l.id !== id))
  }, [])

  return { items, isLoadingInitial, isFetchingMore, hasMore, loadMore, removeItem }
}
