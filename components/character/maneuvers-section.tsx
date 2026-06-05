"use client"

// Battle Master maneuvers on the character sheet — the Fighter subclass's
// choose-from-a-list feature. Same feat-like shape as warlock invocations: a
// count-limited picker over the curated MANEUVERS list, selections stored as
// `characterProperties` rows (type "maneuver"). The superiority dice they spend
// are tracked as a class resource (see lib/character/resources.ts). No schema change.

import { useMemo, useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Plus, X, Search, Trash2, Swords, Check } from "lucide-react"
import {
  MANEUVERS,
  maneuversKnown,
  getManeuverById,
  type ManeuverData,
} from "@/lib/character/maneuvers"

type PropRow = { _id: string; name: string; data: unknown }

function ManeuverPicker({
  chosenIds,
  onPick,
  onClose,
}: {
  chosenIds: Set<string>
  onPick: (m: ManeuverData) => Promise<void>
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState<string | null>(null)
  const q = query.trim().toLowerCase()

  const results = useMemo(
    () =>
      MANEUVERS.filter((m) => (q ? m.name.toLowerCase().includes(q) : true)).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [q],
  )

  const handlePick = async (m: ManeuverData) => {
    setAdding(m.id)
    try {
      await onPick(m)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add maneuver.")
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>Add maneuver</h2>
          <button onClick={onClose} className="p-1 rounded hover:opacity-80" style={{ color: "var(--scene-text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--scene-text-muted)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search maneuvers…"
            autoFocus
            className="w-full pl-8 pr-3 py-2 rounded-md text-sm bg-transparent outline-none"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          />
        </div>

        <div className="overflow-y-auto -mx-1 px-1 space-y-2">
          {results.map((m) => {
            const known = chosenIds.has(m.id)
            return (
              <div key={m.id} className="rounded-lg px-3 py-2.5" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>{m.name}</span>
                    <p className="text-xs leading-snug mt-0.5" style={{ color: "var(--scene-text-muted)" }}>{m.description}</p>
                  </div>
                  <button
                    onClick={() => !known && handlePick(m)}
                    disabled={known || adding !== null}
                    className="px-2.5 py-1 rounded-md text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40 flex-shrink-0"
                    style={{ background: known ? "var(--scene-border)" : "color-mix(in srgb, var(--scene-accent) 14%, transparent)", color: known ? "var(--scene-text-muted)" : "var(--scene-accent)" }}
                  >
                    {known ? <Check className="h-3.5 w-3.5" /> : "Add"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function ManeuversSection({
  characterId,
  classId,
  subclassId,
  level,
  maneuverRows,
  nextOrder,
}: {
  characterId: Id<"characters">
  classId: string
  subclassId?: string
  level: number
  maneuverRows: PropRow[]
  nextOrder: number
}) {
  const addProperty = useMutation(api.characters.addProperty)
  const removeProperty = useMutation(api.characters.removeProperty)
  const [picking, setPicking] = useState(false)

  // Battle Master fighters only, from level 3.
  if (classId.toLowerCase() !== "fighter" || subclassId !== "battle-master" || level < 3) return null

  const known = maneuversKnown(level)
  const chosen = maneuverRows.map((r) => {
    const d = (r.data ?? {}) as { maneuverId?: string }
    const id = d.maneuverId ?? ""
    return { rowId: r._id, id, data: getManeuverById(id), fallbackName: r.name }
  })
  const chosenIds = new Set(chosen.map((c) => c.id))
  const over = chosen.length > known

  const add = async (m: ManeuverData) => {
    await addProperty({
      characterId,
      type: "maneuver",
      name: m.name,
      active: true,
      orderIndex: nextOrder,
      source: "class",
      data: { maneuverId: m.id },
    })
  }

  const remove = async (rowId: string, name: string) => {
    if (!confirm(`Forget ${name}?`)) return
    await removeProperty({ id: rowId as Id<"characterProperties"> }).catch(() => toast.error("Couldn't remove maneuver."))
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Swords className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
          <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>Maneuvers</h2>
          <span
            className="text-xs px-2 py-0.5 rounded-md tabular-nums"
            style={{ background: "var(--scene-surface)", border: `1px solid ${over ? "#f59e0b" : "var(--scene-border)"}`, color: over ? "#f59e0b" : "var(--scene-text-muted)" }}
            title={over ? "Over your maneuvers known — swap one on level-up" : undefined}
          >
            {chosen.length}/{known}
          </span>
        </div>
        <button onClick={() => setPicking(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80" style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {chosen.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>No maneuvers yet — you know {known} at level {level}. Spend superiority dice (tracked under Class Resources) to use them.</p>
      ) : (
        <div className="space-y-2">
          {chosen.map((c) => (
            <div key={c.rowId} className="rounded-lg px-4 py-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>{c.data?.name ?? c.fallbackName}</div>
                  {c.data && <p className="text-sm leading-relaxed mt-0.5" style={{ color: "var(--scene-text-muted)" }}>{c.data.description}</p>}
                </div>
                <button onClick={() => remove(c.rowId, c.data?.name ?? c.fallbackName)} className="p-1 rounded transition-opacity hover:opacity-80 flex-shrink-0" style={{ color: "var(--scene-text-muted)" }} aria-label="Remove maneuver">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {picking && (
        <ManeuverPicker
          chosenIds={chosenIds}
          onPick={async (m) => { await add(m); setPicking(false) }}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  )
}
