/**
 * Class resource tracking — Rage, Ki, Sorcery Points, Channel Divinity, etc.
 *
 * DESIGN (diverges from the spellcasting block on purpose): a resource's MAX is a
 * pure function of (class, level, edition, ability mod), so unlike spell slots we
 * store NOTHING but the spend count. Each resource is a `characterProperties` row
 * `{ type:"classResource", name, data:{ key, used } }`; `max`/`rechargeOn` are
 * DERIVED LIVE here every render. Net: no init at creation, no "enable" backfill
 * card, and no level-up recompute — `max` grows automatically with level and
 * `used` just clamps. Rows are created lazily on first spend (used 0 = no row).
 *
 * SCOPE (v1): class-level resources only. Subclass-gated pools (Battlemaster
 * Superiority Dice, the per-subclass Channel Divinity OPTIONS) are out — subclass
 * isn't reliably readable for curated classes. Wild Shape is deferred to the
 * alternate-form work. Custom maxima from magic items/feats stay in the freeform
 * Custom Properties section.
 *
 * EDITION: the `edition` param is threaded from day one, but v1 returns 2014 (SRD
 * 5.1) data for BOTH editions — the 2024 deltas (Ki→Focus Points, Second Wind /
 * Channel Divinity counts, Bardic recharge timing) are a soft, follow-up data pass,
 * exactly as spell prepared-counts shipped 2014-first. All values below are SRD 5.1
 * verified (Rage + Channel Divinity cross-checked vs 5thsrd.org; Ki/Sorcery Points/
 * Lay on Hands are rules-definitional).
 */

import type { Ability } from "./constants"
import type { Edition } from "../editions"

export type RechargeOn = "shortRest" | "longRest"

// A resource a class HAS at a level, fully derived. `unlimited` = no spend cap
// (L20 Barbarian Rage); `used` is still tracked for display.
export interface ClassResource {
  key: string
  name: string
  max: number
  rechargeOn: RechargeOn
  unlimited?: boolean
  // A point pool spent in variable amounts (Lay on Hands, Sorcery Points) rather
  // than a small count of discrete uses — the UI gives it a "spend N" input, not
  // just ±1 steppers.
  pool?: boolean
  description?: string
}

// The only thing persisted, in `characterProperties.data`: which resource + how
// many points are spent. `max` is never stored (derived live).
export interface StoredResourceData {
  key: string
  used: number
}

// A characterProperties row, generically typed (Convex Docs satisfy it).
export interface ResourceRow {
  _id: string
  name: string
  data: unknown
}

// A resource ready to render: the derived definition + the live spend count + the
// backing row id (absent until the first spend creates a row).
export type SheetResource = ClassResource & { used: number; rowId?: string }

const clampLevel = (level: number): number => Math.max(1, Math.min(20, Math.round(level)))

// Barbarian Rages per long rest by level (SRD 5.1). Level 20 is "Unlimited" — we
// surface 6 as the nominal max but flag `unlimited` so the UI drops the cap.
const RAGE_BY_LEVEL = [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6]

// Cleric Channel Divinity uses between rests (SRD 5.1): 1 → 2 at L6 → 3 at L18.
const clericChannelDivinity = (l: number): number => (l >= 18 ? 3 : l >= 6 ? 2 : 1)

/**
 * The class resources a character has at a given level. Returns [] for classes
 * with no class-level resource pool (or homebrew/unknown ids). `mods` supplies the
 * spellcasting/ability modifier a few resources scale on (e.g. Bardic Inspiration
 * = CHA mod). `edition` is threaded for the future 2024 data pass; v1 is SRD 5.1
 * for both — see the file header.
 */
export function getClassResources(
  classId: string,
  level: number,
  mods: Record<Ability, number>,
  _edition: Edition,
): ClassResource[] {
  const id = classId.toLowerCase()
  const l = clampLevel(level)

  switch (id) {
    case "barbarian":
      return [
        {
          key: "rage",
          name: "Rage",
          max: RAGE_BY_LEVEL[l - 1],
          rechargeOn: "longRest",
          unlimited: l >= 20,
          description: "Bonus damage, resistance to physical damage. Recharges on a long rest.",
        },
      ]
    case "monk":
      return l >= 2
        ? [
            {
              key: "ki",
              name: "Ki",
              max: l,
              rechargeOn: "shortRest",
              description: "Powers Flurry of Blows, Patient Defense, Step of the Wind, and more.",
            },
          ]
        : []
    case "sorcerer":
      return l >= 2
        ? [
            {
              key: "sorcery-points",
              name: "Sorcery Points",
              max: l,
              rechargeOn: "longRest",
              pool: true,
              description: "Fuel Metamagic, or convert to/from spell slots.",
            },
          ]
        : []
    case "fighter":
      return [
        {
          key: "second-wind",
          name: "Second Wind",
          max: 1,
          rechargeOn: "shortRest",
          description: "Bonus action: regain 1d10 + fighter level HP.",
        },
        ...(l >= 2
          ? [
              {
                key: "action-surge",
                name: "Action Surge",
                max: l >= 17 ? 2 : 1,
                rechargeOn: "shortRest" as const,
                description: "Take one additional action on your turn.",
              },
            ]
          : []),
      ]
    case "bard":
      return [
        {
          key: "bardic-inspiration",
          name: "Bardic Inspiration",
          max: Math.max(1, mods.charisma),
          // Font of Inspiration (L5) flips recharge from long-rest-only to short OR long.
          rechargeOn: l >= 5 ? "shortRest" : "longRest",
          description: "Give an ally a Bardic Inspiration die to add to a roll.",
        },
      ]
    case "cleric":
      return l >= 2
        ? [
            {
              key: "channel-divinity",
              name: "Channel Divinity",
              max: clericChannelDivinity(l),
              rechargeOn: "shortRest",
              description: "Turn Undead and your domain's Channel Divinity options.",
            },
          ]
        : []
    case "paladin":
      return [
        {
          key: "lay-on-hands",
          name: "Lay on Hands",
          max: 5 * l,
          rechargeOn: "longRest",
          pool: true,
          description: "A pool of healing (HP) you can distribute by touch.",
        },
        ...(l >= 3
          ? [
              {
                key: "channel-divinity",
                name: "Channel Divinity",
                max: 1,
                rechargeOn: "shortRest" as const,
                description: "Your Sacred Oath's Channel Divinity options.",
              },
            ]
          : []),
      ]
    default:
      return []
  }
}

// Clamp a stored spend count to a resource's current max (0..max), so a max that
// shrank (e.g. a CHA drop lowering Bardic Inspiration) can't leave `used` > max.
export const clampUsed = (used: number, def: ClassResource): number =>
  Math.max(0, def.unlimited ? used : Math.min(used, def.max))

// Read the stored spend count off a row, defaulting to 0 for a missing/malformed blob.
export function rowToStoredResource(row: ResourceRow): StoredResourceData {
  const data = (row.data ?? {}) as Partial<StoredResourceData>
  return {
    key: typeof data.key === "string" ? data.key : "",
    used: typeof data.used === "number" ? data.used : 0,
  }
}

/**
 * Merge the derived resource definitions for a character with their stored spend
 * rows (matched by `key`), clamping `used` to each live max. Returns one entry per
 * resource the class has, in definition order.
 */
export function mergeResources(defs: ClassResource[], rows: ResourceRow[]): SheetResource[] {
  return defs.map((def) => {
    const row = rows.find((r) => rowToStoredResource(r).key === def.key)
    const used = row ? clampUsed(rowToStoredResource(row).used, def) : 0
    return { ...def, used, rowId: row?._id }
  })
}
