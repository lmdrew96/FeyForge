import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type WheelEvent as ReactWheelEvent,
} from "react"
import {
  MIN_ZOOM,
  MAX_ZOOM,
  clampPanToViewport,
  panToAnchorZoom,
  usePinchZoom,
} from "./shared"

// ── Pan / zoom view transform ──────────────────────────────────────────────────
// Owns the zoom + pan state, the image/viewport refs, the pinch-zoom handler, and
// the wheel/center/fit math. Drag panning is exposed as primitives (beginPan/
// movePan/endPan/dragMoved) so the workspace's composite pointer handlers — which
// also coordinate fog painting and pin placement — drive it through a clean
// interface rather than poking the drag ref directly. screenToPercent lives here
// too (it measures against imgRef), and the fog brush consumes it.

export function usePanZoom(opts: { imageStorageKey: string }) {
  const { imageStorageKey } = opts

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null)

  const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))

  // Default/reset view = fill the frame HEIGHT, not the browser's contain default
  // (which fits a wide map to width, leaving it tiny on a portrait phone). The
  // base <img> is contain-sized, so offsetHeight is its scale-1 height; scaling
  // clientHeight/offsetHeight makes it exactly fill vertically. ≈1 (no-op) on wide
  // desktop frames where height already binds. Pan recenters.
  const fitToView = useCallback(() => {
    const img = imgRef.current
    const vp = viewportRef.current
    if (!img || !vp || !img.offsetHeight) return
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, vp.clientHeight / img.offsetHeight)))
    setPan({ x: 0, y: 0 })
  }, [])

  // Cached images may be `complete` before React fires onLoad, so fit on mount too
  // (and whenever the map image changes). onLoad covers the fresh-load path.
  useEffect(() => {
    if (imgRef.current?.complete) fitToView()
  }, [fitToView, imageStorageKey])

  // Live refs so the pinch handler reads current zoom/pan between renders.
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const panRef = useRef(pan)
  panRef.current = pan
  const pinch = usePinchZoom({ zoomRef, panRef, setZoom, setPan, clampZoom, imgRef, viewportRef })

  // Whenever zoom changes (wheel, buttons, reset, centering), pull pan back into
  // bounds — zooming out should reclaim empty edge space rather than stranding the
  // map off-center. Drag-time clamping is handled inline in movePan.
  useEffect(() => {
    setPan((p) => clampPanToViewport(p, zoom, imgRef.current, viewportRef.current))
  }, [zoom])

  // Click → map-relative percent. Measured against the IMAGE element, which is the
  // exact box pins are positioned within (left/top %), so placement is exact at any
  // zoom/pan and aspect ratio.
  const screenToPercent = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const img = imgRef.current
    if (!img) return null
    const rect = img.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const x = ((clientX - rect.left) / rect.width) * 100
    const y = ((clientY - rect.top) / rect.height) * 100
    if (x < 0 || x > 100 || y < 0 || y > 100) return null
    return { x, y }
  }

  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const nz = clampZoom(zoom * (1 + -e.deltaY * 0.0015))
    // Anchor the zoom to the cursor (not the map center) so the spot under the
    // pointer stays put. Pre-clamped to the viewport; both set as absolute values.
    if (nz !== zoom) setPan(panToAnchorZoom(e, zoom, nz, pan, imgRef.current, viewportRef.current))
    setZoom(nz)
  }

  // Center the view on a map coord (% of the rendered image). After scaling about
  // the layer's center, a point d px from center sits d*zoom from center, so
  // pan=-d*zoom brings it to the middle. No-op if the image isn't ready yet.
  const centerOn = (x: number, y: number) => {
    const img = imgRef.current
    if (!img) return
    const z = clampZoom(Math.max(zoom, 1.8))
    const dx = ((x - 50) / 100) * img.offsetWidth
    const dy = ((y - 50) / 100) * img.offsetHeight
    setZoom(z)
    setPan(clampPanToViewport({ x: -dx * z, y: -dy * z }, z, imgRef.current, viewportRef.current))
  }

  // ── Drag-pan primitives ─────────────────────────────────────────────────────
  const beginPan = (clientX: number, clientY: number) => {
    dragState.current = { sx: clientX, sy: clientY, px: pan.x, py: pan.y, moved: false }
  }
  const movePan = (clientX: number, clientY: number) => {
    const d = dragState.current
    if (!d) return
    const dx = clientX - d.sx
    const dy = clientY - d.sy
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true
    setPan(clampPanToViewport({ x: d.px + dx, y: d.py + dy }, zoom, imgRef.current, viewportRef.current))
  }
  const endPan = () => {
    dragState.current = null
  }
  // Did the last interaction actually move (a pan), vs. a stationary click?
  const dragMoved = () => dragState.current?.moved ?? false

  return {
    zoom,
    setZoom,
    pan,
    imgRef,
    viewportRef,
    clampZoom,
    fitToView,
    centerOn,
    screenToPercent,
    handleWheel,
    pinch,
    beginPan,
    movePan,
    endPan,
    dragMoved,
  }
}
