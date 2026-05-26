"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id, Doc } from "@/convex/_generated/dataModel"
import { useAudioEngine, type MusicTrackSet } from "@/hooks/use-audio-engine"
import {
  Waves, Volume2, ChevronDown, ChevronUp,
  Radio, WifiOff, X, Check, Pause, Play, Pencil, Music2,
} from "lucide-react"

type SessionId = Id<"partySessions">
type TrackId = Id<"audioTracks">
type AmbienceLayerId = Id<"ambienceLayers">
type AudioTrack = Doc<"audioTracks">
type LayerTier = "i" | "ii" | "iii" | "off"
type ResolvedAmbienceLayer = Doc<"ambienceLayers"> & { r2Url: string; trackType: string | null }

const TIER_MULTIPLIERS: Record<LayerTier, number> = {
  i: 0.33,
  ii: 0.66,
  iii: 1,
  off: 0,
}

const RANK_LABELS: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V" }

const INTENSITY_MIX: Record<number, [number, number, number]> = {
  1: [1, 0, 0],
  2: [0.5, 0.5, 0],
  3: [0, 1, 0],
  4: [0, 0.5, 0.5],
  5: [0, 0, 1],
}

// ── Track picker modal ────────────────────────────────────────────────────────

function TrackPicker({
  slot,
  currentId,
  onSelect,
  onClose,
}: {
  slot: "explore" | "combat" | "victory"
  currentId: TrackId | null
  onSelect: (trackId: TrackId | null) => void
  onClose: () => void
}) {
  const typeFilter = "music"
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

// ── Music Set Picker ──────────────────────────────────────────────────────────

function MusicSetPicker({
  slot,
  onSelect,
  onClose,
}: {
  slot: "explore" | "combat" | "victory"
  onSelect: (set: { _id: Id<"musicSetLibrary">; lowTrackId: Id<"audioTracks">; medTrackId: Id<"audioTracks">; highTrackId: Id<"audioTracks">; name: string }) => void
  onClose: () => void
}) {
  const tierFilter = slot === "explore" ? "explore" : slot === "combat" ? "combat" : undefined
  const sets = useQuery(api.audio.listMusicSetLibrary, tierFilter ? { intensityTier: tierFilter } : {})
  const [search, setSearch] = useState("")
  const filtered = (sets ?? []).filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-xl overflow-hidden"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--scene-border)" }}>
          <h3 className="text-sm font-semibold capitalize" style={{ color: "var(--scene-text-primary)" }}>
            Pick {slot} music set
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
          {filtered.map((set) => (
            <button
              key={set._id}
              onClick={() => {
                onSelect({ _id: set._id, lowTrackId: set.lowTrackId, medTrackId: set.medTrackId, highTrackId: set.highTrackId, name: set.name })
                onClose()
              }}
              className="w-full px-4 py-3 text-left hover:opacity-80 transition-opacity flex items-center justify-between border-b"
              style={{ borderColor: "var(--scene-border)" }}
            >
              <div>
                <p className="text-sm" style={{ color: "var(--scene-text-primary)" }}>{set.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
                  {set.intensityTier} · {set.tier ?? "free"}
                </p>
              </div>
              <Music2 size={13} style={{ color: "var(--scene-text-muted)" }} />
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-xs text-center" style={{ color: "var(--scene-text-muted)" }}>
              {(sets ?? []).length === 0 ? "No music sets in library yet." : "No sets match your search."}
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
}: {
  playSfx: (url: string) => void
}) {
  const tracks = useQuery(api.audio.listAudioTracks, { type: "sfx" })
  const [flashing, setFlashing] = useState<string | null>(null)

  const handleSfx = useCallback((url: string, id: string) => {
    playSfx(url)
    setFlashing(id)
    setTimeout(() => setFlashing(null), 300)
  }, [playSfx])

  const sfxByTag = (tracks ?? []).reduce<Record<string, AudioTrack[]>>((acc, t) => {
    const key = (t.sceneTag ?? [])[0] ?? "misc"
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

function AmbienceLayerMixer({
  sessionId,
  campaignId,
  activeScene,
  activePresetId,
  activeLayers,
  onLayerChange,
}: {
  sessionId: SessionId
  campaignId: Id<"campaigns">
  activeScene: string
  activePresetId: Id<"ambiencePresets"> | null
  activeLayers: Array<{ layerId: AmbienceLayerId; tier: LayerTier }>
  onLayerChange: (layerId: AmbienceLayerId, tier: LayerTier) => void
}) {
  const presets = useQuery(api.audio.listAmbiencePresets, { campaignId, sceneName: activeScene })
  const layers = useQuery(api.audio.listAmbienceLayers, { campaignId })
  const loadPreset = useMutation(api.audio.loadPreset)
  const [loadingPresetId, setLoadingPresetId] = useState<Id<"ambiencePresets"> | null>(null)

  const activeTierMap = useMemo(() => {
    const map = new Map<AmbienceLayerId, LayerTier>()
    for (const layer of activeLayers) {
      map.set(layer.layerId, layer.tier)
    }
    return map
  }, [activeLayers])

  const groupedLayers = useMemo(() => {
    const groups = new Map<string, ResolvedAmbienceLayer[]>()
    if (!layers) return groups
    for (const layer of layers) {
      const category = layer.category || "other"
      const current: ResolvedAmbienceLayer[] = groups.get(category) ?? []
      current.push(layer)
      groups.set(category, current)
    }
    return groups
  }, [layers])

  const handlePresetSelect = (presetId: string) => {
    if (!presetId) return
    const typedPresetId = presetId as Id<"ambiencePresets">
    setLoadingPresetId(typedPresetId)
    loadPreset({ sessionId, presetId: typedPresetId })
      .catch(console.error)
      .finally(() => setLoadingPresetId(null))
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--scene-text-muted)" }}>
          Variation
        </p>
        <select
          value={activePresetId ?? ""}
          onChange={(e) => handlePresetSelect(e.target.value)}
          disabled={!presets || loadingPresetId !== null}
          className="w-full rounded-md px-3 py-2 text-sm"
          style={{
            background: "var(--scene-bg)",
            border: "1px solid var(--scene-border)",
            color: "var(--scene-text-primary)",
          }}
        >
          <option value="">Select variation…</option>
          {(presets ?? []).map((preset) => (
            <option key={preset._id} value={preset._id}>
              {preset.variationName}
            </option>
          ))}
        </select>
      </div>

      {Array.from(groupedLayers.entries()).map(([category, categoryLayers]) => (
        <div key={category} className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--scene-text-muted)" }}>
            {category}
          </p>

          {categoryLayers.map((layer) => {
            const activeTier = activeTierMap.get(layer._id) ?? "off"
            return (
              <div
                key={layer._id}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {layer.icon ? (
                    <i className={`ti ti-${layer.icon}`} style={{ color: "var(--scene-text-muted)" }} />
                  ) : (
                    <Waves size={13} style={{ color: "var(--scene-text-muted)" }} />
                  )}
                  <p className="text-xs truncate" style={{ color: "var(--scene-text-primary)" }}>
                    {layer.name}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {([
                    ["i", "I"],
                    ["ii", "II"],
                    ["iii", "III"],
                  ] as const).map(([tierValue, label]) => {
                    const isActive = activeTier === tierValue
                    return (
                      <button
                        key={tierValue}
                        onClick={() => onLayerChange(layer._id, isActive ? "off" : tierValue)}
                        className="px-2 py-1 rounded text-[10px] font-semibold"
                        style={{
                          background: isActive ? "var(--scene-accent)" : "var(--scene-border)",
                          color: isActive ? "var(--scene-bg)" : "var(--scene-text-muted)",
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── DM Audio Panel ────────────────────────────────────────────────────────────

type MusicPickerSlot = "explore" | "combat" | "victory" | null

export function DMAudioPanel({ sessionId }: { sessionId: SessionId }) {
  const updateAudio = useMutation(api.audio.updateSessionAudio)
  const updateSessionLayers = useMutation(api.audio.updateSessionLayers)
  const updateSessionMusicMode = useMutation(api.audio.updateSessionMusicMode)
  const updateSessionMusicIntensity = useMutation(api.audio.updateSessionMusicIntensity)
  const upsertSceneMusicSet = useMutation(api.audio.upsertSceneMusicSet)
  const triggerVictoryCue = useMutation(api.audio.triggerVictoryCue)
  const pauseAudioMutation = useMutation(api.audio.pauseAudio)

  // Local state
  const [ambienceId, setAmbienceId] = useState<TrackId | null>(null)
  const [musicIntensity, setMusicIntensity] = useState(3)
  const [ambienceVolume, setAmbienceVolume] = useState(70)
  const [masterVolume, setMasterVolume] = useState(80)
  const [syncEnabled, setSyncEnabled] = useState(false)
  const [paused, setPaused] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<"ambiences" | "one-shots">("ambiences")
  const [activeLayers, setActiveLayers] = useState<Array<{ layerId: AmbienceLayerId; tier: LayerTier }>>([])
  const [musicPickerSlot, setMusicPickerSlot] = useState<MusicPickerSlot>(null)
  const [victoryPickerOpen, setVictoryPickerOpen] = useState(false)

  const sessionRef = useQuery(api.audio.getSessionAudio, { sessionId })

  // Initialize from server state
  const initializedRef = useRef(false)
  useEffect(() => {
    if (sessionRef && !initializedRef.current) {
      initializedRef.current = true
      setAmbienceId(sessionRef.activeAmbienceTrackId ?? null)
      setMusicIntensity(Math.max(1, Math.min(5, sessionRef.musicIntensity ?? 3)))
      setAmbienceVolume(sessionRef.ambienceVolume ?? 70)
      setMasterVolume(sessionRef.masterVolume ?? 80)
      setSyncEnabled(sessionRef.audioSyncEnabled ?? false)
      setActiveLayers(sessionRef.activeLayers ?? [])
      setPaused(sessionRef.audioPaused ?? false)
    }
  }, [sessionRef])

  const campaignId = sessionRef?.campaignId
  const activeScene = sessionRef?.activeScene ?? ""

  // Ambience track
  const ambienceTrack = useQuery(api.audio.getAudioTrack, ambienceId ? { trackId: ambienceId } : "skip")

  // Active victory track (single-track fallback)
  const activeVictoryTrack = useQuery(
    api.audio.getAudioTrack,
    sessionRef?.activeVictoryTrackId ? { trackId: sessionRef.activeVictoryTrackId } : "skip"
  )

  // Scene music set assignments
  const exploreSet = useQuery(
    api.audio.getSceneMusicSet,
    campaignId && activeScene ? { campaignId, sceneName: activeScene, mode: "explore" } : "skip"
  )
  const combatSet = useQuery(
    api.audio.getSceneMusicSet,
    campaignId && activeScene ? { campaignId, sceneName: activeScene, mode: "combat" } : "skip"
  )

  // Resolve explore track URLs
  const exploreLow = useQuery(api.audio.getAudioTrack, exploreSet?.lowTrackId ? { trackId: exploreSet.lowTrackId } : "skip")
  const exploreMed = useQuery(api.audio.getAudioTrack, exploreSet?.medTrackId ? { trackId: exploreSet.medTrackId } : "skip")
  const exploreHigh = useQuery(api.audio.getAudioTrack, exploreSet?.highTrackId ? { trackId: exploreSet.highTrackId } : "skip")

  // Resolve combat track URLs
  const combatLow = useQuery(api.audio.getAudioTrack, combatSet?.lowTrackId ? { trackId: combatSet.lowTrackId } : "skip")
  const combatMed = useQuery(api.audio.getAudioTrack, combatSet?.medTrackId ? { trackId: combatSet.medTrackId } : "skip")
  const combatHigh = useQuery(api.audio.getAudioTrack, combatSet?.highTrackId ? { trackId: combatSet.highTrackId } : "skip")

  // Library set names for display
  const exploreLibSet = useQuery(
    api.audio.listMusicSetLibrary,
    exploreSet?.musicSetLibraryId ? {} : "skip"
  )
  const combatLibSet = useQuery(
    api.audio.listMusicSetLibrary,
    combatSet?.musicSetLibraryId ? {} : "skip"
  )
  const exploreSetName = useMemo(
    () => (exploreLibSet ?? []).find((s) => s._id === exploreSet?.musicSetLibraryId)?.name ?? null,
    [exploreLibSet, exploreSet?.musicSetLibraryId]
  )
  const combatSetName = useMemo(
    () => (combatLibSet ?? []).find((s) => s._id === combatSet?.musicSetLibraryId)?.name ?? null,
    [combatLibSet, combatSet?.musicSetLibraryId]
  )

  const activeSetName = useMemo(() => {
    if (sessionRef?.musicMode === "explore") return exploreSetName ?? (exploreSet ? "Custom set" : null)
    if (sessionRef?.musicMode === "combat") return combatSetName ?? (combatSet ? "Custom set" : null)
    return null
  }, [sessionRef?.musicMode, exploreSetName, combatSetName, exploreSet, combatSet])

  const exploreTracks: MusicTrackSet = useMemo(() => ({
    low: exploreLow?.r2Url ?? null,
    med: exploreMed?.r2Url ?? null,
    high: exploreHigh?.r2Url ?? null,
  }), [exploreLow?.r2Url, exploreMed?.r2Url, exploreHigh?.r2Url])

  const combatTracks: MusicTrackSet = useMemo(() => ({
    low: combatLow?.r2Url ?? null,
    med: combatMed?.r2Url ?? null,
    high: combatHigh?.r2Url ?? null,
  }), [combatLow?.r2Url, combatMed?.r2Url, combatHigh?.r2Url])

  const victoryTracks: MusicTrackSet = useMemo(() => ({
    low: null,
    med: activeVictoryTrack?.r2Url ?? null,
    high: null,
  }), [activeVictoryTrack?.r2Url])

  const ambienceLayers = useQuery(
    api.audio.listAmbienceLayers,
    campaignId ? { campaignId } : "skip"
  )

  const resolvedActiveLayers = useMemo(() => {
    const layerMap = new Map((ambienceLayers ?? []).map((layer) => [layer._id, layer] as const))
    return (activeLayers ?? [])
      .filter((layer) => layer.tier !== "off")
      .map((layer) => {
        const resolved = layerMap.get(layer.layerId)
        return {
          layerId: layer.layerId,
          url: resolved?.r2Url ?? "",
          volume: TIER_MULTIPLIERS[layer.tier] * ((ambienceVolume ?? 70) / 100),
        }
      })
      .filter((layer) => layer.url !== "")
  }, [ambienceLayers, activeLayers, ambienceVolume])

  const engineState = {
    ambienceUrl: ambienceTrack?.r2Url ?? null,
    activeLayers: resolvedActiveLayers,
    musicMode: (sessionRef?.musicMode === "off" || sessionRef?.musicMode === "explore" || sessionRef?.musicMode === "combat")
      ? sessionRef.musicMode
      : "off" as const,
    musicIntensity,
    exploreTracks,
    combatTracks,
    victoryTracks,
    victoryCuedAt: sessionRef?.victoryTriggeredAt ?? null,
    ambienceVolume,
    masterVolume,
  }
  const { playSfx } = useAudioEngine(engineState, !paused)

  // Debounce intensity sync to Convex
  const intensityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleIntensityChange = (val: number) => {
    setMusicIntensity(val)
    if (intensityTimerRef.current) clearTimeout(intensityTimerRef.current)
    intensityTimerRef.current = setTimeout(() => {
      updateSessionMusicIntensity({ sessionId, musicIntensity: val }).catch(console.error)
    }, 100)
  }

  const handleModeChange = (mode: "off" | "explore" | "combat") => {
    updateSessionMusicMode({ sessionId, musicMode: mode }).catch(console.error)
  }

  const handleMusicSetSelect = useCallback((
    slot: "explore" | "combat" | "victory",
    set: { _id: Id<"musicSetLibrary">; lowTrackId: Id<"audioTracks">; medTrackId: Id<"audioTracks">; highTrackId: Id<"audioTracks"> }
  ) => {
    if (!campaignId || !activeScene) return
    upsertSceneMusicSet({
      campaignId,
      sceneName: activeScene,
      mode: slot,
      musicSetLibraryId: set._id,
      lowTrackId: set.lowTrackId,
      medTrackId: set.medTrackId,
      highTrackId: set.highTrackId,
    }).catch(console.error)
  }, [campaignId, activeScene, upsertSceneMusicSet])

  const handleVictoryTrackSelect = (trackId: TrackId | null) => {
    updateAudio({ sessionId, activeVictoryTrackId: trackId ?? undefined }).catch(console.error)
  }

  const pushAudioState = useCallback(
    (patch: Partial<{
      ambienceId: TrackId | null
      ambienceVolume: number
      masterVolume: number
      syncEnabled: boolean
    }>) => {
      updateAudio({
        sessionId,
        activeAmbienceTrackId: patch.ambienceId !== undefined ? patch.ambienceId ?? undefined : ambienceId ?? undefined,
        ambienceVolume: patch.ambienceVolume !== undefined ? patch.ambienceVolume : ambienceVolume,
        masterVolume: patch.masterVolume !== undefined ? patch.masterVolume : masterVolume,
        audioSyncEnabled: patch.syncEnabled !== undefined ? patch.syncEnabled : syncEnabled,
      }).catch(console.error)
    },
    [updateAudio, sessionId, ambienceId, ambienceVolume, masterVolume, syncEnabled]
  )

  const handleLayerChange = useCallback((layerId: AmbienceLayerId, tier: LayerTier) => {
    setActiveLayers((current) => {
      const next = current.some((layer) => layer.layerId === layerId)
        ? current.map((layer) => (layer.layerId === layerId ? { layerId, tier } : layer))
        : [...current, { layerId, tier }]
      updateSessionLayers({ sessionId, activeLayers: next }).catch(console.error)
      return next
    })
  }, [sessionId, updateSessionLayers])

  const handleSyncToggle = () => {
    const next = !syncEnabled
    setSyncEnabled(next)
    pushAudioState({ syncEnabled: next })
  }

  const handlePauseToggle = () => {
    const next = !paused
    setPaused(next)
    pauseAudioMutation({ sessionId, paused: next }).catch(console.error)
  }

  return (
    <>
      <section>
        {/* Header */}
        <div className="flex items-center justify-between py-1 mb-3">
          <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
            Audio
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePauseToggle}
              title={paused ? "Resume audio for everyone" : "Pause audio for everyone"}
              style={{ color: paused ? "var(--scene-highlight)" : "var(--scene-text-muted)" }}
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
            <button onClick={() => setCollapsed((c) => !c)}>
              {collapsed
                ? <ChevronDown size={14} style={{ color: "var(--scene-text-muted)" }} />
                : <ChevronUp size={14} style={{ color: "var(--scene-text-muted)" }} />}
            </button>
          </div>
        </div>

        {!collapsed && (
          <div
            className="rounded-xl p-4 space-y-4"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            {/* Music zone */}
            <div className="space-y-2">
              {/* Mode strip */}
              <div className="flex items-center gap-2">
                {(["off", "explore", "combat"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleModeChange(mode)}
                    className="px-3 py-1 rounded-md text-xs font-medium capitalize"
                    style={{
                      background: sessionRef?.musicMode === mode ? "var(--scene-accent)" : "var(--scene-border)",
                      color: sessionRef?.musicMode === mode ? "var(--scene-bg)" : "var(--scene-text-muted)",
                    }}
                  >
                    {mode === "off" ? "Off" : mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>

              {/* Clickable active set name — opens music set picker */}
              {sessionRef?.musicMode !== "off" && sessionRef?.musicMode !== "blend" && (
                <button
                  onClick={() => setMusicPickerSlot(sessionRef?.musicMode as "explore" | "combat")}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-opacity hover:opacity-80"
                  style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Music2 size={11} style={{ color: "var(--scene-text-muted)", flexShrink: 0 }} />
                    <p className="text-xs truncate" style={{ color: activeSetName ? "var(--scene-text-primary)" : "var(--scene-text-muted)" }}>
                      {activeSetName ?? "No set assigned — pick one"}
                    </p>
                  </div>
                  <Pencil size={11} style={{ color: "var(--scene-text-muted)", flexShrink: 0 }} />
                </button>
              )}

              {/* Intensity slider */}
              {sessionRef?.musicMode !== "off" && (
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 h-2">
                    <div
                      className="absolute inset-0 rounded-full pointer-events-none"
                      style={{
                        background: `linear-gradient(to right,
                          var(--scene-accent) 0%,
                          var(--scene-accent) ${(musicIntensity - 1) / 4 * 100}%,
                          var(--scene-surface) ${(musicIntensity - 1) / 4 * 100}%,
                          var(--scene-surface) 100%
                        )`,
                        opacity: 0.45,
                      }}
                    />
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={musicIntensity}
                      onChange={(e) => handleIntensityChange(Number(e.target.value))}
                      className="relative w-full h-2 rounded-full appearance-none cursor-pointer bg-transparent"
                      style={{ accentColor: "var(--scene-accent)" }}
                    />
                  </div>
                  <span className="text-xs font-semibold w-5 text-right shrink-0" style={{ color: "var(--scene-accent)" }}>
                    {RANK_LABELS[musicIntensity]}
                  </span>
                </div>
              )}
              {/* INTENSITY_MIX display */}
              {sessionRef?.musicMode !== "off" && (
                <div className="flex items-center gap-3 px-1">
                  {["L", "M", "H"].map((label, i) => {
                    const weight = (INTENSITY_MIX[musicIntensity] ?? INTENSITY_MIX[3])[i]
                    return (
                      <div key={label} className="flex items-center gap-1">
                        <span className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>{label}</span>
                        <div className="w-10 h-1 rounded-full overflow-hidden" style={{ background: "var(--scene-border)" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.round(weight * 100)}%`, background: "var(--scene-accent)" }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Victory Cue + track selector */}
            <div className="space-y-1.5">
              <button
                onClick={() => triggerVictoryCue({ sessionId, trackId: sessionRef?.activeVictoryTrackId ?? undefined, durationMs: 10000 }).catch(console.error)}
                className="w-full py-1.5 rounded-md text-sm font-medium transition-colors"
                style={{
                  background: "color-mix(in srgb, var(--scene-highlight) 20%, transparent)",
                  color: "var(--scene-highlight)",
                  border: "1px solid color-mix(in srgb, var(--scene-highlight) 40%, transparent)",
                }}
              >
                🏆 Cue Victory
              </button>
              <button
                onClick={() => setVictoryPickerOpen(true)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left transition-opacity hover:opacity-80"
                style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
              >
                <p className="text-xs truncate" style={{ color: activeVictoryTrack ? "var(--scene-text-primary)" : "var(--scene-text-muted)" }}>
                  {activeVictoryTrack?.name ?? "No victory track"}
                </p>
                <Pencil size={11} style={{ color: "var(--scene-text-muted)", flexShrink: 0 }} />
              </button>
            </div>

            {/* Tabs */}
            <div>
              <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--scene-border)" }}>
                <button
                  onClick={() => setActiveTab("ambiences")}
                  className="px-3 py-1 rounded-md text-xs font-medium"
                  style={{ background: activeTab === "ambiences" ? "var(--scene-accent)" : "var(--scene-border)", color: activeTab === "ambiences" ? "var(--scene-bg)" : "var(--scene-text-muted)" }}
                >
                  Ambiences
                </button>
                <button
                  onClick={() => setActiveTab("one-shots")}
                  className="px-3 py-1 rounded-md text-xs font-medium"
                  style={{ background: activeTab === "one-shots" ? "var(--scene-accent)" : "var(--scene-border)", color: activeTab === "one-shots" ? "var(--scene-bg)" : "var(--scene-text-muted)" }}
                >
                  One-shots
                </button>
              </div>

              {activeTab === "ambiences" ? (
                <div className="pt-3 space-y-4">
                  {sessionRef?.campaignId ? (
                    <AmbienceLayerMixer
                      sessionId={sessionId}
                      campaignId={sessionRef.campaignId}
                      activeScene={sessionRef?.activeScene ?? ""}
                      activePresetId={sessionRef?.activePresetId ?? null}
                      activeLayers={activeLayers}
                      onLayerChange={handleLayerChange}
                    />
                  ) : (
                    <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                      Load a session to configure ambience layers.
                    </p>
                  )}
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Waves size={11} style={{ color: "var(--scene-text-muted)" }} />
                      <span className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>Ambience Volume</span>
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
                </div>
              ) : (
                <div className="pt-3">
                  <SfxBoard playSfx={playSfx} />
                </div>
              )}
            </div>

            {/* Footer: master volume + sync */}
            <div className="space-y-3 border-t pt-3" style={{ borderColor: "var(--scene-border)" }}>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Volume2 size={11} style={{ color: "var(--scene-text-muted)" }} />
                  <span className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>Master Volume</span>
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
          </div>
        )}
      </section>

      {musicPickerSlot && musicPickerSlot !== "victory" && (
        <MusicSetPicker
          slot={musicPickerSlot}
          onSelect={(set) => handleMusicSetSelect(musicPickerSlot, set)}
          onClose={() => setMusicPickerSlot(null)}
        />
      )}

      {victoryPickerOpen && (
        <TrackPicker
          slot="victory"
          currentId={sessionRef?.activeVictoryTrackId ?? null}
          onSelect={(id) => handleVictoryTrackSelect(id)}
          onClose={() => setVictoryPickerOpen(false)}
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

  const ambienceLayers = useQuery(api.audio.listAmbienceLayers, { campaignId })

  const ambienceTrack = useQuery(
    api.audio.getAudioTrack,
    sessionAudio?.activeAmbienceTrackId ? { trackId: sessionAudio.activeAmbienceTrackId } : "skip"
  )

  const activeScene = sessionAudio?.activeScene ?? ""

  // Scene music set assignments
  const exploreSet = useQuery(
    api.audio.getSceneMusicSet,
    campaignId && activeScene ? { campaignId, sceneName: activeScene, mode: "explore" } : "skip"
  )
  const combatSet = useQuery(
    api.audio.getSceneMusicSet,
    campaignId && activeScene ? { campaignId, sceneName: activeScene, mode: "combat" } : "skip"
  )

  // Resolve explore track URLs
  const exploreLow = useQuery(api.audio.getAudioTrack, exploreSet?.lowTrackId ? { trackId: exploreSet.lowTrackId } : "skip")
  const exploreMed = useQuery(api.audio.getAudioTrack, exploreSet?.medTrackId ? { trackId: exploreSet.medTrackId } : "skip")
  const exploreHigh = useQuery(api.audio.getAudioTrack, exploreSet?.highTrackId ? { trackId: exploreSet.highTrackId } : "skip")

  // Resolve combat track URLs
  const combatLow = useQuery(api.audio.getAudioTrack, combatSet?.lowTrackId ? { trackId: combatSet.lowTrackId } : "skip")
  const combatMed = useQuery(api.audio.getAudioTrack, combatSet?.medTrackId ? { trackId: combatSet.medTrackId } : "skip")
  const combatHigh = useQuery(api.audio.getAudioTrack, combatSet?.highTrackId ? { trackId: combatSet.highTrackId } : "skip")

  const activeVictoryTrack = useQuery(
    api.audio.getAudioTrack,
    sessionAudio?.activeVictoryTrackId ? { trackId: sessionAudio.activeVictoryTrackId } : "skip"
  )

  const exploreTracks: MusicTrackSet = useMemo(() => ({
    low: exploreLow?.r2Url ?? null,
    med: exploreMed?.r2Url ?? null,
    high: exploreHigh?.r2Url ?? null,
  }), [exploreLow?.r2Url, exploreMed?.r2Url, exploreHigh?.r2Url])

  const combatTracks: MusicTrackSet = useMemo(() => ({
    low: combatLow?.r2Url ?? null,
    med: combatMed?.r2Url ?? null,
    high: combatHigh?.r2Url ?? null,
  }), [combatLow?.r2Url, combatMed?.r2Url, combatHigh?.r2Url])

  const victoryTracks: MusicTrackSet = useMemo(() => ({
    low: null,
    med: activeVictoryTrack?.r2Url ?? null,
    high: null,
  }), [activeVictoryTrack?.r2Url])

  const resolvedActiveLayers = useMemo(() => {
    const layerMap = new Map((ambienceLayers ?? []).map((layer) => [layer._id, layer] as const))
    return (sessionAudio?.activeLayers ?? [])
      .filter((layer) => layer.tier !== "off")
      .map((layer) => {
        const resolved = layerMap.get(layer.layerId)
        return {
          layerId: layer.layerId,
          url: resolved?.r2Url ?? "",
          volume: TIER_MULTIPLIERS[layer.tier] * ((sessionAudio?.ambienceVolume ?? 70) / 100),
        }
      })
      .filter((layer) => layer.url !== "")
  }, [ambienceLayers, sessionAudio?.activeLayers, sessionAudio?.ambienceVolume])

  const engineState = {
    ambienceUrl: ambienceTrack?.r2Url ?? null,
    activeLayers: resolvedActiveLayers,
    musicMode: (sessionAudio?.musicMode === "off" || sessionAudio?.musicMode === "explore" || sessionAudio?.musicMode === "combat")
      ? sessionAudio.musicMode
      : "off" as const,
    musicIntensity: Math.max(1, Math.min(5, sessionAudio?.musicIntensity ?? 3)),
    exploreTracks,
    combatTracks,
    victoryTracks,
    victoryCuedAt: sessionAudio?.victoryTriggeredAt ?? null,
    ambienceVolume: sessionAudio?.ambienceVolume ?? 70,
    masterVolume: localVolume,
  }

  useAudioEngine(engineState, synced && consentGiven && (sessionAudio?.audioSyncEnabled ?? false) && !(sessionAudio?.audioPaused ?? false))

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
