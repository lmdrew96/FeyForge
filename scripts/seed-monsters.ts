/**
 * SRD monster seeder — bakes the full SRD-2014 creature set from Open5e's
 * /v2/creatures into a bundled JSON file so the combat tracker never depends on
 * the live (volunteer-run, occasionally-down) api.open5e.com at play time.
 *
 * Fetches every srd-2014 creature, maps each through the SAME v2CreatureToMonster
 * boundary the app uses (lib/open5e-api.ts), and writes lib/data/srd-monsters.json.
 * Attack prose is left as-is (name + desc); the runtime parser (lib/monster-attacks)
 * still derives rollable attacks on demand, so the bundled shape is exactly what
 * getMonsters() already returns. Re-run whenever you want to refresh the snapshot.
 *
 * Usage:
 *   npx tsx scripts/seed-monsters.ts
 *
 * No env/secrets required — a read-only fetch from Open5e plus one local file write.
 * (Open5e sits behind Cloudflare and 403s the default Node fetch UA, so we send a
 * browser-like User-Agent.)
 */

import * as fs from "fs"
import * as path from "path"
// Relative (not "@/…") — tsx doesn't resolve tsconfig path aliases here.
import { v2CreatureToMonster, type Open5eMonster } from "../lib/open5e-api"

const API = "https://api.open5e.com/v2/creatures/"
const DOC = "srd-2014"
const UA = "Mozilla/5.0 (compatible; FeyForge-seed/1.0; +https://feyforge.adhdesigns.dev)"
const OUT = path.join(__dirname, "..", "lib", "data", "srd-monsters.json")

async function fetchAll(): Promise<unknown[]> {
  const out: unknown[] = []
  let url: string | null = `${API}?document__key=${DOC}&limit=100`
  let page = 1
  while (url) {
    process.stdout.write(`  fetching page ${page}…\r`)
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } })
    if (!res.ok) throw new Error(`Open5e ${res.status} on ${url}`)
    const data = (await res.json()) as { next: string | null; results: unknown[] }
    out.push(...data.results)
    url = data.next
    page++
  }
  return out
}

async function main() {
  console.log("Fetching SRD-2014 creatures from Open5e…")
  const raw = await fetchAll()
  console.log(`\nFetched ${raw.length} creatures.`)

  const monsters: Open5eMonster[] = raw.map((c) => v2CreatureToMonster(c as never))
  // Stable sort by name so re-seeds produce clean, reviewable diffs.
  monsters.sort((a, b) => a.name.localeCompare(b.name))

  const missing = monsters.filter((m) => !m.slug || !m.name)
  if (missing.length) throw new Error(`${missing.length} creatures missing slug/name`)

  const withActions = monsters.filter((m) => (m.actions?.length ?? 0) > 0).length
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(monsters) + "\n")
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0)
  console.log(
    `Wrote ${monsters.length} monsters (${withActions} with actions) → ` +
      `${path.relative(process.cwd(), OUT)} (${kb} KB)`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
