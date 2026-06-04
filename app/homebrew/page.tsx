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
} from "@/lib/homebrew"
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

type Editor =
  | { kind: "race"; draft: RaceDraft }
  | { kind: "background"; draft: BackgroundDraft }
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

  const handleSave = async () => {
    if (!editor) return
    const name = editor.draft.name.trim()
    if (!name) {
      toast.error("Give it a name first.")
      return
    }
    if (collidesWithCuratedName(editor.kind, name)) {
      toast.error(`"${name}" is an official ${editor.kind} — pick a different name.`)
      return
    }
    setSaving(true)
    try {
      const data =
        editor.kind === "race"
          ? raceDraftToData(editor.draft)
          : backgroundDraftToData(editor.draft)
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
          ) : (
            <BackgroundForm
              draft={editor.draft}
              onChange={(draft) => setEditor({ kind: "background", draft })}
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
          Custom races and backgrounds appear in the character builder, and custom
          items in the inventory&apos;s item search — all alongside the official set.
          They&apos;re yours everywhere; share one to a campaign and its members can use
          it too.
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
        </div>

        {mine === undefined ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--scene-text-muted)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your library…
          </div>
        ) : races.length === 0 && backgrounds.length === 0 && items.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center text-sm"
            style={{ background: "var(--scene-surface)", border: "1px dashed var(--scene-border)", color: "var(--scene-text-muted)" }}
          >
            Nothing brewed yet. Create a race, background, or item to get started — it&apos;ll
            show up the next time you build a character or open your inventory.
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
