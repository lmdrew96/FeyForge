"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"

// "Have an invite code?" entry — the in-app way to join when the DM reads a code
// aloud instead of sharing the full link. Normalizes to uppercase (the join page
// does too) and routes to /session/join/[code], which owns all validation
// (resolveJoinCode renders a clean error for an invalid/expired code). Self-
// contained so it can drop into the dashboard empty state and the /session
// pre-session view alike.
export function JoinCodeField({ autoFocus }: { autoFocus?: boolean }) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const trimmed = code.trim()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmed) return
    router.push(`/session/join/${encodeURIComponent(trimmed.toUpperCase())}`)
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        autoFocus={autoFocus}
        placeholder="Invite code"
        aria-label="Invite code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="flex-1 min-w-0 px-3 py-2 rounded-md text-sm bg-transparent outline-none font-mono tracking-wider"
        style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
      />
      <button
        type="submit"
        disabled={!trimmed}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 shrink-0"
        style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
      >
        Join <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  )
}
