"use client"

// Class resources section for the character sheet — Rage, Ki, Sorcery Points,
// Channel Divinity, etc. The resource LIST and each max are derived live from
// class + level (see lib/character/resources.ts); only the spend count is stored,
// as `characterProperties` rows (type "classResource"), created lazily on first
// spend. Recharge is wired into the Rest panel; the per-resource steppers are the
// always-available manual fallback. Pool resources (Lay on Hands, Sorcery Points)
// get a "spend N" amount input instead of ±1, since they're spent in bulk.

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Zap, Minus, Plus } from "lucide-react"
import type { Ability } from "@/lib/character/constants"
import type { Edition } from "@/lib/editions"
import {
  getClassResources,
  mergeResources,
  clampUsed,
  type ResourceRow,
  type SheetResource,
} from "@/lib/character/resources"

const rechargeLabel = (r: SheetResource["rechargeOn"]): string =>
  r === "shortRest" ? "short rest" : "long rest"

// One resource card. Count resources get ±1 steppers; pool resources get a "spend
// N" amount input. Holds its own `amount` state so each pool card is independent.
function ResourceCard({
  res,
  onSetUsed,
}: {
  res: SheetResource
  onSetUsed: (next: number) => void
}) {
  const [amount, setAmount] = useState(1)
  const remaining = res.unlimited ? Infinity : res.max - res.used
  const step = res.pool ? Math.max(1, amount) : 1
  const spendDisabled = !res.unlimited && remaining <= 0
  const restoreDisabled = res.used <= 0

  return (
    <div
      className="rounded-xl p-3 flex items-center gap-3"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium truncate" style={{ color: "var(--scene-text-primary)" }}>
            {res.name}
          </span>
          <span
            className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
            style={{
              background: "color-mix(in srgb, var(--scene-accent) 12%, transparent)",
              color: "var(--scene-accent)",
            }}
          >
            {rechargeLabel(res.rechargeOn)}
          </span>
        </div>
        <div className="text-lg font-bold tabular-nums mt-0.5" style={{ color: "var(--scene-text-primary)" }}>
          {res.unlimited ? (
            <>∞ <span className="text-xs font-normal" style={{ color: "var(--scene-text-muted)" }}>· {res.used} used</span></>
          ) : (
            <>
              {remaining}
              <span className="text-sm font-normal" style={{ color: "var(--scene-text-muted)" }}> / {res.max}</span>
            </>
          )}
        </div>
        {res.description && (
          <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--scene-text-muted)" }}>
            {res.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {res.pool && (
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            aria-label={`Amount of ${res.name} to spend or restore`}
            className="w-12 px-1.5 py-1 rounded-md text-sm text-center tabular-nums bg-transparent outline-none"
            style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          />
        )}
        <button
          onClick={() => onSetUsed(res.used + step)}
          disabled={spendDisabled}
          title={res.pool ? `Spend ${step}` : "Spend one"}
          aria-label={`Spend ${res.name}`}
          className="p-1.5 rounded-md transition-opacity hover:opacity-80 disabled:opacity-25"
          style={{
            background: "color-mix(in srgb, var(--scene-accent) 14%, transparent)",
            color: "var(--scene-accent)",
          }}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={() => onSetUsed(res.used - step)}
          disabled={restoreDisabled}
          title={res.pool ? `Restore ${step}` : "Restore one"}
          aria-label={`Restore ${res.name}`}
          className="p-1.5 rounded-md transition-opacity hover:opacity-80 disabled:opacity-25"
          style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function ResourcesSection({
  characterId,
  classId,
  level,
  mods,
  edition,
  resourceRows,
  nextOrder,
}: {
  characterId: Id<"characters">
  classId: string
  level: number
  mods: Record<Ability, number>
  edition: Edition
  resourceRows: ResourceRow[]
  nextOrder: number
}) {
  const addProperty = useMutation(api.characters.addProperty)
  const updateProperty = useMutation(api.characters.updateProperty)

  const resources = mergeResources(getClassResources(classId, level, mods, edition), resourceRows)
  if (resources.length === 0) return null

  // Persist a new spend count for one resource. Creates the backing row lazily on
  // the first spend; otherwise patches it. Clamped to the live max so a shrunk max
  // can't strand `used` above it.
  const setUsed = async (res: SheetResource, next: number) => {
    const used = clampUsed(next, res)
    if (used === res.used) return
    try {
      if (res.rowId) {
        await updateProperty({ id: res.rowId as Id<"characterProperties">, data: { key: res.key, used } })
      } else {
        await addProperty({
          characterId,
          type: "classResource",
          name: res.name,
          active: true,
          orderIndex: nextOrder,
          data: { key: res.key, used },
        })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update resource.")
    }
  }

  return (
    <section>
      <div className="flex items-center gap-1.5 mb-3">
        <Zap className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
        <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
          Class Resources
        </h2>
      </div>

      <div className="grid gap-2">
        {resources.map((res) => (
          <ResourceCard key={res.key} res={res} onSetUsed={(next) => setUsed(res, next)} />
        ))}
      </div>
    </section>
  )
}
