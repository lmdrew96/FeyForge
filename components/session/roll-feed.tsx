"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { Dices } from "lucide-react"

// Live shared roll feed for a session — every player/DM roll, newest first.
// Subscribes to sessionRolls.listRecent (membership-gated). Scene-styled +
// glanceable: roller, label, the dice faces, the total, with nat-20 / nat-1 /
// adv / dis / crit flair. Renders nothing until the first roll lands.
export function RollFeed({ sessionId }: { sessionId: Id<"partySessions"> }) {
  const rolls = useQuery(api.sessionRolls.listRecent, { sessionId })
  if (!rolls || rolls.length === 0) return null

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Dices className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
        <h2
          className="text-xs uppercase tracking-widest"
          style={{ color: "var(--scene-accent)" }}
        >
          Rolls
        </h2>
      </div>
      <div className="space-y-1.5">
        {rolls.map((r) => (
          <RollRow key={r._id} roll={r} />
        ))}
      </div>
    </section>
  )
}

function Badge({
  children,
  tone = "good",
}: {
  children: React.ReactNode
  tone?: "good" | "bad"
}) {
  const accent = tone === "bad" ? "#ef4444" : "var(--scene-accent)"
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none flex-shrink-0"
      style={{
        background: `color-mix(in srgb, ${accent} 18%, transparent)`,
        color: accent,
      }}
    >
      {children}
    </span>
  )
}

function RollRow({ roll }: { roll: Doc<"sessionRolls"> }) {
  const nat20 = roll.isD20 && roll.dice[0] === 20
  const nat1 = roll.isD20 && roll.dice[0] === 1
  const totalColor = nat20
    ? "var(--scene-accent)"
    : nat1
      ? "#ef4444"
      : "var(--scene-text-primary)"
  const borderColor = nat20
    ? "var(--scene-accent)"
    : nat1
      ? "#ef4444"
      : "var(--scene-border)"

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{ background: "var(--scene-surface)", border: `1px solid ${borderColor}` }}
    >
      <span
        className="text-lg font-bold tabular-nums w-9 text-center flex-shrink-0"
        style={{ fontFamily: "var(--font-cinzel)", color: totalColor }}
      >
        {roll.total}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-sm font-semibold truncate"
            style={{ color: "var(--scene-text-primary)" }}
          >
            {roll.rollerName}
          </span>
          {roll.label && (
            <span
              className="text-xs truncate"
              style={{ color: "var(--scene-text-muted)" }}
            >
              · {roll.label}
            </span>
          )}
          {nat20 && <Badge>NAT 20</Badge>}
          {nat1 && <Badge tone="bad">NAT 1</Badge>}
          {roll.isCrit && <Badge>CRIT</Badge>}
          {roll.mode === "advantage" && <Badge>ADV</Badge>}
          {roll.mode === "disadvantage" && <Badge tone="bad">DIS</Badge>}
        </div>
        <div
          className="text-xs truncate"
          style={{ color: "var(--scene-text-muted)" }}
        >
          {roll.expression}
          {roll.dice.length > 0 && ` · [${roll.dice.join(", ")}]`}
          {roll.dropped && roll.dropped.length > 0 && ` (drop ${roll.dropped.join(", ")})`}
        </div>
      </div>
    </div>
  )
}
