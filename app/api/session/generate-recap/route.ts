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

    const { summary, highlights, sessionNumber, title } = await req.json()

    const highlightsText = highlights?.join(", ") || ""

    const prompt = `Generate a player-facing recap for D&D Session ${sessionNumber}${title ? `: ${title}` : ""}.

Session Summary:
${summary || ""}

Key Highlights:
${highlightsText}

Create a recap that:
- Is written in an engaging, storytelling style
- Uses "you" and "your party" to address the players
- Captures the excitement and drama
- Reminds players of important decisions they made
- Ends with a cliffhanger or "next time" tease
- Is 2-3 paragraphs long

This will be shared with players before the next session.`

    const { text } = await generateText({
      model: AI_MODEL,
      prompt,
    })

    return NextResponse.json({ recap: text.trim() })
  } catch (error) {
    console.error("[FeyForge] Session recap generation error:", error)
    return NextResponse.json({ error: "Failed to generate session recap" }, { status: 500 })
  }
}
