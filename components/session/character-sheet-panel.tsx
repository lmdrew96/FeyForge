"use client"

import { useState, useEffect } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Swords, Dices, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { CLASS_COLORS, formatModifier } from "@/lib/character/constants"
import { deriveCharacter } from "@/lib/character/derive-character"
import { CharacterAvatar } from "@/components/character/character-avatar"
import {
  useSheetRoll,
  RollModeBar,
  SheetRollCard,
} from "@/components/character/sheet-roll"
import {
  StatBox,
  AbilityScoresGrid,
  SavingThrowsCard,
  SkillsCard,
  ToolsCard,
  SensesCard,
} from "@/components/character/stat-blocks"
import { AttacksSection } from "@/app/characters/[id]/inventory"
import { SpellbookSection } from "@/components/character/spellbook"
import { ResourcesSection } from "@/components/character/resources"
import { WildshapeSection, CompanionsSection } from "@/components/character/creature-sheet"
import { InvocationsSection } from "@/components/character/invocations-section"
import { ManeuversSection } from "@/components/character/maneuvers-section"
import { LandCircleSection } from "@/components/character/land-circle-section"
import { HpEditor, RestPanel, DyingPanel } from "@/components/character/rest-panel"

// Two-tab split for the in-session sheet: things you DO (Actions) vs numbers you
// ROLL (Stats). HP/AC stay pinned in the combat strip above both tabs. Lighter
// than the standalone sheet's 5 tabs — a live surface wants fast access, not deep
// nesting. The active tab is remembered separately from the standalone sheet.
type SessionSheetTab = "actions" | "stats"

const SESSION_SHEET_TABS: { id: SessionSheetTab; label: string; icon: LucideIcon }[] = [
  { id: "actions", label: "Actions", icon: Swords },
  { id: "stats", label: "Stats", icon: Dices },
]

const SESSION_SHEET_TAB_KEY = "feyforge:session-sheet-tab"

function SessionSheetTabs({ tab, setTab }: { tab: SessionSheetTab; setTab: (t: SessionSheetTab) => void }) {
  return (
    <div
      className="flex gap-1 mb-6 p-1 rounded-lg"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      {SESSION_SHEET_TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setTab(id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all"
          style={{
            background: tab === id ? "var(--scene-accent)" : "transparent",
            color: tab === id ? "var(--scene-bg)" : "var(--scene-text-muted)",
          }}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

// In-session character sheet — the play-oriented "act surface" a player needs at
// the table: roll checks/saves/skills, attack, cast (spend slots), spend class
// resources. Deliberately NOT the full standalone sheet — no level-up, feat
// editing, inventory management, or currency, which are between-session config
// that just adds cognitive load mid-combat. Reuses the exact same roll engine,
// derivation, and sections as app/characters/[id] so the numbers can't drift.
export function SessionCharacterSheet({
  characterId,
  campaignId,
}: {
  characterId: Id<"characters">
  campaignId: Id<"campaigns">
}) {
  const char = useQuery(api.characters.get, { id: characterId })
  const allProps = useQuery(api.characters.listAllProperties)
  const campaign = useQuery(api.campaigns.get, { campaignId })
  // Hooks must run on every render — call before any early return (Rules of Hooks).
  const { roll, rollExpr, mode, setMode, lastRoll, rolling, dismiss } = useSheetRoll()

  // Active tab. Default "actions"; restore after mount to avoid a hydration mismatch.
  const [sheetTab, setSheetTab] = useState<SessionSheetTab>("actions")
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_SHEET_TAB_KEY)
    if (saved === "actions" || saved === "stats") setSheetTab(saved)
  }, [])
  const selectTab = (t: SessionSheetTab) => {
    setSheetTab(t)
    try { localStorage.setItem(SESSION_SHEET_TAB_KEY, t) } catch { /* storage may be unavailable */ }
  }

  if (char === undefined) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-xl h-28" style={{ background: "var(--scene-surface)" }} />
        ))}
      </div>
    )
  }

  if (!char) {
    return (
      <p className="text-sm text-center py-8" style={{ color: "var(--scene-text-muted)" }}>
        Couldn&apos;t load your character sheet.
      </p>
    )
  }

  const {
    totalAbilities, mods, profBonus, saveMods, skillMods, passivePerception, initiative,
    raceName, classColor, hitDie, darkvision,
    spells, grantedSpells, resourceRows, shortRestResourceKeys, formRows, companionRows, invocationRows, maneuverRows, landCircleRow, landCircleTerrain, subclassId, casterType, edition,
    equippedWeapons, fightingStyleId, armorClass, critRange, armorName, nextOrder,
    channelDivinityOptions,
  } = deriveCharacter(char, allProps, campaign)

  return (
    <div>
      {/* Compact header */}
      <div
        className="rounded-xl p-4 mb-5 flex items-center gap-3"
        style={{
          background: "color-mix(in srgb, var(--scene-accent) 6%, var(--scene-surface))",
          border: "1px solid color-mix(in srgb, var(--scene-accent) 20%, var(--scene-border))",
        }}
      >
        <CharacterAvatar imageUrl={char.imageUrl} name={char.name} className="w-11 h-11 rounded-lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold truncate" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
            {char.name}
          </h2>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", classColor)}>{char.characterClass}</span>
            {char.subclass && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                {char.subclass}
              </span>
            )}
            <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>{raceName} · Lv {char.level}</span>
          </div>
        </div>
      </div>

      {/* Roll mode toggle — applies advantage/disadvantage to every sheet roll */}
      <RollModeBar mode={mode} setMode={setMode} />
      {lastRoll && <SheetRollCard result={lastRoll} rolling={rolling} onDismiss={dismiss} />}

      {/* Combat stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatBox label="Armor Class" value={armorClass} sub={armorName ?? "unarmored"} />
        <StatBox
          label="Hit Points"
          value={`${char.hitPoints.current}/${char.hitPoints.max}`}
          sub={char.hitPoints.temp > 0 ? `+${char.hitPoints.temp} temp` : undefined}
        />
        <StatBox label="Initiative" value={formatModifier(initiative)} onClick={() => roll("Initiative", initiative)} />
        <StatBox label="Speed" value={`${char.speed} ft`} />
        <StatBox label="Prof Bonus" value={formatModifier(profBonus)} />
        <StatBox label="Passive Perc" value={passivePerception} />
        <StatBox label="Hit Dice" value={`${char.level}d${hitDie}`} />
        {char.inspiration && <StatBox label="Inspiration" value="✦" />}
      </div>

      {/* Death saves — pinned above the tabs (NOT tab-gated) so a dying player
          always sees them, whichever tab is open. Auto-surfaces only at 0 HP;
          regaining any HP clears it server-side, so it disappears on heal. */}
      {char.hitPoints.current === 0 && <DyingPanel char={char} />}

      {/* HP/AC stay pinned in the strip above — visible on both tabs. */}
      <SessionSheetTabs tab={sheetTab} setTab={selectTab} />

      {/* ⚔ Actions — attack, cast, spend resources */}
      {sheetTab === "actions" && (<>
      {/* Attacks — most-used in combat, kept near the top */}
      <AttacksSection
        level={char.level}
        weaponProficiencies={char.weaponProficiencies}
        abilities={totalAbilities}
        weapons={equippedWeapons}
        fightingStyleId={fightingStyleId}
        critRange={critRange}
        roll={roll}
        rollExpr={rollExpr}
      />

      {/* Class resources — Rage / Ki / Sorcery Points / Channel Divinity, etc. */}
      <ResourcesSection
        characterId={char._id}
        classId={char.characterClass}
        level={char.level}
        mods={mods}
        edition={edition}
        subclassId={subclassId}
        resourceRows={resourceRows}
        nextOrder={nextOrder}
        resourceOptions={{ "channel-divinity": channelDivinityOptions }}
      />

      {/* Eldritch Invocations (warlocks) */}
      <InvocationsSection
        characterId={char._id}
        classId={char.characterClass}
        level={char.level}
        invocationRows={invocationRows}
        nextOrder={nextOrder}
      />

      {/* Battle Master maneuvers (fighters) */}
      <ManeuversSection
        characterId={char._id}
        classId={char.characterClass}
        subclassId={subclassId}
        level={char.level}
        maneuverRows={maneuverRows}
        nextOrder={nextOrder}
      />

      {/* Circle of the Land terrain (druids, Land circle) */}
      <LandCircleSection
        characterId={char._id}
        classId={char.characterClass}
        subclassId={subclassId}
        level={char.level}
        rowId={landCircleRow?._id}
        terrain={landCircleTerrain}
        nextOrder={nextOrder}
      />

      {/* Wild Shape (druids) + Companions — usable in the session (roll the form's
          or companion's attacks, track their HP). */}
      <WildshapeSection
        characterId={char._id}
        classId={char.characterClass}
        level={char.level}
        subclass={char.subclass}
        formRows={formRows}
        mentalAbilities={{
          intelligence: totalAbilities.intelligence,
          wisdom: totalAbilities.wisdom,
          charisma: totalAbilities.charisma,
        }}
        nextOrder={nextOrder}
        roll={roll}
        rollExpr={rollExpr}
      />
      <CompanionsSection
        characterId={char._id}
        companionRows={companionRows}
        nextOrder={nextOrder}
        roll={roll}
        rollExpr={rollExpr}
      />

      {/* Spellcasting — slots, save DC/attack, cast from the spellbook. Casters
          who never enabled spellcasting enable it on their full sheet, not here. */}
      {casterType !== "none" && char.spellcasting && (
        <SpellbookSection
          characterId={char._id}
          spellcasting={char.spellcasting}
          classId={char.characterClass}
          subclassId={subclassId}
          level={char.level}
          edition={edition}
          spells={spells}
          grantedSpells={grantedSpells}
          nextOrder={nextOrder}
          roll={roll}
        />
      )}

      {/* Rest & recovery — edit HP + take a short/long rest mid-session. Kept at
          the bottom of Actions: combat-frequent actions (attack, cast, resources)
          lead; rest is a between-fights action. Same components + mutations as the
          full standalone sheet, so HP / slots / hit dice can't drift between them. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 items-start">
        <HpEditor char={char} />
        <RestPanel char={char} resourceRows={resourceRows} shortRestResourceKeys={shortRestResourceKeys} />
      </div>
      </>)}

      {/* 🎲 Stats — ability scores, saves, senses, skills */}
      {sheetTab === "stats" && (<>
      {/* Ability Scores */}
      <AbilityScoresGrid totalAbilities={totalAbilities} mods={mods} roll={roll} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <SavingThrowsCard
          savingThrowProficiencies={char.savingThrowProficiencies}
          saveMods={saveMods}
          roll={roll}
        />
        <SensesCard
          passivePerception={passivePerception}
          speed={char.speed}
          darkvision={darkvision}
        />
      </div>

      {/* Skills */}
      <SkillsCard
        skillProficiencies={char.skillProficiencies}
        skillExpertise={char.skillExpertise}
        skillMods={skillMods}
        roll={roll}
      />

      {/* Tools — proficiency checks (pick the ability) */}
      <ToolsCard
        toolProficiencies={char.toolProficiencies}
        mods={mods}
        profBonus={profBonus}
        roll={roll}
      />
      </>)}
    </div>
  )
}
