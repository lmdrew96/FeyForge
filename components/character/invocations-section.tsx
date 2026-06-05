"use client"

// Eldritch Invocations on the character sheet — the Warlock's choose-from-a-list
// customization. Feat-like: a count-limited, level-gated picker over the curated
// INVOCATIONS list, with selections stored as `characterProperties` rows (type
// "invocation"). See lib/character/invocations.ts. No schema change.

import { useMemo, useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Plus, X, Search, Trash2, Eye, Check } from "lucide-react"
import {
  INVOCATIONS,
  invocationsKnown,
  getInvocationById,
  type InvocationData,
} from "@/lib/character/invocations"

type PropRow = { _id: string; name: string; data: unknown }

function InvocationPicker({
  level,
  chosenIds,
  onPick,
  onClose,
}: {
  level: number
  chosenIds: Set<string>
  onPick: (inv: InvocationData) => Promise<void>
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState<string | null>(null)
  const q = query.trim().toLowerCase()

  const results = useMemo(
    () =>
      INVOCATIONS.filter((i) => (i.minLevel ?? 0) <= level)
        .filter((i) => (q ? i.name.toLowerCase().includes(q) : true))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [q, level],
  )

  const handlePick = async (inv: InvocationData) => {
    setAdding(inv.id)
    try {
      await onPick(inv)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add invocation.")
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
          <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>Add invocation</h2>
          <button onClick={onClose} className="p-1 rounded hover:opacity-80" style={{ color: "var(--scene-text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--scene-text-muted)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search invocations…"
            autoFocus
            className="w-full pl-8 pr-3 py-2 rounded-md text-sm bg-transparent outline-none"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          />
        </div>

        <div className="overflow-y-auto -mx-1 px-1 space-y-2">
          {results.map((inv) => {
            const known = chosenIds.has(inv.id)
            return (
              <div key={inv.id} className="rounded-lg px-3 py-2.5" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>{inv.name}</span>
                      {inv.minLevel && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>Lv {inv.minLevel}+</span>
                      )}
                      {inv.prerequisite && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--scene-accent) 12%, transparent)", color: "var(--scene-accent)" }}>{inv.prerequisite}</span>
                      )}
                    </div>
                    <p className="text-xs leading-snug mt-0.5" style={{ color: "var(--scene-text-muted)" }}>{inv.description}</p>
                  </div>
                  <button
                    onClick={() => !known && handlePick(inv)}
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
        <p className="text-[11px] mt-3" style={{ color: "var(--scene-text-muted)" }}>
          Pact-boon and known-spell prerequisites are advisory — pick what your build qualifies for.
        </p>
      </div>
    </div>
  )
}

export function InvocationsSection({
  characterId,
  classId,
  level,
  invocationRows,
  nextOrder,
}: {
  characterId: Id<"characters">
  classId: string
  level: number
  invocationRows: PropRow[]
  nextOrder: number
}) {
  const addProperty = useMutation(api.characters.addProperty)
  const removeProperty = useMutation(api.characters.removeProperty)
  const [picking, setPicking] = useState(false)

  // Warlocks only, from level 2 (when invocations are first known).
  if (classId.toLowerCase() !== "warlock" || level < 2) return null

  const known = invocationsKnown(level)
  const chosen = invocationRows.map((r) => {
    const d = (r.data ?? {}) as { invocationId?: string }
    const id = d.invocationId ?? ""
    return { rowId: r._id, id, data: getInvocationById(id), fallbackName: r.name }
  })
  const chosenIds = new Set(chosen.map((c) => c.id))
  const over = chosen.length > known

  const add = async (inv: InvocationData) => {
    await addProperty({
      characterId,
      type: "invocation",
      name: inv.name,
      active: true,
      orderIndex: nextOrder,
      source: "class",
      data: { invocationId: inv.id },
    })
  }

  const remove = async (rowId: string, name: string) => {
    if (!confirm(`Forget ${name}?`)) return
    await removeProperty({ id: rowId as Id<"characterProperties"> }).catch(() => toast.error("Couldn't remove invocation."))
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
          <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>Eldritch Invocations</h2>
          <span
            className="text-xs px-2 py-0.5 rounded-md tabular-nums"
            style={{ background: "var(--scene-surface)", border: `1px solid ${over ? "#f59e0b" : "var(--scene-border)"}`, color: over ? "#f59e0b" : "var(--scene-text-muted)" }}
            title={over ? "Over your invocations known — swap one on level-up" : undefined}
          >
            {chosen.length}/{known}
          </span>
        </div>
        <button onClick={() => setPicking(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80" style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {chosen.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>No invocations yet — you know {known} at level {level}. Tap <strong style={{ color: "var(--scene-text-primary)" }}>Add</strong> to pick.</p>
      ) : (
        <div className="space-y-2">
          {chosen.map((c) => (
            <div key={c.rowId} className="rounded-lg px-4 py-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>{c.data?.name ?? c.fallbackName}</div>
                  {c.data && <p className="text-sm leading-relaxed mt-0.5" style={{ color: "var(--scene-text-muted)" }}>{c.data.description}</p>}
                </div>
                <button onClick={() => remove(c.rowId, c.data?.name ?? c.fallbackName)} className="p-1 rounded transition-opacity hover:opacity-80 flex-shrink-0" style={{ color: "var(--scene-text-muted)" }} aria-label="Remove invocation">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {picking && (
        <InvocationPicker
          level={level}
          chosenIds={chosenIds}
          onPick={async (inv) => { await add(inv); setPicking(false) }}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  )
}
