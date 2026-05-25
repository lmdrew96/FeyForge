"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id, Doc } from "@/convex/_generated/dataModel"
import { useAudioEngine } from "@/hooks/use-audio-engine"
import {
  Music, Waves, Zap, Volume2, ChevronDown, ChevronUp,
  Radio, WifiOff, X, Check,
} from "lucide-react"

type SessionId = Id<"partySessions">
type TrackId = Id<"audioTracks">
type AudioTrack = Doc<"audioTracks">

// ── Track picker modal ────────────────────────────────────────────────────────

function TrackPicker({
  slot,
  currentId,
  onSelect,
  onClose,
}: {
  slot: "ambience" | "explore" | "combat" | "victory"
  currentId: TrackId | null
  onSelect: (trackId: TrackId | null) => void
  onClose: () => void
}) {
  const typeFilter = slot === "ambience" ? "ambience" : "music"
  // victory should show any music (no intensity filter)
  const tierFilter = slot === "explore" ? "explore" : slot === "combat" ? "combat" : undefined
  const tracks = useQuery(api.audio.listAudioTracks, {
    type: typeFilter,
    intensityTier: tierFilter,
  })

  const [search, setSearch] = useState("")
  const filtered = (tracks ?? []).filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-xl overflow-hidden"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--scene-border)" }}>
          <h3 className="text-sm font-semibold capitalize" style={{ color: "var(--scene-text-primary)" }}>
            Pick {slot} track
          </h3>
          <button onClick={onClose} style={{ color: "var(--scene-text-muted)" }}><X size={16} /></button>
        </div>
        <div className="p-3 border-b" style={{ borderColor: "var(--scene-border)" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full px-3 py-1.5 rounded-md text-sm"
            style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          <button
            onClick={() => { onSelect(null); onClose() }}
            className="w-full px-4 py-3 text-left text-sm hover:opacity-80 transition-opacity border-b"
            style={{ borderColor: "var(--scene-border)", color: "var(--scene-text-muted)" }}
          >
            Clear slot
          </button>
          {filtered.map((track) => (
            <button
              key={track._id}
              onClick={() => { onSelect(track._id); onClose() }}
              className="w-full px-4 py-3 text-left hover:opacity-80 transition-opacity flex items-center justify-between border-b"
              style={{ borderColor: "var(--scene-border)" }}
            >
              <div>
                <p className="text-sm" style={{ color: "var(--scene-text-primary)" }}>{track.name}</p>
                {track.sceneTag && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>{track.sceneTag}</p>
                )}
              </div>
              {currentId === track._id && <Check size={14} style={{ color: "var(--scene-accent)" }} />}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-xs text-center" style={{ color: "var(--scene-text-muted)" }}>
              No tracks found
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── SFX Board ─────────────────────────────────────────────────────────────────

const SFX_CATEGORIES = [
  { label: "Impact", icon: "⚡" },
  { label: "Weather", icon: "🌩️" },
  { label: "Environment", icon: "🚪" },
  { label: "Magic", icon: "🧙" },
  { label: "Crowd", icon: "👥" },
]

function SfxBoard({
  playSfx,
  masterVolume,
}: {
  playSfx: (url: string) => void
  masterVolume: number
}) {
  const tracks = useQuery(api.audio.listAudioTracks, { type: "sfx" })
  const [flashing, setFlashing] = useState<string | null>(null)

  const handleSfx = useCallback((url: string, id: string) => {
    playSfx(url)
    setFlashing(id)
    setTimeout(() => setFlashing(null), 300)
  }, [playSfx])

  const sfxByTag = (tracks ?? []).reduce<Record<string, AudioTrack[]>>((acc, t) => {
    const key = t.sceneTag ?? "misc"
    acc[key] = acc[key] ?? []
    acc[key].push(t)
    return acc
  }, {})

  const allUntagged = sfxByTag["misc"] ?? []
  const taggedGroups = SFX_CATEGORIES.map((c) => ({
    ...c,
    tracks: sfxByTag[c.label.toLowerCase()] ?? [],
  })).filter((g) => g.tracks.length > 0)

  const allGroups = [
    ...taggedGroups,
    ...(allUntagged.length > 0 ? [{ label: "Other", icon: "🎵", tracks: allUntagged }] : []),
  ]

  if ((tracks ?? []).length === 0) {
    return (
      <p className="text-xs py-3" style={{ color: "var(--scene-text-muted)" }}>
        No SFX in library yet. Add some from the Audio Library.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {allGroups.map((group) => (
        <div key={group.label}>
          <p className="text-xs mb-2" style={{ color: "var(--scene-text-muted)" }}>
            {group.icon} {group.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.tracks.map((track) => (
              <button
                key={track._id}
                onClick={() => handleSfx(track.r2Url, track._id)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background: flashing === track._id ? "var(--scene-accent)" : "var(--scene-border)",
                  color: flashing === track._id ? "var(--scene-bg)" : "var(--scene-text-primary)",
                  transform: flashing === track._id ? "scale(0.96)" : "scale(1)",
                }}
              >
                {track.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Track slot display ────────────────────────────────────────────────────────

function TrackSlot({
  label,
  icon: Icon,
  track,
  onOverride,
}: {
  label: string
  icon: React.ElementType
  track: AudioTrack | null | undefined
  onOverride: () => void
}) {
  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-2"
      style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={13} style={{ color: "var(--scene-text-muted)", flexShrink: 0 }} />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--scene-text-muted)" }}>{label}</p>
          <p className="text-xs truncate" style={{ color: track ? "var(--scene-text-primary)" : "var(--scene-text-muted)" }}>
            {track?.name ?? "—"}
          </p>
        </div>
      </div>
      <button
        onClick={onOverride}
        className="text-[10px] px-2 py-1 rounded ml-2 shrink-0 transition-opacity hover:opacity-80"
        style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-muted)" }}
      >
        Change
      </button>
    </div>
  )
}

// ── DM Audio Panel ────────────────────────────────────────────────────────────

type PickerSlot = "ambience" | "explore" | "combat" | "victory" | null

export function DMAudioPanel({ sessionId }: { sessionId: SessionId }) {
  const updateAudio = useMutation(api.audio.updateSessionAudio)
  const updateIntensity = useMutation(api.audio.updateSessionIntensity)
  const triggerVictoryCue = useMutation(api.audio.triggerVictoryCue)

  // Local state mirrors session audio — optimistic
  const [ambienceId, setAmbienceId] = useState<TrackId | null>(null)
  const [exploreId, setExploreId] = useState<TrackId | null>(null)
  const [combatId, setCombatId] = useState<TrackId | null>(null)
  const [intensity, setIntensity] = useState(0)
  const [ambienceVolume, setAmbienceVolume] = useState(70)
  const [masterVolume, setMasterVolume] = useState(80)
  const [syncEnabled, setSyncEnabled] = useState(false)
  const prevAmbienceRef = useRef<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [showSfx, setShowSfx] = useState(false)
  const [pickerSlot, setPickerSlot] = useState<PickerSlot>(null)

  const sessionRef = useQuery(api.audio.getSessionAudio, { sessionId })

  // Initialize from server state
  const initializedRef = useRef(false)
  useEffect(() => {
    if (sessionRef && !initializedRef.current) {
      initializedRef.current = true
      setAmbienceId(sessionRef.activeAmbienceTrackId ?? null)
      setExploreId(sessionRef.activeExploreTrackId ?? null)
      setCombatId(sessionRef.activeCombatTrackId ?? null)
      setIntensity(sessionRef.intensity ?? 0)
      setAmbienceVolume(sessionRef.ambienceVolume ?? 70)
      setMasterVolume(sessionRef.masterVolume ?? 80)
      setSyncEnabled(sessionRef.audioSyncEnabled ?? false)
    }
  }, [sessionRef])

  // Fetch track docs for display
  const ambienceTrack = useQuery(api.audio.getAudioTrack, ambienceId ? { trackId: ambienceId } : "skip")
  const exploreTrack = useQuery(api.audio.getAudioTrack, exploreId ? { trackId: exploreId } : "skip")
  const combatTrack = useQuery(api.audio.getAudioTrack, combatId ? { trackId: combatId } : "skip")

  // If DM has not overridden with a single track, gather multiple tracks for the active scene and tier
  const sceneTag = sessionRef?.activeScene ?? undefined
  const exploreTracksList = useQuery(api.audio.listAudioTracks, sceneTag ? { type: "music", intensityTier: "explore", sceneTag } : { type: "music", intensityTier: "explore" })
  const combatTracksList = useQuery(api.audio.listAudioTracks, sceneTag ? { type: "music", intensityTier: "combat", sceneTag } : { type: "music", intensityTier: "combat" })

  const sortedExploreUrls = (exploreId && exploreTrack) ? [exploreTrack.r2Url] : (exploreTracksList ?? [])
    .slice()
    .sort((a, b) => (a.intensityRank ?? 0) - (b.intensityRank ?? 0))
    .map((t) => t.r2Url)

  const sortedCombatUrls = (combatId && combatTrack) ? [combatTrack.r2Url] : (combatTracksList ?? [])
    .slice()
    .sort((a, b) => (a.intensityRank ?? 0) - (b.intensityRank ?? 0))
    .map((t) => t.r2Url)

  // Fetch active victory track doc (used only for engine/viz)
  const activeVictoryTrack = useQuery(
    api.audio.getAudioTrack,
    sessionRef?.activeVictoryTrackId ? { trackId: sessionRef.activeVictoryTrackId } : "skip"
  )

  const engineState = {
    ambienceUrl: ambienceTrack?.r2Url ?? null,
    // arrays of URLs for multi-track mixing
    exploreUrls: sortedExploreUrls,
    combatUrls: sortedCombatUrls,
    intensity,
    ambienceVolume,
    masterVolume,
    // victory fields for local engine cueing
    victoryUrl: activeVictoryTrack?.r2Url ?? null,
    victoryTriggeredAt: sessionRef?.victoryTriggeredAt ?? null,
    victoryDurationMs: sessionRef?.victoryDurationMs ?? null,
    musicMode: sessionRef?.musicMode ?? "blend",
  }
  const { playSfx } = useAudioEngine(engineState, true)

  // Debounce intensity sync to Convex
  const intensityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleIntensityChange = (val: number) => {
    setIntensity(val)
    if (intensityTimerRef.current) clearTimeout(intensityTimerRef.current)
    intensityTimerRef.current = setTimeout(() => {
      updateIntensity({ sessionId, intensity: val }).catch(console.error)
    }, 100)
  }

  const pushAudioState = useCallback(
    (patch: Partial<{
      ambienceId: TrackId | null
      exploreId: TrackId | null
      combatId: TrackId | null
      ambienceVolume: number
      masterVolume: number
      syncEnabled: boolean
    }>) => {
      updateAudio({
        sessionId,
        activeAmbienceTrackId: patch.ambienceId !== undefined ? patch.ambienceId ?? undefined : ambienceId ?? undefined,
        activeExploreTrackId: patch.exploreId !== undefined ? patch.exploreId ?? undefined : exploreId ?? undefined,
        activeCombatTrackId: patch.combatId !== undefined ? patch.combatId ?? undefined : combatId ?? undefined,
        ambienceVolume: patch.ambienceVolume !== undefined ? patch.ambienceVolume : ambienceVolume,
        masterVolume: patch.masterVolume !== undefined ? patch.masterVolume : masterVolume,
        audioSyncEnabled: patch.syncEnabled !== undefined ? patch.syncEnabled : syncEnabled,
      }).catch(console.error)
    },
    [updateAudio, sessionId, ambienceId, exploreId, combatId, ambienceVolume, masterVolume, syncEnabled]
  )

  const handleTrackSelect = (slot: "ambience" | "explore" | "combat", trackId: TrackId | null) => {
    if (slot === "ambience") {
      setAmbienceId(trackId)
      pushAudioState({ ambienceId: trackId })
    } else if (slot === "explore") {
      setExploreId(trackId)
      pushAudioState({ exploreId: trackId })
    } else {
      setCombatId(trackId)
      pushAudioState({ combatId: trackId })
    }
  }

  const handleVictoryTrackSelect = (trackId: TrackId | null) => {
    // store active victory track on session
    updateAudio({ sessionId, activeVictoryTrackId: trackId ?? undefined }).catch(console.error)
  }

  const handleSyncToggle = () => {
    const next = !syncEnabled
    setSyncEnabled(next)
    pushAudioState({ syncEnabled: next })
  }

  return (
    <>
      <section>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-between py-1 mb-3"
        >
          <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
            Audio
          </h2>
          {collapsed ? <ChevronDown size={14} style={{ color: "var(--scene-text-muted)" }} /> : <ChevronUp size={14} style={{ color: "var(--scene-text-muted)" }} />}
        </button>

        {!collapsed && (
          <div
            className="rounded-xl p-4 space-y-4"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            {/* Track slots */}
            <div className="space-y-2">
              <TrackSlot
                label="Ambience"
                icon={Waves}
                track={ambienceTrack ?? null}
                onOverride={() => setPickerSlot("ambience")}
              />
              <TrackSlot
                label="Explore"
                icon={Music}
                track={exploreTrack ?? null}
                onOverride={() => setPickerSlot("explore")}
              />
              <TrackSlot
                label="Combat"
                icon={Music}
                track={combatTrack ?? null}
                onOverride={() => setPickerSlot("combat")}
              />
              <TrackSlot
                label="Victory"
                icon={Music}
                track={activeVictoryTrack ?? null}
                onOverride={() => setPickerSlot("victory")}
              />
            </div>

            {/* Intensity slider */}
            <div>
              {/* Music mode strip (Pocket Bard style) */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => {
                    // Music off: set musicMode to off and zero music level
                    setIntensity(0)
                    handleIntensityChange(0)
                    updateAudio({ sessionId, musicMode: "off" }).catch(console.error)
                  }}
                  className="px-3 py-1 rounded-md text-xs font-medium"
                  style={{ background: sessionRef?.musicMode === "off" ? "var(--scene-accent)" : "var(--scene-border)", color: sessionRef?.musicMode === "off" ? "var(--scene-bg)" : "var(--scene-text-muted)" }}
                >
                  Off
                </button>
                <button
                  onClick={() => { setIntensity(70); handleIntensityChange(70); updateAudio({ sessionId, musicMode: "explore" }).catch(console.error) }}
                  className="px-3 py-1 rounded-md text-xs font-medium"
                  style={{ background: sessionRef?.musicMode === "explore" ? "var(--scene-accent)" : "var(--scene-border)", color: sessionRef?.musicMode === "explore" ? "var(--scene-bg)" : "var(--scene-text-muted)" }}
                >
                  Explore
                </button>
                <button
                  onClick={() => { setIntensity(100); handleIntensityChange(100); updateAudio({ sessionId, musicMode: "combat" }).catch(console.error) }}
                  className="px-3 py-1 rounded-md text-xs font-medium"
                  style={{ background: sessionRef?.musicMode === "combat" ? "var(--scene-accent)" : "var(--scene-border)", color: sessionRef?.musicMode === "combat" ? "var(--scene-bg)" : "var(--scene-text-muted)" }}
                >
                  Combat
                </button>
                <button
                  onClick={() => {
                    // trigger victory cue
                    triggerVictoryCue({ sessionId, trackId: sessionRef?.activeVictoryTrackId ?? undefined, durationMs: 10000 }).catch(console.error)
                  }}
                  className="px-3 py-1 rounded-md text-xs font-medium"
                  style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
                >
                  Victory
                </button>
                {/* Ambience toggle */}
                <button
                  onClick={() => {
                    if ((ambienceVolume ?? 0) > 0) {
                      prevAmbienceRef.current = ambienceVolume
                      setAmbienceVolume(0)
                      pushAudioState({ ambienceVolume: 0 })
                    } else {
                      const restore = prevAmbienceRef.current ?? 70
                      setAmbienceVolume(restore)
                      pushAudioState({ ambienceVolume: restore })
                      prevAmbienceRef.current = null
                    }
                  }}
                  className="ml-auto px-3 py-1 rounded-md text-xs font-medium"
                  style={{ background: (ambienceVolume ?? 0) === 0 ? "var(--scene-border)" : "var(--scene-accent)", color: (ambienceVolume ?? 0) === 0 ? "var(--scene-text-muted)" : "var(--scene-bg)" }}
                >
                  Ambience {ambienceVolume === 0 ? "Off" : "On"}
                </button>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>Low</span>
                <span className="text-[10px] font-medium" style={{ color: "var(--scene-accent)" }}>
                  {intensity === 0 ? "Muted" : `${intensity}% Intensity`}
                </span>
                <span className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>High</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={intensity}
                onChange={(e) => handleIntensityChange(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: "var(--scene-accent)" }}
              />
            </div>

            {/* Volume sliders */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Waves size={11} style={{ color: "var(--scene-text-muted)" }} />
                  <span className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>Ambience</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={ambienceVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setAmbienceVolume(v)
                    pushAudioState({ ambienceVolume: v })
                  }}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "var(--scene-accent)" }}
                />
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Volume2 size={11} style={{ color: "var(--scene-text-muted)" }} />
                  <span className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>Master</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={masterVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setMasterVolume(v)
                    pushAudioState({ masterVolume: v })
                  }}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "var(--scene-accent)" }}
                />
              </div>
            </div>

            {/* SFX board toggle */}
            <div>
              <button
                onClick={() => setShowSfx((s) => !s)}
                className="flex items-center gap-1.5 text-xs mb-3 transition-opacity hover:opacity-80"
                style={{ color: "var(--scene-text-muted)" }}
              >
                <Zap size={12} />
                SFX Board
                {showSfx ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showSfx && <SfxBoard playSfx={playSfx} masterVolume={masterVolume} />}
            </div>

            {/* Sync toggle */}
            <div
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
            >
              <div className="flex items-center gap-2">
                {syncEnabled ? (
                  <Radio size={14} style={{ color: "var(--scene-accent)" }} />
                ) : (
                  <WifiOff size={14} style={{ color: "var(--scene-text-muted)" }} />
                )}
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--scene-text-primary)" }}>
                    Sync audio to players
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>
                    {syncEnabled ? "Players hear what you hear" : "Local only"}
                  </p>
                </div>
              </div>
                {/* Victory cue button */}
                <div>
                  <button
                    onClick={() => {
                      // default hold 10s
                      triggerVictoryCue({ sessionId, trackId: sessionRef?.activeVictoryTrackId ?? undefined, durationMs: 10000 }).catch(console.error)
                    }}
                    className="mt-2 px-3 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
                    style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                  >
                    Cue Victory
                  </button>
                </div>
              <button
                onClick={handleSyncToggle}
                className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors"
                style={{ background: syncEnabled ? "var(--scene-accent)" : "var(--scene-border)" }}
              >
                <span
                  className="inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm mt-0.5"
                  style={{ transform: syncEnabled ? "translateX(18px)" : "translateX(2px)" }}
                />
              </button>
            </div>
          </div>
        )}
      </section>

      {pickerSlot && (
        <TrackPicker
          slot={pickerSlot}
          currentId={
            pickerSlot === "ambience" ? ambienceId :
            pickerSlot === "explore" ? exploreId :
            pickerSlot === "combat" ? combatId :
            // victory
            sessionRef?.activeVictoryTrackId ?? null
          }
          onSelect={(id) => {
            if (pickerSlot === "victory") handleVictoryTrackSelect(id)
            else if (pickerSlot) handleTrackSelect(pickerSlot, id)
          }}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </>
  )
}

// ── Player Audio Receiver ─────────────────────────────────────────────────────

export function PlayerAudioReceiver({ sessionId, campaignId }: { sessionId: SessionId; campaignId: Id<"campaigns"> }) {
  const sessionAudio = useQuery(api.audio.getSessionAudio, { sessionId })
  const [localVolume, setLocalVolume] = useState(80)
  const [synced, setSynced] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)

  const ambienceTrack = useQuery(
    api.audio.getAudioTrack,
    sessionAudio?.activeAmbienceTrackId ? { trackId: sessionAudio.activeAmbienceTrackId } : "skip"
  )
  const exploreTrack = useQuery(
    api.audio.getAudioTrack,
    sessionAudio?.activeExploreTrackId ? { trackId: sessionAudio.activeExploreTrackId } : "skip"
  )
  const combatTrack = useQuery(
    api.audio.getAudioTrack,
    sessionAudio?.activeCombatTrackId ? { trackId: sessionAudio.activeCombatTrackId } : "skip"
  )
  const activeVictoryTrack = useQuery(
    api.audio.getAudioTrack,
    sessionAudio?.activeVictoryTrackId ? { trackId: sessionAudio.activeVictoryTrackId } : "skip"
  )

  const sceneTag = sessionAudio?.activeScene ?? undefined
  const exploreTracksList = useQuery(
    api.audio.listAudioTracks,
    sceneTag ? { type: "music", intensityTier: "explore", sceneTag } : { type: "music", intensityTier: "explore" }
  )
  const combatTracksList = useQuery(
    api.audio.listAudioTracks,
    sceneTag ? { type: "music", intensityTier: "combat", sceneTag } : { type: "music", intensityTier: "combat" }
  )

  const sortedExploreUrls = (sessionAudio?.activeExploreTrackId && exploreTrack)
    ? [exploreTrack.r2Url]
    : (exploreTracksList ?? [])
      .slice()
      .sort((a, b) => (a.intensityRank ?? 0) - (b.intensityRank ?? 0))
      .map((t) => t.r2Url)

  const sortedCombatUrls = (sessionAudio?.activeCombatTrackId && combatTrack)
    ? [combatTrack.r2Url]
    : (combatTracksList ?? [])
      .slice()
      .sort((a, b) => (a.intensityRank ?? 0) - (b.intensityRank ?? 0))
      .map((t) => t.r2Url)

  const engineState = {
    ambienceUrl: ambienceTrack?.r2Url ?? null,
    exploreUrls: sortedExploreUrls,
    combatUrls: sortedCombatUrls,
    intensity: sessionAudio?.intensity ?? 0,
    ambienceVolume: sessionAudio?.ambienceVolume ?? 70,
    masterVolume: localVolume,
    victoryUrl: activeVictoryTrack?.r2Url ?? null,
    victoryTriggeredAt: sessionAudio?.victoryTriggeredAt ?? null,
    victoryDurationMs: sessionAudio?.victoryDurationMs ?? null,
    musicMode: sessionAudio?.musicMode ?? "blend",
  }

  useAudioEngine(engineState, synced && consentGiven && (sessionAudio?.audioSyncEnabled ?? false))

  if (!sessionAudio?.audioSyncEnabled) return null

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: synced && consentGiven ? "var(--scene-accent)" : "var(--scene-border)" }}
          />
          <p className="text-xs font-medium" style={{ color: "var(--scene-text-primary)" }}>Session Audio</p>
        </div>
        {!consentGiven ? (
          <button
            onClick={() => { setConsentGiven(true); setSynced(true) }}
            className="text-xs px-3 py-1 rounded-md font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
          >
            Enable Audio
          </button>
        ) : (
          <button
            onClick={() => setSynced((s) => !s)}
            className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors"
            style={{ background: synced ? "var(--scene-accent)" : "var(--scene-border)" }}
          >
            <span
              className="inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm mt-0.5"
              style={{ transform: synced ? "translateX(18px)" : "translateX(2px)" }}
            />
          </button>
        )}
      </div>

      {consentGiven && synced && (
        <div>
          <div className="flex items-center gap-1 mb-1">
            <Volume2 size={11} style={{ color: "var(--scene-text-muted)" }} />
            <span className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>My Volume</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={localVolume}
            onChange={(e) => setLocalVolume(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "var(--scene-accent)" }}
          />
        </div>
      )}

      {consentGiven && !synced && (
        <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>Audio paused. Toggle to resume sync.</p>
      )}
    </div>
  )
}
