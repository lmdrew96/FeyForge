import { generateText } from "ai"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
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
      model: "anthropic/claude-sonnet-4-5-20250929",
      prompt,
    })

    return Response.json({ recap: text.trim() })
  } catch (error) {
    console.error("[v0] Session recap generation error:", error)
    return Response.json({ error: "Failed to generate session recap" }, { status: 500 })
  }
}
