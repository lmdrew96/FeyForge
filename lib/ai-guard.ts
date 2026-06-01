import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { fetchMutation } from "convex/nextjs"
import { api } from "@/convex/_generated/api"

// The single gate every AI route calls. Authenticates, then atomically reserves
// one daily AI credit in Convex (premium 50/day, free 3/day). Stateless
// fetchMutation with a per-call Clerk→Convex token — no shared client, so no
// cross-request auth race under concurrency.
//
// FAILS CLOSED: if the guard itself errors (token mint hiccup, Convex blip) it
// blocks the request (503) rather than letting AI through unmetered — a guard
// bug must never become unlimited free AI.

type GuardOk = { ok: true; token: string | null; remaining: number; isPremium: boolean }
type GuardFail = { ok: false; res: NextResponse }

export async function guardAi(): Promise<GuardOk | GuardFail> {
  const { userId, getToken } = await auth()
  if (!userId) {
    return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  try {
    const token = await getToken({ template: "convex" })
    const result = await fetchMutation(api.aiUsage.consume, {}, { token: token ?? undefined })
    if (!result.allowed) {
      return {
        ok: false,
        res: NextResponse.json(
          { error: "quota_exceeded", isPremium: result.isPremium, cap: result.cap },
          { status: 429, headers: { "Retry-After": "3600" } },
        ),
      }
    }
    return { ok: true, token, remaining: result.remaining, isPremium: result.isPremium }
  } catch (err) {
    console.error("[FeyForge] AI guard error:", err)
    return { ok: false, res: NextResponse.json({ error: "ai_unavailable" }, { status: 503 }) }
  }
}

// Hand the reserved credit back when a generation throws after the guard passed.
// Best-effort; never throws (a failed refund shouldn't mask the original error).
export async function refundAi(token: string | null): Promise<void> {
  try {
    await fetchMutation(api.aiUsage.refund, {}, { token: token ?? undefined })
  } catch (err) {
    console.error("[FeyForge] AI refund error:", err)
  }
}
