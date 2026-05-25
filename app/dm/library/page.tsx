"use client"

import { AppShell } from "@/components/app-shell"
import { useState, useRef, useEffect, useCallback } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id, Doc } from "@/convex/_generated/dataModel"
import { Play, Pause, Upload, Pencil, Trash2, X, Music, Waves, Zap, Star } from "lucide-react"

type AudioTrack = Doc<"audioTracks">
type TrackType = "ambience" | "music" | "sfx"
type IntensityTier = "explore" | "combat"

const TYPE_LABELS: Record<TrackType, string> = { ambience: "Ambience", music: "Music", sfx: "SFX" }
const TYPE_ICONS = { ambience: Waves, music: Music, sfx: Zap }
const TIER_LABELS: Record<IntensityTier, string> = { explore: "Explore", combat: "Combat" }

const SCENE_TAGS = [
  "dungeon", "tavern", "forest", "city", "cave", "ocean", "temple", "plains", "mountain", "underdark",
]

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

function TypeBadge({ type }: { type: TrackType }) {
  const colors: Record<TrackType, string> = {
    ambience: "bg-sky-900/50 text-sky-300 border-sky-700/50",
    music: "bg-purple-900/50 text-purple-300 border-purple-700/50",
    sfx: "bg-amber-900/50 text-amber-300 border-amber-700/50",
  }
  const Icon = TYPE_ICONS[type]
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors[type]}`}>
      <Icon size={10} />
      {TYPE_LABELS[type]}
    </span>
  )
}

function TierBadge({ tier }: { tier: IntensityTier }) {
  const colors = {
    explore: "bg-green-900/50 text-green-300 border-green-700/50",
    combat: "bg-red-900/50 text-red-300 border-red-700/50",
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors[tier]}`}>
      {TIER_LABELS[tier]}
    </span>
  )
}

function AudioPreview({ url, locked }: { url: string; locked?: boolean }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => { audioRef.current?.pause() }
  }, [])

  const toggle = useCallback(() => {
    if (locked) return
    if (!audioRef.current) {
      audioRef.current = new Audio(url)
      audioRef.current.onended = () => setPlaying(false)
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }, [locked, playing, url])

  return (
    <button
      onClick={toggle}
      disabled={locked}
      className="p-1.5 rounded transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
      title={locked ? "Upgrade to Pro to play premium tracks" : playing ? "Pause" : "Preview"}
    >
      {playing ? <Pause size={12} /> : <Play size={12} />}
    </button>
  )
}

type SceneTagPickerProps = {
  selected: string[]
  onChange: (tags: string[]) => void
}

function SceneTagPicker({ selected, onChange }: SceneTagPickerProps) {
  const toggle = (tag: string) => {
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag])
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {SCENE_TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => toggle(tag)}
          className="px-2 py-0.5 rounded text-[11px] border transition-colors"
          style={{
            background: selected.includes(tag) ? "var(--scene-accent)" : "var(--scene-bg)",
            borderColor: selected.includes(tag) ? "var(--scene-accent)" : "var(--scene-border)",
            color: selected.includes(tag) ? "var(--scene-bg)" : "var(--scene-text-muted)",
          }}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}

type EditState = {
  trackId: Id<"audioTracks">
  name: string
  type: TrackType
  intensityTier: IntensityTier | null
  sceneTags: string[]
  sourceUrl: string
}

function EditModal({ track, onClose }: { track: AudioTrack; onClose: () => void }) {
  const updateTrack = useMutation(api.audio.updateAudioTrack)
  const [state, setState] = useState<EditState>({
    trackId: track._id,
    name: track.name,
    type: track.type as TrackType,
    intensityTier: track.intensityTier as IntensityTier | null,
    sceneTags: track.sceneTag ?? [],
    sourceUrl: track.sourceUrl ?? "",
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateTrack({
        trackId: track._id,
        name: state.name,
        type: state.type,
        intensityTier: state.type === "music" ? state.intensityTier : null,
        sceneTag: state.sceneTags.length > 0 ? state.sceneTags : undefined,
        sourceUrl: state.sourceUrl || undefined,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-xl p-6 space-y-4"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>
            Edit Track
          </h3>
          <button onClick={onClose} style={{ color: "var(--scene-text-muted)" }}><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs mb-1 block" style={{ color: "var(--scene-text-muted)" }}>Name</span>
            <input
              value={state.name}
              onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-md text-sm"
              style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
            />
          </label>

          <label className="block">
            <span className="text-xs mb-1 block" style={{ color: "var(--scene-text-muted)" }}>Type</span>
            <select
              value={state.type}
              onChange={(e) => setState((s) => ({ ...s, type: e.target.value as TrackType, intensityTier: null }))}
              className="w-full px-3 py-2 rounded-md text-sm"
              style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
            >
              <option value="ambience">Ambience</option>
              <option value="music">Music</option>
              <option value="sfx">SFX</option>
            </select>
          </label>

          {state.type === "music" && (
            <label className="block">
              <span className="text-xs mb-1 block" style={{ color: "var(--scene-text-muted)" }}>Intensity Tier</span>
              <select
                value={state.intensityTier ?? ""}
                onChange={(e) => setState((s) => ({ ...s, intensityTier: (e.target.value || null) as IntensityTier | null }))}
                className="w-full px-3 py-2 rounded-md text-sm"
                style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
              >
                <option value="">None</option>
                <option value="explore">Explore</option>
                <option value="combat">Combat</option>
              </select>
            </label>
          )}

          <div>
            <span className="text-xs mb-2 block" style={{ color: "var(--scene-text-muted)" }}>Scene Tags</span>
            <SceneTagPicker
              selected={state.sceneTags}
              onChange={(tags) => setState((s) => ({ ...s, sceneTags: tags }))}
            />
          </div>

          <label className="block">
            <span className="text-xs mb-1 block" style={{ color: "var(--scene-text-muted)" }}>Source URL</span>
            <input
              value={state.sourceUrl}
              onChange={(e) => setState((s) => ({ ...s, sourceUrl: e.target.value }))}
              className="w-full px-3 py-2 rounded-md text-sm"
              style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
            />
          </label>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving || !state.name}
            className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm transition-opacity hover:opacity-80"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-muted)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

type UploadState = {
  name: string
  type: TrackType
  intensityTier: IntensityTier | null
  sceneTags: string[]
}

function DirectUploadModal({ onClose }: { onClose: () => void }) {
  const createTrack = useMutation(api.audio.createAudioTrack)
  const [state, setState] = useState<UploadState>({
    name: "", type: "ambience", intensityTier: null, sceneTags: [],
  })
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (!state.name) {
      setState((s) => ({ ...s, name: f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") }))
    }
  }

  const handleUpload = async () => {
    if (!file || !state.name) return
    setUploading(true)
    setError("")
    try {
      const presignRes = await fetch("/api/audio/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || "audio/mpeg", trackType: state.type }),
      })
      const presign = await presignRes.json()
      if (!presignRes.ok) throw new Error(presign.error)

      await fetch(presign.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "audio/mpeg" },
      })

      const audio = new Audio()
      const duration = await new Promise<number>((resolve) => {
        audio.onloadedmetadata = () => resolve(Math.round(audio.duration))
        audio.onerror = () => resolve(0)
        audio.src = URL.createObjectURL(file)
      })

      await createTrack({
        name: state.name,
        type: state.type,
        intensityTier: state.type === "music" ? state.intensityTier : null,
        sceneTag: state.sceneTags.length > 0 ? state.sceneTags : undefined,
        r2Key: presign.r2Key,
        r2Url: presign.r2Url,
        duration,
        sourceUrl: undefined,
      })
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-xl p-6 space-y-4"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>
            Upload Audio File
          </h3>
          <button onClick={onClose} style={{ color: "var(--scene-text-muted)" }}><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <span className="text-xs mb-1 block" style={{ color: "var(--scene-text-muted)" }}>File (MP3 / WAV / OGG)</span>
            <div
              className="w-full rounded-md border border-dashed p-6 text-center cursor-pointer transition-opacity hover:opacity-80"
              style={{ borderColor: "var(--scene-border)" }}
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? (
                <p className="text-sm" style={{ color: "var(--scene-text-primary)" }}>{file.name}</p>
              ) : (
                <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>Click to choose a file</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.ogg,audio/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <label className="block">
            <span className="text-xs mb-1 block" style={{ color: "var(--scene-text-muted)" }}>Track Name</span>
            <input
              value={state.name}
              onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-md text-sm"
              style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs mb-1 block" style={{ color: "var(--scene-text-muted)" }}>Type</span>
              <select
                value={state.type}
                onChange={(e) => setState((s) => ({ ...s, type: e.target.value as TrackType, intensityTier: null }))}
                className="w-full px-3 py-2 rounded-md text-sm"
                style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
              >
                <option value="ambience">Ambience</option>
                <option value="music">Music</option>
                <option value="sfx">SFX</option>
              </select>
            </label>

            {state.type === "music" && (
              <label className="block">
                <span className="text-xs mb-1 block" style={{ color: "var(--scene-text-muted)" }}>Intensity Tier</span>
                <select
                  value={state.intensityTier ?? ""}
                  onChange={(e) => setState((s) => ({ ...s, intensityTier: (e.target.value || null) as IntensityTier | null }))}
                  className="w-full px-3 py-2 rounded-md text-sm"
                  style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
                >
                  <option value="">None</option>
                  <option value="explore">Explore</option>
                  <option value="combat">Combat</option>
                </select>
              </label>
            )}
          </div>

          <div>
            <span className="text-xs mb-2 block" style={{ color: "var(--scene-text-muted)" }}>Scene Tags</span>
            <SceneTagPicker
              selected={state.sceneTags}
              onChange={(tags) => setState((s) => ({ ...s, sceneTags: tags }))}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleUpload}
            disabled={!file || !state.name || uploading}
            className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
          >
            {uploading ? "Uploading…" : "Upload & Save"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm transition-opacity hover:opacity-80"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-muted)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirm({ track, onConfirm, onCancel }: { track: AudioTrack; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-xl p-6 space-y-4"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>Delete Track?</h3>
        <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
          "{track.name}" will be permanently deleted from your library and R2 storage.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-md text-sm transition-opacity hover:opacity-80"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-muted)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

type TierFilter = "all" | "free" | "premium" | "mine"

function TrackCard({
  track,
  isPremium,
  onEdit,
  onDelete,
  reviewReactions,
  isOwner,
}: {
  track: AudioTrack
  isPremium: boolean
  onEdit?: () => void
  onDelete?: () => void
  reviewReactions?: { reaction: string; comment?: string }[]
  isOwner?: boolean
}) {
  const isLocked = track.tier === "premium" && !isPremium
  return (
    <div
      className="rounded-lg p-3 space-y-2"
      style={{
        background: "var(--scene-surface)",
        border: "1px solid var(--scene-border)",
        opacity: isLocked ? 0.65 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {track.tier === "premium" && (
              <Star size={10} className="shrink-0 text-amber-400 fill-amber-400" />
            )}
            <p className="text-sm font-medium leading-tight truncate" style={{ color: "var(--scene-text-primary)" }}>
              {track.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <AudioPreview url={track.r2Url} locked={isLocked} />
          {isOwner && onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 rounded transition-opacity hover:opacity-80"
              style={{ color: "var(--scene-text-muted)" }}
            >
              <Pencil size={12} />
            </button>
          )}
          {isOwner && onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded transition-opacity hover:opacity-80 text-red-400"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <TypeBadge type={track.type as TrackType} />
        {track.intensityTier && <TierBadge tier={track.intensityTier as IntensityTier} />}
        {(track.sceneTag ?? []).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border"
            style={{ borderColor: "var(--scene-border)", color: "var(--scene-text-muted)" }}
          >
            {tag}
          </span>
        ))}
        <span className="ml-auto text-[10px]" style={{ color: "var(--scene-text-muted)" }}>
          {formatDuration(track.duration)}
        </span>
      </div>

      {isLocked && (
        <p className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>
          ⭐ Premium — upgrade on Ko-fi to unlock
        </p>
      )}

      {reviewReactions && reviewReactions.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {reviewReactions.map((r, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "var(--scene-bg)", color: "var(--scene-text-muted)" }}
              title={r.comment}
            >
              {r.reaction === "yes" ? "✅" : r.reaction === "no" ? "❌" : "🤔"}
              {r.comment && " · " + r.comment.slice(0, 30)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AudioLibraryPage() {
  const tracks = useQuery(api.audio.listAudioTracks, {})
  const myTracks = useQuery(api.audio.listMyTracks, {})
  const me = useQuery(api.users.getMe, {})
  const reviewComments = useQuery(api.libraryShare.listMyReviewComments, {})
  const deleteTrack = useMutation(api.audio.deleteAudioTrack)

  const [filterType, setFilterType] = useState<TrackType | "all">("all")
  const [filterIntensityTier, setFilterIntensityTier] = useState<IntensityTier | "all">("all")
  const [filterTag, setFilterTag] = useState<string>("all")
  const [filterTier, setFilterTier] = useState<TierFilter>("all")

  const [editTrack, setEditTrack] = useState<AudioTrack | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AudioTrack | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  const isPremium = me?.isPremium ?? false

  const reviewsByTrack = (reviewComments ?? []).reduce<Record<string, { reaction: string; comment?: string }[]>>(
    (acc, c) => {
      acc[c.trackId] = acc[c.trackId] ?? []
      acc[c.trackId].push({ reaction: c.reaction, comment: c.comment })
      return acc
    },
    {}
  )

  const myTokenId = me?.clerkId

  const filtered = (tracks ?? []).filter((t) => {
    if (filterType !== "all" && t.type !== filterType) return false
    if (filterIntensityTier !== "all" && t.intensityTier !== filterIntensityTier) return false
    if (filterTag !== "all" && !(t.sceneTag ?? []).includes(filterTag)) return false
    if (filterTier === "free" && t.tier !== "free") return false
    if (filterTier === "premium" && t.tier !== "premium") return false
    return true
  })

  const handleDelete = async (track: AudioTrack) => {
    const r2Key = await deleteTrack({ trackId: track._id })
    if (r2Key) {
      await fetch("/api/audio/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ r2Key }),
      })
    }
    setDeleteTarget(null)
  }

  const allTags = Array.from(new Set((tracks ?? []).flatMap((t) => t.sceneTag ?? [])))

  const showingMine = filterTier === "mine"

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--scene-text-primary)" }}>Audio Library</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
              {tracks?.length ?? 0} tracks
            </p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
          >
            <Upload size={14} /> Upload
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Type filter */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--scene-surface)" }}>
            {(["all", "ambience", "music", "sfx"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  background: filterType === t ? "var(--scene-accent)" : "transparent",
                  color: filterType === t ? "var(--scene-bg)" : "var(--scene-text-muted)",
                }}
              >
                {t === "all" ? "All" : TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Intensity tier filter (music only) */}
          {filterType === "music" && (
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--scene-surface)" }}>
              {(["all", "explore", "combat"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterIntensityTier(t)}
                  className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: filterIntensityTier === t ? "var(--scene-accent)" : "transparent",
                    color: filterIntensityTier === t ? "var(--scene-bg)" : "var(--scene-text-muted)",
                  }}
                >
                  {t === "all" ? "All Tiers" : TIER_LABELS[t]}
                </button>
              ))}
            </div>
          )}

          {/* Curation tier filter */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--scene-surface)" }}>
            {([
              { value: "all", label: "All" },
              { value: "free", label: "Free" },
              { value: "premium", label: "⭐ Premium" },
              { value: "mine", label: "My Uploads" },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterTier(value)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  background: filterTier === value ? "var(--scene-accent)" : "transparent",
                  color: filterTier === value ? "var(--scene-bg)" : "var(--scene-text-muted)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Scene tag filter */}
          {allTags.length > 0 && filterTier !== "mine" && (
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="px-3 py-1 rounded-md text-xs"
              style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-muted)" }}
            >
              <option value="all">All Tags</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>

        {/* My Uploads section */}
        {showingMine ? (
          !myTracks ? (
            <p className="text-sm py-12 text-center" style={{ color: "var(--scene-text-muted)" }}>Loading…</p>
          ) : myTracks.length === 0 ? (
            <div className="py-16 text-center">
              <Music size={32} className="mx-auto mb-3 opacity-30" style={{ color: "var(--scene-text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
                No personal uploads yet. Click Upload to add your own tracks.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myTracks.map((track) => (
                <TrackCard
                  key={track._id}
                  track={track}
                  isPremium={isPremium}
                  isOwner
                  onEdit={() => setEditTrack(track)}
                  onDelete={() => setDeleteTarget(track)}
                  reviewReactions={reviewsByTrack[track._id]}
                />
              ))}
            </div>
          )
        ) : (
          /* Shared library */
          !tracks ? (
            <p className="text-sm py-12 text-center" style={{ color: "var(--scene-text-muted)" }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Music size={32} className="mx-auto mb-3 opacity-30" style={{ color: "var(--scene-text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
                {tracks.length === 0 ? "No tracks in the library yet." : "No tracks match these filters."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((track) => (
                <TrackCard
                  key={track._id}
                  track={track}
                  isPremium={isPremium}
                  isOwner={track.uploadedBy === myTokenId}
                  onEdit={() => setEditTrack(track)}
                  onDelete={() => setDeleteTarget(track)}
                  reviewReactions={reviewsByTrack[track._id]}
                />
              ))}
            </div>
          )
        )}
      </div>

      {showUpload && <DirectUploadModal onClose={() => setShowUpload(false)} />}
      {editTrack && <EditModal track={editTrack} onClose={() => setEditTrack(null)} />}
      {deleteTarget && (
        <DeleteConfirm
          track={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </AppShell>
  )
}
