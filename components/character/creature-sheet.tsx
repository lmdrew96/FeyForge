"use client"

// Wildshape forms + companions on the character sheet. Both compose a shared
// CreaturePicker (Open5e beast search) + StatBlockCard (HP tracker, AC, speed,
// abilities, rollable attacks via lib/monster-attacks). Stored as
// `characterProperties` rows (type "alternateForm" / "companion") in the generic
// `data` blob — no schema change. See lib/character/creatures.ts.

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Plus, X, Search, Heart, Trash2, PawPrint, Leaf } from "lucide-react"
import {
  ABILITIES,
  ABILITY_ABBREVIATIONS,
  getAbilityModifier,
  formatModifier,
  type Ability,
} from "@/lib/character/constants"
import type { SheetRollFn, SheetRollExprFn } from "@/components/character/sheet-roll"
import { open5eApi, type Open5eMonster } from "@/lib/open5e-api"
import { parseMonsterAttacks, damageExpr, avgDamage } from "@/lib/monster-attacks"
import {
  monsterToForm,
  monsterToCompanion,
  rowToForm,
  rowToCompanion,
  wildShapeMaxCR,
  crLabel,
  isMoonCircle,
  type StatBlockSnapshot,
} from "@/lib/character/creatures"

type PropRow = { _id: string; name: string; data: unknown }

const speedLabel = (speed: Record<string, number>): string =>
  Object.entries(speed)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k} ${v} ft`)
    .join(", ") || "—"

// Drop the synthetic rowId we attach for the UI before writing the blob back to
// `data` (Convex rejects explicit `undefined` values in an object).
function stripRowId<T extends { rowId: string }>(o: T): Omit<T, "rowId"> {
  const { rowId: _omit, ...rest } = o
  return rest
}

// ── Open5e beast picker ───────────────────────────────────────────────────────

function CreaturePicker({
  title,
  maxCR,
  onPick,
  onClose,
}: {
  title: string
  maxCR?: number
  onPick: (m: Open5eMonster) => Promise<void>
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const cacheRef = useRef<Open5eMonster[] | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    ;(async () => {
      try {
        const beasts = await open5eApi.getMonsters({ type: "beast" })
        if (!cancelled) {
          cacheRef.current = beasts
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
  }, [])

  const q = query.trim().toLowerCase()
  const results = useMemo(() => {
    void version
    const all = cacheRef.current ?? []
    return all
      .filter((m) => (maxCR === undefined ? true : m.cr <= maxCR))
      .filter((m) => (q ? m.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name))
      .slice(0, 80)
  }, [q, version, maxCR])

  const handlePick = async (m: Open5eMonster) => {
    setAdding(m.slug)
    try {
      await onPick(m)
      toast.success(`Added ${m.name}.`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add creature.")
      setAdding(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        className="rounded-xl p-5 w-full max-w-md max-h-[85vh] flex flex-col"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:opacity-80" style={{ color: "var(--scene-text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {maxCR !== undefined && (
          <p className="text-xs mb-3" style={{ color: "var(--scene-text-muted)" }}>SRD beasts up to CR {crLabel(maxCR)}.</p>
        )}

        <div className="relative mb-3">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--scene-text-muted)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search beasts…"
            autoFocus
            className="w-full pl-8 pr-3 py-2 rounded-md text-sm bg-transparent outline-none"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          />
        </div>

        <div className="overflow-y-auto -mx-1 px-1">
          {loading && <p className="text-sm text-center py-6" style={{ color: "var(--scene-text-muted)" }}>Loading beasts…</p>}
          {error && <p className="text-sm text-center py-6" style={{ color: "#ef4444" }}>Couldn&apos;t reach the SRD. Try again.</p>}
          {!loading && !error && results.length === 0 && (
            <p className="text-sm text-center py-6" style={{ color: "var(--scene-text-muted)" }}>No beasts match.</p>
          )}
          <div className="space-y-1.5">
            {results.map((m) => (
              <button
                key={m.slug}
                onClick={() => handlePick(m)}
                disabled={adding !== null}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
              >
                <span className="text-sm flex-1 truncate" style={{ color: "var(--scene-text-primary)" }}>{m.name}</span>
                <span className="text-xs flex-shrink-0" style={{ color: "var(--scene-text-muted)" }}>CR {m.challenge_rating} · {m.hit_points} HP</span>
                <Plus className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--scene-accent)" }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Stat-block card (HP tracker + rollable attacks) ───────────────────────────

function StatBlockCard({
  name,
  badge,
  ac,
  speed,
  abilities,
  currentHp,
  maxHp,
  actions,
  roll,
  rollExpr,
  onAdjustHp,
  onRemove,
}: {
  name: string
  badge?: string
  ac: number
  speed: Record<string, number>
  abilities: Record<Ability, number>
  currentHp: number
  maxHp: number
  actions: StatBlockSnapshot["actions"]
  roll: SheetRollFn
  rollExpr: SheetRollExprFn
  onAdjustHp?: (delta: number) => void
  onRemove?: () => void
}) {
  const [crit, setCrit] = useState(false)
  const attacks = useMemo(() => parseMonsterAttacks(actions), [actions])
  const rollDamage = (label: string, expr: string) => {
    rollExpr(label, expr, { crit })
    if (crit) setCrit(false)
  }
  const pct = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0
  const barColor = pct > 0.5 ? "var(--scene-accent)" : pct > 0.25 ? "#f59e0b" : "#ef4444"

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>{name}</span>
            {badge && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)", color: "var(--scene-accent)" }}>{badge}</span>
            )}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>AC {ac} · {speedLabel(speed)}</div>
        </div>
        {onRemove && (
          <button onClick={onRemove} className="p-1 rounded transition-opacity hover:opacity-80" style={{ color: "var(--scene-text-muted)" }} aria-label={`Remove ${name}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* HP */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
            <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>HP</span>
          </div>
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--scene-text-primary)" }}>{currentHp}<span style={{ color: "var(--scene-text-muted)" }}>/{maxHp}</span></span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden mb-2" style={{ background: "var(--scene-border)" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, background: barColor }} />
        </div>
        {onAdjustHp && (
          <div className="flex gap-1.5">
            {([-5, -1] as const).map((d) => (
              <button key={d} onClick={() => onAdjustHp(d)} disabled={currentHp <= 0} className="flex-1 py-1 rounded text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-30" style={{ background: "#ef444422", color: "#ef4444", border: "1px solid #ef444444" }}>{d}</button>
            ))}
            {([1, 5] as const).map((d) => (
              <button key={d} onClick={() => onAdjustHp(d)} disabled={currentHp >= maxHp} className="flex-1 py-1 rounded text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-30" style={{ background: "color-mix(in srgb, var(--scene-accent) 20%, transparent)", color: "var(--scene-accent)", border: "1px solid color-mix(in srgb, var(--scene-accent) 40%, transparent)" }}>+{d}</button>
            ))}
          </div>
        )}
      </div>

      {/* Abilities */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 mb-3">
        {ABILITIES.map((a) => (
          <div key={a} className="text-center rounded-md py-1" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--scene-text-muted)" }}>{ABILITY_ABBREVIATIONS[a]}</div>
            <div className="text-xs font-bold" style={{ color: "var(--scene-text-primary)" }}>{abilities[a]}</div>
            <div className="text-[10px]" style={{ color: "var(--scene-accent)" }}>{formatModifier(getAbilityModifier(abilities[a]))}</div>
          </div>
        ))}
      </div>

      {/* Attacks */}
      {attacks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>Actions</span>
            <button
              onClick={() => setCrit((c) => !c)}
              className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full transition-colors"
              style={{ background: crit ? "var(--scene-accent)" : "var(--scene-bg)", color: crit ? "var(--scene-bg)" : "var(--scene-text-muted)", border: "1px solid var(--scene-border)" }}
              title="Double the damage dice on the next damage roll"
            >
              Crit
            </button>
          </div>
          <div className="space-y-1.5">
            {attacks.map((atk, i) => (
              <div key={`${atk.name}-${i}`} className="rounded-md px-3 py-2" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm flex-1 min-w-0" style={{ color: "var(--scene-text-primary)" }}>{atk.name}</span>
                  {atk.toHit !== null && (
                    <button onClick={() => roll(atk.name, atk.toHit as number)} className="text-xs px-2 py-0.5 rounded-md font-medium transition-opacity hover:opacity-80" style={{ background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)", color: "var(--scene-accent)" }} title="Roll to hit (honors adv/dis)">{formatModifier(atk.toHit)} hit</button>
                  )}
                  {atk.save && (
                    <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>DC {atk.save.dc} {atk.save.ability.slice(0, 3)}</span>
                  )}
                  {atk.damage.map((p, j) => (
                    <button key={j} onClick={() => rollDamage(`${atk.name} (${p.type})`, damageExpr(p))} className="text-xs px-2 py-0.5 rounded-md font-medium transition-opacity hover:opacity-80" style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }} title={`Roll ${p.type} damage`}>
                      {avgDamage([p])} {p.type}
                    </button>
                  ))}
                </div>
                {atk.reach && <div className="text-[11px] mt-0.5" style={{ color: "var(--scene-text-muted)" }}>{atk.reach}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Wildshape ───────────────────────────────────────────────────────────────────

export function WildshapeSection({
  characterId,
  classId,
  level,
  subclass,
  formRows,
  mentalAbilities,
  nextOrder,
  roll,
  rollExpr,
}: {
  characterId: Id<"characters">
  classId: string
  level: number
  subclass?: string
  formRows: PropRow[]
  // The druid's own INT/WIS/CHA — retained in beast form (2014 RAW).
  mentalAbilities: Pick<Record<Ability, number>, "intelligence" | "wisdom" | "charisma">
  nextOrder: number
  roll: SheetRollFn
  rollExpr: SheetRollExprFn
}) {
  const addProperty = useMutation(api.characters.addProperty)
  const updateProperty = useMutation(api.characters.updateProperty)
  const removeProperty = useMutation(api.characters.removeProperty)
  const [picking, setPicking] = useState(false)

  // Druids only, from level 2.
  if (classId.toLowerCase() !== "druid" || level < 2) return null

  const moon = isMoonCircle(subclass)
  const maxCR = wildShapeMaxCR(level, moon)
  const forms = formRows.map(rowToForm)

  const addForm = async (m: Open5eMonster) => {
    await addProperty({
      characterId,
      type: "alternateForm",
      name: m.name,
      active: true,
      orderIndex: nextOrder,
      data: monsterToForm(m, "wildshape"),
    })
  }

  // Activate one form (transform): it resets to full HP and becomes active; every
  // other form deactivates (only one form at a time).
  const transform = async (rowId: string) => {
    await Promise.all(
      forms.map((f) =>
        updateProperty({
          id: f.rowId as Id<"characterProperties">,
          data: { ...stripRowId(f), active: f.rowId === rowId, currentHp: f.rowId === rowId ? f.maxHp : f.currentHp },
        }),
      ),
    ).catch(() => toast.error("Couldn't transform."))
  }

  const revert = async (rowId: string) => {
    const f = forms.find((x) => x.rowId === rowId)
    if (!f) return
    await updateProperty({ id: rowId as Id<"characterProperties">, data: { ...stripRowId(f), active: false } }).catch(() => toast.error("Couldn't revert."))
  }

  const adjustHp = async (rowId: string, delta: number) => {
    const f = forms.find((x) => x.rowId === rowId)
    if (!f) return
    const nextHp = Math.max(0, Math.min(f.maxHp, f.currentHp + delta))
    // At 0 HP the form drops and you revert to your own body (2014 RAW).
    const active = nextHp <= 0 ? false : f.active
    if (nextHp <= 0) toast(`${f.creatureName} drops — you revert to your own form.`)
    await updateProperty({ id: rowId as Id<"characterProperties">, data: { ...stripRowId(f), currentHp: nextHp, active } }).catch(() => toast.error("Couldn't update HP."))
  }

  const remove = async (rowId: string, name: string) => {
    if (!confirm(`Remove ${name} from your saved forms?`)) return
    await removeProperty({ id: rowId as Id<"characterProperties"> }).catch(() => toast.error("Couldn't remove form."))
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Leaf className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
          <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>Wild Shape</h2>
        </div>
        <button onClick={() => setPicking(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80" style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}>
          <Plus className="h-4 w-4" /> Add form
        </button>
      </div>

      <p className="text-xs mb-3" style={{ color: "var(--scene-text-muted)" }}>
        Beasts up to CR {crLabel(maxCR)}{moon ? " (Circle of the Moon)" : ""}. Wild Shape uses are tracked under Class Resources; transforming starts the form at full HP.
      </p>

      {forms.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>No saved forms yet. Tap <strong style={{ color: "var(--scene-text-primary)" }}>Add form</strong> to pick a beast.</p>
      ) : (
        <div className="space-y-2">
          {forms.map((f) =>
            f.active ? (
              <div key={f.rowId}>
                <StatBlockCard
                  name={f.creatureName}
                  badge="Transformed"
                  ac={f.ac}
                  speed={f.speed}
                  // Beast physical scores; retain the druid's own mental scores (2014 RAW).
                  abilities={{ ...f.abilities, ...mentalAbilities }}
                  currentHp={f.currentHp}
                  maxHp={f.maxHp}
                  actions={f.actions}
                  roll={roll}
                  rollExpr={rollExpr}
                  onAdjustHp={(d) => adjustHp(f.rowId, d)}
                  onRemove={() => remove(f.rowId, f.creatureName)}
                />
                <button onClick={() => revert(f.rowId)} className="mt-1.5 w-full py-1.5 rounded-md text-xs font-medium transition-opacity hover:opacity-80" style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}>Revert to your own form</button>
              </div>
            ) : (
              <div key={f.rowId} className="rounded-lg px-3 py-2 flex items-center gap-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
                <div className="flex-1 min-w-0">
                  <span className="text-sm" style={{ color: "var(--scene-text-primary)" }}>{f.creatureName}</span>
                  <span className="text-xs ml-2" style={{ color: "var(--scene-text-muted)" }}>CR {f.cr} · AC {f.ac} · {f.maxHp} HP</span>
                </div>
                <button onClick={() => transform(f.rowId)} className="text-xs px-2.5 py-1 rounded-md font-medium transition-opacity hover:opacity-80 flex-shrink-0" style={{ background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)", color: "var(--scene-accent)" }}>Transform</button>
                <button onClick={() => remove(f.rowId, f.creatureName)} className="p-1 rounded transition-opacity hover:opacity-80 flex-shrink-0" style={{ color: "var(--scene-text-muted)" }} aria-label={`Remove ${f.creatureName}`}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          )}
        </div>
      )}

      {picking && (
        <CreaturePicker title="Choose a beast form" maxCR={maxCR} onPick={addForm} onClose={() => setPicking(false)} />
      )}
    </section>
  )
}

// ── Companions ────────────────────────────────────────────────────────────────

export function CompanionsSection({
  characterId,
  companionRows,
  nextOrder,
  roll,
  rollExpr,
}: {
  characterId: Id<"characters">
  companionRows: PropRow[]
  nextOrder: number
  roll: SheetRollFn
  rollExpr: SheetRollExprFn
}) {
  const addProperty = useMutation(api.characters.addProperty)
  const updateProperty = useMutation(api.characters.updateProperty)
  const removeProperty = useMutation(api.characters.removeProperty)
  const [picking, setPicking] = useState(false)

  const companions = companionRows.map(rowToCompanion)

  const addCompanion = async (m: Open5eMonster) => {
    await addProperty({
      characterId,
      type: "companion",
      name: m.name,
      active: true,
      orderIndex: nextOrder,
      data: monsterToCompanion(m, "animalCompanion"),
    })
  }

  const adjustHp = async (rowId: string, delta: number) => {
    const c = companions.find((x) => x.rowId === rowId)
    if (!c) return
    const nextHp = Math.max(0, Math.min(c.maxHp, c.currentHp + delta))
    await updateProperty({ id: rowId as Id<"characterProperties">, data: { ...stripRowId(c), currentHp: nextHp } }).catch(() => toast.error("Couldn't update HP."))
  }

  const remove = async (rowId: string, name: string) => {
    if (!confirm(`Remove ${name}?`)) return
    await removeProperty({ id: rowId as Id<"characterProperties"> }).catch(() => toast.error("Couldn't remove companion."))
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <PawPrint className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
          <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>Companions</h2>
        </div>
        <button onClick={() => setPicking(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80" style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}>
          <Plus className="h-4 w-4" /> Add companion
        </button>
      </div>

      {companions.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
          No companions yet — familiars, beast companions, mounts, or summons. Tap <strong style={{ color: "var(--scene-text-primary)" }}>Add companion</strong> to pick a beast.
        </p>
      ) : (
        <div className="space-y-2">
          {companions.map((c) => (
            <StatBlockCard
              key={c.rowId}
              name={c.customName || c.creatureName}
              badge={c.creatureName !== (c.customName || c.creatureName) ? c.creatureName : undefined}
              ac={c.ac}
              speed={c.speed}
              abilities={c.abilities}
              currentHp={c.currentHp}
              maxHp={c.maxHp}
              actions={c.actions}
              roll={roll}
              rollExpr={rollExpr}
              onAdjustHp={(d) => adjustHp(c.rowId, d)}
              onRemove={() => remove(c.rowId, c.customName || c.creatureName)}
            />
          ))}
        </div>
      )}

      {picking && (
        <CreaturePicker title="Choose a companion" onPick={addCompanion} onClose={() => setPicking(false)} />
      )}
    </section>
  )
}
