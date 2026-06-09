import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from "sonner"
import {
  decodeFogMask,
  encodeFogMask,
  emptyMask,
  isMaskEmpty,
  paintBrush,
} from "./fog-mask"
import { DEFAULT_FOG_RADIUS, type WorldMap, type MapLocation, type CampaignId } from "./shared"

// ── Fog of war (display + manual brush) ────────────────────────────────────────
// All fog state, the debounce-flush timer, and the three stale-closure-guarding
// refs live here so the workspace consumes a clean interface and the timing-
// sensitive logic stays in one fog-only file.
//
// The painted-open mask is a 64×36 boolean grid. We keep a local optimistic copy
// (maskCells) and debounce-flush it to paintFog; the server value reaches every
// member via getMap. latestCellsRef holds the freshest array so a fast drag chains
// dabs synchronously (before React re-renders) and the flush reads the latest.
// pendingRef + paintMode gate the resync so an in-flight server echo can't clobber
// a stroke mid-paint. paintingRef tracks whether a pointer stroke is live — the
// workspace drives it only through the begin/move/end/cancelStroke primitives.

export type PaintMode = "off" | "paint" | "erase"

export interface UseFogPainting {
  // Display
  painting: boolean
  showFog: boolean
  fogPins: { x: number; y: number }[]
  fogRadius: number
  fogPreview: boolean
  setFogPreview: Dispatch<SetStateAction<boolean>>
  maskCells: boolean[]
  // Paint controls
  paintMode: PaintMode
  setPaintMode: Dispatch<SetStateAction<PaintMode>>
  brushSize: number
  setBrushSize: Dispatch<SetStateAction<number>>
  startPaint: () => void
  stopPaint: () => void
  clearPaint: () => void
  // Pointer-stroke primitives — the workspace's pointer handlers call these instead
  // of touching the internal refs directly.
  beginStroke: (clientX: number, clientY: number) => void
  moveStroke: (clientX: number, clientY: number) => boolean
  endStroke: () => boolean
  cancelStroke: () => void
  // Fog settings (DM)
  handleToggleFog: () => Promise<void>
  handleFogRadius: (radius: number) => void
}

export function useFogPainting(opts: {
  campaignId: CampaignId
  map: WorldMap
  isDM: boolean
  locations: MapLocation[]
  // Map a screen point to map-relative percent (owned by the pan/zoom layer).
  screenToPercent: (clientX: number, clientY: number) => { x: number; y: number } | null
  // Called when a paint session starts, so the workspace can exit other authoring
  // modes (placing / moving a pin).
  onStartPaint?: () => void
}): UseFogPainting {
  const { campaignId, map, isDM, locations, screenToPercent, onStartPaint } = opts

  const setFogSettings = useMutation(api.worldMap.setFogSettings)
  const paintFog = useMutation(api.worldMap.paintFog)

  // The map row carries fogEnabled + fogRevealRadius; the DM can also toggle a
  // client-only "preview" to see the player's fogged view over their own map (DM
  // otherwise always sees the full map).
  const [fogPreview, setFogPreview] = useState(false)
  const fogRadius = map.fogRevealRadius ?? DEFAULT_FOG_RADIUS
  // Players (non-DM) hold only revealed pins; the DM preview must mimic that.
  const fogPins = useMemo(
    () => locations.filter((l) => l.revealed).map((l) => ({ x: l.x, y: l.y })),
    [locations],
  )

  const [paintMode, setPaintMode] = useState<PaintMode>("off")
  const [brushSize, setBrushSize] = useState(2)
  const [maskCells, setMaskCells] = useState<boolean[]>(() => decodeFogMask(map.fogMask))
  const latestCellsRef = useRef<boolean[]>(maskCells)
  const pendingRef = useRef(false)
  const paintingRef = useRef(false)
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const painting = paintMode !== "off" && isDM

  // Keep the chaining ref in sync with whatever's current (paint or server).
  useEffect(() => {
    latestCellsRef.current = maskCells
  }, [maskCells])

  // Resync from the server only when we hold no unsaved edits AND aren't mid
  // paint-session — otherwise a stale echo would drop dabs / flicker.
  useEffect(() => {
    if (pendingRef.current || paintMode !== "off") return
    setMaskCells(decodeFogMask(map.fogMask))
  }, [map.fogMask, paintMode])

  // Flush the latest mask to the server (empty mask → "" clears the field).
  const flushFog = () => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    const cells = latestCellsRef.current
    paintFog({ campaignId, fogMask: isMaskEmpty(cells) ? "" : encodeFogMask(cells) })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't save fog."))
      .finally(() => {
        pendingRef.current = false
      })
  }
  const scheduleFlush = () => {
    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(flushFog, 400)
  }
  useEffect(
    () => () => {
      if (flushTimer.current) clearTimeout(flushTimer.current)
    },
    [],
  )

  // Stamp the brush at a screen point (paint = open, erase = re-fog).
  const applyBrushAt = (clientX: number, clientY: number) => {
    const coords = screenToPercent(clientX, clientY)
    if (!coords) return
    const next = paintBrush(
      latestCellsRef.current,
      coords.x,
      coords.y,
      brushSize,
      paintMode === "paint",
    )
    latestCellsRef.current = next
    setMaskCells(next)
    pendingRef.current = true
    scheduleFlush()
  }

  const startPaint = () => {
    onStartPaint?.()
    setPaintMode("paint")
  }
  const stopPaint = () => {
    setPaintMode("off")
    if (pendingRef.current) flushFog()
  }
  const clearPaint = () => {
    const empty = emptyMask()
    latestCellsRef.current = empty
    setMaskCells(empty)
    pendingRef.current = true
    flushFog()
  }

  // ── Pointer-stroke primitives ───────────────────────────────────────────────
  const beginStroke = (clientX: number, clientY: number) => {
    paintingRef.current = true
    applyBrushAt(clientX, clientY)
  }
  const moveStroke = (clientX: number, clientY: number): boolean => {
    if (!paintingRef.current) return false
    applyBrushAt(clientX, clientY)
    return true
  }
  const endStroke = (): boolean => {
    if (!paintingRef.current) return false
    paintingRef.current = false
    if (pendingRef.current) flushFog()
    return true
  }
  const cancelStroke = () => {
    paintingRef.current = false
  }

  // Show fog to players whenever the DM enabled it; show it to the DM in preview OR
  // while painting (so the brush strokes are visible as they clear the shroud).
  const showFog = (map.fogEnabled ?? false) && (!isDM || fogPreview || painting)

  const handleToggleFog = async () => {
    const next = !(map.fogEnabled ?? false)
    try {
      await setFogSettings({ campaignId, fogEnabled: next })
      toast.success(next ? "Fog of war on — players see only explored areas." : "Fog of war off.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update fog.")
    }
  }

  const handleFogRadius = (radius: number) => {
    setFogSettings({ campaignId, fogRevealRadius: radius }).catch((err) =>
      toast.error(err instanceof Error ? err.message : "Couldn't update fog radius."),
    )
  }

  return {
    painting,
    showFog,
    fogPins,
    fogRadius,
    fogPreview,
    setFogPreview,
    maskCells,
    paintMode,
    setPaintMode,
    brushSize,
    setBrushSize,
    startPaint,
    stopPaint,
    clearPaint,
    beginStroke,
    moveStroke,
    endStroke,
    cancelStroke,
    handleToggleFog,
    handleFogRadius,
  }
}
