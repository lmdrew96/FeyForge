import { generateObject } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { guardAi, refundAi } from "@/lib/ai-guard"
import { AI_MODEL } from "@/lib/ai"

// Premium AI (Tier B of the loot generator): turn an already-rolled, SRD-safe
// treasure hoard into evocative read-aloud — the boxed text a DM reads when the
// party uncovers it. ADDITIVE: the deterministic hoard (coins + items, generated
// free client-side via lib/loot) stands entirely on its own; this only adds
// flavor, and degrades gracefully when AI is out (the client keeps the hoard).
//
// SRD-SAFE BY CONSTRUCTION: it describes the SCENE of discovery and the items the
// caller already rolled (their names come from the SRD-filtered Open5e pool). It
// invents no new items, stat blocks, or Product Identity — there's no SRD round-
// trip to do. guardAi() meters it on the tiered AI path (premium 50/day, free
// 3/day); this is DM tooling, not the free player-character path.

const schema = z.object({
  readAloud: z
    .string()
    .describe(
      "Evocative read-aloud (2–4 sentences) describing the party DISCOVERING this hoard — the container, the setting, the glint of coin and the items named in the hoard. Second person or scene description, table-ready. Plain prose, light markdown only (no headings, no lists). No game mechanics, no stat blocks, no invented new items beyond what's in the hoard.",
    ),
})

const TIER_SCENE: Record<number, string> = {
  1: "a modest find — a roadside cache, a bandit's stash, a crumbling shrine",
  2: "a substantial haul — a guarded strongroom, a beast's lair, a noble's vault",
  3: "a significant trove — a warlord's hoard, a sealed tomb, a sunken treasury",
  4: "a legendary hoard — a dragon's mound, an archmage's reliquary, a god's forgotten altar",
}

export async function POST(req: Request) {
  const guard = await guardAi()
  if (!guard.ok) return guard.res

  try {
    const body = (await req.json()) as { tier?: number; hoard?: string }
    const tier = Math.max(1, Math.min(4, Math.round(body.tier ?? 1)))
    const hoard = (body.hoard ?? "").trim()

    if (!hoard) {
      // Don't burn the credit on a malformed request.
      await refundAi(guard.token)
      return NextResponse.json(
        { error: "Need a rolled hoard to flavor." },
        { status: 400 },
      )
    }

    const system = `You are a Dungeon Master's treasure-flavor assistant for a D&D 5e game. You are given an already-rolled treasure hoard (coins and magic items). Write the READ-ALOUD a DM speaks when the party uncovers it.
HARD RULES:
- Use ONLY original, SRD-safe prose. Never reference Wizards of the Coast Product Identity — no published settings, deities, or characters.
- Describe the SCENE of discovery and the treasure given. Do NOT invent new magic items, change the coins, or add anything not in the hoard.
- No game mechanics, no stat blocks, no dice, no meta-commentary. This is in-world boxed text.
- Be vivid, specific, and brief (2–4 sentences). Avoid generic fantasy filler.`

    const prompt = `The hoard the party just found (${TIER_SCENE[tier]}):

${hoard}

Write the read-aloud describing the moment of discovery and the treasure itself.`

    const { object } = await generateObject({ model: AI_MODEL, schema, system, prompt })

    return NextResponse.json({ ...object, remaining: guard.remaining })
  } catch (err) {
    await refundAi(guard.token)
    console.error("[FeyForge] Loot flavor generation error:", err)
    return NextResponse.json({ error: "Failed to flavor the hoard." }, { status: 500 })
  }
}
