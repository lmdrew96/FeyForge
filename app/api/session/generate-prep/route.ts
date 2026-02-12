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

    const { summary, plotThreads, sessionNumber } = await req.json()

    const threadsText = plotThreads?.map((t: { title: string; status: string }) => `- ${t.title} (${t.status})`).join("\n") || ""

    const prompt = `Generate session prep notes for the NEXT D&D session (Session ${(sessionNumber || 0) + 1}).

Previous Session Summary:
${summary || "First session"}

Active Plot Threads:
${threadsText || "None yet"}

Create prep notes that include:
- What to prepare (NPCs, maps, encounters)
- Potential hooks to advance plot threads
- Likely player actions to plan for
- Items/rewards to prepare
- Combat encounters to balance
- Pacing considerations

Format as a bulleted list organized by category.`

    const { text } = await generateText({
      model: AI_MODEL,
      prompt,
    })

    return NextResponse.json({ prepNotes: text.trim() })
  } catch (error) {
    console.error("[FeyForge] Session prep generation error:", error)
    return NextResponse.json({ error: "Failed to generate session prep" }, { status: 500 })
  }
}
