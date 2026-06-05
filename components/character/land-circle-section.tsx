"use client"

// Circle of the Land — the Druid Land circle's terrain choice. A single stored
// selection (feat-like, like invocations/maneuvers), persisted as one
// `characterProperties` row (type "landCircle", data `{ terrain }`). The chosen
// terrain's spells become always-prepared and render in the Spellbook's
// "Always Prepared · Subclass" block via deriveCharacter — this section is the
// chooser plus a per-tier summary. See lib/character/circle-of-the-land.ts. No
// schema change.

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Trees, Check, Lock } from "lucide-react"
import { LAND_TERRAINS, getTerrainById } from "@/lib/character/circle-of-the-land"

// Tiers as [druid level required, spell level, terrain spell-key].
const TIERS: [number, number, "l3" | "l5" | "l7" | "l9"][] = [
  [3, 2, "l3"],
  [5, 3, "l5"],
  [7, 4, "l7"],
  [9, 5, "l9"],
]

export function LandCircleSection({
  characterId,
  classId,
  subclassId,
  level,
  rowId,
  terrain,
  nextOrder,
}: {
  characterId: Id<"characters">
  classId: string
  subclassId?: string
  level: number
  rowId?: string
  terrain?: string
  nextOrder: number
}) {
  const addProperty = useMutation(api.characters.addProperty)
  const updateProperty = useMutation(api.characters.updateProperty)
  const [saving, setSaving] = useState<string | null>(null)

  // Druid Land circle only, from 3rd level (when the terrain is chosen).
  if (classId.toLowerCase() !== "druid" || subclassId !== "land" || level < 3) return null

  const chosen = getTerrainById(terrain)

  const choose = async (terrainId: string) => {
    if (terrainId === terrain) return
    setSaving(terrainId)
    try {
      if (rowId) {
        await updateProperty({
          id: rowId as Id<"characterProperties">,
          data: { terrain: terrainId },
        })
      } else {
        await addProperty({
          characterId,
          type: "landCircle",
          name: "Circle of the Land",
          active: true,
          orderIndex: nextOrder,
          source: "class",
          data: { terrain: terrainId },
        })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't set your terrain.")
    } finally {
      setSaving(null)
    }
  }

  return (
    <section className="mb-6">
      <div className="flex items-center gap-1.5 mb-3">
        <Trees className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
        <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
          Circle of the Land — Terrain
        </h2>
      </div>

      {/* Terrain chooser */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {LAND_TERRAINS.map((t) => {
          const active = t.id === terrain
          return (
            <button
              key={t.id}
              onClick={() => choose(t.id)}
              disabled={saving !== null}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                background: active
                  ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)"
                  : "var(--scene-surface)",
                border: `1px solid ${active ? "var(--scene-accent)" : "var(--scene-border)"}`,
                color: active ? "var(--scene-accent)" : "var(--scene-text-primary)",
              }}
            >
              {active && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
              {t.name}
            </button>
          )
        })}
      </div>

      {!chosen ? (
        <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
          Choose the land that shaped your druidic bond. Its spells become always prepared (and
          appear in your Spellbook&apos;s <strong style={{ color: "var(--scene-text-primary)" }}>Always Prepared</strong> list) as you gain levels — they don&apos;t count against the spells you prepare.
        </p>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          {TIERS.map(([reqLevel, spellLevel, key], i) => {
            const unlocked = level >= reqLevel
            const [a, b] = chosen.spells[key]
            return (
              <div
                key={key}
                className="flex items-center gap-3 px-4 py-2.5"
                style={{
                  borderBottom: i < TIERS.length - 1 ? "1px solid var(--scene-border)" : "none",
                  opacity: unlocked ? 1 : 0.5,
                }}
              >
                <span
                  className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0 tabular-nums"
                  style={{
                    background: unlocked
                      ? "color-mix(in srgb, var(--scene-accent) 14%, transparent)"
                      : "var(--scene-border)",
                    color: unlocked ? "var(--scene-accent)" : "var(--scene-text-muted)",
                  }}
                  title={`Gained at druid level ${reqLevel}`}
                >
                  Lv {reqLevel}
                </span>
                <span className="text-sm flex-1 capitalize" style={{ color: "var(--scene-text-primary)" }}>
                  {a}, {b}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: "var(--scene-text-muted)" }}>
                  {unlocked ? `Lvl ${spellLevel}` : <Lock className="h-3.5 w-3.5" />}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
