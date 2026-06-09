import { generateObject } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { fetchQuery } from "convex/nextjs"
import { guardAi, refundAi } from "@/lib/ai-guard"
import { AI_MODEL } from "@/lib/ai"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { formatWorldContext } from "@/lib/worldMap/ai-context"
import { eventTemplate, type WorldEventLike } from "@/lib/worldMap/eventHooks"

// Premium AI: flesh out one Azgaar world event (a brewing invasion, plague, schism,
// eruption…) into a table-ready DM plot seed. Tier 2 of the World-Events-as-prep-tool
// feature — the always-on Tier-1 template (lib/worldMap/eventHooks.ts) is what the DM
// sees for free; this earns a richer four-part breakdown by spending a metered credit.
//
// SRD-SAFE BY CONSTRUCTION: it generates ORIGINAL campaign fiction grounded in the DM's
// OWN map (the event's name/type plus the realms, faiths, and settlements its cells
// touch — all from their Azgaar import). It never references a real creature, stat block,
// or Product Identity, so there's no SRD round-trip like the encounter generator.
//
// DM-ONLY: the caller must be the DM of the campaign (verified server-side via getMyRole —
// never trust the client). guardAi() meters it on the tiered AI path (premium 50/day, free
// 3/day); world events are DM-only tooling, not the free player-character path.

const schema = z.object({
  hook: z
    .string()
    .describe(
      "The core development as a private DM plot seed (2–3 sentences): what is actually happening beneath the event, and a concrete reason the party gets pulled in. Markdown allowed (short **bold** labels fine). Never shown to players.",
    ),
  complication: z
    .string()
    .describe(
      "One twist or wrinkle that makes it more than a fetch quest — a hidden agenda, a moral cost, a wrong-looking ally, or a second party already involved. 1–2 sentences.",
    ),
  stakes: z
    .string()
    .describe(
      "What's at risk and who pays if the party does nothing — name the affected realms/settlements/people from this world. 1–2 sentences.",
    ),
  firstScene: z
    .string()
    .describe(
      "A concrete opening scene to drop the party into: a place, a person, and an immediate beat that demands a choice. 1–2 sentences.",
    ),
})

export async function POST(req: Request) {
  const guard = await guardAi()
  if (!guard.ok) return guard.res

  try {
    const body = (await req.json()) as {
      campaignId?: string
      event?: WorldEventLike
    }
    const { campaignId, event } = body

    if (!campaignId || !event?.name || !event?.type) {
      // Don't burn the credit on a malformed request.
      await refundAi(guard.token)
      return NextResponse.json(
        { error: "Need campaignId and a world event with a name and type." },
        { status: 400 },
      )
    }

    // DM-ONLY, verified server-side — a player must never spend AI here (or read the
    // DM-only world context below). getMyRole is membership-scoped.
    const role = await fetchQuery(
      api.campaignMembers.getMyRole,
      { campaignId: campaignId as Id<"campaigns"> },
      { token: guard.token ?? undefined },
    )
    if (role !== "dm") {
      await refundAi(guard.token)
      return NextResponse.json({ error: "Only the DM can generate plot hooks." }, { status: 403 })
    }

    // Single-source the archetype + the involved realms/settlements from the same pure
    // module the UI renders, so the AI prompt and the Tier-1 fallback never disagree.
    const t = eventTemplate(event)

    // Ground the hook in the DM's actual world (realms + faiths). Fetched server-side with
    // the caller's token — membership-gated, and the DM sees the true realm state.
    const world = await fetchQuery(
      api.worldMap.getWorldbuilding,
      { campaignId: campaignId as Id<"campaigns"> },
      { token: guard.token ?? undefined },
    )
    const realms = world?.realms ?? []
    const faiths = world?.faiths ?? []
    const worldContext = formatWorldContext({ realms, faiths })

    const system = `You are a Dungeon Master's worldbuilding assistant for a D&D 5e campaign. A world event is brewing on the DM's map. Turn it into a plot seed the DM can run at the table.
HARD RULES:
- Use ONLY original, SRD-safe fiction. Never reference Wizards of the Coast Product Identity — no published settings, deities, monsters by name, or characters. The realms, faiths, and places given to you are the DM's OWN world; use those names.
- Everything you write is DM-ONLY and is NEVER shown to players. No meta-commentary, no rules text, no stat blocks.
- Ground everything in THIS world — name the real realms/faiths/settlements provided rather than inventing lore that contradicts them.
- Be specific, evocative, and table-ready. Avoid generic fantasy filler and avoid restating the event back verbatim — develop it.`

    const scopeLine = t.scope
      ? `${t.scope} in reach (${t.scope === "Localized" ? "a single area" : t.scope === "Regional" ? "several settlements" : "a sweeping, multi-realm crisis"})`
      : "reach unknown"
    const realmsLine = t.realms.length ? t.realms.join(", ") : "no specific realm recorded"
    const settlementsLine = t.settlements.length
      ? t.settlements.join(", ")
      : "no specific settlements recorded"

    const prompt = `A brewing world event:
- Name: ${event.name}
- Kind: ${event.type} (narrative archetype: ${t.archetype})
- Scope: ${scopeLine}
- Realms involved: ${realmsLine}
- Settlements affected: ${settlementsLine}
${worldContext}

Write the DM plot seed (hook), one complication, the stakes, and a concrete first scene for this event.`

    const { object } = await generateObject({ model: AI_MODEL, schema, system, prompt })

    return NextResponse.json({ ...object, remaining: guard.remaining })
  } catch (err) {
    await refundAi(guard.token)
    console.error("[FeyForge] World event hook generation error:", err)
    return NextResponse.json({ error: "Failed to generate the plot hook." }, { status: 500 })
  }
}
