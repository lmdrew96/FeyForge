"use client"

import { Zap, Wind, Eye } from "lucide-react"
import {
  ABILITIES,
  ABILITY_ABBREVIATIONS,
  SKILLS,
  SKILL_DISPLAY_NAMES,
  formatModifier,
  type Ability,
  type Skill,
} from "@/lib/character/constants"
import type { SheetRollFn } from "@/components/character/sheet-roll"

// Presentational stat-sheet pieces, shared by the standalone character sheet
// (app/characters/[id]) and the in-session "Sheet" tab so both render identical
// ability/skill/save/combat blocks. Pure leaves — all data + roll handlers are
// passed in.

export function StatBox({
  label,
  value,
  sub,
  onClick,
}: {
  label: string
  value: string | number
  sub?: string
  onClick?: () => void
}) {
  const inner = (
    <>
      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>
        {label}
      </div>
      <div className="text-xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
        {value}
      </div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>{sub}</div>}
    </>
  )
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center justify-center rounded-lg p-3 text-center w-full transition-transform active:scale-95 hover:opacity-90"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        title={`Roll ${label}`}
      >
        {inner}
      </button>
    )
  }
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg p-3 text-center"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      {inner}
    </div>
  )
}

export function AbilityBlock({
  ability,
  total,
  mod,
  onRoll,
}: {
  ability: Ability
  total: number
  mod: number
  onRoll: () => void
}) {
  return (
    <button
      onClick={onRoll}
      className="flex flex-col items-center rounded-lg py-3 px-2 w-full transition-transform active:scale-95 hover:opacity-90"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      title={`Roll ${ABILITY_ABBREVIATIONS[ability]} check`}
    >
      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--scene-text-muted)" }}>
        {ABILITY_ABBREVIATIONS[ability]}
      </div>
      <div
        className="w-10 h-10 rounded-md flex items-center justify-center text-lg font-bold mb-1"
        style={{
          background: "color-mix(in srgb, var(--scene-accent) 12%, var(--scene-surface))",
          border: "1px solid color-mix(in srgb, var(--scene-accent) 25%, transparent)",
          color: "var(--scene-text-primary)",
          fontFamily: "var(--font-cinzel)",
        }}
      >
        {total}
      </div>
      <div className="text-sm font-semibold" style={{ color: "var(--scene-accent)" }}>
        {formatModifier(mod)}
      </div>
    </button>
  )
}

export function ProfDot({ level }: { level: "none" | "proficient" | "expert" }) {
  return (
    <span
      className="w-3 h-3 rounded-full flex-shrink-0 inline-block"
      style={{
        background: level === "none" ? "transparent" : "var(--scene-accent)",
        border: level === "none"
          ? "1.5px solid var(--scene-border)"
          : level === "expert"
          ? "2px solid var(--scene-highlight)"
          : "none",
      }}
    />
  )
}

// ── Composed blocks ─────────────────────────────────────────────────────────

export function AbilityScoresGrid({
  totalAbilities,
  mods,
  roll,
}: {
  totalAbilities: Record<Ability, number>
  mods: Record<Ability, number>
  roll: SheetRollFn
}) {
  return (
    <section className="mb-6">
      <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
        Ability Scores
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {ABILITIES.map((ability) => (
          <AbilityBlock
            key={ability}
            ability={ability}
            total={totalAbilities[ability]}
            mod={mods[ability]}
            onRoll={() => roll(`${ABILITY_ABBREVIATIONS[ability]} check`, mods[ability])}
          />
        ))}
      </div>
    </section>
  )
}

export function SavingThrowsCard({
  savingThrowProficiencies,
  saveMods,
  roll,
}: {
  savingThrowProficiencies: string[]
  saveMods: Record<Ability, number>
  roll: SheetRollFn
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
        Saving Throws
      </h2>
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
        {ABILITIES.map((ability, i) => {
          const isProficient = savingThrowProficiencies.includes(ability)
          return (
            <button
              key={ability}
              onClick={() => roll(`${ABILITY_ABBREVIATIONS[ability]} save`, saveMods[ability])}
              className="flex items-center gap-3 px-4 py-2.5 w-full text-left transition-opacity hover:opacity-80"
              style={{ borderBottom: i < ABILITIES.length - 1 ? "1px solid var(--scene-border)" : "none" }}
              title={`Roll ${ABILITY_ABBREVIATIONS[ability]} save`}
            >
              <ProfDot level={isProficient ? "proficient" : "none"} />
              <span className="text-sm flex-1" style={{ color: "var(--scene-text-primary)" }}>
                {ABILITY_ABBREVIATIONS[ability]}
              </span>
              <span
                className="text-sm font-semibold tabular-nums"
                style={{ color: isProficient ? "var(--scene-accent)" : "var(--scene-text-muted)" }}
              >
                {formatModifier(saveMods[ability])}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function SensesCard({
  passivePerception,
  speed,
  darkvision,
}: {
  passivePerception: number
  speed: number
  darkvision: number
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
        Senses
      </h2>
      <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" style={{ color: "var(--scene-text-muted)" }} />
            <span className="text-sm" style={{ color: "var(--scene-text-primary)" }}>Passive Perception</span>
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>{passivePerception}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wind className="h-3.5 w-3.5" style={{ color: "var(--scene-text-muted)" }} />
            <span className="text-sm" style={{ color: "var(--scene-text-primary)" }}>Speed</span>
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>{speed} ft</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5" style={{ color: "var(--scene-text-muted)" }} />
            <span className="text-sm" style={{ color: "var(--scene-text-primary)" }}>Darkvision</span>
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>
            {darkvision > 0 ? `${darkvision} ft` : "—"}
          </span>
        </div>
      </div>
    </section>
  )
}

export function SkillsCard({
  skillProficiencies,
  skillExpertise,
  skillMods,
  roll,
}: {
  skillProficiencies: string[]
  skillExpertise: string[]
  skillMods: Record<Skill, number>
  roll: SheetRollFn
}) {
  return (
    <section className="mb-6">
      <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
        Skills
      </h2>
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {(Object.keys(SKILLS) as Skill[]).map((skill, i, arr) => {
            const ability = SKILLS[skill] as Ability
            const isExpert = skillExpertise.includes(skill)
            const isProficient = skillProficiencies.includes(skill)
            const level: "none" | "proficient" | "expert" = isExpert ? "expert" : isProficient ? "proficient" : "none"
            // The grid fills ROW-major: even indexes land in the left column, odd in
            // the right (at sm+). Border widths are responsive Tailwind classes; the
            // color rides inline so the scene token applies to whichever sides render.
            const lastRowMobile = i === arr.length - 1
            const lastRowTwoCol = i >= arr.length - 2
            const leftColTwoCol = i % 2 === 0
            return (
              <button
                key={skill}
                onClick={() => roll(SKILL_DISPLAY_NAMES[skill], skillMods[skill])}
                className={[
                  "flex items-center gap-3 px-4 py-2 w-full text-left transition-opacity hover:opacity-80",
                  lastRowMobile ? "" : "border-b",
                  !lastRowMobile && lastRowTwoCol ? "sm:border-b-0" : "",
                  leftColTwoCol ? "sm:border-r" : "",
                ].join(" ")}
                style={{ borderColor: "var(--scene-border)" }}
                title={`Roll ${SKILL_DISPLAY_NAMES[skill]}`}
              >
                <ProfDot level={level} />
                <span className="text-sm flex-1" style={{ color: "var(--scene-text-primary)" }}>
                  {SKILL_DISPLAY_NAMES[skill]}
                </span>
                <span className="text-xs mr-2" style={{ color: "var(--scene-text-muted)" }}>
                  {ABILITY_ABBREVIATIONS[ability]}
                </span>
                <span
                  className="text-sm font-semibold tabular-nums w-8 text-right"
                  style={{ color: level !== "none" ? "var(--scene-accent)" : "var(--scene-text-muted)" }}
                >
                  {formatModifier(skillMods[skill])}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// Tool proficiencies as rollable checks. A 5e tool check is an ability check the
// DM picks the ability for, plus proficiency — so each tool offers all six
// ability buttons; tapping rolls 1d20 + that ability mod + proficiency (these are
// the character's PROFICIENCIES, so the bonus always applies). Mirrors SkillsCard
// and is shared by both sheets. Renders nothing when the character has no tools.
export function ToolsCard({
  toolProficiencies,
  mods,
  profBonus,
  roll,
}: {
  toolProficiencies: string[]
  mods: Record<Ability, number>
  profBonus: number
  roll: SheetRollFn
}) {
  const tools = toolProficiencies.map((t) => t.trim()).filter(Boolean)
  if (tools.length === 0) return null

  return (
    <section className="mb-6">
      <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
        Tools
      </h2>
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
        {tools.map((tool, i) => (
          <div
            key={`${tool}-${i}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5"
            style={{ borderBottom: i < tools.length - 1 ? "1px solid var(--scene-border)" : "none" }}
          >
            <span className="text-sm flex-1 min-w-[7rem]" style={{ color: "var(--scene-text-primary)" }}>
              {tool}
            </span>
            <div className="flex items-center gap-1">
              {ABILITIES.map((ability) => (
                <button
                  key={ability}
                  onClick={() =>
                    roll(`${tool} (${ABILITY_ABBREVIATIONS[ability]}) check`, mods[ability] + profBonus)
                  }
                  className="px-1.5 py-1 rounded text-[11px] font-semibold transition-opacity hover:opacity-80"
                  style={{
                    background: "var(--scene-bg)",
                    color: "var(--scene-accent)",
                    border: "1px solid var(--scene-border)",
                  }}
                  title={`Roll ${tool} check with ${ABILITY_ABBREVIATIONS[ability]} (proficient)`}
                >
                  {ABILITY_ABBREVIATIONS[ability]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
