import { consumeStream, convertToModelMessages, streamText, type UIMessage } from "ai"
import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { rateLimit } from "@/lib/rate-limit"
import { AI_MODEL } from "@/lib/ai"

export const maxDuration = 60

const COMPANION_SYSTEM_PROMPT = `You are a friendly guide helping someone build their first D&D 5th Edition character. You're knowledgeable, encouraging, and concise.

Your role:
- Answer any D&D rules question that comes up during character creation
- Explain why certain choices are mechanically strong or weak given the character so far
- Point out synergies between class, race, background, and ability scores
- Describe the character as it's being built — give it personality and flavor when asked
- Gently steer away from choices that will frustrate a new player (e.g. MAD builds, dump stat mistakes)

Tone:
- Friendly and encouraging, not preachy
- Short answers by default — if the user wants more, they'll ask
- Use D&D flavor naturally, but explain jargon when you use it
- Never tell the user what to pick — explain trade-offs and let them decide

You have the user's current character state in your context. Reference it when answering.`

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

    const { messages, characterState }: { messages: UIMessage[]; characterState?: string } = await req.json()

    const systemPrompt = characterState
      ? `${COMPANION_SYSTEM_PROMPT}\n\n---\nCurrent character state:\n${characterState}`
      : COMPANION_SYSTEM_PROMPT

    const prompt = await convertToModelMessages(messages)

    const result = streamText({
      model: AI_MODEL,
      system: systemPrompt,
      prompt,
      abortSignal: req.signal,
    })

    return result.toUIMessageStreamResponse({
      onFinish: async ({ isAborted }) => { void isAborted },
      consumeSseStream: consumeStream,
    })
  } catch (error) {
    console.error("[FeyForge] Character companion error:", error)
    return NextResponse.json({ error: "Failed to start character companion" }, { status: 500 })
  }
}
