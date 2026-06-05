"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useAction, useMutation, useQuery } from "convex/react"
import { Captions, CaptionsOff, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useLiveCaptions } from "@/hooks/use-live-captions"

type SessionId = Id<"partySessions">

// ── DM control ──────────────────────────────────────────────────────────────
// Premium-gated toggle that captures the DM's mic, streams to AssemblyAI, and
// pushes finalized lines to Convex. A premium DM unlocks captions for the whole
// table; non-premium DMs see a locked upgrade card.

export function DMCaptionControl({ sessionId }: { sessionId: SessionId }) {
  const me = useQuery(api.users.getMe)
  const getStreamingToken = useAction(api.liveCaptions.getStreamingToken)
  const pushLine = useMutation(api.liveCaptions.pushLine)
  const setLivePartial = useMutation(api.liveCaptions.setLivePartial)

  const captions = useLiveCaptions({
    getToken: useCallback(async () => {
      const res = await getStreamingToken({ sessionId })
      return res.token
    }, [getStreamingToken, sessionId]),
    onFinal: useCallback(
      (text: string) => {
        void pushLine({ sessionId, text }).catch(() => {})
      },
      [pushLine, sessionId],
    ),
    onPartial: useCallback(
      (text: string) => {
        void setLivePartial({ sessionId, text }).catch(() => {})
      },
      [setLivePartial, sessionId],
    ),
    onError: useCallback((e: Error) => toast.error(e.message), []),
  })

  const { isCapturing, error, start, stop } = captions
  const [starting, setStarting] = useState(false)

  const handleToggle = async () => {
    if (isCapturing) {
      stop()
      // Clear the in-progress partial so it doesn't linger on players' screens.
      void setLivePartial({ sessionId, text: "" }).catch(() => {})
      return
    }
    setStarting(true)
    try {
      await start()
    } finally {
      setStarting(false)
    }
  }

  const isPremium = me?.isPremium ?? false

  return (
    <section>
      <h2
        className="text-xs uppercase tracking-widest mb-3"
        style={{ color: "var(--scene-text-muted)" }}
      >
        Live Captions
      </h2>
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        {me === undefined ? (
          <div
            className="h-10 rounded-md animate-pulse"
            style={{ background: "var(--scene-border)" }}
          />
        ) : isPremium ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
                  {isCapturing ? "Captioning your voice" : "Caption your narration"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
                  {isCapturing
                    ? "Players can turn captions on from their screen."
                    : "Transcribes your speech live for players who want captions."}
                </p>
              </div>
              <button
                onClick={handleToggle}
                disabled={starting}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 flex-shrink-0"
                style={{
                  background: isCapturing ? "var(--scene-border)" : "var(--scene-accent)",
                  color: isCapturing ? "var(--scene-text-muted)" : "var(--scene-bg)",
                }}
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isCapturing ? (
                  <CaptionsOff className="h-4 w-4" />
                ) : (
                  <Captions className="h-4 w-4" />
                )}
                {starting ? "Starting…" : isCapturing ? "Stop" : "Start Captions"}
              </button>
            </div>
            {isCapturing && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--scene-accent)" }}>
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: "var(--scene-accent)" }}
                />
                Live — listening to your microphone
              </div>
            )}
            {error && (
              <p className="text-xs" style={{ color: "#ef4444" }}>
                {error}
              </p>
            )}
          </>
        ) : (
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: "color-mix(in srgb, var(--scene-accent) 12%, var(--scene-surface))",
                border: "1px solid color-mix(in srgb, var(--scene-accent) 25%, transparent)",
              }}
            >
              <Lock className="h-4 w-4" style={{ color: "var(--scene-accent)" }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
                Live captions are a premium feature
              </p>
              <p className="text-xs mt-0.5 mb-2" style={{ color: "var(--scene-text-muted)" }}>
                Upgrade to transcribe your narration for the whole table — players see captions free.
              </p>
              <Link
                href="/account"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-opacity hover:opacity-80"
                style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
              >
                <Captions className="h-3.5 w-3.5" />
                Upgrade to enable
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ── Player overlay ──────────────────────────────────────────────────────────
// Fixed bottom caption bar + a bottom-left CC toggle. Opt-in (persisted in
// localStorage), glanceable, and anchored clear of the bottom-right DM Assistant
// widget. Shows the most recent finalized lines.

const CAPTIONS_PREF_KEY = "feyforge:captionsEnabled"
// How long a caption stays on screen after it was spoken. Past this, lines age
// out so the bar clears during silence and stale captions don't return on refresh.
const CAPTION_WINDOW_MS = 10_000

export function PlayerCaptionOverlay({ sessionId }: { sessionId: SessionId }) {
  const data = useQuery(api.liveCaptions.listRecent, { sessionId })
  const [enabled, setEnabled] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // Restore the player's opt-in preference (client-only).
  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(CAPTIONS_PREF_KEY) === "1")
    } catch {
      /* localStorage unavailable */
    }
  }, [])

  // While captions are on, tick a clock so lines age out after silence even when
  // no new caption arrives to re-run the reactive query.
  useEffect(() => {
    if (!enabled) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 2000)
    return () => clearInterval(id)
  }, [enabled])

  const toggle = () => {
    setEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem(CAPTIONS_PREF_KEY, next ? "1" : "0")
      } catch {
        /* ignore */
      }
      return next
    })
  }

  // Visible caption = recent finals + the in-progress partial, dropping anything
  // older than the window so it clears after silence and never resurrects on refresh.
  const fresh = (createdAt: number) => now - createdAt < CAPTION_WINDOW_MS
  const segments: { id: string; text: string; partial: boolean }[] = [
    ...(data?.lines ?? [])
      .filter((l) => fresh(l.createdAt))
      .map((l) => ({ id: l._id as string, text: l.text, partial: false })),
    ...(data?.partial && fresh(data.partial.createdAt)
      ? [{ id: data.partial._id as string, text: data.partial.text, partial: true }]
      : []),
  ].slice(-2)

  const showBar = enabled && segments.length > 0

  return (
    <>
      {/* Caption bar — centered, above the bottom edge, never blocks taps. */}
      {showBar && (
        <div
          className="fixed inset-x-0 bottom-[calc(7.5rem_+_env(safe-area-inset-bottom))] md:bottom-24 z-40 flex justify-center px-4 pointer-events-none"
          aria-live="polite"
        >
          <div
            className="max-w-2xl w-fit rounded-xl px-4 py-2.5 text-center"
            style={{
              background: "rgba(10,10,14,0.82)",
              backdropFilter: "blur(6px)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
            }}
          >
            {segments.map((seg) => (
              <p
                key={seg.id}
                className="text-sm sm:text-base leading-snug"
                style={{
                  color: seg.partial ? "rgba(255,255,255,0.75)" : "#fff",
                  textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                }}
              >
                {seg.text}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* CC toggle — bottom-left, clear of the DM Assistant FAB (bottom-right). */}
      <button
        onClick={toggle}
        aria-pressed={enabled}
        aria-label={enabled ? "Turn captions off" : "Turn captions on"}
        className="fixed left-4 bottom-[calc(4.25rem_+_env(safe-area-inset-bottom))] md:bottom-4 z-[55] flex items-center gap-1.5 h-11 px-3.5 rounded-full text-xs font-medium transition-all hover:opacity-90"
        style={{
          background: enabled ? "var(--scene-accent)" : "rgba(10,10,14,0.82)",
          color: enabled ? "var(--scene-bg)" : "#fff",
          border: enabled
            ? "1px solid var(--scene-accent)"
            : "1px solid rgba(255,255,255,0.18)",
          backdropFilter: "blur(6px)",
        }}
      >
        {enabled ? <Captions className="h-4 w-4" /> : <CaptionsOff className="h-4 w-4" />}
        {enabled ? "Captions on" : "Captions"}
      </button>
    </>
  )
}
