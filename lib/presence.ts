import { useEffect, useState } from "react"

// ── Presence freshness (Friends system) ───────────────────────────────────────
// "Online" is derived on the client from a friend's last heartbeat (see
// convex/presence.ts) rather than a stored flag, so it ages out on its own. These
// helpers are shared by every surface that shows online status (the friends list,
// the live-session invite dialog) so the threshold is defined once.

// A friend counts as online if their last heartbeat is within this window. Set a
// bit above the 25s client heartbeat so a single missed beat doesn't flicker.
export const ONLINE_THRESHOLD_MS = 70_000

export function isOnline(lastSeenAt: number | null | undefined, now: number): boolean {
  return lastSeenAt != null && now - lastSeenAt < ONLINE_THRESHOLD_MS
}

// A clock that re-renders the consumer every `intervalMs` so derived online
// status recomputes over time. Starts at 0 and sets the real time on mount (not
// during render) to avoid an SSR/client Date.now() hydration mismatch.
export function useNowTick(intervalMs = 20_000): number {
  const [now, setNow] = useState(0)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
