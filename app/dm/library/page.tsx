"use client"

import { AppShell } from "@/components/app-shell"
import { useState, useRef, useEffect, useCallback } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { Play, Pause, Music, Waves, Zap, Star } from "lucide-react"

type AudioTrack = Doc<"audioTracks">
type TrackType = "ambience" | "music" | "sfx"
type IntensityTier = "explore" | "combat"

const TYPE_LABELS: Record<TrackType, string> = { ambience: "Ambience", music: "Music", sfx: "SFX" }
const TYPE_ICONS = { ambience: Waves, music: Music, sfx: Zap }
const TIER_LABELS: Record<IntensityTier, string> = { explore: "Explore", combat: "Combat" }

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

const RANK_LABELS: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V" }

function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-slate-800/60 text-slate-300 border-slate-600/50">
      <Star size={8} className="fill-current" />
      {RANK_LABELS[rank] ?? rank}
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

type CurationTierFilter = "all" | "free" | "premium"

function TrackCard({ track, isPremium }: { track: AudioTrack; isPremium: boolean }) {
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
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {track.tier === "premium" && (
            <Star size={10} className="shrink-0 text-amber-400 fill-amber-400" />
          )}
          <p className="text-sm font-medium leading-tight truncate" style={{ color: "var(--scene-text-primary)" }}>
            {track.name}
          </p>
        </div>
        <AudioPreview url={track.r2Url} locked={isLocked} />
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <TypeBadge type={track.type as TrackType} />
        {track.intensityTier && <TierBadge tier={track.intensityTier as IntensityTier} />}
        {typeof track.intensityRank === "number" && <RankBadge rank={track.intensityRank} />}
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
          ⭐ Premium — support on Ko-fi to unlock
        </p>
      )}
    </div>
  )
}

export default function AudioLibraryPage() {
  const tracks = useQuery(api.audio.listAudioTracks, {})
  const me = useQuery(api.users.getMe, {})

  const [filterType, setFilterType] = useState<TrackType | "all">("all")
  const [filterIntensityTier, setFilterIntensityTier] = useState<IntensityTier | "all">("all")
  const [filterTag, setFilterTag] = useState<string>("all")
  const [filterTier, setFilterTier] = useState<CurationTierFilter>("all")

  const isPremium = me?.isPremium ?? false

  const filtered = (tracks ?? []).filter((t) => {
    if (filterType !== "all" && t.type !== filterType) return false
    if (filterIntensityTier !== "all" && t.intensityTier !== filterIntensityTier) return false
    if (filterTag !== "all" && !(t.sceneTag ?? []).includes(filterTag)) return false
    if (filterTier === "free" && t.tier !== "free") return false
    if (filterTier === "premium" && t.tier !== "premium") return false
    return true
  })

  const allTags = Array.from(new Set((tracks ?? []).flatMap((t) => t.sceneTag ?? [])))

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--scene-text-primary)" }}>Audio Library</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
            {tracks?.length ?? 0} tracks
          </p>
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
          {allTags.length > 0 && (
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

        {/* Track grid */}
        {!tracks ? (
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
              <TrackCard key={track._id} track={track} isPremium={isPremium} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
