"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState, useRef, useCallback } from "react"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { Play, Pause, Music, Filter, Plus, X } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { SCENES } from "@/lib/scenes"
import { FEYFORGE_SCENES } from "@/lib/audio/scenes"

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

const MODES = ["explore", "combat", "victory"] as const
type StemMode = typeof MODES[number]

// ── Stem slot types ────────────────────────────────────────────────────────────

type StemSlot = {
  id: string // client-only key
  sceneName: string
  mode: StemMode | ""
  name: string
  intensityMin: string
  intensityMax: string
}

type StemSlotError = {
  sceneName?: string
  mode?: string
  name?: string
  intensityMin?: string
  intensityMax?: string
}

function emptyStemSlot(): StemSlot {
  return {
    id: Math.random().toString(36).slice(2),
    sceneName: "",
    mode: "",
    name: "",
    intensityMin: "1",
    intensityMax: "5",
  }
}

function validateSlots(slots: StemSlot[]): { errors: StemSlotError[]; valid: boolean } {
  const errors: StemSlotError[] = slots.map((slot) => {
    const e: StemSlotError = {}
    if (!slot.sceneName) e.sceneName = "Required"
    if (!slot.mode) e.mode = "Required"
    if (!slot.name.trim()) e.name = "Required"
    const min = parseInt(slot.intensityMin, 10)
    const max = parseInt(slot.intensityMax, 10)
    if (isNaN(min) || min < 1 || min > 5) e.intensityMin = "1–5"
    if (isNaN(max) || max < 1 || max > 5 || max < min) e.intensityMax = `≥${isNaN(min) ? 1 : min}, ≤5`
    return e
  })
  const valid = errors.every((e) => Object.keys(e).length === 0)
  return { errors, valid }
}

// ── Stem Assignments section ───────────────────────────────────────────────────

function StemAssignmentsSection({
  slots,
  errors,
  onChange,
  onAdd,
  onRemove,
}: {
  slots: StemSlot[]
  errors: StemSlotError[]
  onChange: (id: string, field: keyof StemSlot, value: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
}) {
  const inputCls = "px-2 py-1 rounded border text-xs outline-none"
  const inputStyle = {
    borderColor: "var(--scene-border)",
    background: "var(--scene-bg)",
    color: "var(--scene-text-primary)",
  }
  const errStyle = { color: "#f87171", fontSize: "10px" }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: "var(--scene-highlight)" }}>
          Stem Assignments
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border"
          style={{ borderColor: "var(--scene-border)", color: "var(--scene-accent)" }}
        >
          <Plus size={11} /> Add slot
        </button>
      </div>

      {slots.length === 0 && (
        <p className="text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
          No slots — click "Add slot" to begin.
        </p>
      )}

      {slots.map((slot, i) => {
        const err = errors[i] ?? {}
        return (
          <div
            key={slot.id}
            className="rounded-lg p-3 space-y-2"
            style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
                Slot {i + 1}
              </span>
              {slots.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(slot.id)}
                  className="p-0.5 rounded"
                  style={{ color: "var(--scene-text-muted)" }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Row 1: scene + mode */}
            <div className="flex gap-2">
              <div className="flex-1 space-y-0.5">
                <select
                  value={slot.sceneName}
                  onChange={(e) => onChange(slot.id, "sceneName", e.currentTarget.value)}
                  className={inputCls + " w-full"}
                  style={inputStyle}
                >
                  <option value="">Scene…</option>
                  {FEYFORGE_SCENES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {err.sceneName && <p style={errStyle}>{err.sceneName}</p>}
              </div>
              <div className="flex-1 space-y-0.5">
                <select
                  value={slot.mode}
                  onChange={(e) => onChange(slot.id, "mode", e.currentTarget.value)}
                  className={inputCls + " w-full"}
                  style={inputStyle}
                >
                  <option value="">Mode…</option>
                  {MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {err.mode && <p style={errStyle}>{err.mode}</p>}
              </div>
            </div>

            {/* Row 2: stem name */}
            <div className="space-y-0.5">
              <input
                type="text"
                value={slot.name}
                onChange={(e) => onChange(slot.id, "name", e.currentTarget.value)}
                placeholder="Stem name (e.g. Strings, Pads, Full Percussion)"
                className={inputCls + " w-full"}
                style={inputStyle}
              />
              {err.name && <p style={errStyle}>{err.name}</p>}
            </div>

            {/* Row 3: intensity range */}
            <div className="flex items-center gap-2">
              <span className="text-[11px]" style={{ color: "var(--scene-text-muted)" }}>Intensity</span>
              <div className="space-y-0.5">
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={slot.intensityMin}
                  onChange={(e) => onChange(slot.id, "intensityMin", e.currentTarget.value)}
                  className={inputCls + " w-14 text-center"}
                  style={inputStyle}
                />
                {err.intensityMin && <p style={errStyle}>{err.intensityMin}</p>}
              </div>
              <span className="text-[11px]" style={{ color: "var(--scene-text-muted)" }}>–</span>
              <div className="space-y-0.5">
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={slot.intensityMax}
                  onChange={(e) => onChange(slot.id, "intensityMax", e.currentTarget.value)}
                  className={inputCls + " w-14 text-center"}
                  style={inputStyle}
                />
                {err.intensityMax && <p style={errStyle}>{err.intensityMax}</p>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Utility ────────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

// ── TrackReviewCard ────────────────────────────────────────────────────────────

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

  // Approve mutations
  const approveTrack = useMutation(api.audio.approveAudioTrack)
  const approveAndAssignStems = useMutation(api.audio.approveAndAssignStems)
  const adminUpdate = useMutation(api.audio.adminUpdateAudioTrack)

  const [isApproving, setIsApproving] = useState(false)
  const [approveError, setApproveError] = useState("")

  // Ambience / SFX fields
  const [selectedTags, setSelectedTags] = useState<string[]>(() => track.sceneTag ?? [])
  const [customTag, setCustomTag] = useState("")
  const [audioTier, setAudioTier] = useState<"free" | "premium">(() => track.tier ?? "free")

  // Music stem slots
  const [slots, setSlots] = useState<StemSlot[]>([emptyStemSlot()])
  const [slotErrors, setSlotErrors] = useState<StemSlotError[]>([{}])

  const isMusic = track.type === "music"
  const canApproveAmbience = selectedTags.length > 0

  // ── Stem slot handlers ──────────────────────────────────────────────────────

  const handleSlotChange = (id: string, field: keyof StemSlot, value: string) => {
    setSlots((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s))
    setSlotErrors((prev) => prev.map((e, i) => slots[i]?.id === id ? {} : e))
    setApproveError("")
  }

  const handleAddSlot = () => {
    setSlots((prev) => [...prev, emptyStemSlot()])
    setSlotErrors((prev) => [...prev, {}])
  }

  const handleRemoveSlot = (id: string) => {
    setSlots((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((s) => s.id !== id)
    })
    setSlotErrors((prev) => {
      const idx = slots.findIndex((s) => s.id === id)
      if (idx === -1) return prev
      return prev.filter((_, i) => i !== idx)
    })
  }

  // ── Audio playback ──────────────────────────────────────────────────────────

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

  // ── Review comment ──────────────────────────────────────────────────────────

  const handleSave = async (r: "yes" | "no" | "maybe") => {
    setReaction(r)
    await addComment({ trackId: track._id, reaction: r, comment: note || undefined })
    setSaved(true)
  }

  // ── Ambience approve ────────────────────────────────────────────────────────

  const handleApproveAmbience = async () => {
    if (!canApproveAmbience || isApproving) return
    setIsApproving(true)
    setApproveError("")
    try {
      const currentTags = [...(track.sceneTag ?? [])].sort().join(",")
      const nextTags = [...selectedTags].sort().join(",")
      if (currentTags !== nextTags) {
        await adminUpdate({ trackId: track._id, sceneTag: selectedTags })
      }
      if (track.tier !== audioTier) {
        await adminUpdate({ trackId: track._id, tier: audioTier })
      }
      await approveTrack({ trackId: track._id, approved: true })
    } catch (error) {
      console.error(error)
      setApproveError(error instanceof Error ? error.message : "Approval failed")
    } finally {
      setIsApproving(false)
    }
  }

  // ── Music approve + assign stems ────────────────────────────────────────────

  const handleApproveMusic = async () => {
    if (isApproving) return
    setApproveError("")

    const { errors, valid } = validateSlots(slots)
    setSlotErrors(errors)
    if (!valid) {
      setApproveError("Fix errors in stem slots before approving.")
      return
    }

    setIsApproving(true)
    try {
      await approveAndAssignStems({
        trackId: track._id,
        tier: audioTier,
        stems: slots.map((slot) => ({
          sceneName: slot.sceneName,
          mode: slot.mode as StemMode,
          name: slot.name.trim(),
          intensityMin: parseInt(slot.intensityMin, 10),
          intensityMax: parseInt(slot.intensityMax, 10),
        })),
      })
    } catch (error) {
      console.error(error)
      setApproveError(error instanceof Error ? error.message : "Approval failed")
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
          <p className="text-sm font-medium truncate" style={{ color: "var(--scene-text-primary)" }}>
            {track.originalFilename ?? track.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "var(--scene-border)", color: "var(--scene-accent)" }}
            >
              {track.type}
            </span>
            {track.status && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  background: track.status === "pending"
                    ? "rgba(251,191,36,0.15)"
                    : track.status === "approved"
                      ? "rgba(74,222,128,0.15)"
                      : "rgba(248,113,113,0.15)",
                  color: track.status === "pending" ? "#fbbf24"
                    : track.status === "approved" ? "#4ade80" : "#f87171",
                }}
              >
                {track.status}
              </span>
            )}
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
            {(track.sceneTag ?? []).map((tag) => (
              <span key={tag} className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>{tag}</span>
            ))}
            <span className="text-[10px] ml-auto" style={{ color: "var(--scene-text-muted)" }}>
              {formatDuration(track.duration)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && isMusic && (
            <button
              onClick={handleApproveMusic}
              disabled={isApproving}
              className="px-3 py-1 rounded bg-green-600 text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApproving ? "Saving…" : "Approve + Assign Stems"}
            </button>
          )}
          {isAdmin && !isMusic && (
            <>
              <button
                onClick={handleApproveAmbience}
                disabled={!canApproveAmbience || isApproving}
                className="px-3 py-1 rounded bg-green-600 text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving ? "Saving…" : "Approve"}
              </button>
              <button
                onClick={() => approveTrack({ trackId: track._id, approved: false }).catch(console.error)}
                className="px-3 py-1 rounded bg-gray-600 text-white text-xs"
              >
                Reject
              </button>
            </>
          )}
          <button
            onClick={toggle}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "var(--scene-accent)" }}
          >
            {playing
              ? <Pause size={13} style={{ color: "var(--scene-bg)" }} />
              : <Play size={13} style={{ color: "var(--scene-bg)" }} />}
          </button>
        </div>
      </div>

      {/* Approve error */}
      {approveError && (
        <p className="text-[11px] px-2 py-1 rounded" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}>
          {approveError}
        </p>
      )}

      {/* Ambience: intensity rank */}
      {isAdmin && track.type === "ambience" && (
        <div className="flex items-center gap-3">
          <div className="text-xs" style={{ color: "var(--scene-highlight)" }}>Intensity rank (1-3)</div>
          <input
            type="number"
            min={1}
            max={3}
            step={1}
            inputMode="numeric"
            defaultValue={track.intensityRank ?? ""}
            onBlur={(e) => {
              const raw = e.currentTarget.value.trim()
              if (raw === "") {
                adminUpdate({ trackId: track._id, intensityRank: undefined }).catch(console.error)
                return
              }
              const parsed = Number(raw)
              if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3) {
                e.currentTarget.value = track.intensityRank?.toString() ?? ""
                return
              }
              adminUpdate({ trackId: track._id, intensityRank: parsed }).catch(console.error)
            }}
            className="w-20 px-2 py-1 rounded border"
            style={{ borderColor: "var(--scene-border)", background: "var(--scene-bg)", color: "var(--scene-text-primary)" }}
          />
        </div>
      )}

      {/* Ambience / SFX: scene tags */}
      {isAdmin && !isMusic && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: "var(--scene-highlight)" }}>
            Scene tags (select one or more — required for approval)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sceneTagOptions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setSelectedTags((prev) =>
                    prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                  )
                }
                className="px-2 py-0.5 rounded text-[11px] border transition-colors"
                style={{
                  background: selectedTags.includes(tag) ? "var(--scene-accent)" : "var(--scene-bg)",
                  borderColor: selectedTags.includes(tag) ? "var(--scene-accent)" : "var(--scene-border)",
                  color: selectedTags.includes(tag) ? "var(--scene-bg)" : "var(--scene-text-muted)",
                }}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              value={customTag}
              onChange={(e) => setCustomTag(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  const t = customTag.trim().toLowerCase()
                  if (t && !selectedTags.includes(t)) setSelectedTags((prev) => [...prev, t])
                  setCustomTag("")
                }
              }}
              placeholder="Add custom tag…"
              className="flex-1 px-2 py-1 rounded border text-xs"
              style={{ borderColor: "var(--scene-border)", background: "var(--scene-bg)", color: "var(--scene-text-primary)" }}
            />
            <button
              type="button"
              onClick={() => {
                const t = customTag.trim().toLowerCase()
                if (t && !selectedTags.includes(t)) setSelectedTags((prev) => [...prev, t])
                setCustomTag("")
              }}
              className="px-2 py-1 rounded border text-xs"
              style={{ borderColor: "var(--scene-border)", color: "var(--scene-text-muted)" }}
            >
              Add
            </button>
          </div>
          {selectedTags.length > 0 && (
            <p className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>
              Selected: {selectedTags.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Music: stem assignments */}
      {isAdmin && isMusic && (
        <StemAssignmentsSection
          slots={slots}
          errors={slotErrors}
          onChange={handleSlotChange}
          onAdd={handleAddSlot}
          onRemove={handleRemoveSlot}
        />
      )}

      {/* Curation tier (all types) */}
      {isAdmin && (
        <div className="flex items-center gap-3">
          <div className="text-xs" style={{ color: "var(--scene-highlight)" }}>Curation tier</div>
          <select
            value={audioTier}
            onChange={(e) => {
              const next = e.currentTarget.value as "free" | "premium"
              setAudioTier(next)
              adminUpdate({ trackId: track._id, tier: next }).catch(console.error)
            }}
            className="w-28 px-2 py-1 rounded border text-xs"
            style={{ borderColor: "var(--scene-border)", background: "var(--scene-bg)", color: "var(--scene-text-primary)" }}
          >
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminReviewPage() {
  const allTracks = useQuery(api.audio.listAudioTracks, { includeUnapproved: true })
  const allComments = useQuery(api.libraryShare.listAllReviewComments, {})
  const me = useQuery(api.users.getMe)
  const [typeFilter, setTypeFilter] = useState<"all" | "ambience" | "music" | "sfx">("all")
  const [showApproved, setShowApproved] = useState(false)

  if (allTracks === undefined || allComments === undefined) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--scene-bg)" }}>
          <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>Loading…</p>
        </div>
      </AppShell>
    )
  }

  // Default: show only pending (unapproved) tracks; toggle to see all
  const pendingTracks = allTracks.filter((t) => !t.approved && t.status !== "rejected")
  const visibleTracks = (showApproved ? allTracks : pendingTracks)
    .filter((t) => typeFilter === "all" || t.type === typeFilter)

  const commentsByTrack = new Map<string, ReviewComment[]>()
  for (const c of allComments as ReviewComment[]) {
    const list = commentsByTrack.get(c.trackId) ?? []
    list.push(c)
    commentsByTrack.set(c.trackId, list)
  }

  const myUserId = me?.clerkId
  const knownSceneTags = Array.from(new Set([
    ...SCENES.map((scene) => scene.id).filter((id) => id.length > 0),
    ...allTracks.flatMap((track) => track.sceneTag ?? []).filter((tag) => tag.trim().length > 0),
  ])).sort((a, b) => a.localeCompare(b))

  return (
    <AppShell>
      <div className="px-6 py-8 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] mb-1" style={{ color: "var(--scene-accent)" }}>Admin</p>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            Audio Review
          </h1>
          <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
            {pendingTracks.length} pending · {allTracks.length} total
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
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
          <button
            onClick={() => setShowApproved((v) => !v)}
            className="ml-auto px-3 py-1.5 rounded-md text-xs transition-all"
            style={{
              background: showApproved ? "var(--scene-surface)" : "transparent",
              color: "var(--scene-text-muted)",
              border: `1px solid var(--scene-border)`,
            }}
          >
            {showApproved ? "Hide approved" : "Show approved"}
          </button>
          <div className="flex items-center gap-1" style={{ color: "#5a5272" }}>
            <Filter size={12} />
          </div>
        </div>

        {/* Tracks */}
        {visibleTracks.length === 0 ? (
          <div className="py-16 text-center">
            <Music size={32} className="mx-auto mb-3 opacity-20" style={{ color: "var(--scene-text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
              {showApproved
                ? "No tracks found."
                : "No pending tracks. Run the upload script to add more, or toggle 'Show approved'."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleTracks.map((track) => {
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
