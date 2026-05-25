"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState, useRef, useCallback } from "react"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { Play, Pause, Music, Filter } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { SCENES } from "@/lib/scenes"

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
  isAdmin,
  sceneTagOptions,
}: {
  track: AudioTrack
  myComment: ReviewComment | undefined
  allComments: ReviewComment[]
  isAdmin: boolean
  sceneTagOptions: string[]
}) {
  const addComment = useMutation(api.libraryShare.addReviewComment)
  const [playing, setPlaying] = useState(false)
  const [reaction, setReaction] = useState<"yes" | "no" | "maybe" | null>(myComment?.reaction ?? null)
  const [note, setNote] = useState(myComment?.comment ?? "")
  const [saved, setSaved] = useState(!!myComment)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const approve = useMutation(api.audio.approveAudioTrack)
  const adminUpdate = useMutation(api.audio.adminUpdateAudioTrack)
  const [isApproving, setIsApproving] = useState(false)
  const [sceneTagMode, setSceneTagMode] = useState<string>(() => {
    if (!track.sceneTag) return ""
    return sceneTagOptions.includes(track.sceneTag) ? track.sceneTag : "__custom__"
  })
  const [customSceneTag, setCustomSceneTag] = useState<string>(() => {
    if (!track.sceneTag || sceneTagOptions.includes(track.sceneTag)) return ""
    return track.sceneTag
  })

  const normalizedSceneTag = (sceneTagMode === "__custom__" ? customSceneTag : sceneTagMode).trim().toLowerCase()
  const canApprove = normalizedSceneTag.length > 0

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

  const handleApprove = async () => {
    if (!canApprove || isApproving) return
    setIsApproving(true)
    try {
      if (track.sceneTag !== normalizedSceneTag) {
        await adminUpdate({ trackId: track._id, sceneTag: normalizedSceneTag })
      }
      await approve({ trackId: track._id, approved: true })
    } catch (error) {
      console.error(error)
    } finally {
      setIsApproving(false)
    }
  }

  const otherComments = allComments.filter((c) => c.userId !== myComment?.userId)

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: "var(--scene-surface)",
        border: `1px solid ${saved ? "var(--scene-accent)" : "var(--scene-border)"}`,
        boxShadow: saved ? "0 0 12px var(--scene-accent-glow)" : "none",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--scene-text-primary)" }}>{track.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "var(--scene-border)", color: "var(--scene-accent)" }}
            >
              {track.type}
            </span>
            {track.intensityTier && (
                <span
                  className="text-[10px] px-1 py-0.5 rounded border"
                  style={{
                    borderColor: track.intensityTier === "explore" ? "var(--scene-accent)" : "var(--color-destructive)",
                    color: track.intensityTier === "explore" ? "var(--scene-accent)" : "var(--color-destructive)",
                  }}
                >
                {track.intensityTier}
              </span>
            )}
            {track.sceneTag && (
              <span className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>{track.sceneTag}</span>
            )}
            <span className="text-[10px] ml-auto" style={{ color: "var(--scene-text-muted)" }}>{formatDuration(track.duration)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button onClick={handleApprove} disabled={!canApprove || isApproving} className="px-3 py-1 rounded bg-green-600 text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed">{isApproving ? "Saving…" : "Approve"}</button>
               <button onClick={() => approve({ trackId: track._id, approved: false }).catch(console.error)} className="px-3 py-1 rounded bg-gray-600 text-white text-xs">Reject</button>
            </>
          )}
          <button
            onClick={toggle}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "var(--scene-accent)" }}
          >
            {playing ? <Pause size={13} style={{ color: "var(--scene-bg)" }} /> : <Play size={13} style={{ color: "var(--scene-bg)" }} />}
          </button>
        </div>
      </div>

      {isAdmin && track.type !== "sfx" && (
          <div className="flex items-center gap-3">
          <div className="text-xs" style={{ color: "var(--scene-highlight)" }}>Intensity rank</div>
          <input defaultValue={track.intensityRank ?? ""} onBlur={(e) => {
            const v = e.currentTarget.value === "" ? undefined : Number(e.currentTarget.value)
            adminUpdate({ trackId: track._id, intensityRank: v }).catch(console.error)
          }} className="w-20 px-2 py-1 rounded border" style={{ borderColor: "var(--scene-border)", background: "var(--scene-bg)", color: "var(--scene-text-primary)" }} />
        </div>
      )}

      {isAdmin && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: "var(--scene-highlight)" }}>Scene tag (required for approval)</p>
          <select
            value={sceneTagMode}
            onChange={(e) => setSceneTagMode(e.currentTarget.value)}
            className="w-full px-2 py-1 rounded border text-xs"
            style={{ borderColor: "var(--scene-border)", background: "var(--scene-bg)", color: "var(--scene-text-primary)" }}
          >
            <option value="">Select a scene tag</option>
            {sceneTagOptions.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
            <option value="__custom__">Custom…</option>
          </select>
          {sceneTagMode === "__custom__" && (
            <input
              value={customSceneTag}
              onChange={(e) => setCustomSceneTag(e.currentTarget.value)}
              placeholder="Enter custom scene tag"
              className="w-full px-2 py-1 rounded border text-xs"
              style={{ borderColor: "var(--scene-border)", background: "var(--scene-bg)", color: "var(--scene-text-primary)" }}
            />
          )}
        </div>
      )}

      {/* Other reviewers' reactions */}
      {otherComments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {otherComments.map((c) => (
            <div
              key={c._id}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]"
              style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
            >
              <span style={{ color: REACTION_COLOR[c.reaction] }}>
                {REACTIONS.find((r) => r.value === c.reaction)?.emoji}
              </span>
              <span style={{ color: "var(--scene-highlight)" }}>{c.reviewerName ?? "Reviewer"}</span>
              {c.comment && (
                <span style={{ color: "var(--scene-text-muted)" }}>— {c.comment}</span>
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
                background: reaction === value ? "var(--scene-accent)" : "var(--scene-bg)",
                border: `1px solid ${reaction === value ? "var(--scene-accent)" : "var(--scene-border)"}`,
                color: reaction === value ? "var(--scene-bg)" : "var(--scene-text-muted)",
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
        style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)", color: "var(--scene-text-muted)" }}
      />

      {saved && <p className="text-[10px]" style={{ color: "var(--scene-accent)" }}>Saved</p>}
    </div>
  )
}

export default function AdminReviewPage() {
  const allTracks = useQuery(api.audio.listAudioTracks, { includeUnapproved: true })
  const allComments = useQuery(api.libraryShare.listAllReviewComments, {})
  const me = useQuery(api.users.getMe)
  const [typeFilter, setTypeFilter] = useState<"all" | "ambience" | "music" | "sfx">("all")

  if (allTracks === undefined || allComments === undefined) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--scene-bg)" }}>
          <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>Loading…</p>
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
  const knownSceneTags = Array.from(new Set([
    ...SCENES.map((scene) => scene.id).filter((id) => id.length > 0),
    ...allTracks.map((track) => track.sceneTag).filter((tag): tag is string => Boolean(tag && tag.trim().length > 0)),
  ])).sort((a, b) => a.localeCompare(b))

  return (
    <AppShell>
      <div className="px-6 py-8 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] mb-1" style={{ color: "var(--scene-accent)" }}>Admin</p>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
            Audio Review
          </h1>
          <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
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
                  background: typeFilter === f ? "var(--scene-accent)" : "var(--scene-surface)",
                  color: typeFilter === f ? "var(--scene-bg)" : "var(--scene-text-muted)",
                  border: `1px solid ${typeFilter === f ? "var(--scene-accent)" : "var(--scene-border)"}`,
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
              <Music size={32} className="mx-auto mb-3 opacity-20" style={{ color: "var(--scene-text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>No tracks yet. Run the seed script to populate.</p>
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
                  isAdmin={me?.role === "admin"}
                  sceneTagOptions={knownSceneTags}
                />
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
