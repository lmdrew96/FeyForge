"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState, useRef, useCallback } from "react"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { Play, Pause, Music, Filter } from "lucide-react"
import { AppShell } from "@/components/app-shell"

type AudioTrack = Doc<"audioTracks">
type ReviewComment = {
  _id: Id<"libraryReviewComments">
  userId: string
  reviewerName?: string
  trackId: Id<"audioTracks">
  reaction: "yes" | "no" | "maybe"
  comment?: string
  createdAt: number
}

const REACTIONS = [
  { value: "yes" as const, emoji: "✅", label: "Yes" },
  { value: "no" as const, emoji: "❌", label: "No" },
  { value: "maybe" as const, emoji: "🤔", label: "Maybe" },
]

const REACTION_COLOR = {
  yes: "#4ade80",
  no: "#f87171",
  maybe: "#fbbf24",
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

function TrackReviewCard({
  track,
  myComment,
  allComments,
}: {
  track: AudioTrack
  myComment: ReviewComment | undefined
  allComments: ReviewComment[]
}) {
  const addComment = useMutation(api.libraryShare.addReviewComment)
  const [playing, setPlaying] = useState(false)
  const [reaction, setReaction] = useState<"yes" | "no" | "maybe" | null>(myComment?.reaction ?? null)
  const [note, setNote] = useState(myComment?.comment ?? "")
  const [saved, setSaved] = useState(!!myComment)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const toggle = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(track.r2Url)
      audioRef.current.onended = () => setPlaying(false)
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }, [playing, track.r2Url])

  const handleSave = async (r: "yes" | "no" | "maybe") => {
    setReaction(r)
    await addComment({ trackId: track._id, reaction: r, comment: note || undefined })
    setSaved(true)
  }

  const otherComments = allComments.filter((c) => c.userId !== myComment?.userId)

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: "#16131f",
        border: `1px solid ${saved ? "#3a2e5a" : "#2a2438"}`,
        boxShadow: saved ? "0 0 12px rgba(123, 104, 200, 0.12)" : "none",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "#e8e0f8" }}>{track.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "#1e1a2e", color: "#7b68c8" }}
            >
              {track.type}
            </span>
            {track.intensityTier && (
              <span
                className="text-[10px] px-1 py-0.5 rounded border"
                style={{
                  borderColor: track.intensityTier === "explore" ? "#2d5a3d" : "#5a2d2d",
                  color: track.intensityTier === "explore" ? "#4ade80" : "#f87171",
                }}
              >
                {track.intensityTier}
              </span>
            )}
            {track.sceneTag && (
              <span className="text-[10px]" style={{ color: "#5a5272" }}>{track.sceneTag}</span>
            )}
            <span className="text-[10px] ml-auto" style={{ color: "#5a5272" }}>{formatDuration(track.duration)}</span>
          </div>
        </div>
        <button
          onClick={toggle}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "#7b68c8" }}
        >
          {playing ? <Pause size={13} style={{ color: "#0d0d14" }} /> : <Play size={13} style={{ color: "#0d0d14" }} />}
        </button>
      </div>

      {/* Other reviewers' reactions */}
      {otherComments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {otherComments.map((c) => (
            <div
              key={c._id}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]"
              style={{ background: "#0d0d14", border: "1px solid #2a2438" }}
            >
              <span style={{ color: REACTION_COLOR[c.reaction] }}>
                {REACTIONS.find((r) => r.value === c.reaction)?.emoji}
              </span>
              <span style={{ color: "#a89ec4" }}>{c.reviewerName ?? "Reviewer"}</span>
              {c.comment && (
                <span style={{ color: "#5a5272" }}>— {c.comment}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* My reaction */}
      <div>
        <p className="text-[10px] mb-1.5" style={{ color: "#5a5272" }}>Your reaction</p>
        <div className="flex gap-2">
          {REACTIONS.map(({ value, emoji, label }) => (
            <button
              key={value}
              onClick={() => handleSave(value)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs transition-all"
              style={{
                background: reaction === value ? "#7b68c820" : "#0d0d14",
                border: `1px solid ${reaction === value ? "#7b68c8" : "#2a2438"}`,
                color: reaction === value ? "#e8e0f8" : "#5a5272",
              }}
            >
              <span>{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <textarea
        value={note}
        onChange={(e) => { setNote(e.target.value); setSaved(false) }}
        onBlur={() => { if (reaction) handleSave(reaction) }}
        placeholder="Add a note… (optional)"
        rows={2}
        className="w-full px-3 py-2 rounded-md text-xs resize-none outline-none"
        style={{ background: "#0d0d14", border: "1px solid #2a2438", color: "#a89ec4" }}
      />

      {saved && <p className="text-[10px]" style={{ color: "#7b68c8" }}>Saved</p>}
    </div>
  )
}

export default function AdminReviewPage() {
  const allTracks = useQuery(api.audio.listAudioTracks, {})
  const allComments = useQuery(api.libraryShare.listAllReviewComments, {})
  const me = useQuery(api.users.getMe)
  const [typeFilter, setTypeFilter] = useState<"all" | "ambience" | "music" | "sfx">("all")

  if (allTracks === undefined || allComments === undefined) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d14" }}>
          <p className="text-sm" style={{ color: "#5a5272" }}>Loading…</p>
        </div>
      </AppShell>
    )
  }

  const filteredTracks = typeFilter === "all"
    ? allTracks
    : allTracks.filter((t) => t.type === typeFilter)

  const commentsByTrack = new Map<string, ReviewComment[]>()
  for (const c of allComments as ReviewComment[]) {
    const list = commentsByTrack.get(c.trackId) ?? []
    list.push(c)
    commentsByTrack.set(c.trackId, list)
  }

  const myUserId = me?.clerkId

  return (
    <AppShell>
      <div className="px-6 py-8 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] mb-1" style={{ color: "#7b68c8" }}>Admin</p>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-cinzel)", color: "#e8e0f8" }}>
            Audio Review
          </h1>
          <p className="text-sm" style={{ color: "#5a5272" }}>
            {filteredTracks.length} track{filteredTracks.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          {(["all", "ambience", "music", "sfx"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className="px-3 py-1.5 rounded-md text-xs capitalize transition-all"
              style={{
                background: typeFilter === f ? "#7b68c8" : "#16131f",
                color: typeFilter === f ? "#0d0d14" : "#5a5272",
                border: `1px solid ${typeFilter === f ? "#7b68c8" : "#2a2438"}`,
              }}
            >
              {f}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1" style={{ color: "#5a5272" }}>
            <Filter size={12} />
          </div>
        </div>

        {/* Tracks */}
        {filteredTracks.length === 0 ? (
          <div className="py-16 text-center">
            <Music size={32} className="mx-auto mb-3 opacity-20" style={{ color: "#5a5272" }} />
            <p className="text-sm" style={{ color: "#5a5272" }}>No tracks yet. Run the seed script to populate.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTracks.map((track) => {
              const trackComments = commentsByTrack.get(track._id) ?? []
              const myComment = myUserId
                ? trackComments.find((c) => c.userId === myUserId)
                : undefined
              return (
                <TrackReviewCard
                  key={track._id}
                  track={track}
                  myComment={myComment}
                  allComments={trackComments}
                />
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
