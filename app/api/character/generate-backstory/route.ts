import { generateText } from "ai"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { rateLimit } from "@/lib/rate-limit"
import { AI_MODEL } from "@/lib/ai"

export const maxDuration = 60

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

    const { name, race, characterClass, background, alignment, personality } = await req.json()

    const prompt = `Generate a compelling D&D character backstory (2-3 paragraphs) for:
- Name: ${name || "Unknown"}
- Race: ${race || "Unknown"}
- Class: ${characterClass || "Unknown"}
- Background: ${background || "Unknown"}
- Alignment: ${alignment || "Unknown"}
${personality ? `- Personality: ${personality}` : ""}

The backstory should:
- Explain how they became their class
- Reference their background
- Include a personal motivation or goal
- Leave hooks for adventure
- Be 2-3 paragraphs long

Write in a narrative style suitable for a player character.`

    const { text } = await generateText({
      model: AI_MODEL,
      prompt,
    })

    return NextResponse.json({ backstory: text.trim() })
  } catch (error) {
    console.error("[FeyForge] Character backstory generation error:", error)
    return NextResponse.json({ error: "Failed to generate character backstory" }, { status: 500 })
  }
}
