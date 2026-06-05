import {
  consumeStream,
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { AI_MODEL } from "@/lib/ai"
import { guardAi } from "@/lib/ai-guard"
import {
  lookupSpell,
  lookupMonster,
  lookupItem,
  lookupCondition,
} from "@/lib/open5e-server"

export const maxDuration = 60

const DM_SYSTEM_PROMPT = `You are an expert Dungeon Master assistant for D&D 5th Edition. You help DMs run their games by:

1. **Rules Clarification**: Explain D&D 5e rules clearly and accurately based on the SRD
2. **Encounter Design**: Help balance combat encounters, suggest monster combinations, and create interesting tactical situations
3. **Improvisation Help**: Generate names, descriptions, plot hooks, and roleplay scenarios on the fly
4. **World Building**: Help flesh out locations, factions, histories, and lore
5. **Session Planning**: Assist with session prep, pacing, and narrative structure

When answering:
- Be concise but thorough
- Reference specific rules when applicable
- Offer creative suggestions that enhance storytelling
- Consider game balance and player fun
- Use fantasy-appropriate language and tone

SRD LOOKUP TOOLS — you CAN look things up. You have tools that fetch real SRD data: lookupSpell, lookupMonster, lookupItem (magic items), and lookupCondition. When the DM asks for an exact spell, monster stat block, magic item, or condition, CALL the matching tool and ground your answer in what it returns rather than reciting from memory. Use the tool whenever precise numbers matter (damage, range, AC, HP, save DCs, durations). If a tool returns "no match," say so and offer your best general guidance instead of inventing specifics.

EDITION CAVEAT: the lookup tools return the 2014 SRD (5.1). If the current campaign uses the 2024 ruleset (5.2) — check the campaign context — note that a few specifics may differ in 2024 and tell the DM to verify against a 2024 source. For procedural rulings the tools can't fully cover (e.g. "can they cast and dodge?"), reason from the rules but flag genuine uncertainty.

Format your responses with markdown for readability. Use headers, bullet points, and bold text where appropriate.`

export async function POST(req: Request) {
  const guard = await guardAi()
  if (!guard.ok) return guard.res
  try {
    const { messages, context }: { messages: UIMessage[]; context?: string } = await req.json()

    const systemPrompt = context ? `${DM_SYSTEM_PROMPT}\n\nCurrent Campaign Context:\n${context}` : DM_SYSTEM_PROMPT

    const prompt = await convertToModelMessages(messages)

    const result = streamText({
      model: AI_MODEL,
      system: systemPrompt,
      prompt,
      // SRD grounding: the model can call these to pull real 2014 SRD data
      // (server-side fetch against the public Open5e API — see lib/open5e-server).
      tools: {
        lookupSpell: tool({
          description:
            "Look up an official SRD spell's full details (level, school, casting time, range, components, duration, effect, higher-level scaling). Use for exact spell mechanics.",
          inputSchema: z.object({
            name: z.string().describe("The spell name, e.g. 'Fireball' or 'Counterspell'."),
          }),
          execute: async ({ name }) => lookupSpell(name),
        }),
        lookupMonster: tool({
          description:
            "Look up an official SRD monster's stat block (size/type, AC, HP, speed, ability scores, CR, senses, and key actions). Use for exact monster stats.",
          inputSchema: z.object({
            name: z.string().describe("The monster name, e.g. 'Goblin' or 'Adult Red Dragon'."),
          }),
          execute: async ({ name }) => lookupMonster(name),
        }),
        lookupItem: tool({
          description:
            "Look up an official SRD magic item (type, rarity, attunement, and effect). Use for exact magic-item properties.",
          inputSchema: z.object({
            name: z.string().describe("The magic item name, e.g. 'Bag of Holding' or 'Flame Tongue'."),
          }),
          execute: async ({ name }) => lookupItem(name),
        }),
        lookupCondition: tool({
          description:
            "Look up an official SRD condition's exact rules (e.g. Prone, Grappled, Frightened, Stunned). Use when a condition's precise effects matter.",
          inputSchema: z.object({
            name: z.string().describe("The condition name, e.g. 'Restrained'."),
          }),
          execute: async ({ name }) => lookupCondition(name),
        }),
      },
      // Allow tool round-trips: the model can call a lookup, read the result, then
      // answer (or chain a couple of lookups) before finishing.
      stopWhen: stepCountIs(5),
      abortSignal: req.signal,
    })

    return result.toUIMessageStreamResponse({
      onFinish: async ({ isAborted }) => {
        // Stream was aborted - no action needed
        void isAborted
      },
      consumeSseStream: consumeStream,
    })
  } catch (error) {
    console.error("[FeyForge] DM assistant error:", error)
    return NextResponse.json({ error: "Failed to start DM assistant" }, { status: 500 })
  }
}
