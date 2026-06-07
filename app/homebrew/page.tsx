"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { toast } from "sonner"
import { FlaskConical, Plus, Pencil, Trash2, Share2, Loader2, ArrowLeft } from "lucide-react"
import {
  ABILITIES,
  ABILITY_ABBREVIATIONS,
  SKILLS,
  SKILL_DISPLAY_NAMES,
  SIZES,
  type Ability,
  type Skill,
} from "@/lib/character/constants"
import {
  collidesWithCuratedName,
  type HomebrewRaceData,
  type HomebrewBackgroundData,
  type HomebrewClassData,
  type HomebrewMonsterData,
} from "@/lib/homebrew"
import {
  synthesizeAction,
  actionToInput,
  CR_OPTIONS,
  DAMAGE_TYPES,
  SAVE_ABILITIES,
  type MonsterActionInput,
} from "@/lib/homebrew-monster"
import { ItemEditorDialog } from "@/components/character/item-editor"
import { rowToItem, type SheetItem, type StoredItemData } from "@/lib/character/sheet-items"

// ── Homebrew library ──────────────────────────────────────────────────────────
// Build custom races & backgrounds that merge into the character builder's pickers
// alongside the curated SRD set. Yours across every character you build; optionally
// publish one to a campaign so its members can use it too. Selection snapshots the
// mechanics onto the character — editing a homebrew entry later won't retroactively
// change characters already built from it.

type AbilityMap = Record<Ability, number>

const ZERO_ABILITIES: AbilityMap = {
  strength: 0, dexterity: 0, constitution: 0,
  intelligence: 0, wisdom: 0, charisma: 0,
}

// Monster ability scores are raw values (default 10), not racial bonuses.
const TEN_ABILITIES: AbilityMap = {
  strength: 10, dexterity: 10, constitution: 10,
  intelligence: 10, wisdom: 10, charisma: 10,
}

interface SubraceDraft {
  name: string
  description: string
  abilityBonuses: AbilityMap
  traitsText: string
  speed: number // 0 = inherit race speed
  darkvision: number // 0 | 60 | 120
}

interface RaceDraft {
  id?: Id<"homebrew">
  name: string
  description: string
  size: string
  speed: number
  abilityBonuses: AbilityMap
  darkvision: number // 0 | 60 | 120
  languagesText: string
  traitsText: string
  subraces: SubraceDraft[]
}

interface BackgroundDraft {
  id?: Id<"homebrew">
  name: string
  description: string
  skillProficiencies: Skill[]
  toolProficienciesText: string
  languages: number
  equipmentText: string
  feature: string
}

interface SubclassDraft {
  name: string
  description: string
}

interface ClassDraft {
  id?: Id<"homebrew">
  name: string
  description: string
  flavorText: string
  hitDie: number // 6 | 8 | 10 | 12
  primaryAbility: Ability
  savingThrows: Ability[]
  armorProfText: string
  weaponProfText: string
  toolProfText: string
  skillCount: number
  skillOptions: Skill[]
  isSpellcaster: boolean
  spellAbility: Ability
  spellType: "prepared" | "known" | "slots"
  subclasses: SubclassDraft[]
}

// A draft attack IS the structured input the synthesizer consumes (lib/homebrew-monster).
type MonsterAttackDraft = MonsterActionInput

interface MonsterDraft {
  id?: Id<"homebrew">
  name: string
  size: string
  type: string
  alignment: string
  armorClass: number
  hitPoints: number
  hitDice: string
  speed: string
  challengeRating: string
  abilityScores: AbilityMap // raw scores (not bonuses)
  attacks: MonsterAttackDraft[]
  description: string
}

type Editor =
  | { kind: "race"; draft: RaceDraft }
  | { kind: "background"; draft: BackgroundDraft }
  | { kind: "class"; draft: ClassDraft }
  | { kind: "monster"; draft: MonsterDraft }
  | null

// ── Draft <-> stored-data conversion ──────────────────────────────────────────

const linesToArray = (text: string): string[] =>
  text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)

const partialAbilities = (map: AbilityMap): Partial<Record<Ability, number>> => {
  const out: Partial<Record<Ability, number>> = {}
  for (const a of ABILITIES) if (map[a] !== 0) out[a] = map[a]
  return out
}

const emptyRaceDraft = (): RaceDraft => ({
  name: "",
  description: "",
  size: "Medium",
  speed: 30,
  abilityBonuses: { ...ZERO_ABILITIES },
  darkvision: 0,
  languagesText: "Common",
  traitsText: "",
  subraces: [],
})

const emptyBackgroundDraft = (): BackgroundDraft => ({
  name: "",
  description: "",
  skillProficiencies: [],
  toolProficienciesText: "",
  languages: 0,
  equipmentText: "",
  feature: "",
})

const raceDocToDraft = (doc: Doc<"homebrew">): RaceDraft => {
  const d = doc.data as HomebrewRaceData
  return {
    id: doc._id,
    name: doc.name,
    description: d.description,
    size: d.size,
    speed: d.speed,
    abilityBonuses: { ...ZERO_ABILITIES, ...d.abilityBonuses },
    darkvision: d.darkvision ?? 0,
    languagesText: (d.languages ?? []).join(", "),
    traitsText: (d.traits ?? []).join("\n"),
    subraces: (d.subraces ?? []).map((sr) => ({
      name: sr.name,
      description: sr.description,
      abilityBonuses: { ...ZERO_ABILITIES, ...sr.abilityBonuses },
      traitsText: (sr.traits ?? []).join("\n"),
      speed: sr.speed ?? 0,
      darkvision: sr.darkvision ?? 0,
    })),
  }
}

const backgroundDocToDraft = (doc: Doc<"homebrew">): BackgroundDraft => {
  const d = doc.data as HomebrewBackgroundData
  return {
    id: doc._id,
    name: doc.name,
    description: d.description,
    skillProficiencies: (d.skillProficiencies as Skill[]) ?? [],
    toolProficienciesText: (d.toolProficiencies ?? []).join(", "),
    languages: d.languages ?? 0,
    equipmentText: (d.equipment ?? []).join("\n"),
    feature: d.feature,
  }
}

const raceDraftToData = (draft: RaceDraft): HomebrewRaceData => ({
  description: draft.description.trim(),
  size: draft.size,
  speed: draft.speed,
  abilityBonuses: partialAbilities(draft.abilityBonuses),
  traits: linesToArray(draft.traitsText),
  languages: linesToArray(draft.languagesText),
  darkvision: draft.darkvision,
  subraces: draft.subraces
    .filter((sr) => sr.name.trim())
    .map((sr) => ({
      name: sr.name.trim(),
      description: sr.description.trim(),
      abilityBonuses: partialAbilities(sr.abilityBonuses),
      traits: linesToArray(sr.traitsText),
      ...(sr.speed > 0 ? { speed: sr.speed } : {}),
      darkvision: sr.darkvision,
    })),
})

const backgroundDraftToData = (draft: BackgroundDraft): HomebrewBackgroundData => ({
  description: draft.description.trim(),
  skillProficiencies: draft.skillProficiencies,
  toolProficiencies: linesToArray(draft.toolProficienciesText),
  languages: draft.languages,
  equipment: linesToArray(draft.equipmentText),
  feature: draft.feature.trim(),
})

const emptyClassDraft = (): ClassDraft => ({
  name: "",
  description: "",
  flavorText: "",
  hitDie: 8,
  primaryAbility: "strength",
  savingThrows: [],
  armorProfText: "",
  weaponProfText: "",
  toolProfText: "",
  skillCount: 2,
  skillOptions: [],
  isSpellcaster: false,
  spellAbility: "intelligence",
  spellType: "prepared",
  subclasses: [],
})

const classDocToDraft = (doc: Doc<"homebrew">): ClassDraft => {
  const d = doc.data as HomebrewClassData
  return {
    id: doc._id,
    name: doc.name,
    description: d.description,
    flavorText: d.flavorText,
    hitDie: d.hitDie,
    primaryAbility: d.primaryAbility as Ability,
    savingThrows: (d.savingThrows as Ability[]) ?? [],
    armorProfText: (d.armorProficiencies ?? []).join(", "),
    weaponProfText: (d.weaponProficiencies ?? []).join(", "),
    toolProfText: (d.toolProficiencies ?? []).join(", "),
    skillCount: d.skillChoices.count,
    skillOptions: (d.skillChoices.options as Skill[]) ?? [],
    isSpellcaster: !!d.spellcasting,
    spellAbility: (d.spellcasting?.ability as Ability) ?? "intelligence",
    spellType: (d.spellcasting?.type as ClassDraft["spellType"]) ?? "prepared",
    subclasses: (d.subclasses ?? []).map((s) => ({
      name: s.name,
      description: s.description,
    })),
  }
}

const classDraftToData = (draft: ClassDraft): HomebrewClassData => ({
  description: draft.description.trim(),
  flavorText: draft.flavorText.trim(),
  hitDie: draft.hitDie,
  primaryAbility: draft.primaryAbility,
  savingThrows: draft.savingThrows,
  armorProficiencies: linesToArray(draft.armorProfText),
  weaponProficiencies: linesToArray(draft.weaponProfText),
  toolProficiencies: linesToArray(draft.toolProfText),
  skillChoices: { count: draft.skillCount, options: draft.skillOptions },
  ...(draft.isSpellcaster
    ? { spellcasting: { ability: draft.spellAbility, type: draft.spellType } }
    : {}),
  subclasses: draft.subclasses
    .filter((s) => s.name.trim())
    .map((s) => ({ name: s.name.trim(), description: s.description.trim() })),
})

// ── Monster conversion ────────────────────────────────────────────────────────
// The structured ↔ MonsterAction synthesis (and the SRD prose format the combat
// tracker parses) lives in lib/homebrew-monster.ts; here we only build/read drafts.

const emptyAttackDraft = (): MonsterAttackDraft => ({
  name: "",
  kind: "melee",
  toHit: 4,
  range: "5 ft.",
  damageDice: "1d6",
  damageBonus: 2,
  damageType: "slashing",
  saveDC: 13,
  saveAbility: "Dexterity",
  desc: "",
})

const emptyMonsterDraft = (): MonsterDraft => ({
  name: "",
  size: "Medium",
  type: "beast",
  alignment: "unaligned",
  armorClass: 12,
  hitPoints: 10,
  hitDice: "",
  speed: "30 ft.",
  challengeRating: "1",
  abilityScores: { ...TEN_ABILITIES },
  attacks: [],
  description: "",
})

const monsterDocToDraft = (doc: Doc<"homebrew">): MonsterDraft => {
  const d = doc.data as HomebrewMonsterData
  return {
    id: doc._id,
    name: doc.name,
    size: d.size,
    type: d.type,
    alignment: d.alignment ?? "",
    armorClass: d.armorClass,
    hitPoints: d.hitPoints,
    hitDice: d.hitDice ?? "",
    speed: d.speed,
    challengeRating: d.challengeRating,
    abilityScores: { ...TEN_ABILITIES, ...d.abilityScores },
    attacks: (d.actions ?? []).map(actionToInput),
    description: d.description ?? "",
  }
}

const monsterDraftToData = (draft: MonsterDraft): HomebrewMonsterData => ({
  size: draft.size,
  type: draft.type.trim(),
  ...(draft.alignment.trim() ? { alignment: draft.alignment.trim() } : {}),
  armorClass: draft.armorClass,
  hitPoints: draft.hitPoints,
  ...(draft.hitDice.trim() ? { hitDice: draft.hitDice.trim() } : {}),
  speed: draft.speed.trim() || "30 ft.",
  challengeRating: draft.challengeRating.trim() || "1",
  abilityScores: { ...draft.abilityScores },
  actions: draft.attacks.filter((a) => a.name.trim()).map(synthesizeAction),
  ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
})

// ── Shared form atoms (match the app's --scene-* token system) ────────────────

const fieldStyle: React.CSSProperties = {
  background: "var(--scene-surface)",
  border: "1px solid var(--scene-border)",
  color: "var(--scene-text-primary)",
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-xs uppercase tracking-widest mb-1.5"
      style={{ color: "var(--scene-text-muted)" }}
    >
      {children}
    </label>
  )
}

function AbilityGrid({
  value,
  onChange,
}: {
  value: AbilityMap
  onChange: (next: AbilityMap) => void
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {ABILITIES.map((a) => (
        <div key={a}>
          <FieldLabel>{ABILITY_ABBREVIATIONS[a]}</FieldLabel>
          <input
            type="number"
            value={value[a]}
            onChange={(e) =>
              onChange({ ...value, [a]: parseInt(e.target.value, 10) || 0 })
            }
            className="w-full px-2 py-1.5 rounded-lg text-sm outline-none text-center"
            style={fieldStyle}
          />
        </div>
      ))}
    </div>
  )
}

function DarkvisionSelect({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className="w-full px-3 py-2 rounded-lg text-sm outline-none appearance-none"
      style={fieldStyle}
    >
      <option value={0}>None</option>
      <option value={60}>Darkvision (60 ft)</option>
      <option value={120}>Superior Darkvision (120 ft)</option>
    </select>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomebrewPage() {
  const mine = useQuery(api.homebrew.listMine)
  const myCampaigns = useQuery(api.campaignMembers.listMyCampaigns)
  const createHb = useMutation(api.homebrew.create)
  const updateHb = useMutation(api.homebrew.update)
  const removeHb = useMutation(api.homebrew.remove)
  const setShare = useMutation(api.homebrew.setShare)

  const [editor, setEditor] = useState<Editor>(null)
  // Items use the shared inventory item editor (a modal), not the inline race/bg
  // form. `id` set ⇒ editing an existing homebrew item; null item ⇒ new.
  const [itemEditor, setItemEditor] = useState<{
    id?: Id<"homebrew">
    item: SheetItem | null
  } | null>(null)
  const [saving, setSaving] = useState(false)

  const races = useMemo(
    () => (mine ?? []).filter((h) => h.kind === "race"),
    [mine],
  )
  const backgrounds = useMemo(
    () => (mine ?? []).filter((h) => h.kind === "background"),
    [mine],
  )
  const items = useMemo(
    () => (mine ?? []).filter((h) => h.kind === "item"),
    [mine],
  )
  const classes = useMemo(
    () => (mine ?? []).filter((h) => h.kind === "class"),
    [mine],
  )
  const monsters = useMemo(
    () => (mine ?? []).filter((h) => h.kind === "monster"),
    [mine],
  )

  const handleSave = async () => {
    if (!editor) return
    const name = editor.draft.name.trim()
    if (!name) {
      toast.error("Give it a name first.")
      return
    }
    if (editor.kind !== "monster" && collidesWithCuratedName(editor.kind, name)) {
      toast.error(`"${name}" is an official ${editor.kind} — pick a different name.`)
      return
    }
    // Class skill-choice guard: the builder offers `count` skills from `options`,
    // so a count larger than the option list (or zero options) would stick the
    // builder's skill step.
    if (editor.kind === "class") {
      const { skillCount, skillOptions } = editor.draft
      if (skillCount > 0 && skillOptions.length === 0) {
        toast.error("Pick the skills this class can choose from.")
        return
      }
      if (skillCount > skillOptions.length) {
        toast.error(`Skill count (${skillCount}) can't exceed the ${skillOptions.length} options offered.`)
        return
      }
    }
    setSaving(true)
    try {
      const data =
        editor.kind === "race"
          ? raceDraftToData(editor.draft)
          : editor.kind === "background"
            ? backgroundDraftToData(editor.draft)
            : editor.kind === "class"
              ? classDraftToData(editor.draft)
              : monsterDraftToData(editor.draft)
      if (editor.draft.id) {
        await updateHb({ id: editor.draft.id, name, data })
        toast.success(`${name} updated.`)
      } else {
        await createHb({ kind: editor.kind, name, data })
        toast.success(`${name} created.`)
      }
      setEditor(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: Id<"homebrew">, name: string) => {
    if (!confirm(`Delete "${name}"? Characters already built from it keep their stats.`)) return
    try {
      await removeHb({ id })
      toast.success(`${name} deleted.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete.")
    }
  }

  const handleShare = async (
    id: Id<"homebrew">,
    campaignId: Id<"campaigns"> | null,
  ) => {
    try {
      await setShare({ id, campaignId })
      toast.success(campaignId ? "Shared to campaign." : "Sharing turned off.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update sharing.")
    }
  }

  // ── Editor view ──────────────────────────────────────────────────────────────
  if (editor) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <button
            onClick={() => setEditor(null)}
            className="flex items-center gap-1.5 text-sm mb-5 hover:opacity-80"
            style={{ color: "var(--scene-text-muted)" }}
          >
            <ArrowLeft className="w-4 h-4" /> Back to library
          </button>

          {editor.kind === "race" ? (
            <RaceForm
              draft={editor.draft}
              onChange={(draft) => setEditor({ kind: "race", draft })}
            />
          ) : editor.kind === "background" ? (
            <BackgroundForm
              draft={editor.draft}
              onChange={(draft) => setEditor({ kind: "background", draft })}
            />
          ) : editor.kind === "class" ? (
            <ClassForm
              draft={editor.draft}
              onChange={(draft) => setEditor({ kind: "class", draft })}
            />
          ) : (
            <MonsterForm
              draft={editor.draft}
              onChange={(draft) => setEditor({ kind: "monster", draft })}
            />
          )}

          <div className="flex gap-2 mt-8">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editor.draft.id ? "Save changes" : "Create"}
            </button>
            <button
              onClick={() => setEditor(null)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  // ── Library view ──────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-2.5">
            <FlaskConical className="w-6 h-6" style={{ color: "var(--scene-accent)" }} />
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
            >
              Homebrew
            </h1>
          </div>
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--scene-text-muted)" }}>
          Custom races, backgrounds, and classes appear in the character builder,
          custom items in the inventory&apos;s item search, and custom monsters in the
          encounter builder &amp; combat tracker — all alongside the official set.
          They&apos;re yours everywhere; share one to a campaign and its members can
          use it too.
        </p>

        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setEditor({ kind: "race", draft: emptyRaceDraft() })}
            className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
          >
            <Plus className="w-4 h-4" /> New race
          </button>
          <button
            onClick={() => setEditor({ kind: "class", draft: emptyClassDraft() })}
            className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          >
            <Plus className="w-4 h-4" /> New class
          </button>
          <button
            onClick={() => setEditor({ kind: "background", draft: emptyBackgroundDraft() })}
            className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          >
            <Plus className="w-4 h-4" /> New background
          </button>
          <button
            onClick={() => setItemEditor({ item: null })}
            className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          >
            <Plus className="w-4 h-4" /> New item
          </button>
          <button
            onClick={() => setEditor({ kind: "monster", draft: emptyMonsterDraft() })}
            className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          >
            <Plus className="w-4 h-4" /> New monster
          </button>
        </div>

        {mine === undefined ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--scene-text-muted)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your library…
          </div>
        ) : races.length === 0 && backgrounds.length === 0 && items.length === 0 && classes.length === 0 && monsters.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center text-sm"
            style={{ background: "var(--scene-surface)", border: "1px dashed var(--scene-border)", color: "var(--scene-text-muted)" }}
          >
            Nothing brewed yet. Create a race, class, background, or item to get started —
            it&apos;ll show up the next time you build a character or open your inventory.
          </div>
        ) : (
          <div className="space-y-8">
            {races.length > 0 && (
              <HomebrewSection
                title="Races"
                items={races}
                myCampaigns={myCampaigns ?? []}
                onEdit={(doc) => setEditor({ kind: "race", draft: raceDocToDraft(doc) })}
                onDelete={handleDelete}
                onShare={handleShare}
                summarize={(doc) => {
                  const d = doc.data as HomebrewRaceData
                  const bonuses = Object.entries(d.abilityBonuses)
                    .map(([k, v]) => `+${v} ${ABILITY_ABBREVIATIONS[k as Ability]}`)
                    .join(", ")
                  return [`${d.size}`, `${d.speed}ft`, bonuses].filter(Boolean).join(" · ")
                }}
              />
            )}
            {classes.length > 0 && (
              <HomebrewSection
                title="Classes"
                items={classes}
                myCampaigns={myCampaigns ?? []}
                onEdit={(doc) => setEditor({ kind: "class", draft: classDocToDraft(doc) })}
                onDelete={handleDelete}
                onShare={handleShare}
                summarize={(doc) => {
                  const d = doc.data as HomebrewClassData
                  const bits = [`d${d.hitDie}`, `${d.primaryAbility} primary`]
                  if (d.subclasses?.length) bits.push(`${d.subclasses.length} subclass${d.subclasses.length > 1 ? "es" : ""}`)
                  if (d.spellcasting) bits.push("spellcaster")
                  return bits.join(" · ")
                }}
              />
            )}
            {backgrounds.length > 0 && (
              <HomebrewSection
                title="Backgrounds"
                items={backgrounds}
                myCampaigns={myCampaigns ?? []}
                onEdit={(doc) => setEditor({ kind: "background", draft: backgroundDocToDraft(doc) })}
                onDelete={handleDelete}
                onShare={handleShare}
                summarize={(doc) => {
                  const d = doc.data as HomebrewBackgroundData
                  const skills = (d.skillProficiencies as Skill[])
                    .map((s) => SKILL_DISPLAY_NAMES[s])
                    .join(", ")
                  return skills || d.feature
                }}
              />
            )}
            {items.length > 0 && (
              <HomebrewSection
                title="Items"
                items={items}
                myCampaigns={myCampaigns ?? []}
                onEdit={(doc) =>
                  setItemEditor({
                    id: doc._id,
                    item: rowToItem({
                      _id: doc._id,
                      name: doc.name,
                      active: true,
                      data: doc.data,
                    }),
                  })
                }
                onDelete={handleDelete}
                onShare={handleShare}
                summarize={(doc) => {
                  const d = doc.data as StoredItemData
                  const bits: string[] = [d.category]
                  if (d.category === "weapon" && d.damageDice) {
                    bits.push(`${d.damageDice}${d.damageType ? ` ${d.damageType}` : ""}`)
                  } else if (d.category === "armor" && d.baseAC != null) {
                    bits.push(`AC ${d.baseAC}`)
                  }
                  return bits.join(" · ")
                }}
              />
            )}
            {monsters.length > 0 && (
              <HomebrewSection
                title="Monsters"
                items={monsters}
                myCampaigns={myCampaigns ?? []}
                onEdit={(doc) => setEditor({ kind: "monster", draft: monsterDocToDraft(doc) })}
                onDelete={handleDelete}
                onShare={handleShare}
                summarize={(doc) => {
                  const d = doc.data as HomebrewMonsterData
                  return [
                    d.type ? `${d.size} ${d.type}` : d.size,
                    `CR ${d.challengeRating}`,
                    `AC ${d.armorClass}`,
                    `${d.hitPoints} HP`,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                }}
              />
            )}
          </div>
        )}
      </div>

      {itemEditor && (
        <ItemEditorDialog
          mode="homebrew"
          item={itemEditor.item}
          onSubmit={async ({ name, data }) => {
            if (itemEditor.id) {
              await updateHb({ id: itemEditor.id, name, data })
              toast.success(`${name} updated.`)
            } else {
              await createHb({ kind: "item", name, data })
              toast.success(`${name} created.`)
            }
          }}
          onClose={() => setItemEditor(null)}
        />
      )}
    </AppShell>
  )
}

// ── Library section ────────────────────────────────────────────────────────────

function HomebrewSection({
  title,
  items,
  myCampaigns,
  onEdit,
  onDelete,
  onShare,
  summarize,
}: {
  title: string
  items: Doc<"homebrew">[]
  myCampaigns: { campaignId: Id<"campaigns">; name: string; role: "dm" | "player" }[]
  onEdit: (doc: Doc<"homebrew">) => void
  onDelete: (id: Id<"homebrew">, name: string) => void
  onShare: (id: Id<"homebrew">, campaignId: Id<"campaigns"> | null) => void
  summarize: (doc: Doc<"homebrew">) => string
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
        {title}
      </h2>
      <div className="space-y-2">
        {items.map((doc) => (
          <div
            key={doc._id}
            className="rounded-xl p-4"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-sm" style={{ color: "var(--scene-text-primary)" }}>
                  {doc.name}
                </div>
                <div className="text-xs mt-0.5 truncate" style={{ color: "var(--scene-text-muted)" }}>
                  {summarize(doc)}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onEdit(doc)}
                  className="p-1.5 rounded-lg hover:opacity-80"
                  style={{ color: "var(--scene-text-muted)" }}
                  aria-label="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(doc._id, doc.name)}
                  className="p-1.5 rounded-lg hover:opacity-80"
                  style={{ color: "var(--scene-text-muted)" }}
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--scene-border)" }}>
              <Share2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--scene-text-muted)" }} />
              <select
                value={doc.sharedCampaignId ?? ""}
                onChange={(e) =>
                  onShare(
                    doc._id,
                    e.target.value ? (e.target.value as Id<"campaigns">) : null,
                  )
                }
                className="text-xs px-2 py-1 rounded-lg outline-none appearance-none"
                style={fieldStyle}
              >
                <option value="">Private (only you)</option>
                {myCampaigns.map((c) => (
                  <option key={c.campaignId} value={c.campaignId}>
                    Shared to {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Race form ──────────────────────────────────────────────────────────────────

function RaceForm({
  draft,
  onChange,
}: {
  draft: RaceDraft
  onChange: (draft: RaceDraft) => void
}) {
  const set = <K extends keyof RaceDraft>(key: K, value: RaceDraft[K]) =>
    onChange({ ...draft, [key]: value })

  const setSubrace = (i: number, next: SubraceDraft) =>
    onChange({ ...draft, subraces: draft.subraces.map((s, idx) => (idx === i ? next : s)) })

  const addSubrace = () =>
    onChange({
      ...draft,
      subraces: [
        ...draft.subraces,
        { name: "", description: "", abilityBonuses: { ...ZERO_ABILITIES }, traitsText: "", speed: 0, darkvision: 0 },
      ],
    })

  const removeSubrace = (i: number) =>
    onChange({ ...draft, subraces: draft.subraces.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
        {draft.id ? "Edit race" : "New race"}
      </h2>

      <div>
        <FieldLabel>Name</FieldLabel>
        <input
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Stormborn"
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={fieldStyle}
        />
      </div>

      <div>
        <FieldLabel>Description</FieldLabel>
        <textarea
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          placeholder="A short flavor line shown in the builder."
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
          style={fieldStyle}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <FieldLabel>Size</FieldLabel>
          <select
            value={draft.size}
            onChange={(e) => set("size", e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none appearance-none"
            style={fieldStyle}
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Speed (ft)</FieldLabel>
          <input
            type="number"
            value={draft.speed}
            onChange={(e) => set("speed", parseInt(e.target.value, 10) || 0)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={fieldStyle}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel>Darkvision</FieldLabel>
          <DarkvisionSelect value={draft.darkvision} onChange={(v) => set("darkvision", v)} />
        </div>
      </div>

      <div>
        <FieldLabel>Ability score bonuses</FieldLabel>
        <AbilityGrid value={draft.abilityBonuses} onChange={(m) => set("abilityBonuses", m)} />
      </div>

      <div>
        <FieldLabel>Languages (one per line, or comma-separated)</FieldLabel>
        <textarea
          value={draft.languagesText}
          onChange={(e) => set("languagesText", e.target.value)}
          rows={2}
          placeholder={"Common\nElvish"}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
          style={fieldStyle}
        />
      </div>

      <div>
        <FieldLabel>Traits (one per line)</FieldLabel>
        <textarea
          value={draft.traitsText}
          onChange={(e) => set("traitsText", e.target.value)}
          rows={3}
          placeholder={"Fey Ancestry\nRelentless Endurance"}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
          style={fieldStyle}
        />
      </div>

      {/* Subraces */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel>Subraces (optional)</FieldLabel>
          <button
            onClick={addSubrace}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          >
            <Plus className="w-3 h-3" /> Add subrace
          </button>
        </div>
        <div className="space-y-3">
          {draft.subraces.map((sr, i) => (
            <div
              key={i}
              className="rounded-xl p-3 space-y-3"
              style={{ background: "color-mix(in srgb, var(--scene-accent) 4%, var(--scene-surface))", border: "1px solid var(--scene-border)" }}
            >
              <div className="flex items-center gap-2">
                <input
                  value={sr.name}
                  onChange={(e) => setSubrace(i, { ...sr, name: e.target.value })}
                  placeholder="Subrace name"
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={fieldStyle}
                />
                <button
                  onClick={() => removeSubrace(i)}
                  className="p-1.5 rounded-lg"
                  style={{ color: "var(--scene-text-muted)" }}
                  aria-label="Remove subrace"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={sr.description}
                onChange={(e) => setSubrace(i, { ...sr, description: e.target.value })}
                rows={1}
                placeholder="Description"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                style={fieldStyle}
              />
              <AbilityGrid
                value={sr.abilityBonuses}
                onChange={(m) => setSubrace(i, { ...sr, abilityBonuses: m })}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Speed override (0 = inherit)</FieldLabel>
                  <input
                    type="number"
                    value={sr.speed}
                    onChange={(e) => setSubrace(i, { ...sr, speed: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <FieldLabel>Darkvision</FieldLabel>
                  <DarkvisionSelect value={sr.darkvision} onChange={(v) => setSubrace(i, { ...sr, darkvision: v })} />
                </div>
              </div>
              <div>
                <FieldLabel>Traits (one per line)</FieldLabel>
                <textarea
                  value={sr.traitsText}
                  onChange={(e) => setSubrace(i, { ...sr, traitsText: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                  style={fieldStyle}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Background form ────────────────────────────────────────────────────────────

function BackgroundForm({
  draft,
  onChange,
}: {
  draft: BackgroundDraft
  onChange: (draft: BackgroundDraft) => void
}) {
  const set = <K extends keyof BackgroundDraft>(key: K, value: BackgroundDraft[K]) =>
    onChange({ ...draft, [key]: value })

  const toggleSkill = (skill: Skill) =>
    set(
      "skillProficiencies",
      draft.skillProficiencies.includes(skill)
        ? draft.skillProficiencies.filter((s) => s !== skill)
        : [...draft.skillProficiencies, skill],
    )

  const skillKeys = Object.keys(SKILLS) as Skill[]

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
        {draft.id ? "Edit background" : "New background"}
      </h2>

      <div>
        <FieldLabel>Name</FieldLabel>
        <input
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Wandering Scholar"
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={fieldStyle}
        />
      </div>

      <div>
        <FieldLabel>Description</FieldLabel>
        <textarea
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
          style={fieldStyle}
        />
      </div>

      <div>
        <FieldLabel>Skill proficiencies</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {skillKeys.map((s) => {
            const on = draft.skillProficiencies.includes(s)
            return (
              <button
                key={s}
                onClick={() => toggleSkill(s)}
                className="text-xs px-2.5 py-1 rounded-full transition-all"
                style={{
                  background: on ? "var(--scene-accent)" : "var(--scene-surface)",
                  color: on ? "var(--scene-bg)" : "var(--scene-text-primary)",
                  border: `1px solid ${on ? "var(--scene-accent)" : "var(--scene-border)"}`,
                }}
              >
                {SKILL_DISPLAY_NAMES[s]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Bonus languages (count)</FieldLabel>
          <input
            type="number"
            min={0}
            value={draft.languages}
            onChange={(e) => set("languages", Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={fieldStyle}
          />
        </div>
        <div>
          <FieldLabel>Feature name</FieldLabel>
          <input
            value={draft.feature}
            onChange={(e) => set("feature", e.target.value)}
            placeholder="e.g. Researcher"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={fieldStyle}
          />
        </div>
      </div>

      <div>
        <FieldLabel>Tool proficiencies (one per line, or comma-separated)</FieldLabel>
        <textarea
          value={draft.toolProficienciesText}
          onChange={(e) => set("toolProficienciesText", e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
          style={fieldStyle}
        />
      </div>

      <div>
        <FieldLabel>Starting equipment (one per line)</FieldLabel>
        <textarea
          value={draft.equipmentText}
          onChange={(e) => set("equipmentText", e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
          style={fieldStyle}
        />
      </div>
    </div>
  )
}

// ── Class form ─────────────────────────────────────────────────────────────────

const HIT_DICE = [6, 8, 10, 12]

function ClassForm({
  draft,
  onChange,
}: {
  draft: ClassDraft
  onChange: (draft: ClassDraft) => void
}) {
  const set = <K extends keyof ClassDraft>(key: K, value: ClassDraft[K]) =>
    onChange({ ...draft, [key]: value })

  const toggleSave = (a: Ability) =>
    set(
      "savingThrows",
      draft.savingThrows.includes(a)
        ? draft.savingThrows.filter((x) => x !== a)
        : [...draft.savingThrows, a],
    )

  const toggleSkillOption = (s: Skill) =>
    set(
      "skillOptions",
      draft.skillOptions.includes(s)
        ? draft.skillOptions.filter((x) => x !== s)
        : [...draft.skillOptions, s],
    )

  const setSubclass = (i: number, next: SubclassDraft) =>
    onChange({ ...draft, subclasses: draft.subclasses.map((s, idx) => (idx === i ? next : s)) })
  const addSubclass = () =>
    onChange({ ...draft, subclasses: [...draft.subclasses, { name: "", description: "" }] })
  const removeSubclass = (i: number) =>
    onChange({ ...draft, subclasses: draft.subclasses.filter((_, idx) => idx !== i) })

  const skillKeys = Object.keys(SKILLS) as Skill[]

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
        {draft.id ? "Edit class" : "New class"}
      </h2>

      <div>
        <FieldLabel>Name</FieldLabel>
        <input
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Warden"
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={fieldStyle}
        />
      </div>

      <div>
        <FieldLabel>Flavor line</FieldLabel>
        <input
          value={draft.flavorText}
          onChange={(e) => set("flavorText", e.target.value)}
          placeholder="A one-line hook shown in the builder."
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={fieldStyle}
        />
      </div>

      <div>
        <FieldLabel>Description</FieldLabel>
        <textarea
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
          style={fieldStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Hit die</FieldLabel>
          <select
            value={draft.hitDie}
            onChange={(e) => set("hitDie", parseInt(e.target.value, 10))}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none appearance-none"
            style={fieldStyle}
          >
            {HIT_DICE.map((d) => (
              <option key={d} value={d}>d{d}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Primary ability</FieldLabel>
          <select
            value={draft.primaryAbility}
            onChange={(e) => set("primaryAbility", e.target.value as Ability)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none appearance-none capitalize"
            style={fieldStyle}
          >
            {ABILITIES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <FieldLabel>Saving throw proficiencies</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {ABILITIES.map((a) => {
            const on = draft.savingThrows.includes(a)
            return (
              <button
                key={a}
                onClick={() => toggleSave(a)}
                className="text-xs px-2.5 py-1 rounded-full transition-all"
                style={{
                  background: on ? "var(--scene-accent)" : "var(--scene-surface)",
                  color: on ? "var(--scene-bg)" : "var(--scene-text-primary)",
                  border: `1px solid ${on ? "var(--scene-accent)" : "var(--scene-border)"}`,
                }}
              >
                {ABILITY_ABBREVIATIONS[a]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <FieldLabel>Armor (comma/line)</FieldLabel>
          <textarea
            value={draft.armorProfText}
            onChange={(e) => set("armorProfText", e.target.value)}
            rows={2}
            placeholder="Light armor, Shields"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
            style={fieldStyle}
          />
        </div>
        <div>
          <FieldLabel>Weapons (comma/line)</FieldLabel>
          <textarea
            value={draft.weaponProfText}
            onChange={(e) => set("weaponProfText", e.target.value)}
            rows={2}
            placeholder="Simple weapons"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
            style={fieldStyle}
          />
        </div>
        <div>
          <FieldLabel>Tools (comma/line)</FieldLabel>
          <textarea
            value={draft.toolProfText}
            onChange={(e) => set("toolProfText", e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
            style={fieldStyle}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <FieldLabel>Skill choices</FieldLabel>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--scene-text-muted)" }}>
            Pick
            <input
              type="number"
              min={0}
              max={draft.skillOptions.length || undefined}
              value={draft.skillCount}
              onChange={(e) => set("skillCount", Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-14 px-2 py-1 rounded-lg text-sm outline-none text-center"
              style={fieldStyle}
            />
            of {draft.skillOptions.length}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {skillKeys.map((s) => {
            const on = draft.skillOptions.includes(s)
            return (
              <button
                key={s}
                onClick={() => toggleSkillOption(s)}
                className="text-xs px-2.5 py-1 rounded-full transition-all"
                style={{
                  background: on ? "var(--scene-accent)" : "var(--scene-surface)",
                  color: on ? "var(--scene-bg)" : "var(--scene-text-primary)",
                  border: `1px solid ${on ? "var(--scene-accent)" : "var(--scene-border)"}`,
                }}
              >
                {SKILL_DISPLAY_NAMES[s]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Spellcasting (display metadata) */}
      <div className="rounded-xl p-3 space-y-3" style={{ border: "1px solid var(--scene-border)" }}>
        <button
          onClick={() => set("isSpellcaster", !draft.isSpellcaster)}
          className="flex items-center gap-2 text-sm"
          style={{ color: "var(--scene-text-primary)" }}
        >
          <span
            className="w-4 h-4 rounded flex items-center justify-center"
            style={{
              border: `1.5px solid ${draft.isSpellcaster ? "var(--scene-accent)" : "var(--scene-border)"}`,
              background: draft.isSpellcaster ? "var(--scene-accent)" : "transparent",
            }}
          >
            {draft.isSpellcaster && <span style={{ color: "var(--scene-bg)", fontSize: 10 }}>✓</span>}
          </span>
          Spellcaster
        </button>
        {draft.isSpellcaster && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Spellcasting ability</FieldLabel>
              <select
                value={draft.spellAbility}
                onChange={(e) => set("spellAbility", e.target.value as Ability)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none appearance-none capitalize"
                style={fieldStyle}
              >
                {ABILITIES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Preparation</FieldLabel>
              <select
                value={draft.spellType}
                onChange={(e) => set("spellType", e.target.value as ClassDraft["spellType"])}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none appearance-none"
                style={fieldStyle}
              >
                <option value="prepared">Prepared</option>
                <option value="known">Known</option>
                <option value="slots">Slots</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Subclasses */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel>Subclasses (optional)</FieldLabel>
          <button
            onClick={addSubclass}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          >
            <Plus className="w-3 h-3" /> Add subclass
          </button>
        </div>
        <div className="space-y-3">
          {draft.subclasses.map((sc, i) => (
            <div
              key={i}
              className="rounded-xl p-3 space-y-2"
              style={{ background: "color-mix(in srgb, var(--scene-accent) 4%, var(--scene-surface))", border: "1px solid var(--scene-border)" }}
            >
              <div className="flex items-center gap-2">
                <input
                  value={sc.name}
                  onChange={(e) => setSubclass(i, { ...sc, name: e.target.value })}
                  placeholder="Subclass name"
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={fieldStyle}
                />
                <button
                  onClick={() => removeSubclass(i)}
                  className="p-1.5 rounded-lg"
                  style={{ color: "var(--scene-text-muted)" }}
                  aria-label="Remove subclass"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={sc.description}
                onChange={(e) => setSubclass(i, { ...sc, description: e.target.value })}
                rows={2}
                placeholder="What this subclass is about"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                style={fieldStyle}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Monster form ───────────────────────────────────────────────────────────────

function MonsterForm({
  draft,
  onChange,
}: {
  draft: MonsterDraft
  onChange: (draft: MonsterDraft) => void
}) {
  const set = <K extends keyof MonsterDraft>(key: K, value: MonsterDraft[K]) =>
    onChange({ ...draft, [key]: value })

  const setAttack = (i: number, next: MonsterAttackDraft) =>
    onChange({ ...draft, attacks: draft.attacks.map((a, idx) => (idx === i ? next : a)) })
  const addAttack = () =>
    onChange({ ...draft, attacks: [...draft.attacks, emptyAttackDraft()] })
  const removeAttack = (i: number) =>
    onChange({ ...draft, attacks: draft.attacks.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
        {draft.id ? "Edit monster" : "New monster"}
      </h2>

      <div>
        <FieldLabel>Name</FieldLabel>
        <input
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Gloomstalker"
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={fieldStyle}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <FieldLabel>Size</FieldLabel>
          <select
            value={draft.size}
            onChange={(e) => set("size", e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none appearance-none"
            style={fieldStyle}
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Type</FieldLabel>
          <input
            value={draft.type}
            onChange={(e) => set("type", e.target.value)}
            placeholder="beast, fiend…"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={fieldStyle}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel>Alignment</FieldLabel>
          <input
            value={draft.alignment}
            onChange={(e) => set("alignment", e.target.value)}
            placeholder="unaligned"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={fieldStyle}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <FieldLabel>Armor class</FieldLabel>
          <input
            type="number"
            value={draft.armorClass}
            onChange={(e) => set("armorClass", parseInt(e.target.value, 10) || 0)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={fieldStyle}
          />
        </div>
        <div>
          <FieldLabel>Hit points</FieldLabel>
          <input
            type="number"
            value={draft.hitPoints}
            onChange={(e) => set("hitPoints", parseInt(e.target.value, 10) || 0)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={fieldStyle}
          />
        </div>
        <div>
          <FieldLabel>Challenge</FieldLabel>
          <select
            value={draft.challengeRating}
            onChange={(e) => set("challengeRating", e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none appearance-none"
            style={fieldStyle}
          >
            {CR_OPTIONS.map((c) => (
              <option key={c} value={c}>CR {c}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Speed</FieldLabel>
          <input
            value={draft.speed}
            onChange={(e) => set("speed", e.target.value)}
            placeholder="30 ft."
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={fieldStyle}
          />
        </div>
      </div>

      <div>
        <FieldLabel>Ability scores</FieldLabel>
        <AbilityGrid value={draft.abilityScores} onChange={(m) => set("abilityScores", m)} />
      </div>

      <div>
        <FieldLabel>Description (optional)</FieldLabel>
        <textarea
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          placeholder="Lore or tactics shown on the stat block."
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
          style={fieldStyle}
        />
      </div>

      {/* Attacks & actions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel>Attacks &amp; actions</FieldLabel>
          <button
            onClick={addAttack}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          >
            <Plus className="w-3 h-3" /> Add attack
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--scene-text-muted)" }}>
          The combat tracker rolls these on tap — to-hit and damage. Use <em>Info</em> for
          non-rolled lines like Multiattack.
        </p>
        <div className="space-y-3">
          {draft.attacks.map((a, i) => (
            <div
              key={i}
              className="rounded-xl p-3 space-y-3"
              style={{ background: "color-mix(in srgb, var(--scene-accent) 4%, var(--scene-surface))", border: "1px solid var(--scene-border)" }}
            >
              <div className="flex items-center gap-2">
                <input
                  value={a.name}
                  onChange={(e) => setAttack(i, { ...a, name: e.target.value })}
                  placeholder="Attack name (e.g. Bite)"
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={fieldStyle}
                />
                <select
                  value={a.kind}
                  onChange={(e) => setAttack(i, { ...a, kind: e.target.value as MonsterAttackDraft["kind"] })}
                  className="px-2 py-2 rounded-lg text-sm outline-none appearance-none"
                  style={fieldStyle}
                >
                  <option value="melee">Melee</option>
                  <option value="ranged">Ranged</option>
                  <option value="save">Save</option>
                  <option value="other">Info</option>
                </select>
                <button
                  onClick={() => removeAttack(i)}
                  className="p-1.5 rounded-lg"
                  style={{ color: "var(--scene-text-muted)" }}
                  aria-label="Remove attack"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {a.kind === "other" ? (
                <textarea
                  value={a.desc}
                  onChange={(e) => setAttack(i, { ...a, desc: e.target.value })}
                  rows={2}
                  placeholder="e.g. Multiattack. The creature makes two attacks."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                  style={fieldStyle}
                />
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {a.kind === "save" ? (
                      <>
                        <div>
                          <FieldLabel>Save DC</FieldLabel>
                          <input
                            type="number"
                            value={a.saveDC}
                            onChange={(e) => setAttack(i, { ...a, saveDC: parseInt(e.target.value, 10) || 0 })}
                            className="w-full px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                            style={fieldStyle}
                          />
                        </div>
                        <div>
                          <FieldLabel>Save</FieldLabel>
                          <select
                            value={a.saveAbility}
                            onChange={(e) => setAttack(i, { ...a, saveAbility: e.target.value })}
                            className="w-full px-2 py-1.5 rounded-lg text-sm outline-none appearance-none"
                            style={fieldStyle}
                          >
                            {SAVE_ABILITIES.map((s) => (
                              <option key={s} value={s}>{s.slice(0, 3)}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <FieldLabel>To hit</FieldLabel>
                          <input
                            type="number"
                            value={a.toHit}
                            onChange={(e) => setAttack(i, { ...a, toHit: parseInt(e.target.value, 10) || 0 })}
                            className="w-full px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                            style={fieldStyle}
                          />
                        </div>
                        <div>
                          <FieldLabel>{a.kind === "melee" ? "Reach" : "Range"}</FieldLabel>
                          <input
                            value={a.range}
                            onChange={(e) => setAttack(i, { ...a, range: e.target.value })}
                            placeholder={a.kind === "melee" ? "5 ft." : "80/320 ft."}
                            className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                            style={fieldStyle}
                          />
                        </div>
                      </>
                    )}
                    <div>
                      <FieldLabel>Damage</FieldLabel>
                      <input
                        value={a.damageDice}
                        onChange={(e) => setAttack(i, { ...a, damageDice: e.target.value })}
                        placeholder="1d8"
                        className="w-full px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                        style={fieldStyle}
                      />
                    </div>
                    <div>
                      <FieldLabel>Bonus</FieldLabel>
                      <input
                        type="number"
                        value={a.damageBonus}
                        onChange={(e) => setAttack(i, { ...a, damageBonus: parseInt(e.target.value, 10) || 0 })}
                        className="w-full px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                        style={fieldStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Damage type</FieldLabel>
                    <select
                      value={a.damageType}
                      onChange={(e) => setAttack(i, { ...a, damageType: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none appearance-none capitalize"
                      style={fieldStyle}
                    >
                      {DAMAGE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Extra text (optional)</FieldLabel>
                    <input
                      value={a.desc}
                      onChange={(e) => setAttack(i, { ...a, desc: e.target.value })}
                      placeholder="Rider effects or flavor."
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={fieldStyle}
                    />
                  </div>
                </>
              )}
            </div>
          ))}
          {draft.attacks.length === 0 && (
            <p className="text-xs italic" style={{ color: "var(--scene-text-muted)" }}>
              No attacks yet — add one so the tracker can roll it.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
