"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { open5eApi, type Open5eMonster } from "@/lib/open5e-api"
import { useCampaignStore } from "@/lib/campaign-store"
import { type Edition, EDITIONS, DEFAULT_EDITION, EDITION_LABELS, resolveEdition } from "@/lib/editions"
import { computeEncounter, crToXp } from "@/lib/encounter"
import { partitionHomebrew, type HomebrewMonster } from "@/lib/homebrew"
import { toast } from "sonner"
import { BookMarked, Search, Plus, Minus, Save, Trash2, Users, Skull, Swords, ChevronDown, ChevronRight } from "lucide-react"
import { EncounterDetails, DifficultyBadge, difficultyColor, hasEncounterDetails } from "@/components/encounters/encounter-details"

// Collapse a combatant line-up ("Goblin 1", "Goblin 2", "Ogre") into a summary
// ("2× Goblin, Ogre") by stripping the trailing index the generator appends.
function lineupSummary(combatants: { name: string }[]): string {
  const counts = new Map<string, number>()
  for (const c of combatants) {
    const base = c.name.replace(/\s+\d+$/, "")
    counts.set(base, (counts.get(base) ?? 0) + 1)
  }
  return [...counts.entries()].map(([n, q]) => (q > 1 ? `${q}× ${n}` : n)).join(", ")
}

interface SelectedMonster {
  slug: string
  name: string
  challengeRating: string
  cr: number
  quantity: number
  // Homebrew monsters carry their stat line inline — there's no open5e entry to
  // resolve AC/HP/Dex from at save time. SRD monsters leave this undefined.
  homebrew?: { armorClass: number; hitPoints: number; dexMod: number }
}

export default function EncounterCalculatorPage() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const campaigns = useQuery(api.campaigns.list)
  const characters = useQuery(api.characters.list)
  // Homebrew monsters (own + campaign-shared) merge into the monster search.
  const homebrewDocs = useQuery(api.homebrew.listForBuilder)
  const homebrewMonsters = useMemo(
    () => partitionHomebrew(homebrewDocs).monsters,
    [homebrewDocs]
  )

  const activeCampaign = campaigns?.find((c) => c._id === activeCampaignId) ?? null
  const campaignChars = useMemo(
    () => (characters ?? []).filter((c) => c.campaignId === activeCampaignId),
    [characters, activeCampaignId]
  )

  // Edition: default to the active campaign's flag; let the DM override here.
  const [edition, setEdition] = useState<Edition>(DEFAULT_EDITION)
  const [editionTouched, setEditionTouched] = useState(false)
  useEffect(() => {
    if (!editionTouched && activeCampaign) setEdition(resolveEdition(activeCampaign.edition))
  }, [activeCampaign, editionTouched])

  // Party: start with a sensible default; DM can load campaign characters' levels.
  const [party, setParty] = useState<number[]>([1, 1, 1, 1])

  const setLevel = (i: number, level: number) =>
    setParty((p) => p.map((lvl, idx) => (idx === i ? Math.max(1, Math.min(20, level)) : lvl)))
  const addMember = () => setParty((p) => [...p, p[p.length - 1] ?? 1])
  const removeMember = (i: number) => setParty((p) => p.filter((_, idx) => idx !== i))
  const loadFromCampaign = () => {
    if (campaignChars.length) setParty(campaignChars.map((c) => c.level))
  }

  // Monsters: fetch the SRD list once, search client-side.
  const [allMonsters, setAllMonsters] = useState<Open5eMonster[]>([])
  const [monstersLoading, setMonstersLoading] = useState(true)
  const [monsterError, setMonsterError] = useState(false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<SelectedMonster[]>([])

  useEffect(() => {
    let cancelled = false
    open5eApi
      .getMonsters()
      .then((m) => {
        if (!cancelled) setAllMonsters(m)
      })
      .catch(() => {
        if (!cancelled) setMonsterError(true)
      })
      .finally(() => {
        if (!cancelled) setMonstersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return allMonsters.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 40)
  }, [query, allMonsters])

  const homebrewMatches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return homebrewMonsters.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 10)
  }, [query, homebrewMonsters])

  const addMonster = (m: Open5eMonster) => {
    setSelected((prev) => {
      const existing = prev.find((s) => s.slug === m.slug)
      if (existing) return prev.map((s) => (s.slug === m.slug ? { ...s, quantity: s.quantity + 1 } : s))
      return [...prev, { slug: m.slug, name: m.name, challengeRating: m.challenge_rating, cr: m.cr, quantity: 1 }]
    })
    setQuery("")
  }

  const addHomebrewMonster = (m: HomebrewMonster) => {
    setSelected((prev) => {
      const existing = prev.find((s) => s.slug === m.id)
      if (existing) return prev.map((s) => (s.slug === m.id ? { ...s, quantity: s.quantity + 1 } : s))
      return [
        ...prev,
        {
          slug: m.id,
          name: m.name,
          challengeRating: m.challengeRating,
          cr: m.cr,
          quantity: 1,
          homebrew: {
            armorClass: m.armorClass,
            hitPoints: m.hitPoints,
            dexMod: Math.floor((m.dexterity - 10) / 2),
          },
        },
      ]
    })
    setQuery("")
  }
  const setQuantity = (slug: string, delta: number) =>
    setSelected((prev) =>
      prev
        .map((s) => (s.slug === slug ? { ...s, quantity: s.quantity + delta } : s))
        .filter((s) => s.quantity > 0)
    )
  const removeMonster = (slug: string) => setSelected((prev) => prev.filter((s) => s.slug !== slug))

  const result = useMemo(
    () =>
      computeEncounter(
        party,
        selected.map((s) => ({ challengeRating: s.challengeRating, cr: s.cr, quantity: s.quantity })),
        edition
      ),
    [party, selected, edition]
  )

  const diffColor = difficultyColor(result.difficulty)

  // ── Saved encounters (the library: map-generated + saved here) ──────────────
  const savedEncounters = useQuery(api.encounters.list)
  const createEncounter = useMutation(api.encounters.create)
  const removeEncounter = useMutation(api.encounters.remove)
  const [encName, setEncName] = useState("")
  const [savingEnc, setSavingEnc] = useState(false)
  const [expandedEnc, setExpandedEnc] = useState<string | null>(null)

  const campaignName = (id?: string) => campaigns?.find((c) => c._id === id)?.name

  // Save the current monster line-up as a runnable encounter (combatants in the
  // live-combat shape; AC/HP/Dex pulled from the SRD list). Initiative is rolled
  // at load time in the tracker, so it's stored as 0 here.
  const handleSaveEncounter = async () => {
    if (selected.length === 0) return
    const totalMonsters = selected.reduce((n, s) => n + s.quantity, 0)
    const name = encName.trim() || `Encounter — ${totalMonsters} monster${totalMonsters === 1 ? "" : "s"}`
    const combatants = selected.flatMap((s) => {
      const full = allMonsters.find((m) => m.slug === s.slug)
      const ac = s.homebrew?.armorClass ?? full?.armor_class ?? 10
      const hp = s.homebrew?.hitPoints ?? full?.hit_points ?? 1
      const dexMod = s.homebrew?.dexMod ?? (full ? Math.floor((full.dexterity - 10) / 2) : 0)
      return Array.from({ length: s.quantity }, (_, i) => ({
        id: `${s.slug}-${i + 1}`,
        name: s.quantity > 1 ? `${s.name} ${i + 1}` : s.name,
        type: "monster" as const,
        initiative: 0,
        initiativeBonus: dexMod,
        armorClass: ac,
        hitPoints: { current: hp, max: hp, temp: 0 },
        conditions: [] as string[],
        notes: "",
        isActive: false,
      }))
    })
    setSavingEnc(true)
    try {
      await createEncounter({
        name,
        combatants,
        round: 1,
        campaignId: activeCampaignId ? (activeCampaignId as Id<"campaigns">) : undefined,
        details: { difficulty: result.difficulty },
      })
      toast.success("Saved — load it from the Combat tab in a live session.")
      setEncName("")
    } catch {
      toast.error("Couldn't save the encounter.")
    } finally {
      setSavingEnc(false)
    }
  }

  const handleDeleteEncounter = async (id: Id<"savedEncounters">) => {
    try {
      await removeEncounter({ id })
    } catch {
      toast.error("Couldn't delete the encounter.")
    }
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto pb-12">
        <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
              Encounter Calculator
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
              Party + monsters → difficulty, by the {EDITION_LABELS[edition]} ruleset.
            </p>
          </div>
          {/* Edition toggle */}
          <div className="flex gap-1.5">
            {EDITIONS.map((ed) => {
              const active = edition === ed
              return (
                <button
                  key={ed}
                  onClick={() => {
                    setEdition(ed)
                    setEditionTouched(true)
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
                  style={{
                    background: active ? "var(--scene-accent)" : "var(--scene-surface)",
                    color: active ? "var(--scene-bg)" : "var(--scene-text-primary)",
                    border: `1px solid ${active ? "var(--scene-accent)" : "var(--scene-border)"}`,
                  }}
                  title={`Calculate with the ${EDITION_LABELS[ed]} rules`}
                >
                  {EDITION_LABELS[ed]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
          {/* ── Party ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" style={{ color: "var(--scene-accent)" }} />
                <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
                  Party ({party.length})
                </h2>
              </div>
              {campaignChars.length > 0 && (
                <button
                  onClick={loadFromCampaign}
                  className="text-xs px-2.5 py-1 rounded-md transition-opacity hover:opacity-80"
                  style={{ background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)", color: "var(--scene-accent)" }}
                  title="Set party to your campaign characters' levels"
                >
                  Load from campaign
                </button>
              )}
            </div>

            <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
              {party.length === 0 && (
                <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>No characters — add one below.</p>
              )}
              {party.map((level, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm w-20" style={{ color: "var(--scene-text-muted)" }}>
                    Char {i + 1}
                  </span>
                  <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>Level</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={level}
                    onChange={(e) => setLevel(i, Number(e.target.value))}
                    className="w-16 px-2 py-1 rounded-md text-sm text-center bg-transparent outline-none"
                    style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
                  />
                  <button
                    onClick={() => removeMember(i)}
                    className="ml-auto p-1.5 rounded transition-opacity hover:opacity-80"
                    style={{ color: "var(--scene-text-muted)" }}
                    title="Remove character"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addMember}
                className="inline-flex items-center gap-1.5 text-sm mt-1 px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
                style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add character
              </button>
            </div>

            {/* ── Monsters ── */}
            <div className="flex items-center gap-2 mb-3 mt-6">
              <Skull className="h-4 w-4" style={{ color: "var(--scene-accent)" }} />
              <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
                Monsters
              </h2>
            </div>

            <div className="rounded-xl p-4" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
              {/* Search */}
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-2" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
                <Search className="h-4 w-4 flex-shrink-0" style={{ color: "var(--scene-text-muted)" }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={monstersLoading ? "Loading SRD monsters…" : "Search monsters to add…"}
                  disabled={monstersLoading}
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: "var(--scene-text-primary)" }}
                />
              </div>
              {monsterError && (
                <p className="text-sm" style={{ color: "#ef4444" }}>Couldn&apos;t load monsters from Open5e.</p>
              )}

              {/* Search results (homebrew first, then SRD) */}
              {(matches.length > 0 || homebrewMatches.length > 0) && (
                <div className="rounded-lg mb-3 overflow-hidden max-h-56 overflow-y-auto" style={{ border: "1px solid var(--scene-border)" }}>
                  {homebrewMatches.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => addHomebrewMonster(m)}
                      className="flex items-center gap-2 px-3 py-2 w-full text-left transition-opacity hover:opacity-80"
                      style={{ borderBottom: "1px solid var(--scene-border)" }}
                    >
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold flex-shrink-0" style={{ background: "color-mix(in srgb, var(--scene-accent) 18%, transparent)", color: "var(--scene-accent)" }}>HB</span>
                      <span className="text-sm flex-1 truncate" style={{ color: "var(--scene-text-primary)" }}>{m.name}</span>
                      <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                        CR {m.challengeRating} · {crToXp(m.challengeRating, m.cr).toLocaleString()} XP
                      </span>
                      <Plus className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
                    </button>
                  ))}
                  {matches.map((m) => (
                    <button
                      key={m.slug}
                      onClick={() => addMonster(m)}
                      className="flex items-center gap-2 px-3 py-2 w-full text-left transition-opacity hover:opacity-80"
                      style={{ borderBottom: "1px solid var(--scene-border)" }}
                    >
                      <span className="text-sm flex-1 truncate" style={{ color: "var(--scene-text-primary)" }}>{m.name}</span>
                      <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                        CR {m.challenge_rating} · {crToXp(m.challenge_rating, m.cr).toLocaleString()} XP
                      </span>
                      <Plus className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
                    </button>
                  ))}
                </div>
              )}

              {/* Selected monsters */}
              {selected.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>No monsters added yet.</p>
              ) : (
                <div className="space-y-2">
                  {selected.map((s) => (
                    <div key={s.slug} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: "var(--scene-text-primary)" }}>{s.name}</p>
                        <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                          CR {s.challengeRating} · {crToXp(s.challengeRating, s.cr).toLocaleString()} XP each
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQuantity(s.slug, -1)} className="p-1 rounded hover:opacity-80" style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }} title="One fewer">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-sm font-bold w-6 text-center tabular-nums" style={{ color: "var(--scene-text-primary)" }}>{s.quantity}</span>
                        <button onClick={() => setQuantity(s.slug, 1)} className="p-1 rounded hover:opacity-80" style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }} title="One more">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button onClick={() => removeMonster(s.slug)} className="p-1.5 rounded hover:opacity-80" style={{ color: "var(--scene-text-muted)" }} title="Remove monster">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── Result ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Swords className="h-4 w-4" style={{ color: "var(--scene-accent)" }} />
              <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
                Difficulty
              </h2>
            </div>

            <div className="rounded-xl p-5 lg:sticky lg:top-6" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
              {/* Verdict */}
              <div className="text-center py-3 rounded-lg mb-4" style={{ background: `color-mix(in srgb, ${diffColor} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${diffColor} 35%, transparent)` }}>
                <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>Encounter is</div>
                <div className="text-3xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: diffColor }}>
                  {result.difficulty}
                </div>
              </div>

              {/* Numbers */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--scene-text-muted)" }}>Monster XP (award)</span>
                  <span className="font-semibold tabular-nums" style={{ color: "var(--scene-text-primary)" }}>{result.monsterXpTotal.toLocaleString()}</span>
                </div>
                {edition === "2014" && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: "var(--scene-text-muted)" }}>Multiplier (×{result.multiplier})</span>
                      <span className="font-semibold tabular-nums" style={{ color: "var(--scene-text-primary)" }}>{result.adjustedXp.toLocaleString()}</span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                      {result.monsterCount} monster{result.monsterCount === 1 ? "" : "s"} → adjusted XP compared to thresholds.
                    </p>
                  </>
                )}
              </div>

              {/* Bands */}
              <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>
                {edition === "2014" ? "Party thresholds" : "Party XP budget"}
              </div>
              <div className="space-y-1.5">
                {result.bands.map((band) => {
                  const compareXp = edition === "2014" ? result.adjustedXp : result.monsterXpTotal
                  const reached = band.partyBudget > 0 && compareXp >= band.partyBudget
                  const color = difficultyColor(band.label)
                  return (
                    <div
                      key={band.label}
                      className="flex items-center justify-between px-3 py-2 rounded-md"
                      style={{
                        background: reached ? `color-mix(in srgb, ${color} 14%, transparent)` : "var(--scene-bg)",
                        border: `1px solid ${reached ? `color-mix(in srgb, ${color} 35%, transparent)` : "var(--scene-border)"}`,
                      }}
                    >
                      <span className="text-sm font-medium" style={{ color: reached ? color : "var(--scene-text-primary)" }}>
                        {band.label}
                      </span>
                      <span className="text-sm tabular-nums" style={{ color: "var(--scene-text-muted)" }}>
                        {band.partyBudget.toLocaleString()} XP
                      </span>
                    </div>
                  )
                })}
              </div>

              <p className="text-xs mt-4 pt-3" style={{ color: "var(--scene-text-muted)", borderTop: "1px solid var(--scene-border)" }}>
                {edition === "2014"
                  ? "2014: per-character thresholds summed across the party; monster XP × encounter multiplier."
                  : "2024: per-character budget summed across the party; no multiplier."}
              </p>

              {/* Save this line-up as a runnable encounter */}
              <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--scene-border)" }}>
                <div className="flex items-center gap-2">
                  <input
                    value={encName}
                    onChange={(e) => setEncName(e.target.value)}
                    placeholder={selected.length ? `Encounter — ${result.monsterCount} monster${result.monsterCount === 1 ? "" : "s"}` : "Add monsters to save…"}
                    disabled={selected.length === 0 || savingEnc}
                    className="flex-1 px-2.5 py-1.5 rounded-md text-sm bg-transparent outline-none disabled:opacity-50"
                    style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
                  />
                  <button
                    onClick={handleSaveEncounter}
                    disabled={selected.length === 0 || monstersLoading || savingEnc}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                  >
                    <Save className="h-3.5 w-3.5" /> Save
                  </button>
                </div>
                <p className="text-[11px] mt-1.5" style={{ color: "var(--scene-text-muted)" }}>
                  Saves the line-up to run later from a live session&apos;s Combat tab.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* ── Saved encounters (library: saved here + generated from the world map) ── */}
        <section className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <BookMarked className="h-4 w-4" style={{ color: "var(--scene-accent)" }} />
            <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
              Saved Encounters{savedEncounters?.length ? ` (${savedEncounters.length})` : ""}
            </h2>
          </div>
          <div className="rounded-xl p-4" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
            {savedEncounters === undefined ? (
              <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>Loading…</p>
            ) : savedEncounters.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
                No saved encounters yet — save a line-up above, or generate one from a world-map pin. Load them from the Combat tab in a live session to run initiative.
              </p>
            ) : (
              <div className="space-y-2">
                {savedEncounters.map((enc) => {
                  const expandable = hasEncounterDetails(enc.details)
                  const isOpen = expandedEnc === enc._id
                  return (
                    <div key={enc._id} className="rounded-lg overflow-hidden" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <button
                          onClick={() => expandable && setExpandedEnc(isOpen ? null : enc._id)}
                          disabled={!expandable}
                          className="flex flex-1 items-center gap-3 min-w-0 text-left transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
                          title={expandable ? "Show encounter details" : undefined}
                        >
                          {expandable ? (
                            isOpen ? <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: "var(--scene-accent)" }} /> : <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: "var(--scene-accent)" }} />
                          ) : (
                            <Swords className="h-4 w-4 flex-shrink-0" style={{ color: "var(--scene-accent)" }} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate" style={{ color: "var(--scene-text-primary)" }}>{enc.name}</p>
                              <DifficultyBadge difficulty={enc.details?.difficulty} />
                            </div>
                            <p className="text-xs truncate" style={{ color: "var(--scene-text-muted)" }}>
                              {enc.combatants.length} combatant{enc.combatants.length === 1 ? "" : "s"} · {lineupSummary(enc.combatants)}
                              {campaignName(enc.campaignId) ? ` · ${campaignName(enc.campaignId)}` : ""}
                            </p>
                          </div>
                        </button>
                        <button onClick={() => handleDeleteEncounter(enc._id)} className="p-1.5 rounded hover:opacity-80" style={{ color: "var(--scene-text-muted)" }} title="Delete encounter">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {isOpen && expandable && (
                        <div className="px-3 pb-3" style={{ borderTop: "1px solid var(--scene-border)" }}>
                          <div className="pt-3">
                            <EncounterDetails details={enc.details} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
