"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState, useRef, useCallback } from "react"
import type { Doc } from "@/convex/_generated/dataModel"
import { Play, Pause, Music, Waves, Zap } from "lucide-react"

type AudioTrack = Doc<"audioTracks">
type TrackType = "ambience" | "music" | "sfx"

const TYPE_LABELS: Record<TrackType, string> = { ambience: "Ambience", music: "Music", sfx: "SFX" }
const TYPE_ICONS = { ambience: Waves, music: Music, sfx: Zap }

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

function TrackRow({ track }: { track: AudioTrack }) {
  const [playing, setPlaying] = useState(false)
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

  const Icon = TYPE_ICONS[track.type as TrackType]

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg"
      style={{ background: "#16131f", border: "1px solid #2a2438" }}
    >
      <button
        onClick={toggle}
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
        style={{ background: "#7b68c8" }}
      >
        {playing ? <Pause size={13} style={{ color: "#0d0d14" }} /> : <Play size={13} style={{ color: "#0d0d14" }} />}
      </button>
      <Icon size={13} style={{ color: "#5a5272", flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" style={{ color: "#e8e0f8" }}>{track.name}</p>
        {track.sceneTag && (
          <p className="text-xs" style={{ color: "#5a5272" }}>{track.sceneTag}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {track.intensityTier && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded border"
            style={{
              borderColor: track.intensityTier === "explore" ? "#2d5a3d" : "#5a2d2d",
              color: track.intensityTier === "explore" ? "#4ade80" : "#f87171",
            }}
          >
            {track.intensityTier}
          </span>
        )}
        <span className="text-xs" style={{ color: "#5a5272" }}>{formatDuration(track.duration)}</span>
      </div>
    </div>
  )
}

export default function PublicAudioLibraryPage() {
  const tracks = useQuery(api.audio.listAudioTracks, {})
  const [filterType, setFilterType] = useState<TrackType | "all">("all")

  const filtered = (tracks ?? []).filter((t) =>
    filterType === "all" || t.type === filterType
  )

  const grouped = filtered.reduce<Record<string, AudioTrack[]>>((acc, t) => {
    const key = t.sceneTag ?? "general"
    acc[key] = acc[key] ?? []
    acc[key].push(t)
    return acc
  }, {})

  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto" style={{ background: "#0d0d14", color: "#f0eef8" }}>
      <div className="mb-8">
        <p
          className="text-xs uppercase tracking-[0.2em] mb-2"
          style={{ color: "#7b68c8" }}
        >
          FeyForge
        </p>
        <h1
          className="text-3xl font-bold mb-2"
          style={{ fontFamily: "var(--font-cinzel)", color: "#e8e0f8" }}
        >
          Audio Library
        </h1>
        <p className="text-sm" style={{ color: "#8a8299" }}>
          {tracks?.length ?? 0} tracks — royalty-free
        </p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 p-1 rounded-lg w-fit" style={{ background: "#16131f" }}>
        {(["all", "ambience", "music", "sfx"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize"
            style={{
              background: filterType === t ? "#7b68c8" : "transparent",
              color: filterType === t ? "#0d0d14" : "#8a8299",
            }}
          >
            {t === "all" ? "All" : TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tracks */}
      {!tracks ? (
        <p className="text-sm py-12 text-center" style={{ color: "#5a5272" }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm py-12 text-center" style={{ color: "#5a5272" }}>No tracks yet.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([tag, tagTracks]) => (
            <div key={tag}>
              <p
                className="text-xs uppercase tracking-widest mb-3"
                style={{ color: "#5a5272" }}
              >
                {tag}
              </p>
              <div className="space-y-2">
                {tagTracks.map((track) => (
                  <TrackRow key={track._id} track={track} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
