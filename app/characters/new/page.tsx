"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { AppShell } from "@/components/app-shell"
import { Wand2, Dice6, BookOpen, ArrowLeft, RefreshCw, Check, Sparkles, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  RACES,
  CLASSES,
  BACKGROUNDS,
  quickRollCharacter,
  autoPickSkillProficiencies,
  generateName,
  deriveDarkvision,
  getCreationFightingStyles,
  formatRaceName,
  type QuickRollResult,
} from "@/lib/character/character-data"
import { autoResolveToolProficiencies } from "@/lib/character/tool-choices"
import { resolveLanguages } from "@/lib/character/language-choices"
import { CLASS_HIT_DICE } from "@/lib/character/constants"
import type { Ability } from "@/lib/character/constants"
import { initSpellcasting } from "@/lib/character/leveling"
import { getStartingLoadout } from "@/lib/character/starting-equipment"
import { useOnboardingStore } from "@/lib/onboarding-store"
import { DEFAULT_EDITION } from "@/lib/editions"
import { NormalBuilder } from "./normal-builder"
import { GuidedFlow } from "./guided-flow"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

type BuildSuggestion = {
  race: string
  subrace?: string
  raceReason: string
  class: string
  subclass?: string
  classReason: string
  background: string
  backgroundReason: string
  abilityPriority: string[]
  suggestedAbilities: Record<Ability, number>
  keySynergies: string[]
  playstyleTips: string[]
  levelProgression: string
}

const findRace = (name: string) => {
  const lower = name.toLowerCase()
  return RACES.find((r) => r.name.toLowerCase() === lower)
}
const findSubrace = (raceName: string, subraceName?: string) => {
  if (!subraceName) return undefined
  const race = findRace(raceName)
  const lower = subraceName.toLowerCase()
  return race?.subraces?.find((s) => s.name.toLowerCase() === lower)
}
const findClass = (name: string) => {
  const lower = name.toLowerCase()
  return CLASSES.find((c) => c.name.toLowerCase() === lower)
}
const findBackground = (name: string) => {
  const lower = name.toLowerCase()
  return BACKGROUNDS.find((b) => b.name.toLowerCase() === lower)
}

type CreationMode = "choose" | "quick-roll-preview" | "guided" | "normal"

const CHOICE_CARDS = [
  {
    id: "quick-roll",
    icon: Dice6,
    title: "Quick Roll",
    subtitle: "A hero in 60 seconds",
    description: "Let fate decide. We'll roll your stats, pick a race and class, and hand you a ready-to-play character.",
    accent: "var(--scene-accent)",
    available: true,
  },
  {
    id: "concept",
    icon: Sparkles,
    title: "From Concept",
    subtitle: "Describe your hero",
    description: "Type a few sentences about who they are. We'll let AI suggest a build that fits the vision.",
    accent: "var(--scene-highlight)",
    available: true,
  },
  {
    id: "guided",
    icon: BookOpen,
    title: "Guided",
    subtitle: "Step by step",
    description: "New to D&D? We'll walk you through every choice with lore, tips, and flavor text.",
    accent: "var(--scene-highlight)",
    available: true,
  },
  {
    id: "normal",
    icon: Wand2,
    title: "Builder",
    subtitle: "Full control",
    description: "Experienced player? Take the wheel. Every option, every stat, your way.",
    accent: "var(--scene-text-primary)",
    available: true,
  },
]

function AbilityRow({ label, base, bonus }: { label: string; base: number; bonus?: number }) {
  const total = base + (bonus ?? 0)
  const mod = Math.floor((total - 10) / 2)
  const modStr = mod >= 0 ? `+${mod}` : `${mod}`
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        {bonus ? (
          <span className="text-xs" style={{ color: "var(--scene-accent)" }}>
            {base}+{bonus}
          </span>
        ) : (
          <span className="text-sm" style={{ color: "var(--scene-text-primary)" }}>
            {base}
          </span>
        )}
        <span
          className="w-10 text-center text-sm font-bold rounded"
          style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}
        >
          {total}
        </span>
        <span className="w-8 text-right text-xs" style={{ color: "var(--scene-text-muted)" }}>
          {modStr}
        </span>
      </div>
    </div>
  )
}

function QuickRollPreview({
  result,
  onReroll,
  onConfirm,
  saving,
}: {
  result: QuickRollResult
  onReroll: () => void
  onConfirm: (editedName: string) => void
  saving: boolean
}) {
  const [editedName, setEditedName] = useState(result.name)
  const { race, subrace, characterClass, background, baseAbilities, racialBonuses } = result
  const raceName = formatRaceName(race.name, subrace?.name)
  const conTotal = baseAbilities.constitution + (racialBonuses.constitution ?? 0)
  const conMod = Math.floor((conTotal - 10) / 2)
  const hitDie = CLASS_HIT_DICE[characterClass.id] ?? 8
  const maxHp = hitDie + conMod

  return (
    <div className="max-w-2xl mx-auto">
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b"
          style={{ borderColor: "var(--scene-border)", background: "color-mix(in srgb, var(--scene-accent) 8%, var(--scene-surface))" }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 mr-4">
              <div className="flex items-center gap-2">
                <input
                  value={editedName}
                  onChange={e => setEditedName(e.target.value)}
                  className="text-2xl font-bold bg-transparent outline-none w-full min-w-0"
                  style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
                />
                <button
                  onClick={() => setEditedName(generateName(race.id))}
                  title="Suggest a different name"
                  className="shrink-0 transition-opacity hover:opacity-70"
                  style={{ color: "var(--scene-text-muted)" }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-sm mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
                {raceName} · {characterClass.name} · {background.name}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
                Level 1
              </div>
              <div className="text-sm font-medium" style={{ color: "var(--scene-accent)" }}>
                {maxHp} HP · d{hitDie}
              </div>
            </div>
          </div>
          <p
            className="text-sm mt-3 italic"
            style={{ color: "var(--scene-text-muted)" }}
          >
            &ldquo;{characterClass.flavorText}&rdquo;
          </p>
        </div>

        {/* Ability Scores */}
        <div className="px-6 py-4">
          <h3
            className="text-xs uppercase tracking-widest mb-3"
            style={{ color: "var(--scene-text-muted)" }}
          >
            Ability Scores
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            {(
              [
                ["STR", "strength"],
                ["DEX", "dexterity"],
                ["CON", "constitution"],
                ["INT", "intelligence"],
                ["WIS", "wisdom"],
                ["CHA", "charisma"],
              ] as [string, keyof typeof baseAbilities][]
            ).map(([label, key]) => (
              <AbilityRow
                key={key}
                label={label}
                base={baseAbilities[key]}
                bonus={racialBonuses[key as keyof typeof racialBonuses]}
              />
            ))}
          </div>
        </div>

        {/* Traits */}
        <div
          className="px-6 py-4 border-t"
          style={{ borderColor: "var(--scene-border)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>
                Race Traits
              </div>
              <ul className="space-y-0.5">
                {[...race.traits, ...(subrace?.traits ?? [])].slice(0, 4).map((t) => (
                  <li key={t} style={{ color: "var(--scene-text-primary)" }}>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>
                Class Saves
              </div>
              <ul className="space-y-0.5">
                {characterClass.savingThrows.map((s) => (
                  <li key={s} className="capitalize" style={{ color: "var(--scene-text-primary)" }}>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>
                Skills
              </div>
              <ul className="space-y-0.5">
                {result.skillProficiencies.slice(0, 5).map((s) => (
                  <li key={s} className="capitalize" style={{ color: "var(--scene-text-primary)" }}>
                    {s.replace(/([A-Z])/g, " $1").trim()}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div
          className="px-6 py-4 border-t flex flex-col sm:flex-row gap-3"
          style={{ borderColor: "var(--scene-border)" }}
        >
          <button
            onClick={onReroll}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium flex-1 transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}
          >
            <RefreshCw className="h-4 w-4" />
            Reroll
          </button>
          <button
            onClick={() => onConfirm(editedName.trim() || result.name)}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium flex-1 transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Play This Character"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NewCharacterPage() {
  const router = useRouter()
  const createCharacter = useMutation(api.characters.create)
  const addProperty = useMutation(api.characters.addProperty)
  const pendingJoinCode = useOnboardingStore((s) => s.pendingJoinCode)
  const clearPendingJoinCode = useOnboardingStore((s) => s.clearPendingJoinCode)

  // Where to land after a successful create. A player who came here mid-join (the
  // join page stashed their invite code) is returned to that join page with their
  // new character in hand — otherwise the normal roster. Clears the code so it's
  // a one-shot hand-off and can't bounce later, unrelated creations.
  const goAfterCreate = () => {
    if (pendingJoinCode) {
      const code = pendingJoinCode
      clearPendingJoinCode()
      router.push(`/session/join/${encodeURIComponent(code)}`)
    } else {
      router.push("/characters")
    }
  }
  const [mode, setMode] = useState<CreationMode>("choose")
  const [rolled, setRolled] = useState<QuickRollResult | null>(null)
  const [rollCount, setRollCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [conceptOpen, setConceptOpen] = useState(false)
  const [conceptText, setConceptText] = useState("")
  const [conceptName, setConceptName] = useState("")
  const [generatingBuild, setGeneratingBuild] = useState(false)
  const [buildSuggestion, setBuildSuggestion] = useState<BuildSuggestion | null>(null)

  const handleQuickRoll = () => {
    setRolled(quickRollCharacter())
    setRollCount(c => c + 1)
    setMode("quick-roll-preview")
  }

  const handleReroll = () => {
    setRolled(quickRollCharacter())
    setRollCount(c => c + 1)
  }

  const saveCharacter = async (result: QuickRollResult) => {
    setSaving(true)
    try {
      const { race, subrace, characterClass, subclass, background, baseAbilities, racialBonuses, skillProficiencies, name } = result
      // Curated classes resolve via the id-keyed map (unchanged); homebrew ids
      // miss it and fall through to the class's own hitDie.
      const hitDie = CLASS_HIT_DICE[characterClass.id] ?? characterClass.hitDie ?? 8
      const conTotal = baseAbilities.constitution + (racialBonuses.constitution ?? 0)
      const conMod = Math.floor((conTotal - 10) / 2)
      const maxHp = hitDie + conMod
      // Seed the spellcasting block for casters so slots/DC/attack are live on the
      // sheet from level 1 (null for non-casters → omitted). Curated ids resolve a
      // caster type; homebrew ids fall through to null, same as on the sheet.
      // Edition is unknowable at creation (no campaign yet) → DEFAULT_EDITION; the
      // only L1 edition-dependent value is the 2024 half-caster's L1 slot, which the
      // sheet's edition-aware recompute corrects once they join a 2014 campaign.
      const spellcasting = initSpellcasting(characterClass.id, 1, baseAbilities, DEFAULT_EDITION, racialBonuses) ?? undefined

      const choice = result.startingChoice ?? "equipment"
      const loadout = getStartingLoadout(characterClass.id, background.equipment, choice)

      const newId = await createCharacter({
        name,
        race: race.name,
        subrace: subrace?.name,
        characterClass: characterClass.name,
        subclass: subclass?.name,
        level: 1,
        experiencePoints: 0,
        background: background.name,
        // Free-text at creation (no campaign/pantheon yet); the edit page offers the
        // world's pantheon picker once the character joins a faith-bearing campaign.
        faith: result.faith?.trim() ? { name: result.faith.trim() } : undefined,
        imageUrl: result.imageUrl?.trim() || undefined,
        baseAbilities,
        racialBonuses: Object.keys(racialBonuses).length > 0 ? racialBonuses : undefined,
        hitPoints: { current: maxHp, max: maxHp, temp: 0 },
        hitDice: [{ diceSize: hitDie, total: 1, used: 0 }],
        deathSaves: { successes: 0, failures: 0 },
        speed: subrace?.speed ?? race.speed,
        darkvision: deriveDarkvision(race, subrace),
        inspiration: false,
        savingThrowProficiencies: characterClass.savingThrows,
        skillProficiencies,
        skillExpertise: [],
        armorProficiencies: characterClass.armorProficiencies,
        weaponProficiencies: characterClass.weaponProficiencies,
        toolProficiencies:
          result.toolProficiencies ??
          autoResolveToolProficiencies([...characterClass.toolProficiencies, ...background.toolProficiencies]),
        languages: result.languages ?? resolveLanguages(race.languages, background.languages),
        currency: { cp: 0, sp: 0, ep: 0, gp: loadout.gold, pp: 0 },
        spellcasting,
      })
      await Promise.all(
        loadout.items.map((it, i) =>
          addProperty({
            characterId: newId,
            type: "item",
            name: it.name,
            active: true,
            equipped: it.equipped ?? false,
            orderIndex: i,
            data: it.data,
          }),
        ),
      )
      // Fighting style (Fighter L1) → a descriptive feature, like a class feature.
      if (result.fightingStyle) {
        await addProperty({
          characterId: newId,
          type: "feature",
          name: `Fighting Style: ${result.fightingStyle.name}`,
          description: result.fightingStyle.description,
          source: "Fighting Style",
          active: true,
          orderIndex: 0,
          data: { fightingStyleId: result.fightingStyle.id },
        })
      }
      toast.success(`${name} is ready to adventure!`)
      goAfterCreate()
    } catch {
      toast.error("Failed to save character. Please try again.")
      setSaving(false)
    }
  }

  const handleConfirm = (editedName: string) => {
    if (!rolled) return
    saveCharacter({ ...rolled, name: editedName })
  }

  const handleGenerateBuild = async () => {
    if (!conceptText.trim()) {
      toast.error("Describe your concept first.")
      return
    }
    setGeneratingBuild(true)
    setBuildSuggestion(null)
    try {
      const res = await fetch("/api/character/suggest-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept: conceptText.trim() }),
      })
      if (!res.ok) throw new Error("Failed to generate a build")
      const data = (await res.json()) as { suggestion?: BuildSuggestion }
      if (!data.suggestion) throw new Error("No build returned")
      setBuildSuggestion(data.suggestion)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate a build.")
    } finally {
      setGeneratingBuild(false)
    }
  }

  const handleAcceptBuild = async () => {
    if (!buildSuggestion) return
    const race = findRace(buildSuggestion.race)
    const cls = findClass(buildSuggestion.class)
    const background = findBackground(buildSuggestion.background)
    if (!race || !cls || !background) {
      toast.error(
        `AI suggested ${[
          !race && `race "${buildSuggestion.race}"`,
          !cls && `class "${buildSuggestion.class}"`,
          !background && `background "${buildSuggestion.background}"`,
        ]
          .filter(Boolean)
          .join(", ")}, which we don't recognise. Try regenerating.`,
      )
      return
    }
    const subrace = findSubrace(buildSuggestion.race, buildSuggestion.subrace)
    const finalName = conceptName.trim() || generateName(race.id)

    const racialBonuses: Partial<Record<Ability, number>> = {}
    const merge = (src?: Partial<Record<Ability, number>>) => {
      if (!src) return
      for (const [k, v] of Object.entries(src) as [Ability, number][]) {
        racialBonuses[k] = (racialBonuses[k] ?? 0) + v
      }
    }
    merge(race.abilityBonuses)
    merge(subrace?.abilityBonuses)

    const baseAbilities = buildSuggestion.suggestedAbilities
    const conTotal = baseAbilities.constitution + (racialBonuses.constitution ?? 0)
    const conMod = Math.floor((conTotal - 10) / 2)
    const hitDie = CLASS_HIT_DICE[cls.id] ?? cls.hitDie ?? 8
    const maxHp = hitDie + conMod
    // Edition unknown at creation (no campaign) → DEFAULT_EDITION; see saveCharacter.
    const spellcasting = initSpellcasting(cls.id, 1, baseAbilities, DEFAULT_EDITION, racialBonuses) ?? undefined

    // From Concept defaults to the equipment package (no interactive choice).
    const loadout = getStartingLoadout(cls.id, background.equipment, "equipment")

    // Fighting style (Fighter L1): the AI build doesn't pick one, so auto-pick for
    // parity with Quick Roll (both non-interactive builders auto-resolve choices).
    const styleOptions = getCreationFightingStyles(cls.id)
    const fightingStyle = styleOptions.length
      ? styleOptions[Math.floor(Math.random() * styleOptions.length)]
      : undefined

    setSaving(true)
    try {
      const newId = await createCharacter({
        name: finalName,
        race: race.name,
        subrace: subrace?.name,
        characterClass: cls.name,
        subclass: buildSuggestion.subclass || undefined,
        level: 1,
        experiencePoints: 0,
        background: background.name,
        baseAbilities,
        racialBonuses: Object.keys(racialBonuses).length > 0 ? racialBonuses : undefined,
        hitPoints: { current: maxHp, max: maxHp, temp: 0 },
        hitDice: [{ diceSize: hitDie, total: 1, used: 0 }],
        deathSaves: { successes: 0, failures: 0 },
        speed: subrace?.speed ?? race.speed,
        darkvision: deriveDarkvision(race, subrace),
        inspiration: false,
        savingThrowProficiencies: cls.savingThrows,
        skillProficiencies: autoPickSkillProficiencies(cls, background),
        skillExpertise: [],
        armorProficiencies: cls.armorProficiencies,
        weaponProficiencies: cls.weaponProficiencies,
        toolProficiencies: autoResolveToolProficiencies([...cls.toolProficiencies, ...background.toolProficiencies]),
        languages: resolveLanguages(race.languages, background.languages),
        currency: { cp: 0, sp: 0, ep: 0, gp: loadout.gold, pp: 0 },
        spellcasting,
      })
      await Promise.all(
        loadout.items.map((it, i) =>
          addProperty({
            characterId: newId,
            type: "item",
            name: it.name,
            active: true,
            equipped: it.equipped ?? false,
            orderIndex: i,
            data: it.data,
          }),
        ),
      )
      if (fightingStyle) {
        await addProperty({
          characterId: newId,
          type: "feature",
          name: `Fighting Style: ${fightingStyle.name}`,
          description: fightingStyle.description,
          source: "Fighting Style",
          active: true,
          orderIndex: 0,
          data: { fightingStyleId: fightingStyle.id },
        })
      }
      toast.success(`${finalName} is ready to adventure!`)
      setConceptOpen(false)
      goAfterCreate()
    } catch {
      toast.error("Failed to save character. Please try again.")
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {/* Back */}
        <button
          onClick={() => {
            if (mode === "quick-roll-preview" || mode === "normal" || mode === "guided") {
              setMode("choose")
            } else {
              router.push("/characters")
            }
          }}
          className="inline-flex items-center gap-2 text-sm mb-6 transition-opacity hover:opacity-80"
          style={{ color: "var(--scene-text-muted)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          {mode === "choose" ? "Back to characters" : "Back to choices"}
        </button>

        {mode === "choose" && (
          <>
            <div className="mb-8">
              <h1
                className="text-3xl font-bold mb-2"
                style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
              >
                Create a Character
              </h1>
              <p style={{ color: "var(--scene-text-muted)" }}>
                Three paths. One hero. Choose how you want to begin.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {CHOICE_CARDS.map((card) => {
                const Icon = card.icon
                return (
                  <button
                    key={card.id}
                    onClick={() => {
                      if (!card.available) {
                        toast.info(`${card.title} creation coming soon!`)
                        return
                      }
                      if (card.id === "quick-roll") handleQuickRoll()
                      if (card.id === "concept") {
                        setBuildSuggestion(null)
                        setConceptText("")
                        setConceptName("")
                        setConceptOpen(true)
                      }
                      if (card.id === "guided") setMode("guided")
                      if (card.id === "normal") setMode("normal")
                    }}
                    className="relative text-left rounded-xl p-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group"
                    style={{
                      background: "var(--scene-surface)",
                      border: `1px solid var(--scene-border)`,
                      opacity: card.available ? 1 : 0.6,
                      cursor: card.available ? "pointer" : "default",
                    }}
                  >
                    {!card.available && (
                      <span
                        className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
                      >
                        Soon
                      </span>
                    )}

                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-colors"
                      style={{
                        background: `color-mix(in srgb, ${card.accent} 15%, var(--scene-surface))`,
                        border: `1px solid color-mix(in srgb, ${card.accent} 30%, transparent)`,
                      }}
                    >
                      <Icon className="h-6 w-6" style={{ color: card.accent }} />
                    </div>

                    <h2
                      className="text-lg font-bold mb-1"
                      style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
                    >
                      {card.title}
                    </h2>
                    <p className="text-xs mb-3" style={{ color: card.accent }}>
                      {card.subtitle}
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>
                      {card.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {mode === "quick-roll-preview" && rolled && (
          <>
            <div className="mb-6">
              <h1
                className="text-2xl font-bold mb-1"
                style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
              >
                The dice have spoken
              </h1>
              <p style={{ color: "var(--scene-text-muted)" }}>
                Like what you see? Confirm to save. Not feeling it? Reroll.
              </p>
            </div>
            <QuickRollPreview
              key={rollCount}
              result={rolled}
              onReroll={handleReroll}
              onConfirm={handleConfirm}
              saving={saving}
            />
          </>
        )}

        {mode === "guided" && (
          <>
            <div className="mb-8">
              <h1
                className="text-2xl font-bold mb-1"
                style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
              >
                Let&apos;s build your hero
              </h1>
              <p style={{ color: "var(--scene-text-muted)" }}>
                One step at a time. We&apos;ll explain everything as we go.
              </p>
            </div>
            <GuidedFlow onComplete={saveCharacter} saving={saving} />
          </>
        )}

        {mode === "normal" && (
          <>
            <div className="mb-8">
              <h1
                className="text-2xl font-bold mb-1"
                style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
              >
                Build Your Character
              </h1>
              <p style={{ color: "var(--scene-text-muted)" }}>
                Every choice is yours. Descriptions and stats are shown as you go.
              </p>
            </div>
            <NormalBuilder onComplete={saveCharacter} saving={saving} />
          </>
        )}
      </div>

      <Dialog open={conceptOpen} onOpenChange={setConceptOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Build from a concept</DialogTitle>
            <DialogDescription>
              Describe who your character is in a few sentences. We&rsquo;ll suggest a race, class,
              background, and ability scores that match.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="concept-text">Concept</Label>
              <Textarea
                id="concept-text"
                rows={4}
                value={conceptText}
                onChange={(e) => setConceptText(e.target.value)}
                placeholder="A retired pirate trying to atone for a betrayed crew. Quiet, tough, used to surviving on the sea."
                disabled={generatingBuild || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="concept-name">Name (optional)</Label>
              <Input
                id="concept-name"
                value={conceptName}
                onChange={(e) => setConceptName(e.target.value)}
                placeholder="Leave blank for a generated name"
                disabled={generatingBuild || saving}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleGenerateBuild} disabled={generatingBuild || saving}>
                {generatingBuild ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate build
                  </>
                )}
              </Button>
            </div>

            {buildSuggestion && (
              <div
                className="rounded-xl p-4 space-y-3"
                style={{
                  background: "color-mix(in srgb, var(--scene-accent) 6%, var(--scene-surface))",
                  border: "1px solid color-mix(in srgb, var(--scene-accent) 20%, var(--scene-border))",
                }}
              >
                <div>
                  <h3
                    className="font-bold text-base"
                    style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
                  >
                    {buildSuggestion.subrace
                      ? `${buildSuggestion.subrace} ${buildSuggestion.race}`
                      : buildSuggestion.race}{" "}
                    · {buildSuggestion.class}
                    {buildSuggestion.subclass ? ` (${buildSuggestion.subclass})` : ""}
                  </h3>
                  <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
                    Background: {buildSuggestion.background}
                  </p>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                  {(
                    ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const
                  ).map((a) => (
                    <div
                      key={a}
                      className="rounded-md py-2"
                      style={{
                        background: "var(--scene-surface)",
                        border: "1px solid var(--scene-border)",
                      }}
                    >
                      <div
                        className="text-xs uppercase tracking-widest"
                        style={{ color: "var(--scene-text-muted)" }}
                      >
                        {a.slice(0, 3).toUpperCase()}
                      </div>
                      <div
                        className="text-base font-bold"
                        style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
                      >
                        {buildSuggestion.suggestedAbilities[a]}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 text-sm" style={{ color: "var(--scene-text-muted)" }}>
                  <p>
                    <strong style={{ color: "var(--scene-text-primary)" }}>Race: </strong>
                    {buildSuggestion.raceReason}
                  </p>
                  <p>
                    <strong style={{ color: "var(--scene-text-primary)" }}>Class: </strong>
                    {buildSuggestion.classReason}
                  </p>
                  <p>
                    <strong style={{ color: "var(--scene-text-primary)" }}>Background: </strong>
                    {buildSuggestion.backgroundReason}
                  </p>
                </div>
                {buildSuggestion.keySynergies?.length > 0 && (
                  <div className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
                    <strong style={{ color: "var(--scene-text-primary)" }}>Synergies:</strong>
                    <ul className="list-disc list-inside ml-2">
                      {buildSuggestion.keySynergies.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {buildSuggestion.playstyleTips?.length > 0 && (
                  <div className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
                    <strong style={{ color: "var(--scene-text-primary)" }}>Tips:</strong>
                    <ul className="list-disc list-inside ml-2">
                      {buildSuggestion.playstyleTips.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConceptOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            {buildSuggestion && (
              <Button onClick={handleAcceptBuild} disabled={saving}>
                {saving ? "Saving…" : "Use this build"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
