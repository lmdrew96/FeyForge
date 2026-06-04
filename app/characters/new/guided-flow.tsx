"use client"

import { useState, useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { RACES, CLASSES, BACKGROUNDS, generateName } from "@/lib/character/character-data"
import type { QuickRollResult } from "@/lib/character/character-data"
import { partitionHomebrew } from "@/lib/homebrew"
import {
  ABILITY_ABBREVIATIONS,
  SKILL_DISPLAY_NAMES,
  type Ability,
  type Skill,
  getAbilityModifier,
  formatModifier,
} from "@/lib/character/constants"
import { ArrowRight, ArrowLeft, RefreshCw, Shield } from "lucide-react"
import { GuidedCompanion } from "@/components/character/guided-companion"

// ── Constants ─────────────────────────────────────────────────────────────────

const ABILITY_KEYS: Ability[] = [
  "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
]

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

const ABILITY_NARRATIVE: Record<Ability, { short: string; long: string }> = {
  strength: {
    short: "Muscle and might",
    long: "Raw physical power — swinging heavy weapons, breaking down doors, grappling enemies. If your character punches things for a living, this is your stat.",
  },
  dexterity: {
    short: "Quickness and grace",
    long: "Agility, reflexes, and precision — dodging attacks, picking locks, firing arrows from the shadows. Dexterity also sets your turn order in combat.",
  },
  constitution: {
    short: "Grit and endurance",
    long: "Not dying. Every point of CON modifier adds to your hit points at every level. Every character benefits from decent Constitution — even if you don't focus on it.",
  },
  intelligence: {
    short: "Booksmarts and arcane insight",
    long: "The Wizard's lifeblood. Also governs Arcana, History, Investigation, Nature, and Religion. Great for characters who know things and solve puzzles.",
  },
  wisdom: {
    short: "Awareness and intuition",
    long: "The Cleric and Druid stat — and the one that drives Perception. If you want to notice ambushes, read people, and not be surprised, put points here.",
  },
  charisma: {
    short: "Force of personality",
    long: "Bards, Sorcerers, Warlocks, and Paladins all cast through Charisma. Also covers Persuasion, Deception, and Intimidation. If you talk your way out of things, this is your stat.",
  },
}

const CLASS_GUIDED_HINT: Record<string, string> = {
  barbarian: "Great for new players who want to wade into melee and hit things very hard. Tough to kill, and Rage is simple to use — just declare it and go.",
  bard: "A social and magical class that's surprisingly resilient. Jack-of-all-trades is a great beginner perk. Works best if you enjoy roleplay and creative problem-solving.",
  cleric: "One of the best beginner classes — you can heal, fight, and cast powerful spells. Your deity shapes your identity and grants bonus abilities.",
  druid: "Nature magic and shapeshifting. Wild Shape gives you a lot of options but can be complex to manage. Strong choice if you enjoy having many tools available.",
  fighter: "The most straightforward class in the game. Excellent hit points, all armors and weapons, and simple but powerful abilities. Ideal first character.",
  monk: "Fast, unarmed combat with ki points for special moves. Rewarding when you learn the system but has more rules to track than simpler classes.",
  paladin: "A holy warrior who combines strong melee combat with support spells. The class that cares most about roleplay — your oath shapes everything.",
  ranger: "A skilled explorer and hunter with nature magic. Works well for players who enjoy tracking, survival, and being effective in the wilds.",
  rogue: "Masters of stealth and precision. Sneak Attack can deal enormous damage. Excellent if you enjoy being clever and picking your moments.",
  sorcerer: "Powerful magic from pure innate talent. Fewer spells than a Wizard but more flexible casting. Good if you want to feel like magic is in your blood.",
  warlock: "A magical pact-maker with limited but rechargeable spell slots. Deeply tied to roleplay through your patron. Strong damage output.",
  wizard: "The broadest spell list in the game. Wizards can do almost anything — but they're fragile and require managing a spellbook. Rewarding long-term.",
}

const STEPS = ["Class", "Race", "Background", "Abilities", "Skills", "Name"] as const
type StepName = typeof STEPS[number]

// ── Props ─────────────────────────────────────────────────────────────────────

interface GuidedFlowProps {
  onComplete: (result: QuickRollResult) => void
  saving: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GuidedFlow({ onComplete, saving }: GuidedFlowProps) {
  const [step, setStep] = useState(0)
  const [classId, setClassId] = useState("")
  const [subclassId, setSubclassId] = useState("")
  const [raceId, setRaceId] = useState("")
  const [subraceId, setSubraceId] = useState("")
  const [backgroundId, setBackgroundId] = useState("")
  const [name, setName] = useState("")
  const [assignments, setAssignments] = useState<Record<Ability, number>>({
    strength: 0, dexterity: 0, constitution: 0,
    intelligence: 0, wisdom: 0, charisma: 0,
  })
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([])

  // ── Content (curated SRD + homebrew you own or that's shared to your campaigns) ─
  const homebrew = useQuery(api.homebrew.listForBuilder)
  const { races: hbRaces, backgrounds: hbBackgrounds, classes: hbClasses } = useMemo(
    () => partitionHomebrew(homebrew),
    [homebrew],
  )
  const allRaces = useMemo(() => [...RACES, ...hbRaces], [hbRaces])
  const allBackgrounds = useMemo(() => [...BACKGROUNDS, ...hbBackgrounds], [hbBackgrounds])
  const allClasses = useMemo(() => [...CLASSES, ...hbClasses], [hbClasses])

  // ── Derived ──────────────────────────────────────────────────────────────────

  const cls = useMemo(() => allClasses.find(c => c.id === classId), [allClasses, classId])
  const subclass = useMemo(() => cls?.subclasses?.find(s => s.id === subclassId), [cls, subclassId])
  const race = useMemo(() => allRaces.find(r => r.id === raceId), [allRaces, raceId])
  const subrace = useMemo(() => race?.subraces?.find(s => s.id === subraceId), [race, subraceId])
  const background = useMemo(() => allBackgrounds.find(b => b.id === backgroundId), [allBackgrounds, backgroundId])

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

  const usedValues = useMemo(
    () => new Set(ABILITY_KEYS.filter(a => assignments[a] !== 0).map(a => assignments[a])),
    [assignments]
  )

  const allAssigned = ABILITY_KEYS.every(a => assignments[a] !== 0)

  const derivedHp = useMemo(() => {
    if (!cls || assignments.constitution === 0) return null
    const conTotal = assignments.constitution + (racialBonuses.constitution ?? 0)
    const conMod = Math.floor((conTotal - 10) / 2)
    return cls.hitDie + conMod
  }, [cls, assignments.constitution, racialBonuses])

  const bgSkills = useMemo(() => new Set<Skill>(background?.skillProficiencies ?? []), [background])
  const classSkillOptions = useMemo(() => cls?.skillChoices.options ?? [], [cls])
  const skillCount = cls?.skillChoices.count ?? 0

  const needsSubrace = !!(race?.subraces?.length && !subraceId)
  const needsSubclass = !!(cls?.subclasses?.length && !subclassId)

  // Step-level "can proceed"
  const canProceed = [
    !!classId && !needsSubclass,                           // 0: Class
    !!raceId && !needsSubrace,                             // 1: Race
    !!backgroundId,                                        // 2: Background
    allAssigned,                                           // 3: Abilities
    selectedSkills.length === skillCount,                  // 4: Skills
    !!name.trim(),                                         // 5: Name
  ]

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleClassChange = (id: string) => {
    setClassId(id)
    setSubclassId("")
    setSelectedSkills([])
  }

  const handleRaceChange = (id: string) => {
    setRaceId(id)
    setSubraceId("")
  }

  const handleAssign = (ability: Ability, raw: string) => {
    const value = parseInt(raw, 10) || 0
    setAssignments(prev => ({ ...prev, [ability]: value }))
  }

  const toggleSkill = (skill: Skill) => {
    if (bgSkills.has(skill)) return
    setSelectedSkills(prev => {
      if (prev.includes(skill)) return prev.filter(s => s !== skill)
      if (prev.length >= skillCount) return prev
      return [...prev, skill]
    })
  }

  const suggestName = () => {
    if (race) setName(generateName(race.id))
  }

  const handleSubmit = () => {
    if (!cls || !race || !background || !name.trim()) return
    const allSkills = Array.from(new Set([...selectedSkills, ...Array.from(bgSkills)])) as Skill[]
    onComplete({
      name: name.trim(),
      race,
      subrace,
      characterClass: cls,
      subclass,
      background,
      baseAbilities: { ...assignments } as Record<Ability, number>,
      racialBonuses,
      skillProficiencies: allSkills,
    })
  }

  // ── Progress bar ─────────────────────────────────────────────────────────────

  const Progress = () => (
    <div className="flex items-center gap-1 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-1 flex-1">
          <div className="flex flex-col items-center gap-1 flex-1">
            <div
              className="h-1 w-full rounded-full transition-all duration-300"
              style={{
                background: i < step
                  ? "var(--scene-accent)"
                  : i === step
                    ? "color-mix(in srgb, var(--scene-accent) 50%, var(--scene-border))"
                    : "var(--scene-border)",
              }}
            />
            <span
              className="text-xs hidden sm:block"
              style={{
                color: i === step ? "var(--scene-accent)" : i < step ? "var(--scene-text-muted)" : "var(--scene-border)",
              }}
            >
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )

  // ── Navigation ────────────────────────────────────────────────────────────────

  const Nav = ({ label = "Continue" }: { label?: string }) => (
    <div className="flex gap-3 mt-8">
      {step > 0 && (
        <button
          onClick={() => setStep(s => s - 1)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--scene-surface)", color: "var(--scene-text-muted)", border: "1px solid var(--scene-border)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      )}
      <button
        onClick={() => setStep(s => s + 1)}
        disabled={!canProceed[step]}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40"
        style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
      >
        {label}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )

  // ── Step: Class ───────────────────────────────────────────────────────────────

  const StepClass = () => (
    <div>
      <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
        Who are you?
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--scene-text-muted)" }}>
        Your class is what you <em>do</em> — how you fight, what magic you wield, where your power comes from. Pick the one that feels right. You can always make another character.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {allClasses.map(c => (
          <button
            key={c.id}
            onClick={() => handleClassChange(c.id)}
            className="text-left px-4 py-3 rounded-xl transition-all hover:opacity-90"
            style={{
              background: classId === c.id ? "color-mix(in srgb, var(--scene-accent) 10%, var(--scene-surface))" : "var(--scene-surface)",
              border: `1px solid ${classId === c.id ? "var(--scene-accent)" : "var(--scene-border)"}`,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm" style={{ color: classId === c.id ? "var(--scene-accent)" : "var(--scene-text-primary)" }}>
                {c.name}
                {c.homebrew && <span className="ml-1" style={{ color: "var(--scene-highlight)" }}>★</span>}
              </span>
              <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>d{c.hitDie}</span>
            </div>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>{c.description}</p>
          </button>
        ))}
      </div>

      {cls && (
        <div
          className="rounded-xl p-4 space-y-2"
          style={{
            background: "color-mix(in srgb, var(--scene-accent) 6%, var(--scene-surface))",
            border: "1px solid color-mix(in srgb, var(--scene-accent) 25%, var(--scene-border))",
          }}
        >
          <p className="text-sm italic font-medium" style={{ color: "var(--scene-accent)" }}>
            &ldquo;{cls.flavorText}&rdquo;
          </p>
          <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
            {CLASS_GUIDED_HINT[cls.id] ?? cls.description}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs pt-1">
            <span style={{ color: "var(--scene-text-muted)" }}>
              <span style={{ color: "var(--scene-text-primary)" }}>Primary stat:</span>{" "}
              {cls.primaryAbility}
            </span>
            <span style={{ color: "var(--scene-text-muted)" }}>
              <span style={{ color: "var(--scene-text-primary)" }}>Saves:</span>{" "}
              {cls.savingThrows.map(s => ABILITY_ABBREVIATIONS[s]).join(", ")}
            </span>
            {cls.spellcasting && (
              <span style={{ color: "var(--scene-text-muted)" }}>
                <span style={{ color: "var(--scene-text-primary)" }}>Spellcaster</span>
              </span>
            )}
          </div>

          {/* Subclass picker (homebrew classes that define subclasses) */}
          {cls.subclasses && cls.subclasses.length > 0 && (
            <div className="pt-1">
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>
                Subclass <span style={{ color: "var(--scene-accent)" }}>*</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {cls.subclasses.map(sc => (
                  <button
                    key={sc.id}
                    onClick={() => setSubclassId(prev => prev === sc.id ? "" : sc.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: subclassId === sc.id ? "var(--scene-highlight)" : "var(--scene-surface)",
                      color: subclassId === sc.id ? "#fff" : "var(--scene-text-primary)",
                      border: `1px solid ${subclassId === sc.id ? "var(--scene-highlight)" : "var(--scene-border)"}`,
                    }}
                  >
                    {sc.name}
                  </button>
                ))}
              </div>
              {subclass && (
                <p className="mt-2 text-xs" style={{ color: "var(--scene-text-muted)" }}>{subclass.description}</p>
              )}
            </div>
          )}
        </div>
      )}

      <Nav />
    </div>
  )

  // ── Step: Race ────────────────────────────────────────────────────────────────

  const StepRace = () => (
    <div>
      <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
        Where do you come from?
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--scene-text-muted)" }}>
        Race shapes your history, your body, and some of your innate abilities. It also gives you bonuses to certain ability scores.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {allRaces.map(r => (
          <button
            key={r.id}
            onClick={() => handleRaceChange(r.id)}
            className="text-left px-3 py-2.5 rounded-xl transition-all hover:opacity-90"
            style={{
              background: raceId === r.id ? "color-mix(in srgb, var(--scene-accent) 10%, var(--scene-surface))" : "var(--scene-surface)",
              border: `1px solid ${raceId === r.id ? "var(--scene-accent)" : "var(--scene-border)"}`,
            }}
          >
            <span className="block font-semibold text-sm" style={{ color: raceId === r.id ? "var(--scene-accent)" : "var(--scene-text-primary)" }}>
              {r.name}
              {r.homebrew && <span className="ml-1" style={{ color: "var(--scene-highlight)" }}>★</span>}
            </span>
            <span className="block text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
              {Object.entries(r.abilityBonuses).map(([k, v]) => `+${v} ${ABILITY_ABBREVIATIONS[k as Ability]}`).join(", ") || "Various bonuses"}
            </span>
          </button>
        ))}
      </div>

      {race && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            background: "color-mix(in srgb, var(--scene-accent) 6%, var(--scene-surface))",
            border: "1px solid color-mix(in srgb, var(--scene-accent) 25%, var(--scene-border))",
          }}
        >
          <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>{race.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {race.traits.map(t => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}>
                {t}
              </span>
            ))}
          </div>

          {race.subraces && race.subraces.length > 0 && (
            <div className="pt-1">
              <p className="text-xs mb-2" style={{ color: "var(--scene-text-muted)" }}>
                <span style={{ color: "var(--scene-text-primary)" }}>Choose a subrace</span> — each one gives different bonuses and traits:
              </p>
              <div className="space-y-2">
                {race.subraces.map(sr => (
                  <button
                    key={sr.id}
                    onClick={() => setSubraceId(prev => prev === sr.id ? "" : sr.id)}
                    className="w-full text-left px-3 py-2.5 rounded-lg transition-all"
                    style={{
                      background: subraceId === sr.id ? "color-mix(in srgb, var(--scene-highlight) 10%, var(--scene-surface))" : "var(--scene-surface)",
                      border: `1px solid ${subraceId === sr.id ? "var(--scene-highlight)" : "var(--scene-border)"}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: subraceId === sr.id ? "var(--scene-highlight)" : "var(--scene-text-primary)" }}>
                        {sr.name}
                      </span>
                      <span className="text-xs" style={{ color: "var(--scene-accent)" }}>
                        {Object.entries(sr.abilityBonuses).map(([k, v]) => `+${v} ${ABILITY_ABBREVIATIONS[k as Ability]}`).join(", ")}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>{sr.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Nav />
    </div>
  )

  // ── Step: Background ──────────────────────────────────────────────────────────

  const StepBackground = () => (
    <div>
      <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
        What did you do before this?
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--scene-text-muted)" }}>
        Your background is who you were before you became an adventurer. It gives you skills, sometimes tool proficiencies, and a special feature that shapes how the world responds to you.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {allBackgrounds.map(b => (
          <button
            key={b.id}
            onClick={() => setBackgroundId(b.id)}
            className="text-left px-4 py-3 rounded-xl transition-all hover:opacity-90"
            style={{
              background: backgroundId === b.id ? "color-mix(in srgb, var(--scene-accent) 10%, var(--scene-surface))" : "var(--scene-surface)",
              border: `1px solid ${backgroundId === b.id ? "var(--scene-accent)" : "var(--scene-border)"}`,
            }}
          >
            <span className="block font-semibold text-sm" style={{ color: backgroundId === b.id ? "var(--scene-accent)" : "var(--scene-text-primary)" }}>
              {b.name}
              {b.homebrew && <span className="ml-1" style={{ color: "var(--scene-highlight)" }}>★</span>}
            </span>
            <span className="block text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
              {b.skillProficiencies.map(s => SKILL_DISPLAY_NAMES[s]).join(", ")}
            </span>
          </button>
        ))}
      </div>

      {background && (
        <div
          className="rounded-xl p-4 space-y-2"
          style={{
            background: "color-mix(in srgb, var(--scene-accent) 6%, var(--scene-surface))",
            border: "1px solid color-mix(in srgb, var(--scene-accent) 25%, var(--scene-border))",
          }}
        >
          <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>{background.description}</p>
          <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
            <span style={{ color: "var(--scene-text-primary)" }}>Feature: </span>{background.feature}
          </p>
          {background.toolProficiencies.length > 0 && (
            <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
              <span style={{ color: "var(--scene-text-primary)" }}>Tools: </span>{background.toolProficiencies.join(", ")}
            </p>
          )}
        </div>
      )}

      <Nav />
    </div>
  )

  // ── Step: Abilities ───────────────────────────────────────────────────────────

  const StepAbilities = () => (
    <div>
      <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
        How capable are you?
      </h2>
      <p className="text-sm mb-2" style={{ color: "var(--scene-text-muted)" }}>
        Assign the six values below to your abilities. Your highest score should probably go to your primary stat
        {cls ? <span style={{ color: "var(--scene-accent)" }}> ({cls.primaryAbility}, for {cls.name})</span> : ""}.
      </p>
      <p className="text-xs mb-6" style={{ color: "var(--scene-text-muted)" }}>
        Standard array: 15, 14, 13, 12, 10, 8 — each used exactly once. Racial bonuses are added on top.
      </p>

      <div className="space-y-2 mb-4">
        {ABILITY_KEYS.map(ability => {
          const base = assignments[ability]
          const racial = racialBonuses[ability] ?? 0
          const total = (base || 0) + racial
          const mod = base ? getAbilityModifier(total) : null
          const isPrimary = cls?.primaryAbility === ability
          const info = ABILITY_NARRATIVE[ability]

          return (
            <div
              key={ability}
              className="rounded-xl overflow-hidden"
              style={{
                border: `1px solid ${isPrimary ? "color-mix(in srgb, var(--scene-accent) 40%, var(--scene-border))" : "var(--scene-border)"}`,
              }}
            >
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ background: isPrimary ? "color-mix(in srgb, var(--scene-accent) 5%, var(--scene-surface))" : "var(--scene-surface)" }}
              >
                <div className="w-10">
                  <div className="text-xs font-bold" style={{ color: isPrimary ? "var(--scene-accent)" : "var(--scene-text-primary)", fontFamily: "var(--font-cinzel)" }}>
                    {ABILITY_ABBREVIATIONS[ability]}
                  </div>
                  {isPrimary && (
                    <div className="text-xs" style={{ color: "var(--scene-accent)", opacity: 0.7 }}>primary</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium" style={{ color: "var(--scene-text-primary)" }}>{info.short}</div>
                  <div className="text-xs leading-relaxed hidden sm:block" style={{ color: "var(--scene-text-muted)" }}>{info.long}</div>
                </div>
                {racial > 0 && (
                  <span className="text-xs" style={{ color: "var(--scene-accent)" }}>+{racial} racial</span>
                )}
                <select
                  value={base === 0 ? "" : base}
                  onChange={e => handleAssign(ability, e.target.value)}
                  className="w-20 px-2 py-1.5 rounded-md text-sm text-center outline-none appearance-none"
                  style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)", border: "none" }}
                >
                  <option value="">—</option>
                  {STANDARD_ARRAY.map(v => (
                    <option key={v} value={v} disabled={usedValues.has(v) && assignments[ability] !== v}>
                      {v}
                    </option>
                  ))}
                </select>
                <div className="w-14 text-right flex items-baseline justify-end gap-1">
                  {base !== 0 && (
                    <>
                      <span className="text-sm font-bold tabular-nums" style={{ color: "var(--scene-text-primary)" }}>{total}</span>
                      {mod !== null && (
                        <span className="text-xs tabular-nums" style={{ color: "var(--scene-text-muted)" }}>({formatModifier(mod)})</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Nav />
    </div>
  )

  // ── Step: Skills ──────────────────────────────────────────────────────────────

  const StepSkills = () => (
    <div>
      <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
        What are you good at?
      </h2>
      <p className="text-sm mb-2" style={{ color: "var(--scene-text-muted)" }}>
        Skills are specific things your character has trained in. Choose <span style={{ color: "var(--scene-accent)" }}>{skillCount}</span> from the options your class offers.
        Your background already gave you a few for free.
      </p>

      {bgSkills.size > 0 && (
        <div className="mb-4 px-4 py-3 rounded-xl" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--scene-text-muted)" }}>From your background ({background?.name}):</p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(bgSkills).map(s => (
              <span key={s} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                {SKILL_DISPLAY_NAMES[s]} ✓
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
          Class skills — pick {skillCount}:
        </p>
        <span className="text-xs" style={{ color: selectedSkills.length === skillCount ? "var(--scene-accent)" : "var(--scene-text-muted)" }}>
          {selectedSkills.length}/{skillCount}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
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
                background: fromBg ? "var(--scene-border)" : selected ? "var(--scene-accent)" : "var(--scene-surface)",
                color: fromBg ? "var(--scene-text-muted)" : selected ? "var(--scene-bg)" : "var(--scene-text-primary)",
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

      <Nav />
    </div>
  )

  // ── Step: Name + Confirm ──────────────────────────────────────────────────────

  const StepName = () => {
    if (!cls || !race || !background) return null

    const raceName = subrace ? `${subrace.name} ${race.name}` : race.name
    const hitDie = cls.hitDie
    const conTotal = (assignments.constitution || 0) + (racialBonuses.constitution ?? 0)
    const conMod = Math.floor((conTotal - 10) / 2)
    const maxHp = hitDie + conMod
    const allSkills = Array.from(new Set([...selectedSkills, ...Array.from(bgSkills)])) as Skill[]

    return (
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
          One last thing.
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--scene-text-muted)" }}>
          Every hero has a name. What do they call yours?
        </p>

        <div className="flex gap-2 mb-6">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={`Name your ${raceName} ${cls.name}…`}
            className="flex-1 px-4 py-3 rounded-xl text-lg font-medium bg-transparent outline-none"
            style={{
              border: "1px solid var(--scene-border)",
              color: "var(--scene-text-primary)",
              fontFamily: "var(--font-cinzel)",
            }}
          />
          <button
            onClick={suggestName}
            className="px-4 py-3 rounded-xl text-sm flex items-center gap-2 transition-opacity hover:opacity-80"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-muted)" }}
            title="Suggest a name"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Preview card */}
        {name.trim() && (
          <div
            className="rounded-xl overflow-hidden mb-6"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            <div
              className="px-6 py-4 border-b"
              style={{
                borderColor: "var(--scene-border)",
                background: "color-mix(in srgb, var(--scene-accent) 8%, var(--scene-surface))",
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                    {name.trim()}
                  </h3>
                  <p className="text-sm mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
                    {raceName} · {cls.name} · {background.name}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>Level 1</div>
                  <div className="text-sm font-medium" style={{ color: "var(--scene-accent)" }}>
                    {maxHp} HP · d{hitDie}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 grid grid-cols-3 gap-4 text-xs">
              <div>
                <div className="uppercase tracking-widest mb-1.5" style={{ color: "var(--scene-text-muted)" }}>Abilities</div>
                {ABILITY_KEYS.map(a => {
                  const base = assignments[a] || 0
                  const racial = racialBonuses[a] ?? 0
                  const total = base + racial
                  const mod = getAbilityModifier(total)
                  return (
                    <div key={a} className="flex justify-between">
                      <span style={{ color: "var(--scene-text-muted)" }}>{ABILITY_ABBREVIATIONS[a]}</span>
                      <span style={{ color: "var(--scene-text-primary)" }}>
                        {total} <span style={{ color: "var(--scene-text-muted)" }}>({formatModifier(mod)})</span>
                      </span>
                    </div>
                  )
                })}
              </div>
              <div>
                <div className="uppercase tracking-widest mb-1.5" style={{ color: "var(--scene-text-muted)" }}>Saves</div>
                {cls.savingThrows.map(s => (
                  <div key={s} className="capitalize" style={{ color: "var(--scene-text-primary)" }}>{s}</div>
                ))}
              </div>
              <div>
                <div className="uppercase tracking-widest mb-1.5" style={{ color: "var(--scene-text-muted)" }}>Skills</div>
                {allSkills.map(s => (
                  <div key={s} className="capitalize" style={{ color: "var(--scene-text-primary)" }}>
                    {SKILL_DISPLAY_NAMES[s]}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--scene-surface)", color: "var(--scene-text-muted)", border: "1px solid var(--scene-border)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)", fontFamily: "var(--font-cinzel)" }}
          >
            <Shield className="h-4 w-4" />
            {saving ? "Creating…" : "Enter the World"}
          </button>
        </div>
      </div>
    )
  }

  // ── Companion state string ────────────────────────────────────────────────────

  const companionState = useMemo(() => {
    const lines: string[] = [`Step: ${STEPS[step]} (${step + 1} of ${STEPS.length})`]
    if (cls) lines.push(`Class: ${cls.name} (primary stat: ${cls.primaryAbility}, hit die: d${cls.hitDie}${cls.spellcasting ? ", spellcaster" : ""})`)
    if (race) lines.push(`Race: ${subrace ? `${subrace.name} ${race.name}` : race.name}`)
    if (background) lines.push(`Background: ${background.name}`)
    const assigned = ABILITY_KEYS.filter(a => assignments[a] !== 0)
    if (assigned.length > 0) {
      const scores = assigned.map(a => {
        const base = assignments[a]
        const racial = racialBonuses[a] ?? 0
        const total = base + racial
        return `${ABILITY_ABBREVIATIONS[a]} ${total} (${formatModifier(getAbilityModifier(total))})`
      })
      lines.push(`Abilities so far: ${scores.join(", ")}`)
    }
    if (selectedSkills.length > 0) {
      lines.push(`Skills chosen: ${selectedSkills.map(s => SKILL_DISPLAY_NAMES[s]).join(", ")}`)
    }
    return lines.join("\n")
  }, [step, cls, race, subrace, background, assignments, racialBonuses, selectedSkills])

  // ── Render ────────────────────────────────────────────────────────────────────

  const steps = [StepClass, StepRace, StepBackground, StepAbilities, StepSkills, StepName]
  const CurrentStep = steps[step]

  return (
    <div className="max-w-2xl mx-auto">
      <Progress />

      {/* Summary strip — hidden on Name step (step 5) which has its own full preview */}
      {step < 5 && (classId || raceId || backgroundId) && (
        <div
          className="mb-6 rounded-xl px-4 py-3 space-y-2.5"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            {cls && (
              <span
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{
                  background: "color-mix(in srgb, var(--scene-accent) 12%, var(--scene-surface))",
                  color: "var(--scene-accent)",
                  border: "1px solid color-mix(in srgb, var(--scene-accent) 25%, transparent)",
                }}
              >
                {cls.name}
              </span>
            )}
            {race && (
              <span
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{
                  background: "color-mix(in srgb, var(--scene-highlight) 12%, var(--scene-surface))",
                  color: "var(--scene-highlight)",
                  border: "1px solid color-mix(in srgb, var(--scene-highlight) 25%, transparent)",
                }}
              >
                {subrace ? `${subrace.name} ${race.name}` : race.name}
              </span>
            )}
            {background && (
              <span
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
              >
                {background.name}
              </span>
            )}
            {derivedHp !== null && (
              <span className="ml-auto text-xs" style={{ color: "var(--scene-text-muted)" }}>
                <span style={{ color: "var(--scene-text-primary)" }}>{derivedHp} HP</span>
                {" "}· d{cls?.hitDie}
              </span>
            )}
          </div>
          {ABILITY_KEYS.some(a => assignments[a] !== 0) && (
            <div
              className="grid grid-cols-3 sm:grid-cols-6 gap-1 pt-2.5 border-t"
              style={{ borderColor: "var(--scene-border)" }}
            >
              {ABILITY_KEYS.map(a => {
                const base = assignments[a]
                const racial = racialBonuses[a] ?? 0
                const total = (base || 0) + racial
                const mod = base ? getAbilityModifier(total) : null
                return (
                  <div key={a} className="text-center">
                    <div className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                      {ABILITY_ABBREVIATIONS[a]}
                    </div>
                    <div
                      className="text-sm font-bold"
                      style={{ color: base ? "var(--scene-text-primary)" : "var(--scene-border)" }}
                    >
                      {base ? total : "—"}
                    </div>
                    {mod !== null && (
                      <div style={{ fontSize: "10px", color: "var(--scene-text-muted)" }}>
                        {formatModifier(mod)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <CurrentStep />

      <GuidedCompanion characterState={companionState} />
    </div>
  )
}
