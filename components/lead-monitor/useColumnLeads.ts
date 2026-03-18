"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { HITLLead, StepKey } from "./types"

const PAGE_SIZE = 15

interface UseColumnLeadsReturn {
  leads: HITLLead[]
  isLoading: boolean
  hasMore: boolean
  total: number
  loadMore: () => void
  removeLead: (id: string) => void
}

export function useColumnLeads(
  stepKey: StepKey,
  picId: string,
  refreshKey: number
): UseColumnLeadsReturn {
  const [leads, setLeads] = useState<HITLLead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)

  const cursorRef = useRef<string | null>(null)
  const fetchingRef = useRef(false)

  // Initial/reset load when filters change
  useEffect(() => {
    let cancelled = false
    cursorRef.current = null
    fetchingRef.current = true
    setIsLoading(true)
    setLeads([])
    setHasMore(false)

    const params = new URLSearchParams({ step_key: stepKey, limit: String(PAGE_SIZE) })
    if (picId !== "all") params.set("pic_id", picId)

    fetch(`/api/lead-monitor/queue?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        if (cancelled) return
        setLeads(data.items ?? [])
        cursorRef.current = data.next_cursor ?? null
        setHasMore(data.has_more ?? false)
        setTotal(data.total ?? 0)
      })
      .catch((e) => { if (!cancelled) console.error(`[useColumnLeads] ${stepKey}:`, e) })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
          fetchingRef.current = false
        }
      })

    return () => { cancelled = true }
  }, [stepKey, picId, refreshKey])

  const loadMore = useCallback(() => {
    if (fetchingRef.current || !hasMore || !cursorRef.current) return
    fetchingRef.current = true
    setIsLoading(true)

    const params = new URLSearchParams({
      step_key: stepKey,
      limit: String(PAGE_SIZE),
      cursor: cursorRef.current,
    })
    if (picId !== "all") params.set("pic_id", picId)

    fetch(`/api/lead-monitor/queue?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        setLeads((prev) => [...prev, ...(data.items ?? [])])
        cursorRef.current = data.next_cursor ?? null
        setHasMore(data.has_more ?? false)
        setTotal(data.total ?? 0)
      })
      .catch((e) => console.error(`[useColumnLeads] loadMore ${stepKey}:`, e))
      .finally(() => {
        setIsLoading(false)
        fetchingRef.current = false
      })
  }, [stepKey, picId, hasMore])

  const removeLead = useCallback((id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id))
    setTotal((prev) => Math.max(0, prev - 1))
  }, [])

  return { leads, isLoading, hasMore, total, loadMore, removeLead }
}
