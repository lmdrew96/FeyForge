"use client"

import { use, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id, Doc } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import Link from "next/link"
import { ArrowLeft, Pencil, Zap, Plus, Trash2, Eye, ChevronsUp, X, Sparkles, Dices, Award, Search, Check, Swords, Package, ScrollText, type LucideIcon } from "lucide-react"
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
import { getDarkvisionRange, getFightingStylesAtLevel, getSubclassId } from "@/lib/character/character-data"
import { getXPProgress, getXPForLevel, getLevelFromXP, getXPToNextLevel } from "@/lib/character/experience"
import { getEffectiveCasterType, hpGainForLevel, avgHitDieRoll, recomputeSpellcasting, initSpellcasting, isAsiLevel } from "@/lib/character/leveling"
import {
  FEATS,
  type FeatData,
  type AppliedGrants,
  featNeedsChoices,
  autoResolve,
  applyGrants,
  reverseGrants,
  appliedSummary,
} from "@/lib/character/feats"
import { resolveEdition, type Edition } from "@/lib/editions"
import { deriveCharacter } from "@/lib/character/derive-character"
import {
  useSheetRoll,
  RollModeBar,
  SheetRollCard,
} from "@/components/character/sheet-roll"
import {
  StatBox,
  AbilityScoresGrid,
  SavingThrowsCard,
  SkillsCard,
  ToolsCard,
  SensesCard,
} from "@/components/character/stat-blocks"
import { AttacksSection, InventorySection } from "./inventory"
import { SpellbookSection } from "@/components/character/spellbook"
import { ResourcesSection } from "@/components/character/resources"
import { WildshapeSection, CompanionsSection } from "@/components/character/creature-sheet"
import { InvocationsSection } from "@/components/character/invocations-section"
import { ManeuversSection } from "@/components/character/maneuvers-section"
import { LandCircleSection } from "@/components/character/land-circle-section"
import { HpEditor, RestPanel, DyingPanel, ExhaustionPanel } from "@/components/character/rest-panel"
import { CharacterAvatar } from "@/components/character/character-avatar"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"

// ── Stat computation ──────────────────────────────────────────────────────────

type CharDoc = Doc<"characters">


// Add a hit die to the pool matching the class die size (or create the pool).
function incrementHitDice(hitDice: CharDoc["hitDice"], dieSize: number): CharDoc["hitDice"] {
  if (hitDice.some((d) => d.diceSize === dieSize)) {
    return hitDice.map((d) => (d.diceSize === dieSize ? { ...d, total: d.total + 1 } : d))
  }
  return [...hitDice, { diceSize: dieSize, total: 1, used: 0 }]
}

// Feat picker — searchable list of curated feats with a choice step for feats
// that require a decision (which ability, skills, expertise, damage type). Reused
// by the level-up flow and the Feats section. onSelect hands back the feat plus
// the resolved grants (AppliedGrants) so the caller can bake them in.
function FeatPicker({
  feats,
  knownIds,
  char,
  onSelect,
  onClose,
}: {
  feats: FeatData[]
  knownIds: Set<string>
  char: CharDoc
  onSelect: (feat: FeatData, applied: AppliedGrants) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [configuring, setConfiguring] = useState<FeatData | null>(null)
  const q = query.trim().toLowerCase()
  const results = feats
    .filter((f) => (q ? f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) : true))
    .sort((a, b) => a.name.localeCompare(b.name))

  const pick = (f: FeatData) => {
    if (knownIds.has(f.id)) return
    if (featNeedsChoices(f.effects)) setConfiguring(f)
    else onSelect(f, autoResolve(f, char.level))
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-5 w-full max-w-md max-h-[85vh] flex flex-col"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            {configuring && (
              <button onClick={() => setConfiguring(null)} className="p-1 rounded hover:opacity-80 flex-shrink-0" style={{ color: "var(--scene-text-muted)" }} title="Back to feat list">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="text-lg font-bold truncate" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
              {configuring ? configuring.name : "Choose a feat"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:opacity-80 flex-shrink-0" style={{ color: "var(--scene-text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {configuring ? (
          <FeatConfig feat={configuring} char={char} onConfirm={(applied) => onSelect(configuring, applied)} />
        ) : (
          <>
            <div className="relative mb-3">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--scene-text-muted)" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search feats…"
                autoFocus
                className="w-full pl-8 pr-3 py-2 rounded-md text-sm bg-transparent outline-none"
                style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
              />
            </div>

            <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5">
              {results.length === 0 ? (
                <div className="px-1 py-3 text-sm" style={{ color: "var(--scene-text-muted)" }}>No matching feats.</div>
              ) : (
                results.map((f) => {
                  const known = knownIds.has(f.id)
                  const hasChoice = featNeedsChoices(f.effects)
                  return (
                    <button
                      key={f.id}
                      onClick={() => pick(f)}
                      disabled={known}
                      className="w-full text-left px-3 py-2.5 rounded-md transition-colors disabled:opacity-50"
                      style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>{f.name}</span>
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                          {f.category}
                        </span>
                        {hasChoice && !known && (
                          <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: "var(--scene-accent)" }}>choices →</span>
                        )}
                        {known && <Check className="h-3.5 w-3.5 ml-auto flex-shrink-0" style={{ color: "var(--scene-accent)" }} />}
                      </div>
                      {f.prerequisite && (
                        <div className="text-[11px] mt-0.5" style={{ color: "var(--scene-accent)" }}>Requires: {f.prerequisite}</div>
                      )}
                      <div className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>{f.description}</div>
                    </button>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Choice step for a feat that requires decisions: pick the +1 ability, skill
// proficiencies, expertise, and/or a flavor option (e.g. damage type). Resolves
// to AppliedGrants on confirm.
function FeatConfig({
  feat,
  char,
  onConfirm,
}: {
  feat: FeatData
  char: CharDoc
  onConfirm: (applied: AppliedGrants) => void
}) {
  const e = feat.effects ?? {}
  const abilityOpts = e.abilityOptions ?? []
  const needAbility = abilityOpts.length > 1
  const [ability, setAbility] = useState<Ability | null>(abilityOpts.length === 1 ? abilityOpts[0] : null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [expertise, setExpertise] = useState<Skill[]>([])
  const [text, setText] = useState<string>("")

  const allSkills = Object.keys(SKILLS) as Skill[]
  // Skills you can newly gain proficiency in (not already proficient).
  const skillPool = allSkills.filter((s) => !char.skillProficiencies.includes(s))
  // Skills eligible for expertise: ones you're proficient in (incl. just-chosen
  // here) and not already an expert in.
  const expertisePool = allSkills.filter(
    (s) => (char.skillProficiencies.includes(s) || skills.includes(s)) && !char.skillExpertise.includes(s),
  )

  const toggle = (list: Skill[], set: (v: Skill[]) => void, s: Skill, max: number) => {
    if (list.includes(s)) set(list.filter((x) => x !== s))
    else if (list.length < max) set([...list, s])
  }

  const ok =
    (!needAbility || !!ability) &&
    (!e.skillChoices || skills.length === e.skillChoices) &&
    (!e.expertiseChoices || expertise.length === e.expertiseChoices) &&
    (!e.textChoice || !!text)

  const confirm = () => {
    const g: AppliedGrants = {}
    if (ability) g.ability = ability
    if (e.saveProficiency && ability && !char.savingThrowProficiencies.includes(ability)) g.saveProficiency = ability
    if (skills.length) g.skillProficiencies = skills
    if (expertise.length) g.skillExpertise = expertise
    if (e.hpPerLevel) g.hp = e.hpPerLevel * char.level
    if (text) g.text = text
    onConfirm(g)
  }

  return (
    <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-4">
      <p className="text-xs leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>{feat.description}</p>

      {needAbility && (
        <div>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>
            +1 Ability{e.saveProficiency ? " (also grants its saving-throw proficiency)" : ""}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {abilityOpts.map((a) => (
              <button
                key={a}
                onClick={() => setAbility(a)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
                style={{
                  background: ability === a ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)" : "var(--scene-bg)",
                  color: ability === a ? "var(--scene-accent)" : "var(--scene-text-primary)",
                  border: `1px solid ${ability === a ? "color-mix(in srgb, var(--scene-accent) 40%, transparent)" : "var(--scene-border)"}`,
                }}
              >
                {ABILITY_ABBREVIATIONS[a]}
              </button>
            ))}
          </div>
        </div>
      )}

      {!!e.skillChoices && (
        <div>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>
            Skill proficiency — pick {e.skillChoices} ({skills.length}/{e.skillChoices})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {skillPool.map((s) => (
              <SkillChip key={s} label={SKILL_DISPLAY_NAMES[s]} active={skills.includes(s)} onClick={() => toggle(skills, setSkills, s, e.skillChoices!)} />
            ))}
          </div>
        </div>
      )}

      {!!e.expertiseChoices && (
        <div>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>
            Expertise — pick {e.expertiseChoices} ({expertise.length}/{e.expertiseChoices})
          </div>
          {expertisePool.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>No eligible skills (need a skill proficiency first).</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {expertisePool.map((s) => (
                <SkillChip key={s} label={SKILL_DISPLAY_NAMES[s]} active={expertise.includes(s)} onClick={() => toggle(expertise, setExpertise, s, e.expertiseChoices!)} />
              ))}
            </div>
          )}
        </div>
      )}

      {e.textChoice && (
        <div>
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>{e.textChoice.label}</div>
          {e.textChoice.options ? (
            <div className="flex flex-wrap gap-1.5">
              {e.textChoice.options.map((o) => (
                <SkillChip key={o} label={o} active={text === o} onClick={() => setText(o)} />
              ))}
            </div>
          ) : (
            <input
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              placeholder={e.textChoice.label}
              className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none"
              style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
            />
          )}
        </div>
      )}

      <button
        onClick={confirm}
        disabled={!ok}
        className="w-full py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
      >
        Add {feat.name}
      </button>
    </div>
  )
}

function SkillChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-md text-xs font-medium transition-opacity hover:opacity-80"
      style={{
        background: active ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)" : "var(--scene-bg)",
        color: active ? "var(--scene-accent)" : "var(--scene-text-primary)",
        border: `1px solid ${active ? "color-mix(in srgb, var(--scene-accent) 40%, transparent)" : "var(--scene-border)"}`,
      }}
    >
      {label}
    </button>
  )
}

// Level-up modal. Bumps level, gains HP (average or rolled), adds a hit die,
// rescales caster slots + DC/attack (see lib/character/leveling.ts). At ASI
// levels it also offers an Ability Score Improvement vs feat choice. Other new
// class features are a guided manual step (add via Custom Properties below).
function LevelUpDialog({
  char,
  hitDie,
  conMod,
  spellAbilityMod,
  edition,
  onClose,
}: {
  char: CharDoc
  hitDie: number
  conMod: number
  spellAbilityMod: number
  edition: Edition
  onClose: () => void
}) {
  const doUpdate = useMutation(api.characters.update)
  const addProperty = useMutation(api.characters.addProperty)
  const updateProperty = useMutation(api.characters.updateProperty)
  const allProps = useQuery(api.characters.listAllProperties)
  const [hpMode, setHpMode] = useState<"average" | "roll">("average")
  const [rolled, setRolled] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const newLevel = Math.min(20, char.level + 1)
  const classId = char.characterClass.toLowerCase()
  // Effective so EK/AT (third-casters) get spell-slot recompute + caster hints.
  const levelUpSubclassId = getSubclassId(classId, char.subclass)
  const casterType = getEffectiveCasterType(classId, levelUpSubclassId)

  // ASI / feat choice — only at this class's ASI levels (4/8/12/16/19, +Fighter/Rogue extras).
  const isAsi = isAsiLevel(classId, newLevel)
  const racialBonuses = (char.racialBonuses ?? {}) as Partial<Record<Ability, number>>
  const totals = Object.fromEntries(
    ABILITIES.map((a) => [a, char.baseAbilities[a] + (racialBonuses[a] ?? 0)]),
  ) as Record<Ability, number>

  const [choice, setChoice] = useState<"asi" | "feat">("asi")
  const [inc, setInc] = useState<Partial<Record<Ability, number>>>({})
  const [selectedFeat, setSelectedFeat] = useState<FeatData | null>(null)
  const [selectedApplied, setSelectedApplied] = useState<AppliedGrants | null>(null)
  const [featPickerOpen, setFeatPickerOpen] = useState(false)
  const [fightingStyleId, setFightingStyleId] = useState("")

  const spent = ABILITIES.reduce((n, a) => n + (inc[a] ?? 0), 0)
  const canApply = choice === "asi" ? spent === 2 : !!selectedFeat

  // +1/−1 an ability's pending ASI increase, capped at a 2-point budget, max +2
  // to any one ability, and never past a total score of 20 (RAW).
  const bump = (a: Ability, d: number) =>
    setInc((prev) => {
      const next = (prev[a] ?? 0) + d
      if (next < 0 || next > 2) return prev
      const others = ABILITIES.reduce((n, x) => n + (x === a ? 0 : prev[x] ?? 0), 0)
      if (others + next > 2) return prev
      if (d > 0 && totals[a] + next > 20) return prev
      return { ...prev, [a]: next }
    })

  const myProps = (allProps ?? []).filter((p) => p.characterId === char._id)
  const knownFeatIds = new Set(
    myProps
      .filter((p) => p.type === "feature")
      .map((p) => (p.data as { featId?: string } | undefined)?.featId)
      .filter(Boolean) as string[],
  )
  const featNextOrder = myProps.length ? Math.max(...myProps.map((p) => p.orderIndex)) + 1 : 0

  // Fighting style gained at THIS level (Paladin/Ranger @ 2; Fighter @ 1 is the
  // creation pick). Offer it only if the character doesn't already have one — that
  // also backfills Fighters built before the style picker shipped.
  const hasFightingStyle = myProps.some(
    (p) => p.type === "feature" && !!(p.data as { fightingStyleId?: string } | undefined)?.fightingStyleId,
  )
  const fightingStyleOptions = getFightingStylesAtLevel(classId, newLevel)
  const needsFightingStyle = fightingStyleOptions.length > 0 && !hasFightingStyle
  const selectedFightingStyle = fightingStyleOptions.find((s) => s.id === fightingStyleId)

  const rollHp = () => {
    setRolled(Math.floor(Math.random() * hitDie) + 1)
    setHpMode("roll")
  }
  const hpRoll = hpMode === "roll" ? rolled ?? avgHitDieRoll(hitDie) : undefined
  const hpGain = hpGainForLevel(hitDie, conMod, hpRoll)

  const oldProf = getProficiencyBonus(char.level)
  const newProf = getProficiencyBonus(newLevel)
  const profChanged = newProf !== oldProf

  const handleConfirm = async (skip = false) => {
    setSaving(true)
    try {
      const applyAsi = isAsi && !skip && choice === "asi" && spent === 2
      const applyFeat = isAsi && !skip && choice === "feat" && !!selectedFeat && !!selectedApplied
      // Feat grants for the stored fields (ability/saves/skills/expertise). HP is
      // handled separately below so it stacks with the level-up HP gain.
      let grants: ReturnType<typeof applyGrants> = {}
      if (applyFeat && selectedApplied) grants = applyGrants(char, selectedApplied)
      delete grants.hitPoints
      const featHp = applyFeat && selectedApplied?.hp ? selectedApplied.hp : 0
      // Tough already on the sheet → +2 HP at every level-up (RAW). Mutually
      // exclusive with featHp (can't take Tough you already have).
      const toughRow = myProps.find(
        (p) => p.type === "feature" && (p.data as { featId?: string } | undefined)?.featId === "tough",
      )
      const toughBonus = toughRow ? 2 : 0
      const newHitPoints = {
        ...char.hitPoints,
        max: char.hitPoints.max + hpGain + featHp + toughBonus,
        current: char.hitPoints.current + hpGain + featHp + toughBonus,
      }
      const spellcasting = char.spellcasting
        ? recomputeSpellcasting(char.spellcasting, classId, newLevel, spellAbilityMod, edition, levelUpSubclassId)
        : undefined
      let baseAbilities: typeof char.baseAbilities | undefined
      if (applyAsi) {
        baseAbilities = { ...char.baseAbilities }
        for (const a of ABILITIES) baseAbilities[a] = char.baseAbilities[a] + (inc[a] ?? 0)
      }
      await doUpdate({
        id: char._id,
        level: newLevel,
        experiencePoints: Math.max(char.experiencePoints, getXPForLevel(newLevel)),
        hitPoints: newHitPoints,
        hitDice: incrementHitDice(char.hitDice, hitDie),
        ...(spellcasting ? { spellcasting } : {}),
        ...(baseAbilities ? { baseAbilities } : {}),
        ...grants,
      })
      // Keep Tough's recorded HP grant in sync with the +2 just added, so removal
      // later reverses the full amount.
      if (toughRow) {
        const data = (toughRow.data ?? {}) as { applied?: AppliedGrants }
        await updateProperty({
          id: toughRow._id,
          data: { ...data, applied: { ...(data.applied ?? {}), hp: (data.applied?.hp ?? 0) + 2 } },
        })
      }
      if (applyFeat && selectedFeat && selectedApplied) {
        const summary = appliedSummary(selectedApplied)
        await addProperty({
          characterId: char._id,
          type: "feature",
          name: selectedApplied.text ? `${selectedFeat.name} (${selectedApplied.text})` : selectedFeat.name,
          description: summary ? `${selectedFeat.description}\n\n${summary}` : selectedFeat.description,
          source: "feat",
          active: true,
          orderIndex: featNextOrder,
          data: { featId: selectedFeat.id, category: selectedFeat.category, applied: selectedApplied },
        })
      }
      // Fighting style (Paladin/Ranger @ 2) → a descriptive feature, like the
      // Fighter's creation pick. Applies regardless of the ASI skip path.
      if (needsFightingStyle && selectedFightingStyle) {
        await addProperty({
          characterId: char._id,
          type: "feature",
          name: `Fighting Style: ${selectedFightingStyle.name}`,
          description: selectedFightingStyle.description,
          source: "Fighting Style",
          active: true,
          orderIndex: featNextOrder + (applyFeat ? 1 : 0),
          data: { fightingStyleId: selectedFightingStyle.id },
        })
      }
      const styleExtra = needsFightingStyle && selectedFightingStyle ? ` — Fighting Style: ${selectedFightingStyle.name}` : ""
      const extra = (applyAsi ? " (+ability scores)" : applyFeat ? ` — gained ${selectedFeat!.name}` : "") + styleExtra
      toast.success(`Leveled up to ${newLevel}! +${hpGain} HP${extra}.`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't level up.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        className="rounded-xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ChevronsUp className="h-5 w-5" style={{ color: "var(--scene-accent)" }} />
            <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
              Level {char.level} → {newLevel}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:opacity-80" style={{ color: "var(--scene-text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* HP gain */}
        <div className="mb-4">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-text-muted)" }}>Hit Points</div>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setHpMode("average")}
              className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
              style={{
                background: hpMode === "average" ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)" : "var(--scene-bg)",
                color: hpMode === "average" ? "var(--scene-accent)" : "var(--scene-text-primary)",
                border: `1px solid ${hpMode === "average" ? "color-mix(in srgb, var(--scene-accent) 40%, transparent)" : "var(--scene-border)"}`,
              }}
            >
              Average ({avgHitDieRoll(hitDie)})
            </button>
            <button
              onClick={rollHp}
              className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
              style={{
                background: hpMode === "roll" ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)" : "var(--scene-bg)",
                color: hpMode === "roll" ? "var(--scene-accent)" : "var(--scene-text-primary)",
                border: `1px solid ${hpMode === "roll" ? "color-mix(in srgb, var(--scene-accent) 40%, transparent)" : "var(--scene-border)"}`,
              }}
            >
              {hpMode === "roll" && rolled ? `Rolled ${rolled}` : `Roll d${hitDie}`}
            </button>
          </div>
          <p className="text-sm" style={{ color: "var(--scene-text-primary)" }}>
            Max HP <span className="font-bold" style={{ color: "var(--scene-accent)" }}>+{hpGain}</span>
            <span style={{ color: "var(--scene-text-muted)" }}> ({hpRoll ?? avgHitDieRoll(hitDie)} {conMod >= 0 ? "+" : "−"} {Math.abs(conMod)} CON, min 1) → {char.hitPoints.max + hpGain}</span>
          </p>
        </div>

        {/* Other gains */}
        <ul className="space-y-1.5 mb-4 text-sm" style={{ color: "var(--scene-text-primary)" }}>
          <li>• A d{hitDie} hit die added (now {char.hitDice.reduce((n, d) => n + d.total, 0) + 1} total)</li>
          {profChanged && (
            <li>• Proficiency bonus +{oldProf} → <span style={{ color: "var(--scene-accent)" }}>+{newProf}</span> (saves, skills, attacks rescale)</li>
          )}
          {(casterType === "full" || casterType === "half" || casterType === "third") && char.spellcasting && (
            <li>• Spell slots updated for level {newLevel}{profChanged ? "; spell save DC & attack rescaled" : ""}</li>
          )}
          {casterType === "pact" && char.spellcasting && (
            <li>• Pact Magic slots updated for level {newLevel}{profChanged ? "; spell save DC & attack rescaled" : ""}</li>
          )}
          {casterType !== "none" && !char.spellcasting && (
            <li style={{ color: "var(--scene-text-muted)" }}>• Enable spellcasting on your sheet to track spell slots</li>
          )}
        </ul>

        {/* ASI vs feat — only at ASI levels */}
        {isAsi && (
          <div className="mb-4">
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-accent)" }}>
              Ability Score Improvement
            </div>
            <div className="flex gap-2 mb-3">
              {(["asi", "feat"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setChoice(c)}
                  className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
                  style={{
                    background: choice === c ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)" : "var(--scene-bg)",
                    color: choice === c ? "var(--scene-accent)" : "var(--scene-text-primary)",
                    border: `1px solid ${choice === c ? "color-mix(in srgb, var(--scene-accent) 40%, transparent)" : "var(--scene-border)"}`,
                  }}
                >
                  {c === "asi" ? "Ability Scores" : "Feat"}
                </button>
              ))}
            </div>

            {choice === "asi" ? (
              <div>
                <p className="text-xs mb-2" style={{ color: spent === 2 ? "var(--scene-text-muted)" : "var(--scene-accent)" }}>
                  {spent === 2 ? "2 points assigned." : `Assign ${2 - spent} more ${2 - spent === 1 ? "point" : "points"} — +2 to one ability or +1 to two.`}
                </p>
                <div className="space-y-1.5">
                  {ABILITIES.map((a) => {
                    const add = inc[a] ?? 0
                    const newScore = totals[a] + add
                    const canInc = spent < 2 && add < 2 && newScore < 20
                    return (
                      <div key={a} className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wider w-10" style={{ color: "var(--scene-text-muted)" }}>
                          {ABILITY_ABBREVIATIONS[a]}
                        </span>
                        <span className="text-sm tabular-nums" style={{ color: "var(--scene-text-primary)" }}>
                          {totals[a]}
                          {add > 0 && <span style={{ color: "var(--scene-accent)" }}> → {newScore}</span>}
                        </span>
                        <div className="ml-auto flex items-center gap-1.5">
                          <button
                            onClick={() => bump(a, -1)}
                            disabled={add <= 0}
                            className="w-7 h-7 rounded text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-30"
                            style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-sm tabular-nums" style={{ color: add > 0 ? "var(--scene-accent)" : "var(--scene-text-muted)" }}>
                            +{add}
                          </span>
                          <button
                            onClick={() => bump(a, +1)}
                            disabled={!canInc}
                            className="w-7 h-7 rounded text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-30"
                            style={{ background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--scene-accent) 32%, transparent)", color: "var(--scene-accent)" }}
                            title={newScore >= 20 ? "Already at 20 (RAW cap)" : undefined}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : selectedFeat ? (
              <div className="rounded-lg p-3" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 flex-shrink-0" style={{ color: "var(--scene-accent)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
                    {selectedApplied?.text ? `${selectedFeat.name} (${selectedApplied.text})` : selectedFeat.name}
                  </span>
                  <button onClick={() => setFeatPickerOpen(true)} className="ml-auto text-xs hover:opacity-80" style={{ color: "var(--scene-accent)" }}>
                    Change
                  </button>
                </div>
                {selectedApplied && appliedSummary(selectedApplied) && (
                  <p className="text-[11px] mt-1 font-medium" style={{ color: "var(--scene-accent)" }}>{appliedSummary(selectedApplied)}</p>
                )}
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>{selectedFeat.description}</p>
              </div>
            ) : (
              <button
                onClick={() => setFeatPickerOpen(true)}
                className="w-full py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
                style={{ background: "var(--scene-bg)", border: "1px dashed var(--scene-border)", color: "var(--scene-accent)" }}
              >
                Choose a feat…
              </button>
            )}
          </div>
        )}

        {/* Fighting Style — Paladin/Ranger at level 2 (required choice) */}
        {needsFightingStyle && (
          <div className="mb-4">
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-accent)" }}>
              Fighting Style
            </div>
            <div className="flex flex-wrap gap-2">
              {fightingStyleOptions.map((fs) => (
                <button
                  key={fs.id}
                  onClick={() => setFightingStyleId((prev) => (prev === fs.id ? "" : fs.id))}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: fightingStyleId === fs.id ? "var(--scene-accent)" : "var(--scene-bg)",
                    color: fightingStyleId === fs.id ? "var(--scene-bg)" : "var(--scene-text-primary)",
                    border: `1px solid ${fightingStyleId === fs.id ? "var(--scene-accent)" : "var(--scene-border)"}`,
                  }}
                >
                  {fs.name}
                </button>
              ))}
            </div>
            {selectedFightingStyle && (
              <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>{selectedFightingStyle.description}</p>
            )}
          </div>
        )}

        {/* Features reminder */}
        <p className="text-xs rounded-lg p-3 mb-4" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)", color: "var(--scene-text-muted)" }}>
          New class features at this level aren&apos;t added automatically — add them as Custom Properties below the sheet (check your class for level {newLevel}).
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => handleConfirm(false)}
            disabled={saving || (isAsi && !canApply) || (needsFightingStyle && !fightingStyleId)}
            className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
            title={
              isAsi && !canApply
                ? choice === "asi" ? "Assign 2 ability points first" : "Choose a feat first"
                : needsFightingStyle && !fightingStyleId ? "Choose a fighting style first" : undefined
            }
          >
            {saving ? "Leveling…" : `Level up to ${newLevel}`}
          </button>
        </div>
        {isAsi && (
          <button
            onClick={() => handleConfirm(true)}
            disabled={saving}
            className="w-full mt-2 py-1.5 text-xs transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ color: "var(--scene-text-muted)" }}
          >
            Skip for now — choose your ASI or feat later
          </button>
        )}

        {featPickerOpen && (
          <FeatPicker
            feats={FEATS}
            knownIds={knownFeatIds}
            char={char}
            onSelect={(f, applied) => { setSelectedFeat(f); setSelectedApplied(applied); setChoice("feat"); setFeatPickerOpen(false) }}
            onClose={() => setFeatPickerOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

// Experience bar + Add XP + Level Up entry point.
function ExperienceCard({ char, conMod, spellAbilityMod, hitDie, edition }: { char: CharDoc; conMod: number; spellAbilityMod: number; hitDie: number; edition: Edition }) {
  const doUpdate = useMutation(api.characters.update)
  const [levelUpOpen, setLevelUpOpen] = useState(false)
  const [addingXp, setAddingXp] = useState(false)
  const [xpInput, setXpInput] = useState("")

  const xp = char.experiencePoints
  const progress = getXPProgress(xp)
  const toNext = getXPToNextLevel(xp)
  const atMax = char.level >= 20
  const xpReady = !atMax && getLevelFromXP(xp) > char.level

  const handleAddXp = async () => {
    const amount = Math.floor(Number(xpInput))
    if (!Number.isFinite(amount) || amount === 0) {
      setAddingXp(false)
      setXpInput("")
      return
    }
    try {
      const newXP = Math.max(0, xp + amount)
      await doUpdate({ id: char._id, experiencePoints: newXP })
      if (getLevelFromXP(newXP) > char.level) toast.success("XP added — ready to level up!")
      else toast.success(`${amount > 0 ? "+" : ""}${amount.toLocaleString()} XP`)
    } catch {
      toast.error("Couldn't update XP.")
    } finally {
      setAddingXp(false)
      setXpInput("")
    }
  }

  return (
    <div className="rounded-xl p-4 mb-6" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
      <div className="flex items-center gap-1.5 mb-2">
        <ChevronsUp className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
        <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>Experience</span>
        <span className="ml-auto text-xs" style={{ color: "var(--scene-text-muted)" }}>
          {atMax ? "Max level" : `${xp.toLocaleString()} XP · ${toNext.toLocaleString()} to level ${char.level + 1}`}
        </span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden mb-3" style={{ background: "var(--scene-border)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${atMax ? 100 : progress}%`, background: "var(--scene-accent)" }} />
      </div>

      {addingXp ? (
        <div className="flex gap-2">
          <input
            autoFocus
            type="number"
            value={xpInput}
            onChange={(e) => setXpInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddXp(); if (e.key === "Escape") { setAddingXp(false); setXpInput("") } }}
            placeholder="XP to add (e.g. 500)"
            className="flex-1 px-3 py-1.5 rounded-md text-sm bg-transparent outline-none"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          />
          <button onClick={handleAddXp} className="px-3 py-1.5 rounded-md text-sm font-medium hover:opacity-80" style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}>Add</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setAddingXp(true)}
            disabled={atMax}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}
          >
            <Plus className="h-3.5 w-3.5" /> Add XP
          </button>
          <button
            onClick={() => setLevelUpOpen(true)}
            disabled={atMax}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={
              xpReady
                ? { background: "var(--scene-accent)", color: "var(--scene-bg)" }
                : { background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)", color: "var(--scene-accent)", border: "1px solid color-mix(in srgb, var(--scene-accent) 32%, transparent)" }
            }
            title={atMax ? "Already level 20" : xpReady ? "Your XP supports a higher level" : "Milestone level up"}
          >
            <ChevronsUp className="h-3.5 w-3.5" /> {atMax ? "Level 20" : "Level Up"}
          </button>
        </div>
      )}

      {levelUpOpen && (
        <LevelUpDialog char={char} hitDie={hitDie} conMod={conMod} spellAbilityMod={spellAbilityMod} edition={edition} onClose={() => setLevelUpOpen(false)} />
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const COINS = ["cp", "sp", "ep", "gp", "pp"] as const
type Coin = (typeof COINS)[number]

// Editable coin purse. Each field is uncontrolled (defaultValue) and commits on
// blur/Enter; the key forces a reset when the server value changes elsewhere
// (e.g. another device). Values clamp to non-negative integers server-side too.
function CurrencyEditor({ char }: { char: CharDoc }) {
  const doSet = useMutation(api.characters.setCurrency)

  const commit = (coin: Coin, raw: string) => {
    const parsed = Math.floor(Number(raw))
    const value = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
    if (value === char.currency[coin]) return
    doSet({ id: char._id, currency: { ...char.currency, [coin]: value } }).catch(() =>
      toast.error("Failed to update currency.")
    )
  }

  return (
    <div
      className="rounded-xl p-4 grid grid-cols-3 sm:grid-cols-5 gap-3 text-center"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      {COINS.map((coin) => (
        <div key={coin}>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>
            {coin}
          </div>
          <input
            key={`${coin}-${char.currency[coin]}`}
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={char.currency[coin]}
            onBlur={(e) => commit(coin, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            }}
            className="w-full text-lg font-bold text-center bg-transparent outline-none rounded-md py-1 transition-colors"
            style={{
              fontFamily: "var(--font-cinzel)",
              color: "var(--scene-text-primary)",
              border: "1px solid var(--scene-border)",
            }}
            aria-label={`${coin} currency`}
          />
        </div>
      ))}
    </div>
  )
}

// Feats section — renders the character's feat features (type "feature", source
// "feat") and offers a standalone "Add feat" for feats gained outside level-up
// (level-1 origin feats, variant-human picks). Homebrew feats merge here later.
function FeatsSection({
  char,
  featRows,
  nextOrder,
}: {
  char: CharDoc
  featRows: Doc<"characterProperties">[]
  nextOrder: number
}) {
  const addProperty = useMutation(api.characters.addProperty)
  const removeProperty = useMutation(api.characters.removeProperty)
  const update = useMutation(api.characters.update)
  const [picking, setPicking] = useState(false)

  const knownIds = new Set(
    featRows.map((p) => (p.data as { featId?: string } | undefined)?.featId).filter(Boolean) as string[],
  )

  const handleAdd = async (feat: FeatData, applied: AppliedGrants) => {
    try {
      const patch = applyGrants(char, applied)
      if (Object.keys(patch).length) await update({ id: char._id, ...patch })
      const summary = appliedSummary(applied)
      await addProperty({
        characterId: char._id,
        type: "feature",
        name: applied.text ? `${feat.name} (${applied.text})` : feat.name,
        description: summary ? `${feat.description}\n\n${summary}` : feat.description,
        source: "feat",
        active: true,
        orderIndex: nextOrder,
        data: { featId: feat.id, category: feat.category, applied },
      })
      toast.success(`Gained ${feat.name}.`)
      setPicking(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add feat.")
    }
  }

  // Reverse the feat's baked-in grants (if any) before removing the row.
  const handleRemove = async (row: Doc<"characterProperties">) => {
    try {
      const applied = (row.data as { applied?: AppliedGrants } | undefined)?.applied
      if (applied) {
        const patch = reverseGrants(char, applied)
        if (Object.keys(patch).length) await update({ id: char._id, ...patch })
      }
      await removeProperty({ id: row._id })
      toast.success("Feat removed.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove feat.")
    }
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
          Feats
        </h2>
        <button
          onClick={() => setPicking(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
        >
          <Plus className="h-4 w-4" /> Add feat
        </button>
      </div>

      {featRows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
          No feats yet. Gain one by choosing &ldquo;Feat&rdquo; at an ASI level on level-up, or add one directly.
        </p>
      ) : (
        <div className="space-y-2">
          {featRows.map((p) => (
            <div
              key={p._id}
              className="flex items-start gap-3 rounded-lg px-4 py-3"
              style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
            >
              <Award className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "var(--scene-accent)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>{p.name}</p>
                {p.description && (
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>{p.description}</p>
                )}
              </div>
              <button
                onClick={() => handleRemove(p)}
                className="p-1.5 rounded transition-opacity hover:opacity-80 flex-shrink-0"
                style={{ color: "var(--scene-text-muted)" }}
                title="Remove feat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {picking && (
        <FeatPicker feats={FEATS} knownIds={knownIds} char={char} onSelect={handleAdd} onClose={() => setPicking(false)} />
      )}
    </section>
  )
}

function CustomPropertiesSection({ characterId }: { characterId: Id<"characters"> }) {
  const allProps = useQuery(api.characters.listAllProperties)
  const addProperty = useMutation(api.characters.addProperty)
  const updateProperty = useMutation(api.characters.updateProperty)
  const removeProperty = useMutation(api.characters.removeProperty)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [adding, setAdding] = useState(false)

  // Only freeform "custom" rows belong here — structured items (type "item")
  // render in the Inventory section, not as custom properties.
  const props = (allProps ?? [])
    .filter((p) => p.characterId === characterId && p.type === "custom")
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
                <MarkdownRenderer content={p.description} variant="scene" className="text-xs mt-0.5 leading-relaxed" />
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

// Shown for a caster whose spellcasting block was never initialized (every
// character built before this feature, plus any class changed TO a caster on the
// edit page). One tap derives + saves the block via the existing update mutation —
// the same block new casters get at creation. Non-casters never see this.
function EnableSpellcastingCard({ char, edition }: { char: CharDoc; edition: Edition }) {
  const doUpdate = useMutation(api.characters.update)
  const [saving, setSaving] = useState(false)

  // Resolve the subclass so EK/AT get their third-caster block, and so the prompt
  // names the source correctly (the subclass, not the base class, grants it).
  const subclassId = getSubclassId(char.characterClass, char.subclass)
  const isThird = getEffectiveCasterType(char.characterClass, subclassId) === "third"

  const handleEnable = async () => {
    const block = initSpellcasting(char.characterClass, char.level, char.baseAbilities, edition, char.racialBonuses, subclassId)
    if (!block) return
    setSaving(true)
    try {
      await doUpdate({ id: char._id, spellcasting: block })
      toast.success("Spellcasting enabled.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't enable spellcasting.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-6">
      <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
        Spellcasting
      </h2>
      <div
        className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <p className="text-sm flex-1" style={{ color: "var(--scene-text-muted)" }}>
          {isThird
            ? `${char.subclass || "Your subclass"} grants spellcasting (a third-caster who learns from the wizard list).`
            : `${char.characterClass} is a spellcasting class.`}{" "}
          Enable spell tracking to manage spell slots, your spell save DC &amp; attack, and a spellbook.
        </p>
        <button
          onClick={handleEnable}
          disabled={saving}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 flex-shrink-0"
          style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
        >
          <Sparkles className="h-4 w-4" />
          {saving ? "Enabling…" : "Enable spellcasting"}
        </button>
      </div>
    </section>
  )
}

// Draconic Resilience (Draconic Bloodline sorcerer) grants +1 max HP per level.
// HP must live in STORED max — combat reads it server-side — so this reconciles
// the stored value against the expected bonus and bakes the delta on one tap (the
// "put the action where it's seen" half of patch 742cf763). Idempotent: it tracks
// the applied amount in a hidden `hpAdjustment` marker, so it handles new levels,
// the retroactive backfill for existing sorcerers, and reversal if the subclass
// changes away. Renders nothing when stored max is already correct.
function DraconicResilienceCard({
  char,
  row,
  expected,
  nextOrder,
}: {
  char: CharDoc
  row: Doc<"characterProperties"> | undefined
  expected: number
  nextOrder: number
}) {
  const doUpdate = useMutation(api.characters.update)
  const addProperty = useMutation(api.characters.addProperty)
  const updateProperty = useMutation(api.characters.updateProperty)
  const removeProperty = useMutation(api.characters.removeProperty)
  const [saving, setSaving] = useState(false)

  const applied = (row?.data as { hp?: number } | undefined)?.hp ?? 0
  const delta = expected - applied
  if (delta === 0) return null

  const handleApply = async () => {
    setSaving(true)
    try {
      const newMax = Math.max(1, char.hitPoints.max + delta)
      // Gaining HP raises current too; losing it only clamps current to the new max.
      const newCurrent =
        delta > 0 ? char.hitPoints.current + delta : Math.min(char.hitPoints.current, newMax)
      await doUpdate({
        id: char._id,
        hitPoints: { ...char.hitPoints, max: newMax, current: newCurrent },
      })
      if (expected === 0) {
        if (row) await removeProperty({ id: row._id })
      } else if (row) {
        await updateProperty({ id: row._id, data: { source: "draconic-resilience", hp: expected } })
      } else {
        await addProperty({
          characterId: char._id,
          type: "hpAdjustment",
          name: "Draconic Resilience HP",
          active: true,
          orderIndex: nextOrder,
          source: "subclass",
          data: { source: "draconic-resilience", hp: expected },
        })
      }
      toast.success(
        delta > 0
          ? `Draconic Resilience applied — +${delta} max HP.`
          : `Draconic Resilience removed — ${delta} max HP.`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update HP.")
    } finally {
      setSaving(false)
    }
  }

  const removing = expected === 0
  return (
    <div
      className="rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{
        background: "var(--scene-surface)",
        border: "1px solid color-mix(in srgb, var(--scene-accent) 40%, var(--scene-border))",
      }}
    >
      <div className="flex-1">
        <div className="text-sm font-semibold mb-0.5" style={{ color: "var(--scene-text-primary)" }}>
          Draconic Resilience
        </div>
        <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
          {removing
            ? `Your max HP still includes +${applied} from Draconic Resilience, but this character no longer has it. Remove it to correct your hit points.`
            : `Draconic Resilience adds +1 max HP per sorcerer level (+${expected} at level ${char.level})${applied > 0 ? `; ${applied} is applied` : ""}. Bake it into your hit points so combat stays in sync.`}
        </p>
      </div>
      <button
        onClick={handleApply}
        disabled={saving}
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 flex-shrink-0"
        style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
      >
        <Sparkles className="h-4 w-4" />
        {saving ? "Saving…" : removing ? `Remove ${delta} HP` : `Apply +${delta} HP`}
      </button>
    </div>
  )
}

// ── Sheet tabs ────────────────────────────────────────────────────────────────
// Chunk the full sheet into intent-based groups so it isn't one endless scroll
// (a named ND anti-pattern). Mirrors the scene-styled tab pattern from the live
// session page. Nothing is removed — every section is one tap away.

type SheetTab = "play" | "abilities" | "spells" | "inventory" | "bio"

const SHEET_TABS: { id: SheetTab; label: string; icon: LucideIcon }[] = [
  { id: "play", label: "Play", icon: Swords },
  { id: "abilities", label: "Abilities", icon: Dices },
  { id: "spells", label: "Spells & Features", icon: Sparkles },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "bio", label: "Bio", icon: ScrollText },
]

const SHEET_TAB_STORAGE_KEY = "feyforge:sheet-tab"

function SheetTabs({ tab, setTab }: { tab: SheetTab; setTab: (t: SheetTab) => void }) {
  return (
    <div
      className="flex gap-1 mb-6 p-1 rounded-lg overflow-x-auto"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      {SHEET_TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setTab(id)}
          className="flex-1 min-w-fit flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap"
          style={{
            background: tab === id ? "var(--scene-accent)" : "transparent",
            color: tab === id ? "var(--scene-bg)" : "var(--scene-text-muted)",
          }}
        >
          <Icon className="h-3.5 w-3.5 flex-shrink-0" />
          {label}
        </button>
      ))}
    </div>
  )
}

export default function CharacterSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const char = useQuery(api.characters.get, { id: id as Id<"characters"> })
  const allProps = useQuery(api.characters.listAllProperties)
  // Resolve the character's campaign edition (for edition-aware spell counts +
  // exhaustion). Membership-gated query → null for a non-member, which
  // resolveEdition defaults to 2024; "skip" for a character with no campaign.
  const campaign = useQuery(
    api.campaigns.get,
    char?.campaignId ? { campaignId: char.campaignId } : "skip",
  )
  // Hooks must run on every render — call before any early return (Rules of Hooks).
  // Exhaustion penalizes every d20 rolled from the sheet, edition-aware.
  const { roll, rollExpr, mode, setMode, lastRoll, rolling, dismiss } = useSheetRoll({
    exhaustion: { level: char?.exhaustion ?? 0, edition: resolveEdition(campaign?.edition) },
  })

  // Active sheet tab. Default to "play"; restore the last-viewed tab after mount
  // (read in an effect, not initial state, to avoid an SSR hydration mismatch).
  const [sheetTab, setSheetTab] = useState<SheetTab>("play")
  useEffect(() => {
    const saved = localStorage.getItem(SHEET_TAB_STORAGE_KEY)
    if (saved && SHEET_TABS.some((t) => t.id === saved)) {
      setSheetTab(saved as SheetTab)
    }
  }, [])
  const selectTab = (t: SheetTab) => {
    setSheetTab(t)
    try { localStorage.setItem(SHEET_TAB_STORAGE_KEY, t) } catch { /* storage may be unavailable */ }
  }

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

  const {
    totalAbilities, mods, profBonus, saveMods, skillMods, passivePerception, initiative,
    raceName, classColor, hitDie, darkvision,
    items, spells, grantedSpells, resourceRows, featRows, formRows, companionRows, invocationRows, maneuverRows, landCircleRow, landCircleTerrain, subclassId, casterType, edition,
    shortRestResourceKeys, equippedWeapons, fightingStyleId,
    armorClass, critRange, draconicHpExpected, draconicHpRow, armorName, nextOrder,
    grantedFeatures, channelDivinityOptions, grantedProficiencies,
  } = deriveCharacter(char, allProps, campaign)

  // Merge subclass-granted bonus proficiencies into the displayed lists
  // (derive-live; deduped case-insensitively against what the class already has).
  const mergeProf = (base: string[], kind: "armor" | "weapon" | "tool") => {
    const extra = grantedProficiencies.filter((p) => p.kind === kind).map((p) => p.value)
    const seen = new Set(base.map((s) => s.toLowerCase()))
    return [...base, ...extra.filter((e) => !seen.has(e.toLowerCase()))]
  }

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

        {/* Header — identity, pinned above the tabs */}
        <div
          className="rounded-xl p-5 mb-4"
          style={{
            background: "color-mix(in srgb, var(--scene-accent) 6%, var(--scene-surface))",
            border: "1px solid color-mix(in srgb, var(--scene-accent) 20%, var(--scene-border))",
          }}
        >
          <div className="flex items-start gap-4">
            <CharacterAvatar
              imageUrl={char.imageUrl}
              name={char.name}
              className="w-14 h-14 rounded-xl"
              iconClassName="h-7 w-7"
            />
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
              {char.faith?.name && (
                <p className="text-xs mt-0.5 italic" style={{ color: "var(--scene-accent)" }}>
                  {char.faith.name}{char.faith.deity ? ` · ${char.faith.deity}` : ""}
                </p>
              )}
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

        {/* Roll mode toggle + last roll — pinned so a roll from any tab shows
            its result in the same place. */}
        <RollModeBar mode={mode} setMode={setMode} />
        {lastRoll && (
          <SheetRollCard result={lastRoll} rolling={rolling} onDismiss={dismiss} />
        )}

        {/* Tabbed sections — the full sheet chunked into intent groups so it isn't
            one endless scroll. The active tab is remembered (selectTab). */}
        <SheetTabs tab={sheetTab} setTab={selectTab} />

        {/* ⚔ Play — at-the-table essentials */}
        {sheetTab === "play" && (<>
        {/* Experience + Level Up */}
        <ExperienceCard
          char={char}
          conMod={mods.constitution}
          spellAbilityMod={char.spellcasting ? mods[char.spellcasting.ability as Ability] : 0}
          hitDie={hitDie}
          edition={edition}
        />

        {/* HP + Class Resources (left) · Rest (right). Stacking resources under HP
            balances the column against the taller Rest card and avoids a lonely
            half-width card; ResourcesSection renders nothing for non-resource classes. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 items-start">
          <div className="flex flex-col gap-4">
            <HpEditor char={char} />
            <ResourcesSection
              characterId={char._id}
              classId={char.characterClass}
              level={char.level}
              mods={mods}
              edition={edition}
              subclassId={subclassId}
              resourceRows={resourceRows}
              nextOrder={nextOrder}
              resourceOptions={{ "channel-divinity": channelDivinityOptions }}
            />
          </div>
          <div className="flex flex-col gap-4">
            <RestPanel char={char} resourceRows={resourceRows} shortRestResourceKeys={shortRestResourceKeys} />
            <ExhaustionPanel char={char} edition={edition} />
          </div>
        </div>

        {/* Draconic Resilience — bake +1 HP/level into stored max (combat-safe). */}
        <DraconicResilienceCard
          char={char}
          row={draconicHpRow}
          expected={draconicHpExpected}
          nextOrder={nextOrder}
        />

        {/* Death saves — auto-surface only while dying (0 HP) */}
        {char.hitPoints.current === 0 && <DyingPanel char={char} />}

        {/* Combat stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatBox label="Armor Class" value={armorClass} sub={armorName ?? "unarmored"} />
          <StatBox label="Initiative" value={formatModifier(initiative)} onClick={() => roll("Initiative", initiative)} />
          <StatBox label="Speed" value={`${char.speed} ft`} />
          <StatBox label="Prof Bonus" value={formatModifier(profBonus)} />
          <StatBox label="Passive Perc" value={passivePerception} />
          <StatBox label="Hit Dice" value={`${char.level}d${hitDie}`} />
          {char.inspiration && <StatBox label="Inspiration" value="✦" />}
        </div>

        {/* Attacks — derived from equipped weapons in the Inventory tab */}
        <AttacksSection
          level={char.level}
          weaponProficiencies={char.weaponProficiencies}
          abilities={totalAbilities}
          weapons={equippedWeapons}
          fightingStyleId={fightingStyleId}
          critRange={critRange}
          roll={roll}
          rollExpr={rollExpr}
        />
        </>)}

        {/* 🎲 Abilities — scores, saves, skills, proficiencies */}
        {sheetTab === "abilities" && (<>
        {/* Ability Scores */}
        <AbilityScoresGrid totalAbilities={totalAbilities} mods={mods} roll={roll} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <SavingThrowsCard
            savingThrowProficiencies={char.savingThrowProficiencies}
            saveMods={saveMods}
            roll={roll}
          />
          <SensesCard
            passivePerception={passivePerception}
            speed={char.speed}
            darkvision={darkvision}
          />
        </div>

        {/* Skills */}
        <SkillsCard
          skillProficiencies={char.skillProficiencies}
          skillExpertise={char.skillExpertise}
          skillMods={skillMods}
          roll={roll}
        />

        {/* Tools — proficiency checks (pick the ability) */}
        <ToolsCard
          toolProficiencies={char.toolProficiencies}
          mods={mods}
          profBonus={profBonus}
          roll={roll}
        />

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
              { label: "Armor", items: mergeProf(char.armorProficiencies, "armor") },
              { label: "Weapons", items: mergeProf(char.weaponProficiencies, "weapon") },
              { label: "Tools", items: mergeProf(char.toolProficiencies, "tool") },
              { label: "Languages", items: char.languages },
            ].filter(({ items }) => items.length > 0).map(({ label, items }) => (
              <div key={label}>
                <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>{label}</div>
                <p className="text-sm" style={{ color: "var(--scene-text-primary)" }}>{items.join(", ")}</p>
              </div>
            ))}
          </div>
        </section>
        </>)}

        {/* ✨ Spells & Features — class powers, features, feats */}
        {sheetTab === "spells" && (<>
        {/* Spellcasting — slots, spell save DC/attack, and the spellbook. Casters
            without a block yet (built before this feature) get a one-tap enable card.
            Gated on the CURRENT class being a caster, so a stale block from a class
            later changed to a non-caster (edit page) never shows a phantom spellbook. */}
        {casterType !== "none" &&
          (char.spellcasting ? (
            <SpellbookSection
              characterId={char._id}
              spellcasting={char.spellcasting}
              classId={char.characterClass}
              subclassId={subclassId}
              level={char.level}
              edition={edition}
              spells={spells}
              grantedSpells={grantedSpells}
              nextOrder={nextOrder}
              roll={roll}
            />
          ) : (
            <EnableSpellcastingCard char={char} edition={edition} />
          ))}

        {/* Eldritch Invocations (warlocks L2+) — chosen from a list, count-gated. */}
        <InvocationsSection
          characterId={char._id}
          classId={char.characterClass}
          level={char.level}
          invocationRows={invocationRows}
          nextOrder={nextOrder}
        />

        {/* Battle Master maneuvers (fighters) */}
        <ManeuversSection
          characterId={char._id}
          classId={char.characterClass}
          subclassId={subclassId}
          level={char.level}
          maneuverRows={maneuverRows}
          nextOrder={nextOrder}
        />

        {/* Circle of the Land terrain (druids, Land circle, L3+) */}
        <LandCircleSection
          characterId={char._id}
          classId={char.characterClass}
          subclassId={subclassId}
          level={char.level}
          rowId={landCircleRow?._id}
          terrain={landCircleTerrain}
          nextOrder={nextOrder}
        />

        {/* Wild Shape (druids L2+) + Companions — creature stat blocks attached to
            the character; derived live from alternateForm/companion property rows. */}
        <WildshapeSection
          characterId={char._id}
          classId={char.characterClass}
          level={char.level}
          subclass={char.subclass}
          formRows={formRows}
          mentalAbilities={{
            intelligence: totalAbilities.intelligence,
            wisdom: totalAbilities.wisdom,
            charisma: totalAbilities.charisma,
          }}
          nextOrder={nextOrder}
          roll={roll}
          rollExpr={rollExpr}
        />
        <CompanionsSection
          characterId={char._id}
          companionRows={companionRows}
          nextOrder={nextOrder}
          roll={roll}
          rollExpr={rollExpr}
        />

        {/* Class Features — granted by class/subclass (read-only, derived live
            from class-grants; e.g. cleric domain features). */}
        {grantedFeatures.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
              Class Features
            </h2>
            <div className="space-y-2">
              {grantedFeatures.map((f) => (
                <div key={f.id} className="rounded-lg px-4 py-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>{f.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>Lv {f.level}</span>
                    {f.uses && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--scene-accent) 12%, transparent)", color: "var(--scene-accent)" }}>{f.uses}</span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>{f.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Feats — ASI-level picks + standalone origin/variant feats */}
        <FeatsSection char={char} featRows={featRows} nextOrder={nextOrder} />
        </>)}

        {/* 🎒 Inventory — gear and coin */}
        {sheetTab === "inventory" && (<>
        {/* Inventory — weapons/armor/gear; equipped weapons feed Attacks, equipped armor sets AC */}
        <InventorySection char={char} characterId={char._id} items={items} nextOrder={nextOrder} strength={totalAbilities.strength} />

        {/* Currency */}
        <section>
          <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
            Currency
          </h2>
          <CurrencyEditor char={char} />
        </section>
        </>)}

        {/* 📜 Bio — appearance, personality, and custom notes */}
        {sheetTab === "bio" && (<>
        {/* Appearance — physical descriptors recorded on the edit page. */}
        {(char.age || char.height || char.weight || char.size || char.eyes || char.skin || char.hair) && (
          <section className="mb-6">
            <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
              Appearance
            </h2>
            <div
              className="rounded-lg px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3"
              style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
            >
              {[
                { label: "Age", value: char.age },
                { label: "Height", value: char.height },
                { label: "Weight", value: char.weight },
                { label: "Size", value: char.size },
                { label: "Eyes", value: char.eyes },
                { label: "Skin", value: char.skin },
                { label: "Hair", value: char.hair },
              ].filter(({ value }) => !!value).map(({ label, value }) => (
                <div key={label}>
                  <div className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "var(--scene-text-muted)" }}>{label}</div>
                  <p className="text-sm" style={{ color: "var(--scene-text-primary)" }}>{value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Personality — free-text fields rendered as markdown (backstory etc.
            often carry headings, lists, and emphasis). */}
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
                  <MarkdownRenderer content={value as string} variant="scene" className="text-sm leading-relaxed" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Custom Properties */}
        <CustomPropertiesSection characterId={char._id} />
        </>)}

      </div>
    </AppShell>
  )
}
