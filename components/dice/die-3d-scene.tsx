"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { DIE_COLORS, Die } from "./die"
import { getDieGeometry, shapeForSides } from "./die-geometry"

// ── Tunables (world units) ────────────────────────────────────────────────────
// The orthographic camera reframes the grid to the canvas every resize, so these
// ratios hold at any die count / screen size.
const CELL = 1.0 // grid cell size
const DIE_RADIUS = 0.42 // each die normalized to this radius (diameter 0.84)
const NUMBER_SIZE = 0.62 // billboard sprite height for the floating value
const MAX_COLS = 6
const SETTLE_MS = 460 // keep rendering this long after a roll so dice ease to rest

export interface SceneDie {
  sides: number
  value: number
  dropped: boolean
}

interface DiceSceneProps {
  dice: SceneDie[]
  rolling: boolean
  /** Show the floating value on each die. False for a single die with no
   *  modifier, where the big total above already shows that exact number. */
  showNumbers: boolean
}

// ── Floating-number textures ──────────────────────────────────────────────────
// One canvas texture per face value, cached and shared across every die + roll.
// White glyph with a dark outline so it reads on any die color; Cinzel when ready.

const textureCache = new Map<number, THREE.CanvasTexture>()

function cinzelFamily(): string {
  if (typeof window === "undefined") return "serif"
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-cinzel")
    .trim()
  return v ? `${v}, serif` : "Cinzel, serif"
}

function numberTexture(value: number): THREE.CanvasTexture {
  const cached = textureCache.get(value)
  if (cached) return cached

  const S = 256
  const cv = document.createElement("canvas")
  cv.width = S
  cv.height = S
  const ctx = cv.getContext("2d")!
  const family = cinzelFamily()
  const text = String(value)

  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  // Shrink until it fits so "100" on a d100 doesn't overflow the texture.
  let fontSize = 168
  do {
    ctx.font = `700 ${fontSize}px ${family}`
    if (ctx.measureText(text).width <= S * 0.82) break
    fontSize -= 8
  } while (fontSize > 48)
  ctx.font = `700 ${fontSize}px ${family}`

  const cx = S / 2
  const cy = S / 2 + fontSize * 0.04
  ctx.lineJoin = "round"
  ctx.lineWidth = fontSize * 0.16
  ctx.strokeStyle = "rgba(0,0,0,0.72)"
  ctx.strokeText(text, cx, cy)
  ctx.fillStyle = "#ffffff"
  ctx.fillText(text, cx, cy)

  const tex = new THREE.CanvasTexture(cv)
  tex.anisotropy = 4
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  textureCache.set(value, tex)
  return tex
}

// ── Per-die scene objects ─────────────────────────────────────────────────────

interface DieObject {
  group: THREE.Group
  mesh: THREE.Mesh
  sprite: THREE.Sprite
  rest: THREE.Quaternion
  spin: { x: number; y: number; z: number }
  /** Materials this die owns (geometry + edges are shared and not disposed). */
  owned: { dispose: () => void }[]
}

function critHighlight(die: SceneDie): "nat20" | "nat1" | null {
  if (die.sides !== 20 || die.dropped) return null
  if (die.value === 20) return "nat20"
  if (die.value === 1) return "nat1"
  return null
}

function buildDie(die: SceneDie, seed: number): DieObject {
  const shape = shapeForSides(die.sides)
  const { geometry, edges, unitScale } = getDieGeometry(shape)
  const baseColor = DIE_COLORS[die.sides] ?? "#8a8a8a"
  const highlight = critHighlight(die)
  const glow =
    highlight === "nat20" ? baseColor : highlight === "nat1" ? "#ef4444" : null

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseColor),
    flatShading: true,
    metalness: 0.18,
    roughness: 0.42,
    emissive: new THREE.Color(glow ?? "#000000"),
    emissiveIntensity: glow ? 0.55 : 0,
    transparent: die.dropped,
    opacity: die.dropped ? 0.32 : 1,
  })

  const scale = unitScale * DIE_RADIUS
  const mesh = new THREE.Mesh(geometry, material)
  mesh.scale.setScalar(scale)

  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: die.dropped ? 0.12 : 0.28,
  })
  const lines = new THREE.LineSegments(edges, lineMaterial)
  mesh.add(lines) // inherits the mesh's scale + tumble

  const texture = numberTexture(die.value)
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: die.dropped ? 0.4 : 1,
  })
  const sprite = new THREE.Sprite(spriteMaterial)
  sprite.position.set(0, 0, DIE_RADIUS + 0.05)
  sprite.scale.setScalar(NUMBER_SIZE)
  sprite.renderOrder = 10

  const group = new THREE.Group()
  group.add(mesh)
  group.add(sprite)

  // Stable per-die randomness so a handful don't tumble in lockstep, and each
  // settles at its own resting angle.
  const r1 = mulberry32(seed)
  const spin = {
    x: (r1() * 2 - 1) * 9,
    y: (r1() * 2 - 1) * 9,
    z: (r1() * 2 - 1) * 5,
  }
  const r2 = mulberry32(seed * 7 + 13)
  const rest = new THREE.Quaternion().setFromEuler(
    new THREE.Euler((r2() - 0.5) * 0.7, r2() * Math.PI * 2, (r2() - 0.5) * 0.5),
  )
  mesh.quaternion.copy(rest) // start settled (first paint + reduced-motion)

  return {
    group,
    mesh,
    sprite,
    rest,
    spin,
    owned: [material, lineMaterial, spriteMaterial],
  }
}

// ── The renderer controller (vanilla three.js, no react-three-fiber) ──────────
// Encapsulates the WebGL renderer, scene graph, animation loop, and disposal so
// the React component just feeds it props. Lives outside React's render cycle —
// no per-frame re-renders, and a single WebGL context for the whole result area
// (one-canvas-per-die would blow iOS Safari's context cap on a big handful).

class DiceRenderer {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  private dice: DieObject[] = []
  private cols = 1
  private rows = 1

  private raf = 0
  private lastTime = 0
  private rolling = false
  private showNumbers = true
  private settleUntil = 0
  private disposed = false

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 0)

    this.camera.position.set(0, 0, 10)
    this.camera.lookAt(0, 0, 0)

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.78))
    const key = new THREE.DirectionalLight(0xffffff, 1.7)
    key.position.set(3, 5, 6)
    this.scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.5)
    fill.position.set(-4, -2, 2)
    this.scene.add(fill)
  }

  setDice(list: SceneDie[], showNumbers: boolean): void {
    this.clearDice()
    this.showNumbers = showNumbers
    const n = list.length
    this.cols = Math.min(n, MAX_COLS) || 1
    this.rows = Math.ceil(n / this.cols) || 1

    list.forEach((die, i) => {
      const obj = buildDie(die, i + 1)
      const col = i % this.cols
      const row = Math.floor(i / this.cols)
      obj.group.position.set(
        (col - (this.cols - 1) / 2) * CELL,
        ((this.rows - 1) / 2 - row) * CELL,
        0,
      )
      obj.sprite.visible = this.showNumbers && !this.rolling
      this.scene.add(obj.group)
      this.dice.push(obj)
    })
    this.refit()
    this.renderOnce()
  }

  setRolling(rolling: boolean): void {
    this.rolling = rolling
    if (rolling) {
      this.settleUntil = Infinity
      for (const d of this.dice) d.sprite.visible = false
      this.start()
    } else {
      this.settleUntil = performance.now() + SETTLE_MS
      for (const d of this.dice) d.sprite.visible = this.showNumbers
      this.start() // run the loop out to ease everything to rest
    }
  }

  resize(width: number, height: number): void {
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    this.refit()
    this.renderOnce()
  }

  // Fit the grid to the canvas (letterboxed, centered) given its pixel aspect.
  private refit(): void {
    const size = new THREE.Vector2()
    this.renderer.getSize(size)
    const aspect = size.height ? size.width / size.height : 1
    const margin = 1.18
    const worldW = this.cols * CELL * margin
    const worldH = this.rows * CELL * margin
    let halfW = worldW / 2
    let halfH = worldH / 2
    if (worldW / worldH > aspect) halfH = halfW / aspect
    else halfW = halfH * aspect
    this.camera.left = -halfW
    this.camera.right = halfW
    this.camera.top = halfH
    this.camera.bottom = -halfH
    this.camera.updateProjectionMatrix()
  }

  private start(): void {
    if (this.raf || this.disposed) return
    this.lastTime = performance.now()
    const loop = (now: number) => {
      const delta = Math.min((now - this.lastTime) / 1000, 0.05)
      this.lastTime = now
      this.step(delta)
      this.renderOnce()
      if (this.rolling || now < this.settleUntil) {
        this.raf = requestAnimationFrame(loop)
      } else {
        // Snap to exact rest and idle the loop.
        for (const d of this.dice) d.mesh.quaternion.copy(d.rest)
        this.renderOnce()
        this.raf = 0
      }
    }
    this.raf = requestAnimationFrame(loop)
  }

  private step(delta: number): void {
    for (const d of this.dice) {
      if (this.rolling) {
        d.mesh.rotateX(delta * d.spin.x)
        d.mesh.rotateY(delta * d.spin.y)
        d.mesh.rotateZ(delta * d.spin.z)
      } else {
        d.mesh.quaternion.slerp(d.rest, Math.min(1, delta * 9))
      }
    }
  }

  private renderOnce(): void {
    if (!this.disposed) this.renderer.render(this.scene, this.camera)
  }

  private clearDice(): void {
    for (const d of this.dice) {
      this.scene.remove(d.group)
      for (const m of d.owned) m.dispose()
    }
    this.dice = []
  }

  dispose(): void {
    this.disposed = true
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.clearDice()
    this.renderer.dispose()
  }
}

// ── React wrapper ─────────────────────────────────────────────────────────────

export function DiceScene({ dice, rolling, showNumbers }: DiceSceneProps) {
  // WebGL can't render on the server, so paint the lightweight CSS dice until the
  // canvas mounts (also covers a WebGL-less / context-creation-failed environment).
  const [mounted, setMounted] = useState(false)
  const [failed, setFailed] = useState(false)
  const [fontTick, setFontTick] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<DiceRenderer | null>(null)

  useEffect(() => setMounted(true), [])

  // Redraw number textures once the brand font loads (first roll may otherwise
  // bake the serif fallback).
  useEffect(() => {
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (cancelled) return
      textureCache.forEach((t) => t.dispose())
      textureCache.clear()
      setFontTick((n) => n + 1)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Create the renderer once the canvas exists; tear it down on unmount.
  useEffect(() => {
    if (!mounted || !canvasRef.current || !wrapRef.current) return
    let renderer: DiceRenderer
    try {
      renderer = new DiceRenderer(canvasRef.current)
    } catch {
      setFailed(true)
      return
    }
    rendererRef.current = renderer

    const wrap = wrapRef.current
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect()
      renderer.resize(r.width, r.height)
    })
    ro.observe(wrap)
    const rect = wrap.getBoundingClientRect()
    renderer.resize(rect.width, rect.height)

    return () => {
      ro.disconnect()
      renderer.dispose()
      rendererRef.current = null
    }
  }, [mounted])

  // Feed dice → renderer (rebuilds meshes). fontTick forces a texture refresh
  // after the brand font loads.
  useEffect(() => {
    rendererRef.current?.setDice(dice, showNumbers)
  }, [dice, showNumbers, fontTick])

  // Feed rolling state → renderer (drives the tumble / settle).
  useEffect(() => {
    rendererRef.current?.setRolling(rolling)
  }, [rolling])

  const n = dice.length
  const cols = Math.min(n, MAX_COLS) || 1
  const rows = Math.ceil(n / cols) || 1
  const height = rows === 1 ? 120 : rows === 2 ? 168 : 210

  if (!mounted || failed) {
    return (
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {dice.map((d, i) => (
          <Die
            key={i}
            sides={d.sides}
            value={showNumbers ? d.value : undefined}
            dimmed={d.dropped}
          />
        ))}
      </div>
    )
  }

  return (
    <div ref={wrapRef} style={{ width: "100%", height, touchAction: "none" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  )
}

// Tiny deterministic PRNG so each die's tumble is stable across re-renders.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
