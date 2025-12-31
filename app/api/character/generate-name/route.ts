import { generateText } from "ai"
import { NextResponse } from "next/server"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { race, characterClass, gender } = await req.json()

    const prompt = `Generate a single fantasy character name for a D&D character with the following traits:
- Race: ${race || "any"}
- Class: ${characterClass || "any"}
- Gender: ${gender || "any"}

Return ONLY the name, nothing else. The name should be appropriate for the race and setting.
Examples: "Thorgrim Ironforge", "Lyra Moonwhisper", "Zephyr Stormwind"`

    const { text } = await generateText({
      model: "anthropic/claude-sonnet-4-5-20250929",
      prompt,
    })

    return NextResponse.json({ name: text.trim() })
  } catch (error) {
    console.error("[FeyForge] Character name generation error:", error)
    return NextResponse.json({ error: "Failed to generate character name" }, { status: 500 })
  }
}
