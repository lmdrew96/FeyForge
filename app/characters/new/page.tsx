"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { AppShell } from "@/components/app-shell"
import { Wand2, Dice6, BookOpen, ArrowLeft, RefreshCw, Check } from "lucide-react"
import { toast } from "sonner"
import {
  quickRollCharacter,
  type QuickRollResult,
} from "@/lib/character/character-data"
import { CLASS_HIT_DICE } from "@/lib/character/constants"

type CreationMode = "choose" | "quick-roll-preview"

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
    id: "guided",
    icon: BookOpen,
    title: "Guided",
    subtitle: "Step by step",
    description: "New to D&D? We'll walk you through every choice with lore, tips, and flavor text.",
    accent: "var(--scene-highlight)",
    available: false,
  },
  {
    id: "normal",
    icon: Wand2,
    title: "Builder",
    subtitle: "Full control",
    description: "Experienced player? Take the wheel. Every option, every stat, your way.",
    accent: "var(--scene-text-primary)",
    available: false,
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
  onConfirm: () => void
  saving: boolean
}) {
  const { name, race, subrace, characterClass, background, baseAbilities, racialBonuses } = result
  const raceName = subrace ? `${subrace.name} ${race.name}` : race.name
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
            <div>
              <h2
                className="text-2xl font-bold"
                style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
              >
                {name}
              </h2>
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
            onClick={onConfirm}
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
  const [mode, setMode] = useState<CreationMode>("choose")
  const [rolled, setRolled] = useState<QuickRollResult | null>(null)
  const [saving, setSaving] = useState(false)

  const handleQuickRoll = () => {
    setRolled(quickRollCharacter())
    setMode("quick-roll-preview")
  }

  const handleReroll = () => {
    setRolled(quickRollCharacter())
  }

  const handleConfirm = async () => {
    if (!rolled) return
    setSaving(true)
    try {
      const { race, subrace, characterClass, background, baseAbilities, racialBonuses, skillProficiencies, name } = rolled
      const hitDie = CLASS_HIT_DICE[characterClass.id] ?? 8
      const conTotal = baseAbilities.constitution + (racialBonuses.constitution ?? 0)
      const conMod = Math.floor((conTotal - 10) / 2)
      const maxHp = hitDie + conMod

      await createCharacter({
        name,
        race: race.name,
        subrace: subrace?.name,
        characterClass: characterClass.name,
        level: 1,
        experiencePoints: 0,
        background: background.name,
        baseAbilities,
        racialBonuses: Object.keys(racialBonuses).length > 0 ? racialBonuses : undefined,
        hitPoints: { current: maxHp, max: maxHp, temp: 0 },
        hitDice: [{ diceSize: hitDie, total: 1, used: 0 }],
        deathSaves: { successes: 0, failures: 0 },
        speed: subrace?.speed ?? race.speed,
        inspiration: false,
        savingThrowProficiencies: characterClass.savingThrows,
        skillProficiencies,
        skillExpertise: [],
        armorProficiencies: characterClass.armorProficiencies,
        weaponProficiencies: characterClass.weaponProficiencies,
        toolProficiencies: characterClass.toolProficiencies,
        languages: race.languages,
        currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      })
      toast.success(`${name} is ready to adventure!`)
      router.push("/characters")
    } catch (err) {
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
            if (mode === "quick-roll-preview") {
              setMode("choose")
            } else {
              router.push("/characters")
            }
          }}
          className="inline-flex items-center gap-2 text-sm mb-6 transition-opacity hover:opacity-80"
          style={{ color: "var(--scene-text-muted)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          {mode === "quick-roll-preview" ? "Back to choices" : "Back to characters"}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              result={rolled}
              onReroll={handleReroll}
              onConfirm={handleConfirm}
              saving={saving}
            />
          </>
        )}
      </div>
    </AppShell>
  )
}
