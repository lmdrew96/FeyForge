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

    const { notes, highlights, sessionNumber, title } = await req.json()

    const notesText = notes?.map((n: { type: string; content: string }) => `[${n.type}] ${n.content}`).join("\n") || ""
    const highlightsText = highlights?.join(", ") || ""

    const prompt = `Generate a concise session summary (2-3 paragraphs) for D&D Session ${sessionNumber}${title ? `: ${title}` : ""}.

Session Notes:
${notesText}

Key Highlights:
${highlightsText}

Create a summary that:
- Captures the main events and story beats
- Mentions important NPCs and locations
- Highlights player choices and consequences
- Ends with what's next or unresolved threads
- Is written from the DM's perspective for record-keeping`

    const { text } = await generateText({
      model: AI_MODEL,
      prompt,
    })

    return NextResponse.json({ summary: text.trim() })
  } catch (error) {
    console.error("[FeyForge] Session summary generation error:", error)
    return NextResponse.json({ error: "Failed to generate session summary" }, { status: 500 })
  }
}
