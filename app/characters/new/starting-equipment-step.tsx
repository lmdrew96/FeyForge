"use client"

// Shared "equipment vs starting gold" chooser, mounted by both interactive
// builders (guided + normal). Quick Roll / From Concept skip this and default to
// the equipment package.

import { CLASS_STARTING, startingGoldFor, type StartingChoice } from "@/lib/character/starting-equipment"

function itemLabel(name: string, quantity?: number): string {
  return quantity && quantity > 1 ? `${name} ×${quantity}` : name
}

export function StartingEquipmentStep({
  classId,
  value,
  onChange,
}: {
  classId: string
  value: StartingChoice
  onChange: (choice: StartingChoice) => void
}) {
  const pkg = CLASS_STARTING[classId]
  const gold = startingGoldFor(classId)

  if (!pkg) {
    return (
      <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
        This class has no standard starting package. You&rsquo;ll begin with your background&rsquo;s gear — add
        weapons, armor, and gear from the inventory after creating your character.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onChange("equipment")}
        className="w-full text-left rounded-xl p-4 transition-colors"
        style={{
          background: value === "equipment" ? "color-mix(in srgb, var(--scene-accent) 14%, transparent)" : "var(--scene-surface)",
          border: `1px solid ${value === "equipment" ? "color-mix(in srgb, var(--scene-accent) 45%, transparent)" : "var(--scene-border)"}`,
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-medium" style={{ color: "var(--scene-text-primary)" }}>Take the equipment package</span>
          {value === "equipment" && <span className="text-xs font-medium" style={{ color: "var(--scene-accent)" }}>Selected</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {pkg.equipment.map((it, i) => (
            <span
              key={`${it.name}-${i}`}
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)", color: "var(--scene-text-muted)" }}
            >
              {itemLabel(it.name, it.data.quantity)}
            </span>
          ))}
        </div>
      </button>

      <button
        type="button"
        onClick={() => onChange("gold")}
        className="w-full text-left rounded-xl p-4 transition-colors"
        style={{
          background: value === "gold" ? "color-mix(in srgb, var(--scene-accent) 14%, transparent)" : "var(--scene-surface)",
          border: `1px solid ${value === "gold" ? "color-mix(in srgb, var(--scene-accent) 45%, transparent)" : "var(--scene-border)"}`,
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium" style={{ color: "var(--scene-text-primary)" }}>Take {gold} gp instead</span>
          {value === "gold" && <span className="text-xs font-medium" style={{ color: "var(--scene-accent)" }}>Selected</span>}
        </div>
        <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
          Skip the package and buy your own gear from the inventory later.
        </p>
      </button>

      <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
        You&rsquo;ll also receive your background&rsquo;s equipment either way.
      </p>
    </div>
  )
}
