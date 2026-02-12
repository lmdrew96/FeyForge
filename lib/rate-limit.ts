/**
 * Simple in-memory sliding-window rate limiter.
 * Keyed by user ID for authenticated API routes.
 *
 * Note: In-memory state resets on serverless cold starts.
 * For stricter enforcement, upgrade to Vercel KV or Redis.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Prune expired entries every 5 minutes to prevent memory leaks
const PRUNE_INTERVAL = 5 * 60 * 1000
let lastPrune = Date.now()

function pruneExpiredEntries(windowMs: number) {
  const now = Date.now()
  if (now - lastPrune < PRUNE_INTERVAL) return

  lastPrune = now
  const cutoff = now - windowMs
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) {
      store.delete(key)
    }
  }
}

export function rateLimit(
  userId: string,
  { maxRequests = 20, windowMs = 60 * 1000 } = {}
): { success: boolean; remaining: number } {
  const now = Date.now()
  const cutoff = now - windowMs

  pruneExpiredEntries(windowMs)

  const entry = store.get(userId) ?? { timestamps: [] }
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

  if (entry.timestamps.length >= maxRequests) {
    return { success: false, remaining: 0 }
  }

  entry.timestamps.push(now)
  store.set(userId, entry)

  return { success: true, remaining: maxRequests - entry.timestamps.length }
}
