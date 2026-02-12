import { generateText } from "ai"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { rateLimit } from "@/lib/rate-limit"
import { AI_MODEL } from "@/lib/ai"

export const maxDuration = 60

interface BuildSuggestionRequest {
  concept: string
  playstyle?: "combat" | "roleplay" | "balanced" | "support"
  experience?: "beginner" | "intermediate" | "advanced"
  preferences?: {
    preferredRaces?: string[]
    preferredClasses?: string[]
    avoidMagic?: boolean
    preferRanged?: boolean
  }
}

interface BuildSuggestion {
  race: string
  subrace?: string
  raceReason: string
  class: string
  subclass?: string
  classReason: string
  background: string
  backgroundReason: string
  abilityPriority: string[]
  suggestedAbilities: {
    strength: number
    dexterity: number
    constitution: number
    intelligence: number
    wisdom: number
    charisma: number
  }
  keySynergies: string[]
  playstyleTips: string[]
  levelProgression: string
}

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

    const body: BuildSuggestionRequest = await req.json()
    const { concept, playstyle = "balanced", experience = "beginner", preferences } = body

    if (!concept || concept.trim().length === 0) {
      return NextResponse.json({ error: "Character concept is required" }, { status: 400 })
    }

    const prompt = `You are an expert D&D 5e character builder. Create an optimized character build based on this concept.

CHARACTER CONCEPT: "${concept}"
PLAYSTYLE PREFERENCE: ${playstyle}
PLAYER EXPERIENCE: ${experience}
${preferences?.preferredRaces?.length ? `PREFERRED RACES: ${preferences.preferredRaces.join(", ")}` : ""}
${preferences?.preferredClasses?.length ? `PREFERRED CLASSES: ${preferences.preferredClasses.join(", ")}` : ""}
${preferences?.avoidMagic ? "PREFERENCE: Avoid magic-focused builds" : ""}
${preferences?.preferRanged ? "PREFERENCE: Prefer ranged combat" : ""}

AVAILABLE CONTENT: Use only SRD/Open5e content (PHB races, classes, backgrounds).

Respond with a JSON object (no markdown, just valid JSON):
{
  "race": "Race name",
  "subrace": "Subrace if applicable or null",
  "raceReason": "Why this race fits the concept (1-2 sentences)",
  "class": "Class name",
  "subclass": "Recommended subclass or null for level 1",
  "classReason": "Why this class fits the concept (1-2 sentences)",
  "background": "Background name",
  "backgroundReason": "Why this background fits (1 sentence)",
  "abilityPriority": ["primary", "secondary", "tertiary"],
  "suggestedAbilities": {
    "strength": 8-15,
    "dexterity": 8-15,
    "constitution": 8-15,
    "intelligence": 8-15,
    "wisdom": 8-15,
    "charisma": 8-15
  },
  "keySynergies": ["2-3 key mechanical synergies"],
  "playstyleTips": ["2-3 tips for playing this character"],
  "levelProgression": "Brief note on how to develop at higher levels"
}

For ability scores, use point buy values (8-15 range, total cost 27 points).
Point costs: 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=7, 15=9`

    const { text } = await generateText({
      model: AI_MODEL,
      prompt,
    })

    // Parse the JSON response
    let suggestion: BuildSuggestion
    try {
      // Clean up potential markdown code blocks
      const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim()
      suggestion = JSON.parse(cleanedText)
    } catch {
      console.error("[FeyForge] Failed to parse AI response:", text)
      return NextResponse.json(
        { error: "Failed to parse build suggestion" },
        { status: 500 }
      )
    }

    return NextResponse.json({ suggestion })
  } catch (error) {
    console.error("[FeyForge] Build suggestion error:", error)
    return NextResponse.json(
      { error: "Failed to generate build suggestion" },
      { status: 500 }
    )
  }
}
