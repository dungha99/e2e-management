"use client"

import { useCallback, useMemo, useState, useEffect } from "react"

const STORAGE_KEY = "decoy-message-counts"

interface MessageCountMap {
    [leadId: string]: number
}

/**
 * Hook to manage decoy message count tracking for "new reply" indicators.
 * 
 * Approach: Compare stored message count with current count from API.
 * - If current > stored: lead has new replies (show indicator)
 * - When user views the chat, update stored count to current
 */
export function useDecoySignals() {
    // State to trigger re-renders when storage changes
    const [storedCounts, setStoredCounts] = useState<MessageCountMap>({})

    // Load from localStorage on mount
    useEffect(() => {
        if (typeof window === "undefined") return

        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                setStoredCounts(JSON.parse(stored))
            }
        } catch (e) {
            console.warn("[useDecoySignals] Failed to parse stored counts:", e)
            setStoredCounts({})
        }
    }, [])

    // Get stored count for a lead
    const getStoredCount = useCallback((leadId: string): number => {
        return storedCounts[leadId] ?? 0
    }, [storedCounts])

    // Update stored count for a lead (mark as "read")
    const markAsRead = useCallback((leadId: string, currentCount: number) => {
        if (typeof window === "undefined") return
        if (!leadId || currentCount === undefined || currentCount === null) return

        setStoredCounts(prev => {
            const updated = { ...prev, [leadId]: currentCount }
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
            } catch (e) {
                console.warn("[useDecoySignals] Failed to save to localStorage:", e)
            }
            return updated
        })
    }, [])

    // Check if a lead has new replies
    const hasNewReplies = useCallback((leadId: string, currentCount: number | undefined | null): boolean => {
        if (!leadId || currentCount === undefined || currentCount === null) return false
        const stored = storedCounts[leadId] ?? 0
        return currentCount > stored
    }, [storedCounts])

    // Batch check for multiple leads - returns map of leadId -> hasNew
    const checkMultipleLeads = useCallback((leads: Array<{ id: string; total_decoy_messages?: number | null }>) => {
        const result: Record<string, boolean> = {}
        for (const lead of leads) {
            result[lead.id] = hasNewReplies(lead.id, lead.total_decoy_messages ?? 0)
        }
        return result
    }, [hasNewReplies])

    return {
        getStoredCount,
        markAsRead,
        hasNewReplies,
        checkMultipleLeads,
    }
}
