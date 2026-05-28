"use client"

import { useState, useMemo } from "react"
import { RACES, CLASSES, BACKGROUNDS } from "@/lib/character/character-data"
import type { QuickRollResult, ClassData, RaceData, SubraceData, BackgroundData } from "@/lib/character/character-data"
import {
  ABILITY_ABBREVIATIONS,
  SKILL_DISPLAY_NAMES,
  type Ability,
  type Skill,
  getAbilityModifier,
  formatModifier,
} from "@/lib/character/constants"
import { ArrowRight, Sparkles, Loader2 } from "lucide-react"
import { toast } from "sonner"

// ── Constants ─────────────────────────────────────────────────────────────────

const ABILITY_KEYS: Ability[] = [
  "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
]

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

const PB_COSTS: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
}
const PB_POOL = 27

const ABILITY_HINTS: Record<Ability, string> = {
  strength: "Melee attacks, athletics, carrying capacity",
  dexterity: "Ranged attacks, AC (light armor), initiative, stealth",
  constitution: "Hit points, holding concentration",
  intelligence: "Arcane magic, investigation, knowledge skills",
  wisdom: "Perception, insight, divine and druidic magic",
  charisma: "Social skills, bardic and sorcerer magic",
}

type AbilityMethod = "standard-array" | "point-buy"
type Assignments = Record<Ability, number>

// ── Stat Preview ──────────────────────────────────────────────────────────────

interface StatPreviewProps {
  name: string
  cls: ClassData | undefined
  race: RaceData | undefined
  subrace: SubraceData | undefined
  background: BackgroundData | undefined
  assignments: Assignments
  racialBonuses: Partial<Record<Ability, number>>
  selectedSkills: Skill[]
  bgSkills: Set<Skill>
}

const STAT_PREVIEW_ABILITY_KEYS: Ability[] = [
  "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
]

function StatPreview({ name, cls, race, subrace, background, assignments, racialBonuses, selectedSkills, bgSkills }: StatPreviewProps) {
  const raceName = subrace ? `${subrace.name} ${race?.name}` : race?.name
  const conTotal = (assignments.constitution || 0) + (racialBonuses.constitution ?? 0)
  const conMod = Math.floor((conTotal - 10) / 2)
  const maxHp = cls ? cls.hitDie + conMod : null
  const anyAbility = STAT_PREVIEW_ABILITY_KEYS.some(a => assignments[a] !== 0)
  const allSkills = [...new Set([...Array.from(bgSkills), ...selectedSkills])] as Skill[]

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      <div
        className="px-4 py-3 border-b"
        style={{
          borderColor: "var(--scene-border)",
          background: "color-mix(in srgb, var(--scene-accent) 6%, var(--scene-surface))",
        }}
      >
        <div
          className="font-bold text-base leading-tight"
          style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
        >
          {name.trim() || <span style={{ color: "var(--scene-border)" }}>Unnamed Hero</span>}
        </div>
        <div className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
          {[raceName, cls?.name, background?.name].filter(Boolean).join(" · ") || (
            <span style={{ color: "var(--scene-border)" }}>Choose your path…</span>
          )}
        </div>
        {maxHp !== null && (
          <div className="text-xs mt-1" style={{ color: "var(--scene-accent)" }}>
            {maxHp} HP · d{cls!.hitDie}
          </div>
        )}
      </div>

      {anyAbility && (
        <div className="px-4 py-3">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>
            Abilities
          </div>
          <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
            {STAT_PREVIEW_ABILITY_KEYS.map(a => {
              const base = assignments[a]
              const racial = racialBonuses[a] ?? 0
              const total = (base || 0) + racial
              const mod = base ? getAbilityModifier(total) : null
              return (
                <div key={a} className="flex items-baseline justify-between">
                  <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                    {ABILITY_ABBREVIATIONS[a]}
                  </span>
                  <div className="flex items-baseline gap-0.5">
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{ color: base ? "var(--scene-text-primary)" : "var(--scene-border)" }}
                    >
                      {base ? total : "—"}
                    </span>
                    {mod !== null && (
                      <span style={{ fontSize: "10px", color: "var(--scene-text-muted)" }}>
                        ({formatModifier(mod)})
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {allSkills.length > 0 && (
        <div className="px-4 py-3 border-t" style={{ borderColor: "var(--scene-border)" }}>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>
            Skills
          </div>
          <div className="flex flex-wrap gap-1">
            {allSkills.map(s => (
              <span
                key={s}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}
              >
                {SKILL_DISPLAY_NAMES[s]}
              </span>
            ))}
          </div>
        </div>
      )}

      {!name.trim() && !cls && !race && !background && !anyAbility && (
        <div className="px-4 py-6 text-center">
          <p className="text-xs" style={{ color: "var(--scene-border)" }}>
            Your character will appear here as you build.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface NormalBuilderProps {
  onComplete: (result: QuickRollResult) => void
  saving: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NormalBuilder({ onComplete, saving }: NormalBuilderProps) {
  const [name, setName] = useState("")
  const [classId, setClassId] = useState("")
  const [raceId, setRaceId] = useState("")
  const [subraceId, setSubraceId] = useState("")
  const [backgroundId, setBackgroundId] = useState("")
  const [suggestingName, setSuggestingName] = useState(false)
  const [method, setMethod] = useState<AbilityMethod>("standard-array")
  const [assignments, setAssignments] = useState<Assignments>({
    strength: 0, dexterity: 0, constitution: 0,
    intelligence: 0, wisdom: 0, charisma: 0,
  })
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([])

  // ── Derived ──────────────────────────────────────────────────────────────────

  const cls = useMemo(() => CLASSES.find(c => c.id === classId), [classId])
  const race = useMemo(() => RACES.find(r => r.id === raceId), [raceId])
  const subrace = useMemo(() => race?.subraces?.find(s => s.id === subraceId), [race, subraceId])
  const background = useMemo(() => BACKGROUNDS.find(b => b.id === backgroundId), [backgroundId])

  const racialBonuses = useMemo((): Partial<Record<Ability, number>> => {
    const out: Partial<Record<Ability, number>> = {}
    const merge = (src: Partial<Record<string, number>> | undefined) => {
      if (!src) return
      for (const [k, v] of Object.entries(src) as [Ability, number][]) {
        out[k] = (out[k] ?? 0) + v
      }
    }
    merge(race?.abilityBonuses)
    merge(subrace?.abilityBonuses)
    return out
  }, [race, subrace])

  const pbSpent = useMemo(
    () => ABILITY_KEYS.reduce((sum, a) => sum + (PB_COSTS[assignments[a]] ?? 0), 0),
    [assignments]
  )

  const usedStandardValues = useMemo(
    () => new Set(ABILITY_KEYS.filter(a => assignments[a] !== 0).map(a => assignments[a])),
    [assignments]
  )

  const bgSkills = useMemo(() => new Set<Skill>(background?.skillProficiencies ?? []), [background])
  const classSkillOptions = useMemo(() => cls?.skillChoices.options ?? [], [cls])
  const skillCount = cls?.skillChoices.count ?? 0

  const allAssigned = method === "standard-array"
    ? ABILITY_KEYS.every(a => assignments[a] !== 0)
    : true

  const isValid = !!(
    name.trim() && classId && raceId && backgroundId &&
    (!race?.subraces?.length || subraceId) &&
    allAssigned &&
    selectedSkills.length === skillCount
  )

  const validationHint = !name.trim() ? "Add a character name"
    : !classId ? "Choose a class"
    : !raceId ? "Choose a race"
    : (race?.subraces?.length && !subraceId) ? "Choose a subrace"
    : !backgroundId ? "Choose a background"
    : !allAssigned ? "Assign all six ability scores"
    : selectedSkills.length < skillCount
      ? `Choose ${skillCount - selectedSkills.length} more skill${skillCount - selectedSkills.length !== 1 ? "s" : ""}`
    : null

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleClassChange = (id: string) => {
    setClassId(id)
    setSelectedSkills([])
  }

  const handleSuggestName = async () => {
    setSuggestingName(true)
    try {
      const res = await fetch("/api/character/generate-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ race: race?.name, characterClass: cls?.name }),
      })
      if (!res.ok) throw new Error("Failed to suggest a name")
      const data = (await res.json()) as { name?: string }
      if (data.name) setName(data.name)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't suggest a name.")
    } finally {
      setSuggestingName(false)
    }
  }

  const handleRaceChange = (id: string) => {
    setRaceId(id)
    setSubraceId("")
  }

  const switchMethod = (m: AbilityMethod) => {
    setMethod(m)
    setAssignments(
      m === "point-buy"
        ? { strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 }
        : { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 }
    )
  }

  const handleStandardAssign = (ability: Ability, raw: string) => {
    const value = parseInt(raw, 10) || 0
    setAssignments(prev => ({ ...prev, [ability]: value }))
  }

  const handlePBChange = (ability: Ability, delta: number) => {
    const current = assignments[ability]
    const next = current + delta
    if (next < 8 || next > 15) return
    const newSpent = pbSpent - (PB_COSTS[current] ?? 0) + (PB_COSTS[next] ?? 999)
    if (newSpent > PB_POOL) return
    setAssignments(prev => ({ ...prev, [ability]: next }))
  }

  const toggleSkill = (skill: Skill) => {
    if (bgSkills.has(skill)) return
    setSelectedSkills(prev => {
      if (prev.includes(skill)) return prev.filter(s => s !== skill)
      if (prev.length >= skillCount) return prev
      return [...prev, skill]
    })
  }

  const handleSubmit = () => {
    if (!isValid || !cls || !race || !background) return
    const allSkills = Array.from(new Set([...selectedSkills, ...Array.from(bgSkills)])) as Skill[]
    onComplete({
      name: name.trim(),
      race,
      subrace,
      characterClass: cls,
      background,
      baseAbilities: { ...assignments } as Record<Ability, number>,
      racialBonuses,
      skillProficiencies: allSkills,
    })
  }

  // ── Shared preview props ──────────────────────────────────────────────────────

  const previewProps: StatPreviewProps = {
    name, cls, race, subrace, background, assignments, racialBonuses, selectedSkills, bgSkills,
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="lg:grid lg:grid-cols-[1fr,260px] lg:gap-8 lg:items-start">
    <div className="space-y-10">

      {/* ── Name ─────────────────────────────────────────────────────────────── */}
      <section>
        <label
          className="block text-xs uppercase tracking-widest mb-2"
          style={{ color: "var(--scene-text-muted)" }}
        >
          Character Name
        </label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="What do they call you?"
            className="flex-1 px-4 py-3 rounded-xl text-lg font-medium bg-transparent outline-none"
            style={{
              border: "1px solid var(--scene-border)",
              color: "var(--scene-text-primary)",
              fontFamily: "var(--font-cinzel)",
            }}
          />
          <button
            type="button"
            onClick={handleSuggestName}
            disabled={suggestingName}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{
              background: "color-mix(in srgb, var(--scene-accent) 12%, var(--scene-surface))",
              color: "var(--scene-accent)",
              border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, var(--scene-border))",
            }}
            title="Suggest a name with AI"
          >
            {suggestingName ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Suggest</span>
          </button>
        </div>
      </section>

      {/* ── Class ────────────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
            Class
          </h2>
          {cls && (
            <span className="text-xs" style={{ color: "var(--scene-accent)" }}>
              d{cls.hitDie} hit die · {ABILITY_ABBREVIATIONS[cls.primaryAbility]} primary
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {CLASSES.map(c => (
            <button
              key={c.id}
              onClick={() => handleClassChange(c.id)}
              className="px-3 py-2 rounded-lg text-sm font-medium text-left transition-all hover:opacity-90"
              style={{
                background: classId === c.id ? "var(--scene-accent)" : "var(--scene-surface)",
                color: classId === c.id ? "var(--scene-bg)" : "var(--scene-text-primary)",
                border: `1px solid ${classId === c.id ? "var(--scene-accent)" : "var(--scene-border)"}`,
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        {cls && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "color-mix(in srgb, var(--scene-accent) 5%, var(--scene-surface))",
              border: "1px solid color-mix(in srgb, var(--scene-accent) 20%, var(--scene-border))",
            }}
          >
            <p className="text-sm italic" style={{ color: "var(--scene-accent)" }}>
              &ldquo;{cls.flavorText}&rdquo;
            </p>
            <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>{cls.description}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <span style={{ color: "var(--scene-text-muted)" }}>
                <span style={{ color: "var(--scene-text-primary)" }}>Hit Die</span>{" "}d{cls.hitDie}
              </span>
              <span style={{ color: "var(--scene-text-muted)" }}>
                <span style={{ color: "var(--scene-text-primary)" }}>Primary</span>{" "}{cls.primaryAbility}
              </span>
              <span style={{ color: "var(--scene-text-muted)" }}>
                <span style={{ color: "var(--scene-text-primary)" }}>Saves</span>{" "}
                {cls.savingThrows.map(s => ABILITY_ABBREVIATIONS[s]).join(", ")}
              </span>
              {cls.spellcasting && (
                <span style={{ color: "var(--scene-text-muted)" }}>
                  <span style={{ color: "var(--scene-text-primary)" }}>Spellcasting</span>{" "}
                  {cls.spellcasting.ability} ({cls.spellcasting.type})
                </span>
              )}
              <span style={{ color: "var(--scene-text-muted)" }}>
                <span style={{ color: "var(--scene-text-primary)" }}>Armor</span>{" "}
                {cls.armorProficiencies.join(", ") || "None"}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── Race ─────────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
          Race
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {RACES.map(r => (
            <button
              key={r.id}
              onClick={() => handleRaceChange(r.id)}
              className="px-3 py-2 rounded-lg text-sm font-medium text-left transition-all hover:opacity-90"
              style={{
                background: raceId === r.id ? "var(--scene-accent)" : "var(--scene-surface)",
                color: raceId === r.id ? "var(--scene-bg)" : "var(--scene-text-primary)",
                border: `1px solid ${raceId === r.id ? "var(--scene-accent)" : "var(--scene-border)"}`,
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
        {race && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "color-mix(in srgb, var(--scene-accent) 5%, var(--scene-surface))",
              border: "1px solid color-mix(in srgb, var(--scene-accent) 20%, var(--scene-border))",
            }}
          >
            <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>{race.description}</p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span style={{ color: "var(--scene-text-muted)" }}>
                <span style={{ color: "var(--scene-text-primary)" }}>Speed</span>{" "}{race.speed}ft
              </span>
              {Object.entries(race.abilityBonuses).map(([k, v]) => (
                <span key={k} style={{ color: "var(--scene-accent)" }}>
                  +{v} {ABILITY_ABBREVIATIONS[k as Ability]}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {race.traits.map(t => (
                <span
                  key={t}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}
                >
                  {t}
                </span>
              ))}
            </div>

            {/* Subrace picker */}
            {race.subraces && race.subraces.length > 0 && (
              <div className="pt-1">
                <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>
                  Subrace <span style={{ color: "var(--scene-accent)" }}>*</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {race.subraces.map(sr => (
                    <button
                      key={sr.id}
                      onClick={() => setSubraceId(prev => prev === sr.id ? "" : sr.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: subraceId === sr.id ? "var(--scene-highlight)" : "var(--scene-surface)",
                        color: subraceId === sr.id ? "#fff" : "var(--scene-text-primary)",
                        border: `1px solid ${subraceId === sr.id ? "var(--scene-highlight)" : "var(--scene-border)"}`,
                      }}
                    >
                      {sr.name}
                    </button>
                  ))}
                </div>
                {subrace && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>{subrace.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(subrace.abilityBonuses).map(([k, v]) => (
                        <span key={k} className="text-xs" style={{ color: "var(--scene-accent)" }}>
                          +{v} {ABILITY_ABBREVIATIONS[k as Ability]}
                        </span>
                      ))}
                      {subrace.traits.map(t => (
                        <span
                          key={t}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Background ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
          Background
        </h2>
        <select
          value={backgroundId}
          onChange={e => setBackgroundId(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl text-sm appearance-none outline-none"
          style={{
            background: "var(--scene-surface)",
            border: "1px solid var(--scene-border)",
            color: "var(--scene-text-primary)",
          }}
        >
          <option value="">Choose a background…</option>
          {BACKGROUNDS.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        {background && (
          <div
            className="mt-2 rounded-xl p-4 space-y-2"
            style={{
              background: "color-mix(in srgb, var(--scene-accent) 5%, var(--scene-surface))",
              border: "1px solid color-mix(in srgb, var(--scene-accent) 20%, var(--scene-border))",
            }}
          >
            <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>{background.description}</p>
            <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
              <span style={{ color: "var(--scene-text-primary)" }}>Skills: </span>
              {background.skillProficiencies.map(s => SKILL_DISPLAY_NAMES[s]).join(", ")}
            </p>
            {background.toolProficiencies.length > 0 && (
              <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                <span style={{ color: "var(--scene-text-primary)" }}>Tools: </span>
                {background.toolProficiencies.join(", ")}
              </p>
            )}
            <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
              <span style={{ color: "var(--scene-text-primary)" }}>Feature: </span>
              {background.feature}
            </p>
          </div>
        )}
      </section>

      {/* ── Ability Scores ───────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
            Ability Scores
          </h2>
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
            {(["standard-array", "point-buy"] as const).map(m => (
              <button
                key={m}
                onClick={() => switchMethod(m)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  background: method === m ? "var(--scene-accent)" : "transparent",
                  color: method === m ? "var(--scene-bg)" : "var(--scene-text-muted)",
                }}
              >
                {m === "standard-array" ? "Standard Array" : "Point Buy"}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs mb-4" style={{ color: "var(--scene-text-muted)" }}>
          {method === "standard-array"
            ? `Assign 15, 14, 13, 12, 10, 8 across your six abilities. Racial bonuses apply on top.`
            : `Start with all 8s and spend ${PB_POOL} points. Costs rise above 13 — max 15 before racial bonuses.`
          }
        </p>

        {method === "point-buy" && (
          <div
            className="flex items-center justify-between px-4 py-2 rounded-lg mb-3"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>Points remaining</span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: pbSpent > PB_POOL ? "#ef4444" : "var(--scene-accent)" }}
            >
              {PB_POOL - pbSpent}
            </span>
          </div>
        )}

        <div className="space-y-2">
          {ABILITY_KEYS.map(ability => {
            const base = assignments[ability]
            const racial = racialBonuses[ability] ?? 0
            const total = (base || 0) + racial
            const showTotal = method === "point-buy" || base !== 0
            const mod = showTotal ? getAbilityModifier(total) : null

            const canIncrease = method === "point-buy"
              && base < 15
              && (pbSpent - (PB_COSTS[base] ?? 0) + (PB_COSTS[base + 1] ?? 999)) <= PB_POOL

            return (
              <div
                key={ability}
                className="flex items-center gap-3 px-4 py-3 rounded-lg"
                style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
              >
                <div
                  className="w-10 text-xs font-bold"
                  style={{ color: "var(--scene-text-primary)", fontFamily: "var(--font-cinzel)" }}
                >
                  {ABILITY_ABBREVIATIONS[ability]}
                </div>
                <div className="flex-1 text-xs hidden sm:block" style={{ color: "var(--scene-text-muted)" }}>
                  {ABILITY_HINTS[ability]}
                </div>
                {racial > 0 && (
                  <span className="text-xs tabular-nums" style={{ color: "var(--scene-accent)" }}>
                    +{racial} racial
                  </span>
                )}

                {method === "standard-array" ? (
                  <select
                    value={base === 0 ? "" : base}
                    onChange={e => handleStandardAssign(ability, e.target.value)}
                    className="w-20 px-2 py-1.5 rounded-md text-sm text-center outline-none appearance-none"
                    style={{
                      background: "var(--scene-border)",
                      color: "var(--scene-text-primary)",
                      border: "none",
                    }}
                  >
                    <option value="">—</option>
                    {STANDARD_ARRAY.map(v => (
                      <option
                        key={v}
                        value={v}
                        disabled={usedStandardValues.has(v) && assignments[ability] !== v}
                      >
                        {v}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handlePBChange(ability, -1)}
                      disabled={base <= 8}
                      className="w-7 h-7 rounded text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-25"
                      style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
                    >
                      −
                    </button>
                    <span
                      className="w-8 text-center text-sm font-bold tabular-nums"
                      style={{ color: "var(--scene-text-primary)" }}
                    >
                      {base}
                    </span>
                    <button
                      onClick={() => handlePBChange(ability, 1)}
                      disabled={!canIncrease}
                      className="w-7 h-7 rounded text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-25"
                      style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
                    >
                      +
                    </button>
                  </div>
                )}

                <div className="w-16 text-right flex items-baseline justify-end gap-1">
                  {showTotal && (
                    <>
                      <span className="text-sm font-bold tabular-nums" style={{ color: "var(--scene-text-primary)" }}>
                        {total}
                      </span>
                      {mod !== null && (
                        <span className="text-xs tabular-nums" style={{ color: "var(--scene-text-muted)" }}>
                          ({formatModifier(mod)})
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Skills ───────────────────────────────────────────────────────────── */}
      {cls && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
              Class Skills
            </h2>
            <span
              className="text-xs"
              style={{ color: selectedSkills.length === skillCount ? "var(--scene-accent)" : "var(--scene-text-muted)" }}
            >
              {selectedSkills.length}/{skillCount} chosen
            </span>
          </div>
          {bgSkills.size > 0 && (
            <p className="text-xs mb-3" style={{ color: "var(--scene-text-muted)" }}>
              Already proficient from background:{" "}
              {Array.from(bgSkills).map(s => SKILL_DISPLAY_NAMES[s]).join(", ")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {classSkillOptions.map(skill => {
              const fromBg = bgSkills.has(skill)
              const selected = selectedSkills.includes(skill)
              const atLimit = !selected && selectedSkills.length >= skillCount
              return (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  disabled={fromBg || atLimit}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: fromBg
                      ? "var(--scene-border)"
                      : selected
                        ? "var(--scene-accent)"
                        : "var(--scene-surface)",
                    color: fromBg
                      ? "var(--scene-text-muted)"
                      : selected
                        ? "var(--scene-bg)"
                        : "var(--scene-text-primary)",
                    border: `1px solid ${fromBg ? "transparent" : selected ? "var(--scene-accent)" : "var(--scene-border)"}`,
                    opacity: atLimit ? 0.4 : 1,
                    cursor: fromBg || atLimit ? "default" : "pointer",
                  }}
                >
                  {SKILL_DISPLAY_NAMES[skill]}
                  {fromBg && " ✓"}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Mobile preview ───────────────────────────────────────────────────── */}
      <div className="lg:hidden">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
          Character Preview
        </p>
        <StatPreview {...previewProps} />
      </div>

      {/* ── Submit ───────────────────────────────────────────────────────────── */}
      <div className="pb-8 space-y-3">
        <button
          onClick={handleSubmit}
          disabled={!isValid || saving}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium transition-all hover:opacity-90 disabled:opacity-40"
          style={{
            background: "var(--scene-accent)",
            color: "var(--scene-bg)",
            fontFamily: "var(--font-cinzel)",
          }}
        >
          <ArrowRight className="h-5 w-5" />
          {saving ? "Creating…" : "Create Character"}
        </button>
        {validationHint && (
          <p className="text-xs text-center" style={{ color: "var(--scene-text-muted)" }}>
            {validationHint}
          </p>
        )}
      </div>
    </div>

    {/* ── Desktop sticky sidebar ────────────────────────────────────────────── */}
    <div className="hidden lg:block lg:sticky lg:top-6">
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
        Character Preview
      </p>
      <StatPreview {...previewProps} />
    </div>
    </div>
  )
}
