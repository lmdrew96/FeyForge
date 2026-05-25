"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState, useRef, useCallback, use } from "react"
import type { Doc } from "@/convex/_generated/dataModel"
import { Play, Pause, Music } from "lucide-react"

type AudioTrack = Doc<"audioTracks">

const REACTIONS = [
  { value: "yes" as const, emoji: "✅", label: "Use it" },
  { value: "no" as const, emoji: "❌", label: "Skip" },
  { value: "maybe" as const, emoji: "🤔", label: "Maybe" },
]

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

function TrackReviewCard({
  track,
  token,
  existingComment,
}: {
  track: AudioTrack
  token: string
  existingComment: { reaction: "yes" | "no" | "maybe"; comment?: string } | undefined
}) {
  const addComment = useMutation(api.libraryShare.addReviewComment)
  const [playing, setPlaying] = useState(false)
  const [reaction, setReaction] = useState<"yes" | "no" | "maybe" | null>(existingComment?.reaction ?? null)
  const [comment, setComment] = useState(existingComment?.comment ?? "")
  const [saved, setSaved] = useState(!!existingComment)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const toggle = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(track.r2Url)
      audioRef.current.onended = () => setPlaying(false)
      setTimeout(() => { audioRef.current?.pause(); setPlaying(false) }, 10000)
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
    await addComment({ token, trackId: track._id, reaction: r, comment: comment || undefined })
    setSaved(true)
  }

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
          <div className="flex items-center gap-2 mt-0.5">
            {track.sceneTag && (
              <span className="text-[10px]" style={{ color: "#5a5272" }}>{track.sceneTag}</span>
            )}
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

      {/* Reactions */}
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

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => { setComment(e.target.value); setSaved(false) }}
        onBlur={() => { if (reaction) handleSave(reaction) }}
        placeholder="Add a note… (optional)"
        rows={2}
        className="w-full px-3 py-2 rounded-md text-xs resize-none outline-none"
        style={{
          background: "#0d0d14",
          border: "1px solid #2a2438",
          color: "#a89ec4",
        }}
      />

      {saved && (
        <p className="text-[10px]" style={{ color: "#7b68c8" }}>Saved</p>
      )}
    </div>
  )
}

export default function LibraryReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const tokenDoc = useQuery(api.libraryShare.getShareToken, { token })
  const allTracks = useQuery(api.audio.listAudioTracks, {})
  const comments = useQuery(api.libraryShare.listCommentsByToken, { token })

  if (tokenDoc === undefined || allTracks === undefined) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d14" }}>
        <p className="text-sm" style={{ color: "#5a5272" }}>Loading…</p>
      </main>
    )
  }

  if (tokenDoc === null) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d14" }}>
        <p className="text-sm" style={{ color: "#5a5272" }}>This review link doesn&apos;t exist or has expired.</p>
      </main>
    )
  }

  const tracks = allTracks.filter((t) => {
    if (tokenDoc.filterType && t.type !== tokenDoc.filterType) return false
    if (tokenDoc.filterSceneTag && t.sceneTag !== tokenDoc.filterSceneTag) return false
    return true
  })

  const commentMap = new Map(
    (comments ?? []).map((c) => [c.trackId, { reaction: c.reaction, comment: c.comment }])
  )

  return (
    <main className="min-h-screen px-6 py-12" style={{ background: "#0d0d14", color: "#f0eef8" }}>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: "#7b68c8" }}>FeyForge</p>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-cinzel)", color: "#e8e0f8" }}>
            Audio Review
          </h1>
          <p className="text-sm" style={{ color: "#5a5272" }}>
            {tracks.length} track{tracks.length !== 1 ? "s" : ""} — preview and leave reactions
          </p>
        </div>

        {tracks.length === 0 ? (
          <div className="py-16 text-center">
            <Music size={32} className="mx-auto mb-3 opacity-20" style={{ color: "#5a5272" }} />
            <p className="text-sm" style={{ color: "#5a5272" }}>No tracks in this review.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tracks.map((track) => (
              <TrackReviewCard
                key={track._id}
                track={track}
                token={token}
                existingComment={commentMap.get(track._id)}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-center pt-4" style={{ color: "#3a3350" }}>
          Powered by FeyForge
        </p>
      </div>
    </main>
  )
}
