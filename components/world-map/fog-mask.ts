// Manual fog brush (Phase 2) — grid + mask encoding shared by the world-map page
// (painting) and the FogOverlay (rendering). The DM paints cells permanently
// OPEN, decoupled from pins; the mask is stored as a compact scalar on the map
// row (worldMaps.fogMask) and unioned with the per-pin auto clearings.
//
// Fixed 64×36 grid: matches the ~1.83:1 aspect of the standard preset maps
// (1512×828) so cells stay roughly square, and a FIXED size means the bitmask
// decodes without needing the map dimensions. Uploaded maps of other aspects
// still work — cells just distort slightly, which is invisible at brush scale.

export const FOG_GRID_COLS = 64
export const FOG_GRID_ROWS = 36
const TOTAL = FOG_GRID_COLS * FOG_GRID_ROWS // 2304 cells → 288 bytes → ~384 b64 chars

export function emptyMask(): boolean[] {
  return new Array<boolean>(TOTAL).fill(false)
}

export function isMaskEmpty(cells: boolean[]): boolean {
  for (let i = 0; i < cells.length; i++) if (cells[i]) return false
  return true
}

// boolean[] → base64 bitmask. btoa/atob are available in the browser and in the
// Node 18+ SSR runtime; encode only ever runs in a client event handler anyway.
export function encodeFogMask(cells: boolean[]): string {
  const bytes = new Uint8Array(Math.ceil(TOTAL / 8))
  for (let i = 0; i < TOTAL; i++) {
    if (cells[i]) bytes[i >> 3] |= 1 << (i & 7)
  }
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

// base64 bitmask → boolean[] of length TOTAL. undefined / corrupt → all-false.
export function decodeFogMask(s: string | undefined | null): boolean[] {
  const cells = emptyMask()
  if (!s) return cells
  try {
    const bin = atob(s)
    for (let i = 0; i < TOTAL; i++) {
      const byte = bin.charCodeAt(i >> 3)
      if (byte & (1 << (i & 7))) cells[i] = true
    }
  } catch {
    // Corrupt string → treat as nothing painted.
  }
  return cells
}

// Stamp a circular brush of `radius` cells at a normalized (0–100) point,
// setting cells to `open` (paint = true, erase = false). Returns a NEW array.
export function paintBrush(
  cells: boolean[],
  xPct: number,
  yPct: number,
  radius: number,
  open: boolean,
): boolean[] {
  const col = Math.min(FOG_GRID_COLS - 1, Math.max(0, Math.floor((xPct / 100) * FOG_GRID_COLS)))
  const row = Math.min(FOG_GRID_ROWS - 1, Math.max(0, Math.floor((yPct / 100) * FOG_GRID_ROWS)))
  const next = cells.slice()
  const rr = (radius + 0.25) * (radius + 0.25) // slightly rounded disc
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > rr) continue
      const c = col + dx
      const r = row + dy
      if (c < 0 || c >= FOG_GRID_COLS || r < 0 || r >= FOG_GRID_ROWS) continue
      next[r * FOG_GRID_COLS + c] = open
    }
  }
  return next
}

// Merge each row's painted cells into horizontal run-rects (in viewBox px), so a
// fully-painted map is ~36 rects instead of 2304 — keeps the SVG mask cheap to
// composite under pan/zoom.
export function maskRunsFromCells(
  cells: boolean[],
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number }[] {
  const cellW = width / FOG_GRID_COLS
  const cellH = height / FOG_GRID_ROWS
  const runs: { x: number; y: number; w: number; h: number }[] = []
  for (let row = 0; row < FOG_GRID_ROWS; row++) {
    let start = -1
    for (let col = 0; col <= FOG_GRID_COLS; col++) {
      const on = col < FOG_GRID_COLS && !!cells[row * FOG_GRID_COLS + col]
      if (on && start === -1) {
        start = col
      } else if (!on && start !== -1) {
        runs.push({
          x: start * cellW,
          y: row * cellH,
          w: (col - start) * cellW,
          h: cellH,
        })
        start = -1
      }
    }
  }
  return runs
}
