import { generateObject } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { guardAi, refundAi } from "@/lib/ai-guard"
import { AI_MODEL } from "@/lib/ai"
import { formatSurroundings, type Surroundings } from "@/lib/worldMap/surroundings"

// Premium AI: turn a combat-capable world-map pin (encounter/monster/dungeon/ruin)
// into a runnable, CR-balanced encounter. The differentiator from the Azgaar
// gap report — the map stops being a reference and starts generating playable
// content grounded in the pin's place + the party's level.
//
// SRD-SAFE BY CONSTRUCTION: the client passes a list of real SRD monster
// candidates (open5e, document=wotc-srd); the model may ONLY pick from their
// slugs. It never invents a creature or a stat block, so nothing Product-Identity
// can leak in, and the client can recompute the true XP/difficulty from the slugs
// it gets back. The model's job is selection + narration, not game math.

const schema = z.object({
  title: z
    .string()
    .describe("A short, evocative name for this encounter (e.g. 'Ambush at the Sunken Shrine'). Plain text, no markdown."),
  readAloud: z
    .string()
    .describe(
      "Player-facing boxed text the DM reads when the encounter triggers: 2–4 sentences of sensory scene-setting. Markdown. No monster names or stats spoiled — describe what the players SEE.",
    ),
  setup: z
    .string()
    .describe(
      "DM-only running notes: the monsters' goal/tactics, terrain features that matter, and how the fight starts (ambush, parley, etc.). Markdown with short **bold** labels or bullets. Never read aloud.",
    ),
  monsters: z
    .array(z.object({ slug: z.string(), count: z.number().int().min(1).max(20) }))
    .min(1)
    .describe(
      "The creatures in this encounter. Each `slug` MUST be copied exactly from the provided candidate list — never invent a slug. Choose a thematically-fitting group whose total XP lands near the target budget.",
    ),
  scaling: z
    .string()
    .describe("One or two lines: how to make this easier or harder on the fly (add/remove a creature, swap terrain). Markdown."),
  treasure: z
    .string()
    .describe("A fitting reward or loot hook for clearing the encounter — SRD-safe and modest. Markdown. Write 'Nothing of note.' if a fight here wouldn't leave loot."),
})

// Per-kind steer so a monster lair doesn't read like a roadside ambush.
const POI_GUIDANCE: Record<string, string> = {
  encounter: "A marked encounter site — a clash waiting to happen (ambush, patrol, territorial beast). Lead with how it's sprung.",
  monster: "A monster's lair — a single dangerous creature or a tight pack on home ground. Favor a centerpiece threat over a swarm.",
  dungeon: "A room or threshold within a dungeon/ruin complex — guardians, wards, or things that dwell in the dark.",
  ruin: "A ruin's defenders — scavengers, undead stirred from rest, or squatters who've claimed the stones.",
}

type Candidate = { slug: string; name: string; cr: string; xp: number; type: string; size: string }

export async function POST(req: Request) {
  const guard = await guardAi()
  if (!guard.ok) return guard.res

  try {
    const body = (await req.json()) as {
      pinName?: string
      poiKind?: string
      legend?: string
      mapName?: string
      edition?: string
      surroundings?: Surroundings
      party?: { levels: number[]; size: number }
      difficulty?: string
      targetBudget?: number
      candidates?: Candidate[]
    }
    const { pinName, poiKind, legend, mapName, edition, surroundings, party, difficulty, targetBudget } = body
    const candidates = Array.isArray(body.candidates) ? body.candidates : []

    if (candidates.length === 0 || !party || !Array.isArray(party.levels) || party.levels.length === 0) {
      // Don't burn the credit on a malformed request.
      await refundAi(guard.token)
      return NextResponse.json(
        { error: "Need party levels and a monster candidate list to build an encounter." },
        { status: 400 },
      )
    }

    const guidance = POI_GUIDANCE[poiKind ?? ""] ?? POI_GUIDANCE.encounter
    const partyDesc = `${party.size} character${party.size === 1 ? "" : "s"} of levels [${party.levels.join(", ")}]`

    const candidateLines = candidates
      .map((c) => `- ${c.slug} — ${c.name} (${c.size} ${c.type}, CR ${c.cr}, ${c.xp} XP)`)
      .join("\n")

    const system = `You are a D&D 5e ${edition ? `(${edition}) ` : ""}encounter designer helping a Dungeon Master populate a location on their world map.
Build a single, runnable combat encounter that fits the place and challenges the party.
HARD RULES:
- Choose creatures ONLY from the candidate list you are given. Every slug in your answer must be copied exactly from that list. Never invent a creature, slug, or stat block.
- Aim for a total XP (sum of each creature's XP × its count) close to the target budget — a little over or under is fine; thematic fit beats hitting the number exactly.
- Use only SRD-safe, original prose — no Wizards of the Coast Product Identity names or settings.
- Be vivid and table-ready, not generic. Keep every field concise. Use Markdown.`

    const prompt = `Location pin: "${pinName ?? "Unnamed site"}"
Kind: ${poiKind ?? "encounter"} — ${guidance}
${mapName ? `World/map: "${mapName}"` : ""}
${legend?.trim() ? `What the DM already knows about this place: ${legend.trim()}` : ""}
Party: ${partyDesc}.
Target difficulty: ${difficulty ?? "Moderate"} (XP budget ≈ ${targetBudget ?? "unknown"}).${formatSurroundings(surroundings)}

Candidate creatures (slug — name (size type, CR, XP)):
${candidateLines}

Design the encounter: pick a fitting group from the candidates, then write the title, read-aloud, DM setup/tactics, scaling, and treasure.`

    const { object } = await generateObject({ model: AI_MODEL, schema, system, prompt })

    return NextResponse.json({ ...object, remaining: guard.remaining })
  } catch (err) {
    await refundAi(guard.token)
    console.error("[FeyForge] Encounter generation error:", err)
    return NextResponse.json({ error: "Failed to generate the encounter." }, { status: 500 })
  }
}
