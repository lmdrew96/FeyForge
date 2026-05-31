// One-off geometry sanity check for the 3D dice. Run from project root:
//   npx tsx scripts/verify-dice-geo.ts
// Confirms every die mesh is outward-facing (no inverted normals), has no
// degenerate triangles, and is a closed 2-manifold (every edge shared by 2 tris).
import * as THREE from "three"
import { getDieGeometry } from "../components/dice/die-geometry"

const a = new THREE.Vector3()
const b = new THREE.Vector3()
const c = new THREE.Vector3()
const ab = new THREE.Vector3()
const ac = new THREE.Vector3()
const n = new THREE.Vector3()
const ctr = new THREE.Vector3()

let allOk = true
for (const s of ["d4", "d6", "d8", "d10", "d12", "d20"] as const) {
  const { geometry, unitScale } = getDieGeometry(s)
  const pos = geometry.getAttribute("position")
  // Honor the index buffer: stock primitives like BoxGeometry are indexed and
  // share vertices, so iterating raw positions would miscount triangles + edges.
  const index = geometry.getIndex()
  const triCount = index ? index.count / 3 : pos.count / 3
  const vAt = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k)
  const tris = triCount
  let inward = 0
  let degenerate = 0
  const edges = new Map<string, number>()
  const vk = (v: THREE.Vector3) =>
    `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`

  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(pos, vAt(t, 0))
    b.fromBufferAttribute(pos, vAt(t, 1))
    c.fromBufferAttribute(pos, vAt(t, 2))
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    n.crossVectors(ab, ac)
    if (n.length() < 1e-7) degenerate++
    ctr.copy(a).add(b).add(c).multiplyScalar(1 / 3)
    if (n.dot(ctr) < 0) inward++ // normal points toward origin = inward-facing
    const vs = [vk(a), vk(b), vk(c)]
    for (let e = 0; e < 3; e++) {
      const ek = [vs[e], vs[(e + 1) % 3]].sort().join("|")
      edges.set(ek, (edges.get(ek) ?? 0) + 1)
    }
  }
  let nonManifold = 0
  edges.forEach((cnt) => {
    if (cnt !== 2) nonManifold++
  })
  geometry.computeBoundingSphere()
  const r = geometry.boundingSphere!.radius
  const ok = inward === 0 && degenerate === 0 && nonManifold === 0
  if (!ok) allOk = false
  console.log(
    `${s.padEnd(4)} tris=${String(tris).padStart(3)} inward=${inward} ` +
      `degenerate=${degenerate} nonManifoldEdges=${nonManifold} ` +
      `r=${r.toFixed(3)} unitScale=${unitScale.toFixed(3)} ${ok ? "OK" : "*** CHECK ***"}`,
  )
}
console.log(allOk ? "\nALL GEOMETRY OK" : "\nGEOMETRY ISSUES FOUND")
process.exit(allOk ? 0 : 1)
