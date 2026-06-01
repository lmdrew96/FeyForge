import { generateObject } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { guardAi, refundAi } from "@/lib/ai-guard"
import { AI_MODEL } from "@/lib/ai"
import { formatSurroundings, type Surroundings } from "@/lib/worldMap/surroundings"

// Premium AI: flesh out a world-map pin into player-facing + DM-secret notes.
// Output is Markdown (renders through the shared MarkdownRenderer). Turns an
// unnamed Azgaar burg into a usable location on demand — the answer to "what do
// I do with 100 auto-pins": you generate the few that matter.

const schema = z.object({
  playerNotes: z
    .string()
    .describe(
      "What the players learn when this place is revealed: 2–4 sentences of evocative, sensory description they'd get on arrival. Markdown. No secrets.",
    ),
  dmNotes: z
    .string()
    .describe(
      "DM-only material: a plot hook or complication, one named NPC tied to the place, and a hidden secret or danger. Markdown with short **bold** labels or a bullet list. Never shown to players.",
    ),
})

// Per-type steer so a town doesn't read like a dungeon.
const TYPE_GUIDANCE: Record<string, string> = {
  settlement:
    "A settlement (village/town/city). Cover its character, who holds power, what it trades or is known for, and a rumor in the air.",
  poi: "A point of interest (dungeon, ruin, shrine, lair). Lead with intrigue and danger — why it draws adventurers and what waits inside.",
  natural:
    "A natural feature (mountain, forest, river-source, etc.). Evoke the landscape and any legend or hazard attached to it.",
  water: "A body of water. Evoke its mood, what travels or lurks on/under it, and any local lore.",
  region: "A region. Paint its overall character, peoples, and the tensions or flavor that define it.",
}

export async function POST(req: Request) {
  const guard = await guardAi()
  if (!guard.ok) return guard.res

  try {
    const { name, type, mapName, edition, surroundings } = (await req.json()) as {
      name?: string
      type?: string
      mapName?: string
      edition?: string
      surroundings?: Surroundings
    }
    if (!name?.trim()) {
      // Don't burn the credit on a malformed request.
      await refundAi(guard.token)
      return NextResponse.json({ error: "A location name is required." }, { status: 400 })
    }

    const guidance = TYPE_GUIDANCE[type ?? ""] ?? TYPE_GUIDANCE.settlement
    const system = `You are a D&D 5e worldbuilding assistant helping a Dungeon Master flesh out a location on their world map.
${edition ? `Ruleset: D&D 5e (${edition}).` : ""}
Use only SRD-safe, original content — no Wizards of the Coast Product Identity (no beholders, mind flayers, named settings, etc.).
Be vivid and usable at the table, not generic. Keep it concise. Use Markdown formatting.`

    const prompt = `Location name: "${name.trim()}"
Type: ${type ?? "settlement"} — ${guidance}
${mapName ? `World/map: "${mapName}"` : ""}${formatSurroundings(surroundings)}

Write the player-facing description and the DM-only notes for this location.`

    const { object } = await generateObject({ model: AI_MODEL, schema, system, prompt })

    return NextResponse.json({ ...object, remaining: guard.remaining })
  } catch (err) {
    await refundAi(guard.token)
    console.error("[FeyForge] Location generation error:", err)
    return NextResponse.json({ error: "Failed to generate location details." }, { status: 500 })
  }
}
