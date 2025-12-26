import { generateText } from "ai"
import { NextResponse } from "next/server"

export const maxDuration = 60

interface TraitSuggestionRequest {
  race?: string
  class?: string
  background?: string
  alignment?: string
  partialBackstory?: string
  existingTraits?: {
    personalityTraits?: string
    ideals?: string
    bonds?: string
    flaws?: string
  }
}

interface TraitSuggestion {
  personalityTraits: string[]
  ideals: string[]
  bonds: string[]
  flaws: string[]
  namesuggestions: string[]
  backstoryHooks: string[]
}

export async function POST(req: Request) {
  try {
    const body: TraitSuggestionRequest = await req.json()
    const { race, class: characterClass, background, alignment, partialBackstory, existingTraits } = body

    const prompt = `You are an expert D&D 5e roleplayer. Generate personality suggestions for a character.

CHARACTER INFO:
- Race: ${race || "Unknown"}
- Class: ${characterClass || "Unknown"}
- Background: ${background || "Unknown"}
- Alignment: ${alignment || "Unknown"}
${partialBackstory ? `- Backstory so far: ${partialBackstory}` : ""}
${existingTraits?.personalityTraits ? `- Current personality: ${existingTraits.personalityTraits}` : ""}

Generate unique, flavorful options that:
1. Fit the race/class/background combination
2. Align with the stated alignment
3. Create interesting roleplay opportunities
4. Include potential character hooks for adventures

Respond with a JSON object (no markdown, just valid JSON):
{
  "personalityTraits": [
    "First personality trait option (1-2 sentences)",
    "Second personality trait option (1-2 sentences)",
    "Third personality trait option (1-2 sentences)"
  ],
  "ideals": [
    "First ideal that fits the alignment (format: 'Ideal Name. Description')",
    "Second ideal option",
    "Third ideal option"
  ],
  "bonds": [
    "First bond connected to background (1 sentence)",
    "Second bond option",
    "Third bond option"
  ],
  "flaws": [
    "First flaw that creates interesting complications",
    "Second flaw option",
    "Third flaw option"
  ],
  "namesuggestions": [
    "Name 1",
    "Name 2", 
    "Name 3",
    "Name 4",
    "Name 5"
  ],
  "backstoryHooks": [
    "A story hook that could drive adventures",
    "Another potential plot hook"
  ]
}

Make each option distinct and avoid generic fantasy tropes. Names should be appropriate for the race.`

    const { text } = await generateText({
      model: "anthropic/claude-sonnet-4-5-20250929",
      prompt,
    })

    // Parse the JSON response
    let suggestion: TraitSuggestion
    try {
      const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim()
      suggestion = JSON.parse(cleanedText)
    } catch {
      console.error("[FeyForge] Failed to parse AI response:", text)
      return NextResponse.json(
        { error: "Failed to parse trait suggestions" },
        { status: 500 }
      )
    }

    return NextResponse.json({ suggestion })
  } catch (error) {
    console.error("[FeyForge] Trait suggestion error:", error)
    return NextResponse.json(
      { error: "Failed to generate trait suggestions" },
      { status: 500 }
    )
  }
}
