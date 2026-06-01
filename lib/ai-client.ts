"use client"

// Client-side wrapper for the JSON AI routes (the generateObject ones). Centralizes
// how the guard's 401/429/503 responses become friendly, quota-aware messages so
// every AI surface degrades the same way — no more "Failed to generate" on a free
// user who simply hit their daily taste. (Streaming routes like the DM Assistant
// surface errors through their own useChat handler, not this.)

export type AiErrorKind = "auth" | "quota" | "unavailable" | "failed"

export class AiError extends Error {
  kind: AiErrorKind
  isPremium?: boolean
  constructor(kind: AiErrorKind, message: string, isPremium?: boolean) {
    super(message)
    this.name = "AiError"
    this.kind = kind
    this.isPremium = isPremium
  }
}

export async function postAi<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (res.ok) return (await res.json()) as T

  let data: { error?: string; isPremium?: boolean } = {}
  try {
    data = await res.json()
  } catch {
    // non-JSON error body
  }

  if (res.status === 401) {
    throw new AiError("auth", "Please sign in to use AI features.")
  }
  if (res.status === 429) {
    const isPremium = data.isPremium
    throw new AiError(
      "quota",
      isPremium
        ? "You've used today's AI generations — resets tomorrow."
        : "You've used your free AI generations for today. Upgrade for 50/day.",
      isPremium,
    )
  }
  if (res.status === 503) {
    throw new AiError("unavailable", "AI is briefly unavailable — try again in a moment.")
  }
  throw new AiError("failed", data.error || "AI request failed.")
}
