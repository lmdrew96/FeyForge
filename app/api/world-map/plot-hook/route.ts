import { generateObject } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { fetchQuery } from "convex/nextjs"
import { guardAi, refundAi } from "@/lib/ai-guard"
import { AI_MODEL } from "@/lib/ai"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { formatWorldContext } from "@/lib/worldMap/ai-context"
import { NEUTRAL } from "@/lib/worldMap/diplomacy"
import type { RealmInfo } from "@/lib/worldMap/azgaar-map"

// Premium AI: turn a Living-Diplomacy shift between two realms into a usable plot
// hook — a polished player-facing World News HEADLINE plus a private DM PLOT SEED.
// Thread ③ of the Realms/Religions umbrella: the world's latent narrative tension
// (who just allied, who just declared rivalry) stops being inert data and starts
// generating content the DM can drop into play.
//
// SRD-SAFE BY CONSTRUCTION: it generates ORIGINAL campaign fiction grounded in the
// DM's OWN map names (realms/faiths/settlements from their Azgaar import) + invented
// narrative. It never references a real creature, stat block, or Product Identity —
// unlike the encounter generator there's no SRD round-trip to do.
//
// DM-ONLY: the caller must be the DM of the campaign (verified server-side via
// getMyRole — never trust the client). guardAi() meters it on the tiered AI path
// (premium 50/day, free 3/day); this is DM tooling, not the free player-character path.

const schema = z.object({
  headline: z
    .string()
    .describe(
      "Player-facing World News line: a single polished, in-world rumor/news sentence about the shift, tone-matched to it (warming ties read hopeful; a rupture reads ominous). Plain text, no markdown, no DM secrets, no game mechanics.",
    ),
  hook: z
    .string()
    .describe(
      "PRIVATE DM plot seed — NEVER shown to players. 2–4 sentences: the development, a concrete reason the party gets pulled in, and a complication or quest seed to run. Markdown allowed (short **bold** labels fine).",
    ),
  title: z
    .string()
    .describe(
      "A short, evocative plot-thread title for the DM's tracker (3–6 words, e.g. 'The Shattered Concord'). Plain text, no markdown.",
    ),
})

// One grounding line for a realm the shift involves: government / capital / people,
// so the hook is rooted in THIS realm rather than a generic kingdom.
function realmLine(name: string, realms: RealmInfo[]): string {
  const r = realms.find((x) => x.name === name)
  if (!r) return `- ${name}`
  const tail: string[] = []
  if (r.form) tail.push(r.form)
  if (r.capital) tail.push(`capital ${r.capital}`)
  if (r.culture) tail.push(`${r.culture} people`)
  return `- ${name}${tail.length ? ` — ${tail.join("; ")}` : ""}`
}

// Humanize the diplomacy sentinel for the prompt ("Neutral" → no formal ties).
const phrase = (s: string) => (s === NEUTRAL ? "no formal relations" : s)

export async function POST(req: Request) {
  const guard = await guardAi()
  if (!guard.ok) return guard.res

  try {
    const body = (await req.json()) as {
      campaignId?: string
      realmA?: string
      realmB?: string
      from?: string
      to?: string
    }
    const { campaignId, realmA, realmB, from, to } = body

    if (!campaignId || !realmA || !realmB || !to) {
      // Don't burn the credit on a malformed request.
      await refundAi(guard.token)
      return NextResponse.json(
        { error: "Need campaignId and both realms plus the new status to generate a hook." },
        { status: 400 },
      )
    }

    // DM-ONLY, verified server-side — a player must never be able to spend AI here
    // (or read the DM-only world context below). getMyRole is membership-scoped.
    const role = await fetchQuery(
      api.campaignMembers.getMyRole,
      { campaignId: campaignId as Id<"campaigns"> },
      { token: guard.token ?? undefined },
    )
    if (role !== "dm") {
      await refundAi(guard.token)
      return NextResponse.json({ error: "Only the DM can generate plot hooks." }, { status: 403 })
    }

    // Ground the hook in the DM's actual world (realms + faiths). Fetched server-side
    // with the caller's token — membership-gated, and the DM sees the true realm state.
    const world = await fetchQuery(
      api.worldMap.getWorldbuilding,
      { campaignId: campaignId as Id<"campaigns"> },
      { token: guard.token ?? undefined },
    )
    const realms = world?.realms ?? []
    const faiths = world?.faiths ?? []
    const worldContext = formatWorldContext({ realms, faiths })

    const system = `You are a Dungeon Master's worldbuilding assistant for a D&D 5e campaign. A diplomatic shift just occurred between two realms on the DM's world map. Turn it into a plot hook the DM can use at the table.
HARD RULES:
- Use ONLY original, SRD-safe fiction. Never reference Wizards of the Coast Product Identity — no published settings, deities, monsters by name, or characters. The realms, faiths, and places given to you are the DM's OWN world; use those names.
- HEADLINE is player-facing: a single in-world rumor/news sentence. No game mechanics, no DM secrets, no meta-commentary.
- HOOK is DM-only and is NEVER shown to players: 2–4 sentences with a concrete way the party gets pulled in plus a complication or quest seed.
- Ground everything in THIS world — name the real realms/faiths/settlements provided rather than inventing lore that contradicts them.
- Be specific, evocative, and table-ready. Avoid generic fantasy filler.`

    const prompt = `A diplomatic shift between two realms:
${realmA} and ${realmB} — their relationship changed from "${phrase(from ?? NEUTRAL)}" to "${phrase(to)}".

The realms involved:
${realmLine(realmA, realms)}
${realmLine(realmB, realms)}
${worldContext}

Write the player-facing headline, the private DM plot seed (hook), and a short plot-thread title for this development.`

    const { object } = await generateObject({ model: AI_MODEL, schema, system, prompt })

    return NextResponse.json({ ...object, remaining: guard.remaining })
  } catch (err) {
    await refundAi(guard.token)
    console.error("[FeyForge] Plot hook generation error:", err)
    return NextResponse.json({ error: "Failed to generate the plot hook." }, { status: 500 })
  }
}
