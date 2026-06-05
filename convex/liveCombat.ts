import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { getMembershipBySession } from "./lib/auth"

// ── Types & validators ────────────────────────────────────────────────────────

const combatantInputValidator = v.object({
  id: v.string(),
  name: v.string(),
  type: v.union(v.literal("pc"), v.literal("npc"), v.literal("monster")),
  initiative: v.number(),
  initiativeBonus: v.number(),
  armorClass: v.number(),
  hitPoints: v.object({
    current: v.number(),
    max: v.number(),
    temp: v.number(),
  }),
  conditions: v.array(v.string()),
  deathSaves: v.optional(
    v.object({ successes: v.number(), failures: v.number() })
  ),
  characterId: v.optional(v.id("characters")),
  userId: v.optional(v.string()),
})

type Combatant = Doc<"liveCombat">["combatants"][number]

// Health bands shown to players for hidden (monster/npc) HP. "bloodied" is the
// canonical 5e term for at-or-below half HP.
export type HealthBand = "healthy" | "bloodied" | "down"

function healthBand(current: number, max: number): HealthBand {
  if (current <= 0) return "down"
  if (max > 0 && current <= max / 2) return "bloodied"
  return "healthy"
}

// ── Pure combat logic (lifted from lib/combat-store.ts) ─────────────────────────

// Initiative high→low, Dex/init bonus as tiebreaker.
function sortByInitiative(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative
    return b.initiativeBonus - a.initiativeBonus
  })
}

// Damage applies to temp HP first; healing never exceeds max and never revives
// temp HP. Mirrors combat-store.adjustHP.
function applyHpDelta(hp: Combatant["hitPoints"], amount: number) {
  let current = hp.current
  let temp = hp.temp
  if (amount < 0) {
    const damage = Math.abs(amount)
    if (temp > 0) {
      const tempDamage = Math.min(temp, damage)
      temp -= tempDamage
      current -= damage - tempDamage
    } else {
      current -= damage
    }
  } else {
    current += amount
  }
  current = Math.max(0, Math.min(current, hp.max))
  return { ...hp, current, temp }
}

// ── Auth helpers ────────────────────────────────────────────────────────────────

// Loads the active combat for a session and verifies the caller is its DM.
// Returns the combat doc + identity for the mutation to patch.
async function requireCombatDm(
  ctx: MutationCtx,
  sessionId: Id<"partySessions">
): Promise<{ combat: Doc<"liveCombat">; userId: string }> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error("Not authenticated")
  const combat = await ctx.db
    .query("liveCombat")
    .withIndex("by_sessionId_and_isActive", (q) =>
      q.eq("sessionId", sessionId).eq("isActive", true)
    )
    .first()
  if (!combat) throw new Error("No active combat in this session")
  if (combat.dmUserId !== identity.tokenIdentifier) {
    throw new Error("Only the DM can manage combat")
  }
  return { combat, userId: identity.tokenIdentifier }
}

// Keeps activeIndex in range after the combatant list changes length.
function clampIndex(index: number, length: number): number {
  if (length === 0) return 0
  return Math.max(0, Math.min(index, length - 1))
}

// ── Query (role-filtered) ───────────────────────────────────────────────────────

export const getCombat = query({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args) => {
    // Members only — the combat row carries exact PC HP, so a non-member must
    // not be able to read it by passing a session id.
    const m = await getMembershipBySession(ctx, args.sessionId)
    if (!m) return null
    const { userId } = m

    const combat = await ctx.db
      .query("liveCombat")
      .withIndex("by_sessionId_and_isActive", (q) =>
        q.eq("sessionId", args.sessionId).eq("isActive", true)
      )
      .first()
    if (!combat) return null

    const isDM = combat.dmUserId === userId

    // The combat row's HP snapshot is the source of truth during combat: the DM
    // drives it via the combat mutations (snapshot-at-start, like most initiative
    // trackers). Players see exact HP for PCs (consistent with the party rail);
    // monster/NPC HP is reduced to a health band so the DM keeps secrets.
    const combatants = combat.combatants.map((c, index) => {
      const base = {
        id: c.id,
        name: c.name,
        type: c.type,
        initiative: c.initiative,
        // AC is only meaningful for combatants the DM entered it for (monsters/
        // NPCs); PC AC isn't computed onto the live row, so omit rather than
        // show a wrong number.
        armorClass: isDM && c.type !== "pc" ? c.armorClass : undefined,
        conditions: c.conditions,
        deathSaves: c.deathSaves,
        characterId: c.characterId,
        isActive: index === combat.activeIndex,
        isMine: c.userId === userId,
      }
      const showExact = isDM || c.type === "pc"
      if (showExact) {
        return { ...base, hitPoints: c.hitPoints, healthBand: undefined }
      }
      return {
        ...base,
        hitPoints: undefined,
        healthBand: healthBand(c.hitPoints.current, c.hitPoints.max),
      }
    })

    return {
      _id: combat._id,
      isDM,
      round: combat.round,
      activeIndex: combat.activeIndex,
      combatants,
    }
  },
})

// ── Mutations (DM-only) ──────────────────────────────────────────────────────────

export const startCombat = mutation({
  args: {
    sessionId: v.id("partySessions"),
    combatants: v.array(combatantInputValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")
    if (session.dmUserId !== identity.tokenIdentifier) {
      throw new Error("Only the DM can start combat")
    }

    // Retire any existing active combat for this session (one active at a time).
    const existing = await ctx.db
      .query("liveCombat")
      .withIndex("by_sessionId_and_isActive", (q) =>
        q.eq("sessionId", args.sessionId).eq("isActive", true)
      )
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { isActive: false, updatedAt: Date.now() })
    }

    const sorted = sortByInitiative(args.combatants as Combatant[])
    const now = Date.now()
    return await ctx.db.insert("liveCombat", {
      sessionId: args.sessionId,
      campaignId: session.campaignId,
      dmUserId: identity.tokenIdentifier,
      isActive: true,
      round: 1,
      activeIndex: 0,
      combatants: sorted,
      startedAt: now,
      updatedAt: now,
    })
  },
})

export const addCombatant = mutation({
  args: {
    sessionId: v.id("partySessions"),
    combatant: combatantInputValidator,
  },
  handler: async (ctx, args) => {
    const { combat } = await requireCombatDm(ctx, args.sessionId)
    // Re-sort so the new combatant lands in initiative order; keep the *same*
    // combatant active across the re-sort by tracking its id.
    const activeId = combat.combatants[combat.activeIndex]?.id
    const next = sortByInitiative([
      ...combat.combatants,
      args.combatant as Combatant,
    ])
    const activeIndex = Math.max(
      0,
      next.findIndex((c) => c.id === activeId)
    )
    await ctx.db.patch(combat._id, {
      combatants: next,
      activeIndex: clampIndex(activeIndex, next.length),
      updatedAt: Date.now(),
    })
  },
})

export const removeCombatant = mutation({
  args: { sessionId: v.id("partySessions"), combatantId: v.string() },
  handler: async (ctx, args) => {
    const { combat } = await requireCombatDm(ctx, args.sessionId)
    const activeId = combat.combatants[combat.activeIndex]?.id
    const next = combat.combatants.filter((c) => c.id !== args.combatantId)
    // If the active combatant was removed, the turn stays at the same index
    // (now the next combatant); otherwise follow the active combatant's id.
    let activeIndex = combat.activeIndex
    if (activeId && activeId !== args.combatantId) {
      const found = next.findIndex((c) => c.id === activeId)
      if (found >= 0) activeIndex = found
    }
    await ctx.db.patch(combat._id, {
      combatants: next,
      activeIndex: clampIndex(activeIndex, next.length),
      updatedAt: Date.now(),
    })
  },
})

// Generic per-combatant patch helper for the HP/condition/initiative mutations.
// Returns the updated combatant so callers can write its live state through to the
// linked character/party-member (the "one shared number").
async function patchCombatant(
  ctx: MutationCtx,
  sessionId: Id<"partySessions">,
  combatantId: string,
  update: (c: Combatant) => Combatant,
  opts?: { resort?: boolean }
): Promise<Combatant | undefined> {
  const { combat } = await requireCombatDm(ctx, sessionId)
  const activeId = combat.combatants[combat.activeIndex]?.id
  let next = combat.combatants.map((c) =>
    c.id === combatantId ? update(c) : c
  )
  let activeIndex = combat.activeIndex
  if (opts?.resort) {
    next = sortByInitiative(next)
    const found = next.findIndex((c) => c.id === activeId)
    if (found >= 0) activeIndex = found
  }
  await ctx.db.patch(combat._id, {
    combatants: next,
    activeIndex: clampIndex(activeIndex, next.length),
    updatedAt: Date.now(),
  })
  return next.find((c) => c.id === combatantId)
}

// ── "One shared number" write-through ────────────────────────────────────────
// During combat the liveCombat combatant is the live authority for a PC's HP,
// death saves, and conditions. These helpers push that state back onto the linked
// character + party-member rows so the player's character sheet and MyCharacterPanel
// never drift from the DM's tracker — and the final state persists after combat
// ends. All no-op for monster/NPC combatants (no characterId/userId) or a
// deleted/absent target, so they're always safe to call.

// HP (current + temp) and death saves → the linked character. The character keeps
// its OWN max (the combatant max is a start-of-combat snapshot); current is clamped
// into [0, max].
async function syncCharacterFromCombatant(ctx: MutationCtx, combatant: Combatant) {
  const characterId = combatant.characterId
  if (!characterId) return
  const character = await ctx.db.get(characterId)
  if (!character) return
  await ctx.db.patch(characterId, {
    hitPoints: {
      max: character.hitPoints.max,
      current: Math.max(0, Math.min(combatant.hitPoints.current, character.hitPoints.max)),
      temp: Math.max(0, combatant.hitPoints.temp),
    },
    deathSaves: combatant.deathSaves ?? { successes: 0, failures: 0 },
  })
}

// Conditions → the player's party-member row (combatant wins in-combat), so their
// MyCharacterPanel reflects DM-applied conditions live.
async function syncPartyMemberConditions(
  ctx: MutationCtx,
  sessionId: Id<"partySessions">,
  combatant: Combatant
) {
  const userId = combatant.userId
  if (!userId) return
  const member = await ctx.db
    .query("partyMembers")
    .withIndex("by_sessionId_and_userId", (q) =>
      q.eq("sessionId", sessionId).eq("userId", userId)
    )
    .first()
  if (!member) return
  await ctx.db.patch(member._id, { conditions: combatant.conditions })
}

export const adjustHp = mutation({
  args: {
    sessionId: v.id("partySessions"),
    combatantId: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const { combat } = await requireCombatDm(ctx, args.sessionId)
    const target = combat.combatants.find((c) => c.id === args.combatantId)

    const next = combat.combatants.map((c) =>
      c.id === args.combatantId
        ? { ...c, hitPoints: applyHpDelta(c.hitPoints, args.amount) }
        : c
    )
    await ctx.db.patch(combat._id, {
      combatants: next,
      updatedAt: Date.now(),
    })

    // Write the PC's new HP through to their character sheet (one shared number).
    const updated = next.find((c) => c.id === args.combatantId)
    if (updated) await syncCharacterFromCombatant(ctx, updated)

    // If a concentrating combatant took damage, surface the CON save DC so the DM
    // can call for it: DC 10 or half the damage taken, whichever is higher.
    if (
      target &&
      args.amount < 0 &&
      target.conditions.some((x) => x.toLowerCase() === "concentrating")
    ) {
      const damage = Math.abs(args.amount)
      return {
        concentrationDC: Math.max(10, Math.floor(damage / 2)),
        name: target.name,
      }
    }
    return null
  },
})

// Roll a death save server-side and apply 5e rules:
//   nat 20 → regain 1 HP (conscious, clear saves); nat 1 → two failures;
//   10–19 → one success; 2–9 → one failure. 3 successes = stable, 3 = dead.
// Returns the roll + resulting outcome so the DM gets a clear toast.
export const rollDeathSave = mutation({
  args: { sessionId: v.id("partySessions"), combatantId: v.string() },
  handler: async (ctx, args) => {
    const { combat } = await requireCombatDm(ctx, args.sessionId)
    const target = combat.combatants.find((c) => c.id === args.combatantId)
    if (!target) throw new Error("Combatant not found")

    const roll = Math.floor(Math.random() * 20) + 1
    const prev = target.deathSaves ?? { successes: 0, failures: 0 }
    let successes = prev.successes
    let failures = prev.failures
    let revived = false
    let outcome: "success" | "failure" | "stable" | "dead" | "revived"

    if (roll === 20) {
      // Pop back up at 1 HP, conscious, saves cleared.
      successes = 0
      failures = 0
      revived = true
      outcome = "revived"
    } else if (roll === 1) {
      failures = Math.min(3, failures + 2)
      outcome = failures >= 3 ? "dead" : "failure"
    } else if (roll >= 10) {
      successes = Math.min(3, successes + 1)
      outcome = successes >= 3 ? "stable" : "success"
    } else {
      failures = Math.min(3, failures + 1)
      outcome = failures >= 3 ? "dead" : "failure"
    }

    // On stabilize, saves reset (creature is stable at 0 HP, no longer rolling).
    const clearedSaves = outcome === "stable"

    const next = combat.combatants.map((c) =>
      c.id === args.combatantId
        ? {
            ...c,
            hitPoints: revived
              ? { ...c.hitPoints, current: 1 }
              : c.hitPoints,
            deathSaves: clearedSaves || revived
              ? { successes: 0, failures: 0 }
              : { successes, failures },
          }
        : c
    )
    await ctx.db.patch(combat._id, { combatants: next, updatedAt: Date.now() })

    // Persist the revived HP / updated death saves to the character sheet.
    const updated = next.find((c) => c.id === args.combatantId)
    if (updated) await syncCharacterFromCombatant(ctx, updated)

    return { roll, outcome, successes, failures, name: target.name }
  },
})

export const setTempHp = mutation({
  args: {
    sessionId: v.id("partySessions"),
    combatantId: v.string(),
    temp: v.number(),
  },
  handler: async (ctx, args) => {
    const updated = await patchCombatant(ctx, args.sessionId, args.combatantId, (c) => ({
      ...c,
      hitPoints: { ...c.hitPoints, temp: Math.max(0, args.temp) },
    }))
    if (updated) await syncCharacterFromCombatant(ctx, updated)
  },
})

export const setInitiative = mutation({
  args: {
    sessionId: v.id("partySessions"),
    combatantId: v.string(),
    initiative: v.number(),
  },
  handler: async (ctx, args) => {
    await patchCombatant(
      ctx,
      args.sessionId,
      args.combatantId,
      (c) => ({ ...c, initiative: args.initiative }),
      { resort: true }
    )
  },
})

export const toggleCondition = mutation({
  args: {
    sessionId: v.id("partySessions"),
    combatantId: v.string(),
    condition: v.string(),
  },
  handler: async (ctx, args) => {
    const updated = await patchCombatant(ctx, args.sessionId, args.combatantId, (c) => ({
      ...c,
      conditions: c.conditions.includes(args.condition)
        ? c.conditions.filter((x) => x !== args.condition)
        : [...c.conditions, args.condition],
    }))
    if (updated) await syncPartyMemberConditions(ctx, args.sessionId, updated)
  },
})

export const setDeathSaves = mutation({
  args: {
    sessionId: v.id("partySessions"),
    combatantId: v.string(),
    successes: v.number(),
    failures: v.number(),
  },
  handler: async (ctx, args) => {
    const updated = await patchCombatant(ctx, args.sessionId, args.combatantId, (c) => ({
      ...c,
      deathSaves: {
        successes: Math.max(0, Math.min(3, args.successes)),
        failures: Math.max(0, Math.min(3, args.failures)),
      },
    }))
    if (updated) await syncCharacterFromCombatant(ctx, updated)
  },
})

export const nextTurn = mutation({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args) => {
    const { combat } = await requireCombatDm(ctx, args.sessionId)
    if (combat.combatants.length === 0) return
    const newIndex = (combat.activeIndex + 1) % combat.combatants.length
    const newRound = newIndex === 0 ? combat.round + 1 : combat.round
    await ctx.db.patch(combat._id, {
      activeIndex: newIndex,
      round: newRound,
      updatedAt: Date.now(),
    })
  },
})

export const previousTurn = mutation({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args) => {
    const { combat } = await requireCombatDm(ctx, args.sessionId)
    if (combat.combatants.length === 0) return
    const wrapping = combat.activeIndex === 0
    const newIndex = wrapping
      ? combat.combatants.length - 1
      : combat.activeIndex - 1
    const newRound = wrapping && combat.round > 1 ? combat.round - 1 : combat.round
    await ctx.db.patch(combat._id, {
      activeIndex: newIndex,
      round: newRound,
      updatedAt: Date.now(),
    })
  },
})

export const endCombat = mutation({
  args: { sessionId: v.id("partySessions") },
  handler: async (ctx, args) => {
    const { combat } = await requireCombatDm(ctx, args.sessionId)
    await ctx.db.patch(combat._id, { isActive: false, updatedAt: Date.now() })
  },
})
