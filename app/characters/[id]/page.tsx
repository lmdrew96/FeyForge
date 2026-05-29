"use client"

import { use, useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id, Doc } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import Link from "next/link"
import { ArrowLeft, Heart, Pencil, Shield, Zap, Wind, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  ABILITIES,
  ABILITY_ABBREVIATIONS,
  SKILLS,
  SKILL_DISPLAY_NAMES,
  CLASS_COLORS,
  getAbilityModifier,
  formatModifier,
  getProficiencyBonus,
} from "@/lib/character/constants"
import type { Ability, Skill } from "@/lib/character/constants"

// ── Stat computation ──────────────────────────────────────────────────────────

type CharDoc = Doc<"characters">

function computeStats(char: CharDoc) {
  const racialBonuses = char.racialBonuses ?? {}
  const totalAbilities = Object.fromEntries(
    ABILITIES.map((a) => [a, char.baseAbilities[a] + (racialBonuses[a] ?? 0)])
  ) as Record<Ability, number>

  const mods = Object.fromEntries(
    ABILITIES.map((a) => [a, getAbilityModifier(totalAbilities[a])])
  ) as Record<Ability, number>

  const profBonus = getProficiencyBonus(char.level)

  const saveMods = Object.fromEntries(
    ABILITIES.map((a) => {
      const isProficient = char.savingThrowProficiencies.includes(a)
      return [a, mods[a] + (isProficient ? profBonus : 0)]
    })
  ) as Record<Ability, number>

  const skillMods = Object.fromEntries(
    (Object.keys(SKILLS) as Skill[]).map((skill) => {
      const ability = SKILLS[skill] as Ability
      const isExpert = char.skillExpertise.includes(skill)
      const isProficient = char.skillProficiencies.includes(skill)
      const bonus = isExpert ? profBonus * 2 : isProficient ? profBonus : 0
      return [skill, mods[ability] + bonus]
    })
  ) as Record<Skill, number>

  const passivePerception = 10 + skillMods.perception
  const initiative = mods.dexterity
  const unarmoredAC = 10 + mods.dexterity

  return { totalAbilities, mods, profBonus, saveMods, skillMods, passivePerception, initiative, unarmoredAC }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg p-3 text-center"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>
        {label}
      </div>
      <div className="text-xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
        {value}
      </div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>{sub}</div>}
    </div>
  )
}

function AbilityBlock({ ability, total, mod }: { ability: Ability; total: number; mod: number }) {
  return (
    <div
      className="flex flex-col items-center rounded-lg py-3 px-2"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>
        {ABILITY_ABBREVIATIONS[ability]}
      </div>
      <div
        className="w-10 h-10 rounded-md flex items-center justify-center text-lg font-bold mb-1"
        style={{
          background: "color-mix(in srgb, var(--scene-accent) 12%, var(--scene-surface))",
          border: "1px solid color-mix(in srgb, var(--scene-accent) 25%, transparent)",
          color: "var(--scene-text-primary)",
          fontFamily: "var(--font-cinzel)",
        }}
      >
        {total}
      </div>
      <div className="text-sm font-semibold" style={{ color: "var(--scene-accent)" }}>
        {formatModifier(mod)}
      </div>
    </div>
  )
}

function ProfDot({ level }: { level: "none" | "proficient" | "expert" }) {
  return (
    <span
      className="w-3 h-3 rounded-full flex-shrink-0 inline-block"
      style={{
        background: level === "none" ? "transparent" : "var(--scene-accent)",
        border: level === "none"
          ? "1.5px solid var(--scene-border)"
          : level === "expert"
          ? "2px solid var(--scene-highlight)"
          : "none",
      }}
    />
  )
}

function HpEditor({ char }: { char: CharDoc }) {
  const doUpdateHp = useMutation(api.characters.updateHp)

  const handleDelta = (delta: number) => {
    doUpdateHp({ id: char._id, delta }).catch(() => toast.error("Failed to update HP."))
  }

  const pct = char.hitPoints.max > 0 ? Math.max(0, char.hitPoints.current / char.hitPoints.max) : 0
  const barColor = pct > 0.5 ? "var(--scene-accent)" : pct > 0.25 ? "#f59e0b" : "#ef4444"

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Heart className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
        <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
          Hit Points
        </span>
        {char.hitPoints.temp > 0 && (
          <span className="ml-auto text-xs" style={{ color: "var(--scene-highlight)" }}>
            +{char.hitPoints.temp} temp
          </span>
        )}
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden mb-3" style={{ background: "var(--scene-border)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, background: barColor }} />
      </div>
      <div className="flex gap-1.5 items-center">
        {([-5, -1] as const).map((d) => (
          <button
            key={d}
            onClick={() => handleDelta(d)}
            disabled={char.hitPoints.current === 0}
            className="flex-1 py-1.5 rounded text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-30"
            style={{ background: "#ef444420", color: "#ef4444", border: "1px solid #ef444444" }}
          >
            {d}
          </button>
        ))}
        <div
          className="flex-1 py-1.5 rounded text-center text-sm font-bold tabular-nums"
          style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)", fontFamily: "var(--font-cinzel)" }}
        >
          {char.hitPoints.current}
          <span style={{ color: "var(--scene-text-muted)" }}>/{char.hitPoints.max}</span>
        </div>
        {([1, 5] as const).map((d) => (
          <button
            key={d}
            onClick={() => handleDelta(d)}
            disabled={char.hitPoints.current >= char.hitPoints.max}
            className="flex-1 py-1.5 rounded text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-30"
            style={{
              background: "color-mix(in srgb, var(--scene-accent) 18%, transparent)",
              color: "var(--scene-accent)",
              border: "1px solid color-mix(in srgb, var(--scene-accent) 38%, transparent)",
            }}
          >
            +{d}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function CustomPropertiesSection({ characterId }: { characterId: Id<"characters"> }) {
  const allProps = useQuery(api.characters.listAllProperties)
  const addProperty = useMutation(api.characters.addProperty)
  const updateProperty = useMutation(api.characters.updateProperty)
  const removeProperty = useMutation(api.characters.removeProperty)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [adding, setAdding] = useState(false)

  const props = (allProps ?? [])
    .filter((p) => p.characterId === characterId)
    .sort((a, b) => a.orderIndex - b.orderIndex)

  const handleAdd = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Give the property a name.")
      return
    }
    setAdding(true)
    try {
      const nextOrder = props.length ? Math.max(...props.map((p) => p.orderIndex)) + 1 : 0
      await addProperty({
        characterId,
        type: "custom",
        name: trimmed,
        description: description.trim() || undefined,
        active: true,
        orderIndex: nextOrder,
        data: {},
      })
      setName("")
      setDescription("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add property.")
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (id: Id<"characterProperties">, active: boolean) => {
    try {
      await updateProperty({ id, active: !active })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update property.")
    }
  }

  const handleRemove = async (id: Id<"characterProperties">) => {
    try {
      await removeProperty({ id })
      toast.success("Property removed.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove property.")
    }
  }

  return (
    <section className="mt-6">
      <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
        Custom Properties
      </h2>

      <div className="space-y-2">
        {allProps === undefined && (
          <div className="h-12 rounded-lg animate-pulse" style={{ background: "var(--scene-surface)" }} />
        )}
        {allProps !== undefined && props.length === 0 && (
          <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
            No custom properties yet. Add freeform stats, traits, or notes below.
          </p>
        )}
        {props.map((p) => (
          <div
            key={p._id}
            className="flex items-start gap-3 rounded-lg px-4 py-3"
            style={{
              background: "var(--scene-surface)",
              border: "1px solid var(--scene-border)",
              opacity: p.active ? 1 : 0.55,
            }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>{p.name}</p>
              {p.description && (
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>
                  {p.description}
                </p>
              )}
            </div>
            <button
              onClick={() => handleToggle(p._id, p.active)}
              className="text-[10px] px-2 py-1 rounded-md transition-opacity hover:opacity-80 flex-shrink-0"
              style={{
                background: p.active ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)" : "var(--scene-border)",
                color: p.active ? "var(--scene-accent)" : "var(--scene-text-muted)",
              }}
              title={p.active ? "Active — click to disable" : "Inactive — click to enable"}
            >
              {p.active ? "Active" : "Inactive"}
            </button>
            <button
              onClick={() => handleRemove(p._id)}
              className="p-1.5 rounded transition-opacity hover:opacity-80 flex-shrink-0"
              style={{ color: "var(--scene-text-muted)" }}
              title="Remove property"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div
        className="mt-3 rounded-lg p-4 space-y-2"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
          placeholder="Property name (e.g. Lucky, Darkvision)"
          className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none"
          style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
          placeholder="Description or value (optional)"
          className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none"
          style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
        />
        <button
          onClick={handleAdd}
          disabled={adding}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
        >
          <Plus className="h-4 w-4" />
          {adding ? "Adding…" : "Add property"}
        </button>
      </div>
    </section>
  )
}

export default function CharacterSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const char = useQuery(api.characters.get, { id: id as Id<"characters"> })

  if (char === undefined) {
    return (
      <AppShell>
        <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl h-32" style={{ background: "var(--scene-surface)" }} />
          ))}
        </div>
      </AppShell>
    )
  }

  if (!char) {
    return (
      <AppShell>
        <div className="p-6 max-w-4xl mx-auto text-center">
          <p className="text-sm mb-4" style={{ color: "var(--scene-text-muted)" }}>Character not found.</p>
          <Link href="/characters" className="text-sm hover:opacity-80 transition-opacity" style={{ color: "var(--scene-accent)" }}>
            ← Back to characters
          </Link>
        </div>
      </AppShell>
    )
  }

  const { totalAbilities, mods, profBonus, saveMods, skillMods, passivePerception, initiative, unarmoredAC } = computeStats(char)
  const raceName = char.subrace ? `${char.subrace} ${char.race}` : char.race
  const classColor = CLASS_COLORS[char.characterClass.toLowerCase()] ?? "bg-gray-600 text-white"
  const hitDie = char.hitDice[0]?.diceSize ?? 8

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-12">

        {/* Back + Edit */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/characters"
            className="inline-flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
            style={{ color: "var(--scene-text-muted)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to characters
          </Link>
          <Link
            href={`/characters/${char._id}/edit`}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
            style={{
              background: "var(--scene-surface)",
              color: "var(--scene-text-primary)",
              border: "1px solid var(--scene-border)",
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
        </div>

        {/* Header */}
        <div
          className="rounded-xl p-5 mb-6"
          style={{
            background: "color-mix(in srgb, var(--scene-accent) 6%, var(--scene-surface))",
            border: "1px solid color-mix(in srgb, var(--scene-accent) 20%, var(--scene-border))",
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "color-mix(in srgb, var(--scene-accent) 15%, var(--scene-surface))",
                border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, transparent)",
              }}
            >
              <Shield className="h-7 w-7" style={{ color: "var(--scene-accent)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <h1
                className="text-2xl font-bold"
                style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
              >
                {char.name}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
                {raceName}{char.background ? ` · ${char.background}` : ""}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", classColor)}>
                  {char.characterClass}
                </span>
                {char.subclass && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                    {char.subclass}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                  Level {char.level}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                  d{hitDie} hit die
                </span>
                {char.alignment && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                    {char.alignment}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* HP */}
        <div className="mb-6">
          <HpEditor char={char} />
        </div>

        {/* Combat stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatBox label="Armor Class" value={unarmoredAC} sub="unarmored" />
          <StatBox label="Initiative" value={formatModifier(initiative)} />
          <StatBox label="Speed" value={`${char.speed} ft`} />
          <StatBox label="Prof Bonus" value={formatModifier(profBonus)} />
          <StatBox label="Passive Perc" value={passivePerception} />
          <StatBox label="Hit Dice" value={`${char.level}d${hitDie}`} />
          <StatBox label="Death Saves" value={`${char.deathSaves.successes}S / ${char.deathSaves.failures}F`} />
          {char.inspiration && <StatBox label="Inspiration" value="✦" />}
        </div>

        {/* Ability Scores */}
        <section className="mb-6">
          <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
            Ability Scores
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {ABILITIES.map((ability) => (
              <AbilityBlock key={ability} ability={ability} total={totalAbilities[ability]} mod={mods[ability]} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Saving Throws */}
          <section>
            <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
              Saving Throws
            </h2>
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
              {ABILITIES.map((ability, i) => {
                const isProficient = char.savingThrowProficiencies.includes(ability)
                return (
                  <div
                    key={ability}
                    className="flex items-center gap-3 px-4 py-2.5"
                    style={{ borderBottom: i < ABILITIES.length - 1 ? "1px solid var(--scene-border)" : "none" }}
                  >
                    <ProfDot level={isProficient ? "proficient" : "none"} />
                    <span className="text-sm flex-1" style={{ color: "var(--scene-text-primary)" }}>
                      {ABILITY_ABBREVIATIONS[ability]}
                    </span>
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: isProficient ? "var(--scene-accent)" : "var(--scene-text-muted)" }}
                    >
                      {formatModifier(saveMods[ability])}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Senses + Spellcasting */}
          <section>
            <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
              Senses
            </h2>
            <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5" style={{ color: "var(--scene-text-muted)" }} />
                  <span className="text-sm" style={{ color: "var(--scene-text-primary)" }}>Passive Perception</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>{passivePerception}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wind className="h-3.5 w-3.5" style={{ color: "var(--scene-text-muted)" }} />
                  <span className="text-sm" style={{ color: "var(--scene-text-primary)" }}>Speed</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>{char.speed} ft</span>
              </div>
            </div>

            {char.spellcasting && (
              <>
                <h2 className="text-xs uppercase tracking-widest mt-4 mb-3" style={{ color: "var(--scene-text-muted)" }}>
                  Spellcasting
                </h2>
                <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--scene-text-muted)" }}>Ability</span>
                    <span className="font-medium capitalize" style={{ color: "var(--scene-text-primary)" }}>{char.spellcasting.ability}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--scene-text-muted)" }}>Save DC</span>
                    <span className="font-medium" style={{ color: "var(--scene-text-primary)" }}>{char.spellcasting.spellSaveDC}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--scene-text-muted)" }}>Attack Bonus</span>
                    <span className="font-medium" style={{ color: "var(--scene-text-primary)" }}>{formatModifier(char.spellcasting.spellAttackBonus)}</span>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        {/* Skills */}
        <section className="mb-6">
          <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
            Skills
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {(Object.keys(SKILLS) as Skill[]).map((skill, i, arr) => {
                const ability = SKILLS[skill] as Ability
                const isExpert = char.skillExpertise.includes(skill)
                const isProficient = char.skillProficiencies.includes(skill)
                const level: "none" | "proficient" | "expert" = isExpert ? "expert" : isProficient ? "proficient" : "none"
                const half = Math.ceil(arr.length / 2)
                const isRightCol = i >= half
                const isLastInLeftCol = i === half - 1
                const isLastInRightCol = i === arr.length - 1
                return (
                  <div
                    key={skill}
                    className="flex items-center gap-3 px-4 py-2"
                    style={{
                      borderBottom: (!isRightCol && !isLastInLeftCol) || (isRightCol && !isLastInRightCol)
                        ? "1px solid var(--scene-border)"
                        : "none",
                      borderRight: !isRightCol ? "1px solid var(--scene-border)" : "none",
                    }}
                  >
                    <ProfDot level={level} />
                    <span className="text-sm flex-1" style={{ color: "var(--scene-text-primary)" }}>
                      {SKILL_DISPLAY_NAMES[skill]}
                    </span>
                    <span className="text-xs mr-2" style={{ color: "var(--scene-text-muted)" }}>
                      {ABILITY_ABBREVIATIONS[ability]}
                    </span>
                    <span
                      className="text-sm font-semibold tabular-nums w-8 text-right"
                      style={{ color: level !== "none" ? "var(--scene-accent)" : "var(--scene-text-muted)" }}
                    >
                      {formatModifier(skillMods[skill])}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Proficiencies & Languages */}
        <section className="mb-6">
          <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
            Proficiencies & Languages
          </h2>
          <div
            className="rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            {[
              { label: "Armor", items: char.armorProficiencies },
              { label: "Weapons", items: char.weaponProficiencies },
              { label: "Tools", items: char.toolProficiencies },
              { label: "Languages", items: char.languages },
            ].filter(({ items }) => items.length > 0).map(({ label, items }) => (
              <div key={label}>
                <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>{label}</div>
                <p className="text-sm" style={{ color: "var(--scene-text-primary)" }}>{items.join(", ")}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Personality */}
        {(char.personalityTraits || char.ideals || char.bonds || char.flaws || char.backstory) && (
          <section className="mb-6">
            <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
              Personality
            </h2>
            <div className="space-y-3">
              {[
                { label: "Personality Traits", value: char.personalityTraits },
                { label: "Ideals", value: char.ideals },
                { label: "Bonds", value: char.bonds },
                { label: "Flaws", value: char.flaws },
                { label: "Backstory", value: char.backstory },
              ].filter(({ value }) => !!value).map(({ label, value }) => (
                <div key={label} className="rounded-lg px-4 py-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
                  <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>{label}</div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--scene-text-primary)" }}>{value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Currency */}
        <section>
          <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
            Currency
          </h2>
          <div
            className="rounded-xl p-4 grid grid-cols-5 gap-3 text-center"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            {(["cp", "sp", "ep", "gp", "pp"] as const).map((coin) => (
              <div key={coin}>
                <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>{coin}</div>
                <div className="text-lg font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                  {char.currency[coin]}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Custom Properties */}
        <CustomPropertiesSection characterId={char._id} />

      </div>
    </AppShell>
  )
}
