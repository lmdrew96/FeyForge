"use client"

// ── AI encounter generator (premium) ─────────────────────────────────────────
// A DM-only action on combat-capable world-map pins (encounter/monster/dungeon/
// ruin): generate a CR-balanced, SRD-safe encounter grounded in the pin's place,
// its surroundings, and the party's actual levels — then save it straight into
// the encounters/initiative system to run at the table.
//
// SELF-CONTAINED on purpose: it queries its own party levels (listMembers),
// edition (campaigns.get), and quota (aiUsage) from just a campaignId, so wiring
// it onto a new surface costs the parent almost nothing — pass {loc, campaignId,
// mapName, surroundings} and go. All the D&D math is reused, never re-derived:
// computeEncounter + crToXp from lib/encounter (edition-aware, SRD-verified).
//
// SRD-SAFE BY CONSTRUCTION: candidates come from open5e (document=wotc-srd) and
// the route may only pick from their slugs; we re-validate every returned slug
// here, so a hallucinated creature can't reach the table OR skew the difficulty.

import { useMemo, useRef, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from "sonner"
import { Loader2, RefreshCw, Save, Shield, Sparkles, Swords, X } from "lucide-react"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { open5eApi, type Open5eMonster } from "@/lib/open5e-api"
import { computeEncounter, crToXp } from "@/lib/encounter"
import { resolveEdition } from "@/lib/editions"
import { postAi, AiError } from "@/lib/ai-client"
import { SecondaryButton, type CampaignId, type MapLocation } from "./shared"
import type { Surroundings } from "@/lib/worldMap/surroundings"

// POI kinds that can host a fight. Tavern/landmark route to NPC/flavor tools, not
// this. The parent gates on the same set; exported so it stays the one source.
export const COMBAT_POI_KINDS = new Set(["encounter", "monster", "dungeon", "ruin"])

const DEFAULT_PARTY = [3, 3, 3, 3] // fallback when no characters are linked yet

// Rich client-side candidate: lean fields go to the route; ac/hp/dexMod/crNum stay
// here for the difficulty recompute, the result display, and Save-to-Encounters.
type Candidate = {
  slug: string
  name: string
  cr: string
  crNum: number
  xp: number
  type: string
  size: string
  ac: number
  hp: number
  dexMod: number
}

type EncounterResponse = {
  title: string
  readAloud: string
  setup: string
  monsters: { slug: string; count: number }[]
  scaling: string
  treasure: string
  remaining: number
}

type Result = EncounterResponse & { chosen: (Candidate & { count: number })[] }

// Round-robin across CR rungs so the candidate set always spans low→high (swarms
// AND bosses), never just the cheapest creatures a flat slice would grab first.
function pickCandidates(monsters: Open5eMonster[], maxCr: number, limit = 48): Candidate[] {
  const byCr = new Map<number, Open5eMonster[]>()
  for (const m of monsters) {
    if (!Number.isFinite(m.cr) || m.cr > maxCr) continue
    const arr = byCr.get(m.cr) ?? []
    arr.push(m)
    byCr.set(m.cr, arr)
  }
  const rungs = [...byCr.keys()].sort((a, b) => a - b)
  const out: Open5eMonster[] = []
  for (let i = 0; out.length < limit; i++) {
    let advanced = false
    for (const cr of rungs) {
      const m = byCr.get(cr)![i]
      if (m) {
        out.push(m)
        advanced = true
        if (out.length >= limit) break
      }
    }
    if (!advanced) break
  }
  return out.map((m) => ({
    slug: m.slug,
    name: m.name,
    cr: m.challenge_rating,
    crNum: m.cr,
    xp: crToXp(m.challenge_rating, m.cr),
    type: m.type,
    size: m.size,
    ac: m.armor_class,
    hp: m.hit_points,
    dexMod: Math.floor((m.dexterity - 10) / 2),
  }))
}

const difficultyColor = (label: string): string => {
  const l = label.toLowerCase()
  if (l === "deadly" || l === "high") return "#dc2626"
  if (l === "hard") return "#ea580c"
  if (l === "medium" || l === "moderate") return "#ca8a04"
  return "#16a34a" // easy / low / trivial
}

export function EncounterGenerator({
  loc,
  campaignId,
  mapName,
  surroundings,
}: {
  loc: MapLocation
  campaignId: CampaignId
  mapName: string
  surroundings?: Surroundings
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [difficulty, setDifficulty] = useState<string | null>(null)
  const monstersRef = useRef<Open5eMonster[] | null>(null) // cache the SRD fetch across regenerates

  const members = useQuery(api.campaignMembers.listMembers, { campaignId })
  const campaign = useQuery(api.campaigns.get, { campaignId })
  const usage = useQuery(api.aiUsage.getUsage)
  const createEncounter = useMutation(api.encounters.create)

  const edition = resolveEdition(campaign?.edition)
  const partyLinked = (members ?? []).some((m) => m.character)
  const partyLevels = useMemo(() => {
    const lvls = (members ?? [])
      .map((m) => m.character?.level)
      .filter((l): l is number => typeof l === "number" && l > 0)
    return lvls.length ? lvls : DEFAULT_PARTY
  }, [members])

  // Edition-aware difficulty bands + the party's summed budget for each (empty
  // monster list → just the thresholds). The selector picks one; its budget is
  // the AI's target.
  const bands = useMemo(() => computeEncounter(partyLevels, [], edition).bands, [partyLevels, edition])
  const defaultDifficulty = edition === "2024" ? "Moderate" : "Medium"
  const chosenDifficulty = difficulty ?? defaultDifficulty
  const rawTargetBudget = bands.find((b) => b.label === chosenDifficulty)?.partyBudget
  // The AI aims RAW monster XP at the target. 2024 judges difficulty on raw XP
  // (multiplier 1), so the threshold IS the aim. But 2014 judges on raw XP × an
  // encounter multiplier (≈2 for a typical 3–6 monster group), so aiming raw XP
  // at the full threshold reads ~one band hot — halve it so the result lands on
  // the band the DM picked. The displayed band budgets stay the true thresholds.
  const targetBudget =
    rawTargetBudget == null ? undefined : edition === "2024" ? rawTargetBudget : Math.round(rawTargetBudget / 2)

  // The real, deterministic difficulty of what the AI actually returned — the
  // single source of truth the DM sees, independent of what we asked for.
  const realResult = useMemo(
    () =>
      result
        ? computeEncounter(
            partyLevels,
            result.chosen.map((c) => ({ challengeRating: c.cr, cr: c.crNum, quantity: c.count })),
            edition,
          )
        : null,
    [result, partyLevels, edition],
  )

  const remaining = usage?.remaining
  const outOfQuota = remaining === 0

  const ensureMonsters = async (): Promise<Open5eMonster[]> => {
    if (monstersRef.current) return monstersRef.current
    const all = await open5eApi.getMonsters() // all SRD monsters, cached 24h in IndexedDB
    monstersRef.current = all
    return all
  }

  const generate = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const all = await ensureMonsters()
      const avgLevel = Math.round(partyLevels.reduce((a, b) => a + b, 0) / partyLevels.length)
      const candidates = pickCandidates(all, avgLevel + 3)
      if (candidates.length === 0) {
        setError("No SRD creatures found for this party level.")
        return
      }
      const bySlug = new Map(candidates.map((c) => [c.slug, c]))
      const lean = candidates.map(({ slug, name, cr, xp, type, size }) => ({ slug, name, cr, xp, type, size }))

      const res = await postAi<EncounterResponse>("/api/world-map/generate-encounter", {
        pinName: loc.name,
        poiKind: loc.poiKind,
        legend: (loc.dmNotes || loc.playerNotes || "").slice(0, 600),
        mapName,
        edition,
        surroundings,
        party: { levels: partyLevels, size: partyLevels.length },
        difficulty: chosenDifficulty,
        targetBudget,
        candidates: lean,
      })

      // Re-validate: keep only creatures that were actually in the SRD candidate
      // set (a miss can't reach the table or skew the difficulty number), and
      // merge any duplicate slug so combatant ids stay unique on Save.
      const countBySlug = new Map<string, number>()
      for (const m of res.monsters) {
        if (!bySlug.has(m.slug)) continue
        const add = Math.max(1, Math.min(20, Math.round(m.count)))
        countBySlug.set(m.slug, Math.min(20, (countBySlug.get(m.slug) ?? 0) + add))
      }
      const chosen = [...countBySlug.entries()].map(([slug, count]) => ({ ...bySlug.get(slug)!, count }))

      if (chosen.length === 0) {
        setError("The AI picked creatures outside the SRD set — try regenerating.")
        return
      }

      setResult({ ...res, chosen })
      toast.success(`Encounter generated — ${res.remaining} left today.`)
    } catch (err) {
      setError(err instanceof AiError ? err.message : "Couldn't generate the encounter.")
    } finally {
      setLoading(false)
    }
  }

  const saveToEncounters = async () => {
    if (!result) return
    setSaving(true)
    try {
      const combatants = result.chosen.flatMap((c) =>
        Array.from({ length: c.count }, (_, i) => ({
          id: `${c.slug}-${i + 1}`,
          name: c.count > 1 ? `${c.name} ${i + 1}` : c.name,
          type: "monster" as const,
          initiative: 0,
          initiativeBonus: c.dexMod,
          armorClass: c.ac,
          hitPoints: { current: c.hp, max: c.hp, temp: 0 },
          conditions: [] as string[],
          notes: "",
          isActive: false,
        })),
      )
      await createEncounter({
        name: result.title || loc.name,
        combatants,
        round: 1,
        campaignId,
        details: {
          readAloud: result.readAloud,
          setup: result.setup,
          scaling: result.scaling,
          treasure: result.treasure,
          difficulty: realResult?.difficulty,
        },
      })
      toast.success("Saved — find it in DM → Encounters to run initiative.")
    } catch {
      toast.error("Couldn't save the encounter.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SecondaryButton onClick={() => setOpen(true)}>
        <Swords className="h-4 w-4" />
        Generate encounter
      </SecondaryButton>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl"
            style={{ borderColor: "var(--scene-border)", background: "var(--scene-surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: "var(--scene-border)" }}>
              <div className="flex min-w-0 items-center gap-2">
                <Swords className="h-5 w-5 shrink-0" style={{ color: "var(--scene-accent)" }} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                    Encounter at {loc.name}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
                    {partyLinked
                      ? `Party levels [${partyLevels.join(", ")}] · ${edition}`
                      : `No party characters linked — estimating a 4× level-3 party · ${edition}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 hover:opacity-70" style={{ color: "var(--scene-text-muted)" }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {/* Difficulty selector */}
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-medium" style={{ color: "var(--scene-text-muted)" }}>
                  Target difficulty
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {bands.map((b) => {
                    const active = b.label === chosenDifficulty
                    return (
                      <button
                        key={b.label}
                        onClick={() => setDifficulty(b.label)}
                        className="rounded-md px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-90"
                        style={{
                          background: active ? difficultyColor(b.label) : "var(--scene-bg)",
                          color: active ? "#fff" : "var(--scene-text-primary)",
                          border: `1px solid ${active ? difficultyColor(b.label) : "var(--scene-border)"}`,
                        }}
                      >
                        {b.label}
                        <span className="ml-1 opacity-70">{b.partyBudget.toLocaleString()} XP</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Generate / regenerate */}
              <button
                onClick={generate}
                disabled={loading || outOfQuota}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--scene-accent)" }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : result ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {loading ? "Designing…" : result ? "Regenerate" : "Generate encounter"}
              </button>
              {typeof remaining === "number" && (
                <p className="mt-1.5 text-center text-[11px]" style={{ color: outOfQuota ? "#dc2626" : "var(--scene-text-muted)" }}>
                  {outOfQuota ? "Out of AI generations today — resets tomorrow." : `${remaining} AI generation${remaining === 1 ? "" : "s"} left today`}
                </p>
              )}

              {error && (
                <p className="mt-3 rounded-md px-3 py-2 text-xs" style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
                  {error}
                </p>
              )}

              {/* Result */}
              {result && realResult && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                      {result.title}
                    </h3>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                      style={{ background: difficultyColor(realResult.difficulty) }}
                      title={
                        realResult.difficulty === chosenDifficulty
                          ? undefined
                          : `Aimed for ${chosenDifficulty}; this came out ${realResult.difficulty}.`
                      }
                    >
                      {realResult.difficulty}
                    </span>
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
                    {realResult.monsterCount} creature{realResult.monsterCount === 1 ? "" : "s"} ·{" "}
                    {realResult.monsterXpTotal.toLocaleString()} XP award
                    {realResult.multiplier !== 1 ? ` · ×${realResult.multiplier} adjusted` : ""}
                  </p>

                  {/* Monster roster with real SRD stats */}
                  <div className="rounded-lg border" style={{ borderColor: "var(--scene-border)", background: "var(--scene-bg)" }}>
                    {result.chosen.map((c, i) => (
                      <div
                        key={c.slug}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                        style={{ borderTop: i === 0 ? "none" : "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{c.name}</span>
                          {c.count > 1 && <span style={{ color: "var(--scene-text-muted)" }}> ×{c.count}</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
                          <span>CR {c.cr}</span>
                          <span className="inline-flex items-center gap-0.5"><Shield className="h-3 w-3" />{c.ac}</span>
                          <span>{c.hp} HP</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  <ResultBlock label="Read aloud" body={result.readAloud} accentBorder />
                  <ResultBlock label="DM notes & tactics" body={result.setup} />
                  <ResultBlock label="Scaling" body={result.scaling} />
                  <ResultBlock label="Treasure" body={result.treasure} />

                  <button
                    onClick={saveToEncounters}
                    disabled={saving}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ borderColor: "var(--scene-border)", color: "var(--scene-text-primary)", background: "var(--scene-surface)" }}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save to Encounters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ResultBlock({ label, body, accentBorder }: { label: string; body: string; accentBorder?: boolean }) {
  if (!body?.trim()) return null
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{
        background: "var(--scene-bg)",
        borderLeft: accentBorder ? "3px solid var(--scene-accent)" : "1px solid var(--scene-border)",
        border: accentBorder ? undefined : "1px solid var(--scene-border)",
      }}
    >
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--scene-text-muted)" }}>
        {label}
      </p>
      <MarkdownRenderer variant="scene" content={body} className="text-sm" />
    </div>
  )
}
