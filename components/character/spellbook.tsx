"use client"

// Spellbook section for the character sheet — slot tracking, spell selection, and
// cast-from-sheet. Reads/writes the character's `spellcasting` block (slots / DC /
// attack / ability) via the existing characters.update mutation and stores chosen
// spells as `characterProperties` rows (type "spell"), exactly mirroring how the
// inventory stores items. The casting "mode" (spellbook / prepared / known) is
// derived live from the class id — no persisted descriptor, nothing to migrate.

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import {
  Sparkles,
  Plus,
  Trash2,
  Search,
  X,
  Moon,
  Check,
  Wand2,
  ChevronDown,
} from "lucide-react"
import { formatModifier, getProficiencyBonus } from "@/lib/character/constants"
import {
  getCastingDescriptor,
  getSpellLimits,
  maxSpellLevel,
  type PrepMode,
} from "@/lib/character/leveling"
import type { Edition } from "@/lib/editions"
import {
  groupSpellsByLevel,
  spellLevelLabel,
  spellToStored,
  type SheetSpell,
  type StoredSpellData,
} from "@/lib/character/sheet-spells"
import { open5eApi, type Open5eSpell } from "@/lib/open5e-api"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"

type SpellcastingBlock = NonNullable<Doc<"characters">["spellcasting"]>
type RollFn = (label: string, mod: number) => void

// SheetSpell minus the row identity fields = the stored blob to re-persist.
function storedFromSheet(spell: SheetSpell): StoredSpellData {
  const { id: _id, name: _name, active: _active, ...data } = spell
  return data
}

export function SpellbookSection({
  characterId,
  spellcasting,
  classId,
  level,
  edition,
  spells,
  nextOrder,
  roll,
}: {
  characterId: Id<"characters">
  spellcasting: SpellcastingBlock
  classId: string
  level: number
  edition: Edition
  spells: SheetSpell[]
  nextOrder: number
  roll: RollFn
}) {
  const updateChar = useMutation(api.characters.update)
  const addProperty = useMutation(api.characters.addProperty)
  const updateProperty = useMutation(api.characters.updateProperty)
  const removeProperty = useMutation(api.characters.removeProperty)

  const [picking, setPicking] = useState(false)

  const desc = getCastingDescriptor(classId)
  const prepMode: PrepMode = desc.prepMode ?? "known"
  const isPact = desc.casterType === "pact"

  // Spellcasting ability modifier, recovered from the stored attack bonus
  // (= prof + mod) so we don't need the raw ability scores here. Drives the
  // prepared-count guidance.
  const abilityMod = spellcasting.spellAttackBonus - getProficiencyBonus(level)
  const limits = getSpellLimits(classId, level, abilityMod, edition)
  const maxLevel = maxSpellLevel(spellcasting.spellSlots)

  // Counts for the guidance chips. The COUNT-source follows the UI (whether the
  // sheet shows a per-spell prepared toggle), NOT the edition-aware label: classes
  // with a toggle count prepared spells; the rest count all leveled spells.
  const usesToggle = prepMode === "prepared" || prepMode === "spellbook"
  const cantripCount = spells.filter((s) => s.level <= 0).length
  const leveledSpells = spells.filter((s) => s.level >= 1)
  const leveledCount = usesToggle
    ? leveledSpells.filter((s) => s.prepared).length
    : leveledSpells.length
  const showCantripChip = !!limits && (limits.cantrips > 0 || cantripCount > 0)
  const showLeveledChip = !!limits && (limits.leveled > 0 || leveledCount > 0)

  const groups = useMemo(() => groupSpellsByLevel(spells), [spells])
  const knownSlugs = useMemo(
    () => new Set(spells.map((s) => s.slug).filter(Boolean) as string[]),
    [spells],
  )

  // Persist a new spellSlots array onto the existing block. update's validator
  // wants the WHOLE spellcasting object, which `spellcasting` already is.
  const writeSlots = async (slots: SpellcastingBlock["spellSlots"]) => {
    try {
      await updateChar({ id: characterId, spellcasting: { ...spellcasting, spellSlots: slots } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update spell slots.")
    }
  }

  const adjustSlot = (slotLevel: number, delta: number) =>
    writeSlots(
      spellcasting.spellSlots.map((s) =>
        s.level === slotLevel
          ? { ...s, used: Math.max(0, Math.min(s.total, s.used + delta)) }
          : s,
      ),
    )

  const restoreAllSlots = () =>
    writeSlots(spellcasting.spellSlots.map((s) => ({ ...s, used: 0 })))

  const castAtLevel = async (slotLevel: number, spellName: string) => {
    await adjustSlot(slotLevel, +1)
    toast.success(`Cast ${spellName} at ${spellLevelLabel(slotLevel)} level.`)
  }

  const togglePrepared = async (spell: SheetSpell) => {
    try {
      await updateProperty({
        id: spell.id as Id<"characterProperties">,
        data: { ...storedFromSheet(spell), prepared: !spell.prepared },
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update spell.")
    }
  }

  const removeSpell = async (spell: SheetSpell) => {
    try {
      await removeProperty({ id: spell.id as Id<"characterProperties"> })
      toast.success(`Removed ${spell.name}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove spell.")
    }
  }

  const addSpell = async (data: StoredSpellData, name: string) => {
    await addProperty({
      characterId,
      type: "spell",
      name,
      active: true,
      orderIndex: nextOrder,
      data,
    })
  }

  // Slot pools with any availability, for the cast picker (a spell can be cast
  // with a slot of its level or higher).
  const availableSlotLevels = spellcasting.spellSlots
    .filter((s) => s.total - s.used > 0)
    .map((s) => s.level)

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
          Spellcasting
        </h2>
        <button
          onClick={() => setPicking(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
        >
          <Plus className="h-4 w-4" /> Add spell
        </button>
      </div>

      {/* DC / attack / ability + spell-attack roll */}
      <div
        className="rounded-xl p-4 mb-4 grid grid-cols-3 gap-3 text-center"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <div>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>
            Ability
          </div>
          <div className="text-lg font-bold capitalize" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
            {spellcasting.ability.slice(0, 3)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>
            Save DC
          </div>
          <div className="text-lg font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
            {spellcasting.spellSaveDC}
          </div>
        </div>
        <button
          onClick={() => roll("Spell attack", spellcasting.spellAttackBonus)}
          className="rounded-lg transition-transform active:scale-95 hover:opacity-90"
          title="Roll a spell attack (honors the adv/dis toggle)"
        >
          <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>
            Spell Atk
          </div>
          <div className="text-lg font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-accent)" }}>
            {formatModifier(spellcasting.spellAttackBonus)}
          </div>
        </button>
      </div>

      {/* Spell slots */}
      {spellcasting.spellSlots.length > 0 && (
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
            <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
              {isPact ? "Pact Magic slots" : "Spell slots"}
            </span>
            {isPact && (
              <button
                onClick={restoreAllSlots}
                className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-opacity hover:opacity-80"
                style={{
                  background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)",
                  color: "var(--scene-accent)",
                  border: "1px solid color-mix(in srgb, var(--scene-accent) 32%, transparent)",
                }}
                title="Warlock pact slots recharge on a short rest"
              >
                <Moon className="h-3 w-3" /> Short rest
              </button>
            )}
          </div>
          <div className="space-y-2">
            {spellcasting.spellSlots.map((slot) => (
              <SlotRow
                key={slot.level}
                level={slot.level}
                total={slot.total}
                used={slot.used}
                onExpend={() => adjustSlot(slot.level, +1)}
                onRestore={() => adjustSlot(slot.level, -1)}
              />
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--scene-text-muted)" }}>
            Tap a pip to spend or restore a slot. A long rest restores all slots.
          </p>
        </div>
      )}

      {/* Count guidance — how many you should know/prepare vs how many you have.
          Soft (amber when over), never blocks. Each chip shows only when relevant
          (e.g. paladins have no cantrips → no cantrip chip). */}
      {limits && (showCantripChip || showLeveledChip) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {showCantripChip && <CountChip label="Cantrips" have={cantripCount} max={limits.cantrips} />}
          {showLeveledChip && (
            <CountChip label={limits.leveledLabel} have={leveledCount} max={limits.leveled} />
          )}
        </div>
      )}

      {/* Spell list */}
      {spells.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
          No spells yet. Tap <strong style={{ color: "var(--scene-text-primary)" }}>Add spell</strong> to
          pick from the SRD list for your class.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map(({ level, spells: levelSpells }) => (
            <div key={level}>
              <div className="text-xs uppercase tracking-widest mb-1.5" style={{ color: "var(--scene-text-muted)" }}>
                {spellLevelLabel(level)}
              </div>
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
              >
                {levelSpells.map((spell, i) => (
                  <SpellRowItem
                    key={spell.id}
                    spell={spell}
                    last={i === levelSpells.length - 1}
                    prepMode={prepMode}
                    availableSlotLevels={availableSlotLevels}
                    onCast={(slotLevel) => castAtLevel(slotLevel, spell.name)}
                    onTogglePrepared={() => togglePrepared(spell)}
                    onRemove={() => removeSpell(spell)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {picking && (
        <SpellPicker
          classId={classId}
          maxLevel={maxLevel}
          knownSlugs={knownSlugs}
          onAdd={addSpell}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  )
}

// Guidance chip: "Label: have/max", amber when over the limit.
function CountChip({ label, have, max }: { label: string; have: number; max: number }) {
  const over = have > max
  return (
    <span
      className="text-xs px-2.5 py-1 rounded-md"
      style={{
        background: "var(--scene-surface)",
        border: `1px solid ${over ? "#f59e0b" : "var(--scene-border)"}`,
        color: "var(--scene-text-muted)",
      }}
      title={over ? `Over your ${label.toLowerCase()} limit` : undefined}
    >
      {label}:{" "}
      <span style={{ color: over ? "#f59e0b" : "var(--scene-text-primary)", fontWeight: 600 }}>
        {have}/{max}
      </span>
    </span>
  )
}

// One slot-level row: N pips, filled = available, hollow = spent. Tapping the
// leftmost available pip spends a slot; tapping the rightmost spent pip restores.
function SlotRow({
  level,
  total,
  used,
  onExpend,
  onRestore,
}: {
  level: number
  total: number
  used: number
  onExpend: () => void
  onRestore: () => void
}) {
  const remaining = total - used
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-10 flex-shrink-0" style={{ color: "var(--scene-text-primary)" }}>
        {spellLevelLabel(level)}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap flex-1">
        {Array.from({ length: total }).map((_, i) => {
          const available = i < remaining
          return (
            <button
              key={i}
              onClick={available ? onExpend : onRestore}
              className="w-4 h-4 rounded-full transition-transform active:scale-90 hover:opacity-80"
              style={{
                background: available ? "var(--scene-accent)" : "transparent",
                border: `1.5px solid ${available ? "var(--scene-accent)" : "var(--scene-border)"}`,
              }}
              title={available ? "Spend a slot" : "Restore a slot"}
            />
          )
        })}
      </div>
      <span className="text-xs tabular-nums flex-shrink-0" style={{ color: "var(--scene-text-muted)" }}>
        {remaining}/{total}
      </span>
    </div>
  )
}

// One spell row: name + chips, an optional prepared toggle (prepared/spellbook
// casters, leveled spells only), a cast control (leveled spells), an expandable
// description, and remove.
function SpellRowItem({
  spell,
  last,
  prepMode,
  availableSlotLevels,
  onCast,
  onTogglePrepared,
  onRemove,
}: {
  spell: SheetSpell
  last: boolean
  prepMode: PrepMode
  availableSlotLevels: number[]
  onCast: (slotLevel: number) => void
  onTogglePrepared: () => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const [casting, setCasting] = useState(false)

  const isCantrip = spell.level <= 0
  // Prepared/spellbook casters prepare leveled spells; known casters and all
  // cantrips are always castable.
  const usesPrepare = (prepMode === "prepared" || prepMode === "spellbook") && !isCantrip
  // Castable slot levels for this spell: its level or higher, with a slot free.
  const castableLevels = availableSlotLevels.filter((l) => l >= spell.level).sort((a, b) => a - b)

  return (
    <div
      style={{
        borderBottom: last ? "none" : "1px solid var(--scene-border)",
        opacity: usesPrepare && !spell.prepared ? 0.6 : 1,
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button onClick={() => setOpen((o) => !o)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate" style={{ color: "var(--scene-text-primary)" }}>
              {spell.name}
            </span>
            {spell.concentration && (
              <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }} title="Concentration">
                C
              </span>
            )}
            {spell.ritual && (
              <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }} title="Ritual">
                R
              </span>
            )}
          </div>
          <span className="text-xs capitalize" style={{ color: "var(--scene-text-muted)" }}>
            {[spell.school, spell.castingTime].filter(Boolean).join(" · ") || "—"}
          </span>
        </button>

        {usesPrepare && (
          <button
            onClick={onTogglePrepared}
            className="text-[10px] px-2 py-1 rounded-md transition-opacity hover:opacity-80 flex-shrink-0"
            style={{
              background: spell.prepared
                ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)"
                : "var(--scene-border)",
              color: spell.prepared ? "var(--scene-accent)" : "var(--scene-text-muted)",
            }}
            title={spell.prepared ? "Prepared — tap to unprepare" : "Tap to prepare"}
          >
            {spell.prepared ? "Prepared" : "Prepare"}
          </button>
        )}

        {!isCantrip && (
          <button
            onClick={() => setCasting((c) => !c)}
            disabled={castableLevels.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-30 flex-shrink-0"
            style={{
              background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)",
              color: "var(--scene-accent)",
              border: "1px solid color-mix(in srgb, var(--scene-accent) 32%, transparent)",
            }}
            title={castableLevels.length === 0 ? "No slots available" : "Cast — choose a slot level"}
          >
            <Wand2 className="h-3 w-3" /> Cast
            <ChevronDown
              className="h-3 w-3 transition-transform"
              style={{ transform: casting ? "rotate(180deg)" : "none" }}
            />
          </button>
        )}

        <button
          onClick={onRemove}
          className="p-1.5 rounded transition-opacity hover:opacity-80 flex-shrink-0"
          style={{ color: "var(--scene-text-muted)" }}
          title="Remove spell"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Cast tray — inline (not an absolute popover) so the bottommost spell's
          options are never clipped by the list's rounded overflow-hidden. */}
      {!isCantrip && casting && castableLevels.length > 0 && (
        <div className="px-3 pb-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
            Cast with
          </span>
          {castableLevels.map((l) => (
            <button
              key={l}
              onClick={() => {
                onCast(l)
                setCasting(false)
              }}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition-opacity hover:opacity-80"
              style={{
                background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)",
                color: "var(--scene-accent)",
                border: "1px solid color-mix(in srgb, var(--scene-accent) 32%, transparent)",
              }}
            >
              {spellLevelLabel(l)} slot{l > spell.level ? " (upcast)" : ""}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="px-3 pb-3 -mt-1">
          <div
            className="rounded-lg p-3 text-sm"
            style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
          >
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-2" style={{ color: "var(--scene-text-muted)" }}>
              {spell.range && <span>Range: {spell.range}</span>}
              {spell.duration && <span>Duration: {spell.duration}</span>}
              {spell.components && <span>Components: {spell.components}</span>}
            </div>
            {spell.description ? (
              <MarkdownRenderer content={spell.description} variant="scene" />
            ) : (
              <span style={{ color: "var(--scene-text-muted)" }}>No description.</span>
            )}
            {spell.higherLevel && (
              <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--scene-border)" }}>
                <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
                  At higher levels
                </span>
                <MarkdownRenderer content={spell.higherLevel} variant="scene" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Spell picker ────────────────────────────────────────────────────────────────

// Dialog that searches the class's SRD spell list (Open5e, IndexedDB-cached) and
// adds picked spells as characterProperties rows. Level-gated to what the character
// can actually cast (cantrips + up to their highest slot level). Stays open so you
// can add several at once; already-added spells show as added. Mirrors SrdSearch.
function SpellPicker({
  classId,
  maxLevel,
  knownSlugs,
  onAdd,
  onClose,
}: {
  classId: string
  maxLevel: number
  knownSlugs: Set<string>
  onAdd: (data: StoredSpellData, name: string) => Promise<void>
  onClose: () => void
}) {
  // Level filters capped at what the character can cast — cantrips always, then
  // 1st up to their highest slot level.
  const levelFilters = [
    { value: -1, label: "All" },
    { value: 0, label: "Cantrip" },
    ...Array.from({ length: maxLevel }, (_, i) => ({
      value: i + 1,
      label: spellLevelLabel(i + 1),
    })),
  ]
  const [query, setQuery] = useState("")
  const [levelFilter, setLevelFilter] = useState(-1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const cacheRef = useRef<Open5eSpell[] | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    ;(async () => {
      try {
        const spells = await open5eApi.getSpells({ class: classId })
        if (!cancelled) {
          cacheRef.current = spells
          setVersion((v) => v + 1)
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [classId])

  const q = query.trim().toLowerCase()
  const results = useMemo(() => {
    void version
    const all = cacheRef.current ?? []
    return all
      .filter((s) => s.level_int <= maxLevel) // can't learn spells above your slots
      .filter((s) => (levelFilter < 0 ? true : s.level_int === levelFilter))
      .filter((s) => (q ? s.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.level_int - b.level_int || a.name.localeCompare(b.name))
      .slice(0, 60)
  }, [q, levelFilter, version, maxLevel])

  const handleAdd = async (s: Open5eSpell) => {
    setAdding(s.slug)
    try {
      await onAdd(spellToStored(s), s.name)
      setAdded((prev) => new Set(prev).add(s.slug))
      toast.success(`Added ${s.name}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add spell.")
    } finally {
      setAdding(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-5 w-full max-w-md max-h-[85vh] flex flex-col"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold capitalize" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
            Add {classId} spells
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:opacity-80" style={{ color: "var(--scene-text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--scene-text-muted)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search spells…"
            autoFocus
            className="w-full pl-8 pr-3 py-2 rounded-md text-sm bg-transparent outline-none"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          />
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {levelFilters.map((f) => {
            const active = levelFilter === f.value
            return (
              <button
                key={f.value}
                onClick={() => setLevelFilter(f.value)}
                className="px-2.5 py-1 rounded-md text-xs font-medium flex-shrink-0 transition-colors"
                style={{
                  background: active ? "var(--scene-accent)" : "var(--scene-bg)",
                  color: active ? "var(--scene-bg)" : "var(--scene-text-muted)",
                  border: "1px solid var(--scene-border)",
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="px-1 py-3 text-sm" style={{ color: "var(--scene-text-muted)" }}>
              Loading {classId} spells…
            </div>
          ) : error ? (
            <div className="px-1 py-3 text-sm" style={{ color: "var(--scene-text-muted)" }}>
              Couldn&apos;t reach the SRD spell list. Check your connection and reopen.
            </div>
          ) : results.length === 0 ? (
            <div className="px-1 py-3 text-sm" style={{ color: "var(--scene-text-muted)" }}>
              {maxLevel === 0
                ? "No spell slots yet — you can't learn spells at this level."
                : "No matching spells."}
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((s) => {
                const isAdded = added.has(s.slug) || knownSlugs.has(s.slug)
                return (
                  <button
                    key={s.slug}
                    onClick={() => !isAdded && handleAdd(s)}
                    disabled={isAdded || adding === s.slug}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-left transition-colors disabled:opacity-60"
                    style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block" style={{ color: "var(--scene-text-primary)" }}>
                        {s.name}
                      </span>
                      <span className="text-xs capitalize" style={{ color: "var(--scene-text-muted)" }}>
                        {s.level_int === 0 ? "Cantrip" : spellLevelLabel(s.level_int)} · {s.school}
                      </span>
                    </div>
                    {isAdded ? (
                      <Check className="h-4 w-4 flex-shrink-0" style={{ color: "var(--scene-accent)" }} />
                    ) : (
                      <Plus className="h-4 w-4 flex-shrink-0" style={{ color: "var(--scene-text-muted)" }} />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
