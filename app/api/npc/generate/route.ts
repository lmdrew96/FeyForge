import { generateObject } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { rateLimit } from "@/lib/rate-limit"
import { AI_MODEL } from "@/lib/ai"

const npcSchema = z.object({
  name: z.string().describe("A fitting fantasy name for the NPC"),
  race: z.string().describe("The NPC's race (Human, Elf, Dwarf, etc.)"),
  occupation: z.string().describe("The NPC's profession or role"),
  age: z.string().describe("Descriptive age like 'middle-aged', 'elderly', 'young adult'"),
  gender: z.string().describe("The NPC's gender"),
  alignment: z.string().describe("D&D alignment like 'Neutral Good' or 'Chaotic Evil'"),
  appearance: z.string().describe("Detailed physical description including distinctive features"),
  personality: z.array(z.string()).describe("3-4 personality traits"),
  mannerisms: z.string().describe("Distinctive habits, gestures, or speech patterns"),
  voiceDescription: z.string().describe("How they speak - accent, tone, pace, vocabulary"),
  motivation: z.string().describe("What drives this NPC, their primary goal"),
  secret: z.string().describe("A hidden secret the NPC keeps"),
  backstory: z.string().describe("A brief but compelling backstory (2-3 sentences)"),
})

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { success } = rateLimit(session.user.id)
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const { prompt, location, occupation, race } = await req.json()

    const systemPrompt = `You are a creative D&D NPC generator. Create interesting, memorable NPCs that DMs can use in their campaigns.
Make them feel real with depth, flaws, and hooks for roleplay. Be creative but avoid clichés.
${location ? `The NPC should be found in or near: ${location}` : ""}
${occupation ? `The NPC's occupation is: ${occupation}` : ""}
${race ? `The NPC's race is: ${race}` : ""}`

    const userPrompt = prompt || "Generate an interesting NPC for a fantasy tavern."

    const { object } = await generateObject({
      model: AI_MODEL,
      schema: npcSchema,
      system: systemPrompt,
      prompt: userPrompt,
    })

    return NextResponse.json({ npc: object })
  } catch (error) {
    console.error("[FeyForge] NPC generation error:", error)
    return NextResponse.json({ error: "Failed to generate NPC" }, { status: 500 })
  }
}
