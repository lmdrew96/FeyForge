/**
 * BAKE PoC — drive Azgaar's Fantasy Map Generator HEADLESS to produce ONE map
 * (PNG + .map) from mapped "vibe" params, then validate the .map through our own
 * parser. Proves the premium-map-picker bake pipeline is viable BEFORE building
 * the full vibe matrix + picker UI.
 *
 * This is an OFFLINE dev script — Puppeteer never goes near production (per spec).
 * Run on a machine with a browser:  npx tsx scripts/bake-poc.ts
 *
 * ── Azgaar mechanism (verified against source, public/ @ master, 2026-06) ──
 *  Functions are GLOBAL (Azgaar calls them from inline onclick), so page.evaluate
 *  can invoke them by bare name:
 *   - regenerateMap(options?)  main.js:1277  debounced full regen; reads DOM option
 *                              inputs; options.seed forces a seed (→ setSeed).
 *   - prepareMapData()         save.js:40    returns the .map as a string[] (one
 *                              line per element). Header L0 = [VERSION,license,
 *                              date,SEED,WIDTH,HEIGHT,mapId].join("|") → matches our
 *                              parser's seed@3/width@4/height@5.
 *   - exportToPng()            export.js:23  draws #map svg → canvas → downloads PNG.
 *  Option inputs (DOM ids, verified): templateInput (value = display NAME, e.g.
 *  "Continents"), temperatureEquatorOutput / temperatureNorthPoleOutput /
 *  temperatureSouthPoleOutput, statesNumber, manorsInput (towns), mapSizeOutput +
 *  mapWidthInput + mapHeightInput, pointsInput (cell density), optionsSeed.
 *  Heightmap templates (config/heightmap-templates.js): Archipelago / High Island /
 *  Low Island / Continents / Pangea — AVOID Old World/Peninsula/Fractious (bleed
 *  off-canvas).
 */

import * as fs from "fs"
import * as path from "path"
import puppeteer from "puppeteer-core"
// Relative import — tsx doesn't resolve tsconfig path aliases in scripts.
import { parseMap, curateForImport } from "../lib/worldMap/azgaar-map"

const AZGAAR_URL = "https://azgaar.github.io/Fantasy-Map-Generator/"
const OUT_DIR = path.resolve("maps/baked")
// System Chrome (override with CHROME_PATH). puppeteer-core needs an executable —
// avoids the bundled-Chromium download. macOS default shown; the real bake can
// swap to full `puppeteer` for portability.
const CHROME_PATH =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

// One vibe cell for the PoC. The real bake loops the 4×4×3×2 matrix; here we set a
// representative spread of params to prove we can DRIVE generation, not just open it.
type Vibe = {
  slug: string
  seed: string
  template: string // templateInput display name (Shape)
  mapSize: number // % of globe (Scale)
  statesNumber: number // states count (Civilization)
  manors: number // towns/burgs count; -1 = auto (Civilization)
  tempEquator?: number // °C at equator (Climate)
}

const VIBE: Vibe = {
  slug: "temperate-continents-settled-world",
  seed: "771511", // fixed → reproducible bake
  template: "Continents",
  mapSize: 100,
  statesNumber: 18,
  manors: 1000,
  tempEquator: 27,
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  console.log("Launching headless Chromium…")
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1600, height: 900 })

    // tsx/esbuild wraps named functions with a __name() helper; page.evaluate ships
    // only the function BODY to the browser, where __name is undefined. Define a
    // passthrough on every document so our evaluates run. (Set before goto so it's
    // present when Azgaar's document loads.)
    await page.evaluateOnNewDocument(() => {
      // @ts-expect-error injected shim
      window.__name = (fn: unknown) => fn
    })

    // Route PNG downloads to OUT_DIR.
    const client = await page.target().createCDPSession()
    await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: OUT_DIR })

    console.log("Loading Azgaar…")
    await page.goto(AZGAAR_URL, { waitUntil: "networkidle2", timeout: 120_000 })

    // Azgaar auto-generates a random map on load; wait for it to settle, then close
    // any first-visit dialogs that would swallow our calls.
    await page.waitForFunction(() => (window as any).pack?.burgs?.length > 1, { timeout: 120_000 })
    await page.evaluate(() => {
      // jQuery-UI dialogs (changelog etc.)
      try {
        ;(window as any).$?.(".dialog:visible").each(function (this: any) {
          ;(window as any).$(this).dialog("close")
        })
      } catch {}
    })
    console.log("Base map generated. Applying vibe params…")

    // Set option inputs, dispatch events so any handlers recompute, then regenerate
    // with our seed. Setting both the value and firing input/change mirrors a user.
    await page.evaluate((v: Vibe) => {
      const set = (id: string, value: string | number) => {
        const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null
        if (!el) return false
        ;(el as HTMLInputElement).value = String(value)
        el.dispatchEvent(new Event("input", { bubbles: true }))
        el.dispatchEvent(new Event("change", { bubbles: true }))
        return true
      }
      set("templateInput", v.template)
      set("mapSizeOutput", v.mapSize)
      set("mapSizeInput", v.mapSize)
      set("statesNumber", v.statesNumber)
      set("manorsInput", v.manors)
      if (v.tempEquator != null) {
        set("temperatureEquatorOutput", v.tempEquator)
        set("temperatureEquatorInput", v.tempEquator)
      }
      ;(document.getElementById("optionsSeed") as HTMLInputElement).value = v.seed
    }, VIBE)

    // Full regen with the forced seed. regenerateMap is a top-level `const` in a
    // classic script → it lives in the global LEXICAL scope (reachable by bare name,
    // NOT as window.regenerateMap). A string-expression evaluate runs in global
    // scope where the binding resolves. It's debounced + not awaitable, so kick it
    // then poll for completion (our seed lands on window.seed + burgs repopulate).
    await page.evaluate(`regenerateMap({ seed: "${VIBE.seed}" })`)
    await page.waitForFunction(
      (seed: string) => String((window as any).seed) === seed && (window as any).pack?.burgs?.length > 1,
      { timeout: 120_000 },
      VIBE.seed,
    )
    console.log("Vibe map generated. Exporting .map + PNG…")

    // Use Azgaar's REAL exporters (saveMap/exportToPng are function declarations →
    // global) and capture the downloads — the exact .map serialization our parser
    // already handles, no in-memory array/string guessing.
    const mapPath = path.join(OUT_DIR, `${VIBE.slug}.map`)
    const beforeMap = new Set(fs.readdirSync(OUT_DIR))
    await page.evaluate(`saveMap("machine")`)
    const mapDl = await waitForNewFile(OUT_DIR, beforeMap, ".map", 60_000)
    if (!mapDl) throw new Error("Azgaar produced no .map download")
    fs.renameSync(mapDl, mapPath)
    const mapText = fs.readFileSync(mapPath, "utf8")

    const finalPng = path.join(OUT_DIR, `${VIBE.slug}.png`)
    const beforePng = new Set(fs.readdirSync(OUT_DIR))
    await page.evaluate(`exportToPng()`)
    const pngDl = await waitForNewFile(OUT_DIR, beforePng, ".png", 60_000)
    if (pngDl && pngDl !== finalPng) fs.renameSync(pngDl, finalPng)

    // ── Validate: does OUR parser accept Azgaar's headless output? ──
    const parsed = parseMap(mapText)
    const imported = curateForImport(parsed)
    const cityLinks = imported.filter((l) => l.type === "settlement" && l.drillDownUrl).length

    console.log(`\n${"─".repeat(56)}`)
    console.log(`✓ Baked + parsed "${VIBE.slug}"`)
    console.log(`  .map : ${mapPath}`)
    console.log(`  .png : ${finalPng}${fs.existsSync(finalPng) ? "" : "  (⚠️ PNG not captured)"}`)
    console.log(`  canvas: ${parsed.width}×${parsed.height}  scale: ${parsed.scaleMilesPerPx ?? "?"} mi/px`)
    console.log(
      `  parsed: ${parsed.settlements.length} settlements + ${parsed.pois.length} POIs ` +
        `→ import keeps ${imported.length} (${cityLinks} city links)`,
    )
    console.log(`${"─".repeat(56)}`)
    if (imported.length === 0) throw new Error("Parsed 0 pins — generation or parse failed.")
    console.log("PoC PASSED — headless bake → our parser is viable.")
  } finally {
    await browser.close()
  }
}

async function waitForNewFile(
  dir: string,
  before: Set<string>,
  ext: string,
  timeoutMs: number,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const now = fs.readdirSync(dir).filter((f) => f.endsWith(ext) && !f.endsWith(".crdownload"))
    const fresh = now.find((f) => !before.has(f))
    if (fresh) return path.join(dir, fresh)
    await new Promise((r) => setTimeout(r, 500))
  }
  return null
}

main().catch((e) => {
  console.error("\n✗ PoC FAILED:", e instanceof Error ? e.message : e)
  process.exit(1)
})
