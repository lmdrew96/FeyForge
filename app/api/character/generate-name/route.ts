import { generateText } from "ai"
import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { rateLimit } from "@/lib/rate-limit"
import { AI_MODEL } from "@/lib/ai"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { success } = rateLimit(userId)
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const { race, characterClass, gender } = await req.json()

    const prompt = `Generate a single fantasy character name for a D&D character with the following traits:
- Race: ${race || "any"}
- Class: ${characterClass || "any"}
- Gender: ${gender || "any"}

Return ONLY the name, nothing else. The name should be appropriate for the race and setting.
Examples: "Thorgrim Ironforge", "Lyra Moonwhisper", "Zephyr Stormwind"`

    const { text } = await generateText({
      model: AI_MODEL,
      prompt,
    })

    return NextResponse.json({ name: text.trim() })
  } catch (error) {
    console.error("[FeyForge] Character name generation error:", error)
    return NextResponse.json({ error: "Failed to generate character name" }, { status: 500 })
  }
}
