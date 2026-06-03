import type { Doc } from "./_generated/dataModel"

type PremiumFields = Pick<Doc<"users">, "isPremium" | "premiumExpiresAt" | "role">

// The single rule for "is this user premium RIGHT NOW" — every premium gate
// (getMe, AI quota, world-map imports) reads through this so they can't drift.
//
// Read-time enforcement: a lapsed Ko-fi subscription loses access the instant
// premiumExpiresAt passes, not whenever the daily cron next runs. convex/crons.ts
// still flips the stored isPremium:false for housekeeping (keeps the by_isPremium
// index + admin reporting honest), but correctness no longer depends on it firing.
//
//   • Admins are always premium (free, never expires).
//   • A premium user with no expiry set — legacy/manual/comped grants — never
//     lapses. Only Ko-fi subscribers carry premiumExpiresAt, so only they expire.
export function isPremiumActive(user: PremiumFields, now: number = Date.now()): boolean {
  if (user.role === "admin") return true
  if (!user.isPremium) return false
  if (user.premiumExpiresAt === undefined) return true
  return user.premiumExpiresAt > now
}
