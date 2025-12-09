/**
 * Simple in-memory cache for Next.js API routes
 * Works on Vercel serverless functions
 * For production with multiple instances, upgrade to Redis (Upstash)
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>>

  constructor() {
    this.cache = new Map()
  }

  /**
   * Get cached value or fetch and cache it
   */
  async get<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 60
  ): Promise<T> {
    const now = Date.now()
    const cached = this.cache.get(key)

    // Return cached value if still valid
    if (cached && cached.expiresAt > now) {
      console.log(`[Cache HIT] ${key}`)
      return cached.data as T
    }

    // Cache miss - fetch fresh data
    console.log(`[Cache MISS] ${key}`)
    try {
      const data = await fetchFn()
      const expiresAt = now + ttlSeconds * 1000

      this.cache.set(key, { data, expiresAt })

      // Clean up expired entries periodically
      this.cleanExpired()

      return data
    } catch (error) {
      // If fetch fails and we have expired cache, return stale data
      if (cached) {
        console.warn(`[Cache STALE] ${key} - returning expired data due to fetch error`)
        return cached.data as T
      }
      throw error
    }
  }

  /**
   * Manually invalidate a cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key)
    console.log(`[Cache INVALIDATE] ${key}`)
  }

  /**
   * Invalidate all keys matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern)
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
    console.log(`[Cache INVALIDATE PATTERN] ${pattern}`)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
    console.log("[Cache CLEAR] All cache cleared")
  }

  /**
   * Remove expired entries (automatic cleanup)
   */
  private cleanExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

// Global cache instance (persists across function invocations in same container)
const globalForCache = globalThis as unknown as {
  cache: SimpleCache | undefined
}

if (!globalForCache.cache) {
  globalForCache.cache = new SimpleCache()
}

export const cache = globalForCache.cache

/**
 * Helper function for easy caching
 */
export async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  return cache.get(key, fetchFn, ttlSeconds)
}

/**
 * Invalidate cache by key
 */
export function invalidateCache(key: string): void {
  cache.invalidate(key)
}

/**
 * Invalidate cache by pattern
 */
export function invalidateCachePattern(pattern: string): void {
  cache.invalidatePattern(pattern)
}
