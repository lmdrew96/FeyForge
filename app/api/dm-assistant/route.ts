import { consumeStream, convertToModelMessages, streamText, type UIMessage } from "ai"

export const maxDuration = 60

const DM_SYSTEM_PROMPT = `You are an expert Dungeon Master assistant for D&D 5th Edition. You help DMs run their games by:

1. **Rules Clarification**: Explain D&D 5e rules clearly and accurately based on the SRD
2. **Encounter Design**: Help balance combat encounters, suggest monster combinations, and create interesting tactical situations
3. **Improvisation Help**: Generate names, descriptions, plot hooks, and roleplay scenarios on the fly
4. **World Building**: Help flesh out locations, factions, histories, and lore
5. **Session Planning**: Assist with session prep, pacing, and narrative structure

When answering:
- Be concise but thorough
- Reference specific rules when applicable
- Offer creative suggestions that enhance storytelling
- Consider game balance and player fun
- Use fantasy-appropriate language and tone

You have access to the D&D 5e SRD content. When discussing mechanics, spells, monsters, or items, provide accurate information.

Format your responses with markdown for readability. Use headers, bullet points, and bold text where appropriate.`

export async function POST(req: Request) {
  const { messages, context }: { messages: UIMessage[]; context?: string } = await req.json()

  const systemPrompt = context ? `${DM_SYSTEM_PROMPT}\n\nCurrent Campaign Context:\n${context}` : DM_SYSTEM_PROMPT

  const prompt = await convertToModelMessages(messages)

  const result = streamText({
    model: "anthropic/claude-sonnet-4-5-20250929",
    system: systemPrompt,
    prompt,
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    onFinish: async ({ isAborted }) => {
      // Stream was aborted - no action needed
      void isAborted
    },
    consumeSseStream: consumeStream,
  })
}
