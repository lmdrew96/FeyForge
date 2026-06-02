/**
 * Tag hand-curated premium maps with their vibe axes (interactive).
 *
 * Manual-curation workflow (we drive Azgaar BY HAND — its UI renders perfectly,
 * unlike headless automation): generate maps you like in Azgaar's web app, Export
 * each as BOTH a `.map` and a `.png` image into `maps/premium-src/`, then run this
 * to tag each with its 4 vibe axes. It writes `maps/premium-src/manifest.json`,
 * which `pnpm seed:premium` ingests as premium-preset worldMaps.
 *
 * See docs/specs/feyforge-premium-map-curation.md for which Azgaar options produce
 * which vibe (frozen / arid / archipelago / …).
 *
 *   npx tsx scripts/tag-premium.ts            # tag any new (untagged) maps
 *   npx tsx scripts/tag-premium.ts --retag    # re-tag everything from scratch
 */
import * as fs from "fs"
import * as path from "path"
import * as readline from "node:readline/promises"
import { stdin, stdout } from "node:process"
import {
  VIBE_SHAPES,
  VIBE_CLIMATES,
  VIBE_CIVILIZATIONS,
  VIBE_SCALES,
  VIBE_LABELS,
  vibeName,
  type Vibe,
  type VibeShape,
  type VibeClimate,
  type VibeCivilization,
  type VibeScale,
} from "../lib/worldMap/vibe"

const SRC_DIR = "maps/premium-src"
const MANIFEST = path.join(SRC_DIR, "manifest.json")

type Entry = {
  slug: string // sanitized — R2 key + DB upsert key (unique)
  file: string // original filename base — locates the local .map/.png
  name: string
  vibeShape: VibeShape
  vibeClimate: VibeClimate
  vibeCivilization: VibeCivilization
  vibeScale: VibeScale
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "map"

function loadManifest(): Map<string, Entry> {
  if (!fs.existsSync(MANIFEST)) return new Map()
  try {
    const arr = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Entry[]
    return new Map(arr.map((e) => [e.slug, e]))
  } catch {
    return new Map()
  }
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    fs.mkdirSync(SRC_DIR, { recursive: true })
    console.log(`Created ${SRC_DIR}/`)
    console.log(`Drop your Azgaar exports here as paired <name>.map + <name>.png, then re-run.`)
    return
  }

  const mapFiles = fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.toLowerCase().endsWith(".map"))
    .sort()
  if (mapFiles.length === 0) {
    console.log(`No .map files in ${SRC_DIR}/. Export maps from Azgaar (.map + .png) there first.`)
    return
  }

  const retag = process.argv.includes("--retag")
  const manifest = loadManifest()

  const rl = readline.createInterface({ input: stdin, output: stdout })
  const ask = async (q: string) => (await rl.question(q)).trim()
  async function pick<T extends readonly string[]>(
    label: string,
    options: T,
    labels: Record<T[number], string>,
  ): Promise<T[number]> {
    for (;;) {
      console.log(`\n${label}:`)
      options.forEach((o, i) => console.log(`  ${i + 1}) ${labels[o as T[number]]}`))
      const n = parseInt(await ask("  → "), 10)
      if (n >= 1 && n <= options.length) return options[n - 1] as T[number]
      console.log(`  (enter 1–${options.length})`)
    }
  }

  let tagged = 0
  for (const mapFile of mapFiles) {
    const base = mapFile.replace(/\.map$/i, "")
    const slug = slugify(base)
    if (!fs.existsSync(path.join(SRC_DIR, `${base}.png`))) {
      console.log(`\n⚠️  ${mapFile}: no paired ${base}.png — skipping (export the image too).`)
      continue
    }
    if (manifest.has(slug) && !retag) {
      console.log(`\n✓ ${base} already tagged (${manifest.get(slug)!.name}) — skip (--retag to redo).`)
      continue
    }

    console.log(`\n${"─".repeat(52)}\nTagging: ${mapFile}`)
    const shape = await pick("Shape of the world", VIBE_SHAPES, VIBE_LABELS.shape)
    const climate = await pick("Climate", VIBE_CLIMATES, VIBE_LABELS.climate)
    const civilization = await pick("Civilization", VIBE_CIVILIZATIONS, VIBE_LABELS.civilization)
    const scale = await pick("Scale", VIBE_SCALES, VIBE_LABELS.scale)
    const vibe: Vibe = { shape, climate, civilization, scale }
    const defName = vibeName(vibe)
    const name = (await ask(`Name [${defName}]: `)) || defName

    manifest.set(slug, {
      slug,
      file: base,
      name,
      vibeShape: shape,
      vibeClimate: climate,
      vibeCivilization: civilization,
      vibeScale: scale,
    })
    tagged++
    console.log(`  ✓ ${name} — ${shape} / ${climate} / ${civilization} / ${scale}`)
  }
  rl.close()

  const arr = [...manifest.values()].sort((a, b) => a.slug.localeCompare(b.slug))
  fs.writeFileSync(MANIFEST, JSON.stringify(arr, null, 2))
  console.log(`\n${"─".repeat(52)}`)
  console.log(`Tagged ${tagged} new map(s). Manifest now has ${arr.length}. → ${MANIFEST}`)
  if (arr.length > 0) console.log(`Next: pnpm seed:premium  (uploads + seeds them)`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
