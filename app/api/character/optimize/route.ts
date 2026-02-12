import { generateText } from "ai"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { rateLimit } from "@/lib/rate-limit"
import { AI_MODEL } from "@/lib/ai"

export const maxDuration = 60

interface OptimizeRequest {
  race: string
  class: string
  subclass?: string
  level: number
  upcomingLevel: number
  currentAbilities: {
    strength: number
    dexterity: number
    constitution: number
    intelligence: number
    wisdom: number
    charisma: number
  }
  existingFeats?: string[]
  skillProficiencies?: string[]
  playstyle?: "damage" | "tank" | "support" | "utility" | "balanced"
  multiclassInterest?: boolean
}

interface Recommendation {
  type: "asi" | "feat" | "multiclass"
  name: string
  description: string
  reason: string
  mechanicalBenefit: string
  synergies: string[]
  alternative?: {
    name: string
    reason: string
  }
}

interface OptimizeResponse {
  recommendations: Recommendation[]
  generalAdvice: string
  spellRecommendations?: string[]
  combatTips?: string[]
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

    const body: OptimizeRequest = await req.json()
    const {
      race,
      class: characterClass,
      subclass,
      level,
      upcomingLevel,
      currentAbilities,
      existingFeats = [],
      skillProficiencies = [],
      playstyle = "balanced",
      multiclassInterest = false,
    } = body

    // Validate ASI level
    const asiLevels = [4, 8, 12, 16, 19]
    const isASILevel = asiLevels.includes(upcomingLevel)

    if (!isASILevel && !multiclassInterest) {
      return NextResponse.json({
        recommendations: [],
        generalAdvice: `Level ${upcomingLevel} doesn't grant an ASI or feat choice. Focus on your new class features!`,
      })
    }

    const prompt = `You are an expert D&D 5e optimizer. Recommend the best choices for this character's level up.

CHARACTER BUILD:
- Race: ${race}
- Class: ${characterClass}${subclass ? ` (${subclass})` : ""}
- Current Level: ${level}
- Leveling to: ${upcomingLevel}
- Playstyle: ${playstyle}

CURRENT ABILITY SCORES:
- STR: ${currentAbilities.strength}
- DEX: ${currentAbilities.dexterity}
- CON: ${currentAbilities.constitution}
- INT: ${currentAbilities.intelligence}
- WIS: ${currentAbilities.wisdom}
- CHA: ${currentAbilities.charisma}

EXISTING FEATS: ${existingFeats.length ? existingFeats.join(", ") : "None"}
SKILL PROFICIENCIES: ${skillProficiencies.join(", ") || "Unknown"}
${multiclassInterest ? "INTERESTED IN MULTICLASSING: Yes" : ""}

${isASILevel ? "This level grants an ASI (Ability Score Improvement) or feat choice." : ""}

Provide 2-3 recommendations ranked by effectiveness for this build and playstyle.

Respond with a JSON object (no markdown, just valid JSON):
{
  "recommendations": [
    {
      "type": "asi" or "feat" or "multiclass",
      "name": "Choice name (e.g., '+2 Strength' or 'Great Weapon Master')",
      "description": "Brief description of what this gives",
      "reason": "Why this is good for THIS specific build (2-3 sentences)",
      "mechanicalBenefit": "Specific numerical or tactical benefit",
      "synergies": ["How it synergizes with existing features"],
      "alternative": {
        "name": "Alternative choice if this doesn't fit playstyle",
        "reason": "Why the alternative might be preferred"
      }
    }
  ],
  "generalAdvice": "Overall strategic advice for this character going forward",
  "spellRecommendations": ["If caster, 2-3 recommended spells to pick up"],
  "combatTips": ["2-3 tactical tips for using this build effectively"]
}

Use only SRD/PHB content. Consider odd ability scores that could be rounded up.`

    const { text } = await generateText({
      model: AI_MODEL,
      prompt,
    })

    // Parse the JSON response
    let response: OptimizeResponse
    try {
      const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim()
      response = JSON.parse(cleanedText)
    } catch {
      console.error("[FeyForge] Failed to parse AI response:", text)
      return NextResponse.json(
        { error: "Failed to parse optimization suggestions" },
        { status: 500 }
      )
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[FeyForge] Optimization error:", error)
    return NextResponse.json(
      { error: "Failed to generate optimization suggestions" },
      { status: 500 }
    )
  }
}
