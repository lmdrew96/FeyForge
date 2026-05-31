import * as THREE from "three"

// Maps a die's side count to the polyhedron we render. A d100 is shown on the
// classic d10 (pentagonal trapezohedron) silhouette — the floating number
// carries the full 1–100 value, so one mesh covers both.
export type DieShape = "d4" | "d6" | "d8" | "d10" | "d12" | "d20"

export function shapeForSides(sides: number): DieShape {
  if (sides === 4) return "d4"
  if (sides === 6) return "d6"
  if (sides === 8) return "d8"
  if (sides === 10 || sides === 100) return "d10"
  if (sides === 12) return "d12"
  return "d20"
}

// ── Pentagonal trapezohedron (the d10) ───────────────────────────────────────
// Not a three.js primitive, so we build it by hand: two apex points (top/bottom)
// and a 10-vertex zig-zag equator (5 raised, 5 lowered, alternating). Each of the
// 10 faces is a kite touching exactly one apex. Built non-indexed so flat shading
// gives crisp facets; winding is corrected per-triangle so every normal points
// outward (the solid is convex and centered on the origin).
function makeD10Geometry(): THREE.BufferGeometry {
  const R = 1 // equator radius
  const h = 0.26 // equator vertical offset (the zig-zag)
  const H = 1.18 // apex height

  const top = new THREE.Vector3(0, H, 0)
  const bottom = new THREE.Vector3(0, -H, 0)

  const upper: THREE.Vector3[] = []
  const lower: THREE.Vector3[] = []
  for (let j = 0; j < 5; j++) {
    const aUp = (j * 2 * Math.PI) / 5
    const aLo = aUp + Math.PI / 5 // offset 36° so the equator zig-zags
    upper.push(new THREE.Vector3(R * Math.cos(aUp), h, R * Math.sin(aUp)))
    lower.push(new THREE.Vector3(R * Math.cos(aLo), -h, R * Math.sin(aLo)))
  }

  const tris: THREE.Vector3[][] = []
  for (let j = 0; j < 5; j++) {
    const jn = (j + 1) % 5
    // Top kite: top apex + upper[j] + lower[j] + upper[j+1]
    tris.push([top, upper[j], lower[j]])
    tris.push([top, lower[j], upper[jn]])
    // Bottom kite: bottom apex + lower[j] + upper[j+1] + lower[j+1]
    tris.push([bottom, lower[j], upper[jn]])
    tris.push([bottom, upper[jn], lower[jn]])
  }

  const positions: number[] = []
  const centroid = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  const normal = new THREE.Vector3()
  for (const [a, b, c] of tris) {
    // Flip winding if the face normal points inward (toward the origin).
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    normal.crossVectors(ab, ac)
    centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3)
    const ordered = normal.dot(centroid) < 0 ? [a, c, b] : [a, b, c]
    for (const v of ordered) positions.push(v.x, v.y, v.z)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}

// ── Geometry cache ────────────────────────────────────────────────────────────
// Geometries are immutable and shared across every mesh + every roll (meshes
// carry their own transform/material), so we build each shape once and keep it.
// boundingSphere is precomputed so the scene can normalize each die to a common
// on-screen size.

interface CachedGeometry {
  geometry: THREE.BufferGeometry
  /** Shared facet-edge geometry for crisp outlines (reused across meshes). */
  edges: THREE.EdgesGeometry
  /** Scale that maps this geometry's bounding sphere to unit radius. */
  unitScale: number
}

const cache = new Map<DieShape, CachedGeometry>()

export function getDieGeometry(shape: DieShape): CachedGeometry {
  const cached = cache.get(shape)
  if (cached) return cached

  let geometry: THREE.BufferGeometry
  switch (shape) {
    case "d4":
      geometry = new THREE.TetrahedronGeometry(1)
      break
    case "d6":
      geometry = new THREE.BoxGeometry(1.25, 1.25, 1.25)
      break
    case "d8":
      geometry = new THREE.OctahedronGeometry(1)
      break
    case "d10":
      geometry = makeD10Geometry()
      break
    case "d12":
      geometry = new THREE.DodecahedronGeometry(1)
      break
    case "d20":
      geometry = new THREE.IcosahedronGeometry(1)
      break
  }

  geometry.computeBoundingSphere()
  const radius = geometry.boundingSphere?.radius ?? 1
  // thresholdAngle 18° keeps each polyhedron's true facet seams while suppressing
  // the internal triangulation of curved-ish faces (d10 kites, dodeca pentagons).
  const edges = new THREE.EdgesGeometry(geometry, 18)
  const result: CachedGeometry = { geometry, edges, unitScale: 1 / radius }
  cache.set(shape, result)
  return result
}
