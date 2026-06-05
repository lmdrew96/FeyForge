"use client"

import { useState, useMemo, useRef, useEffect, type FormEvent } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { toast } from "sonner"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { Button } from "@/components/ui/button"
import {
  useDMAssistantStore,
  type Conversation,
  type Message,
} from "@/lib/dm-assistant-store"
import {
  Send,
  Square,
  Bot,
  Scroll,
  Swords,
  Coins,
  Wand2,
  AlertCircle,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Shared DM Assistant chat surface.
//
// This is the ONE chat panel mounted by BOTH the full /dm/assistant page and the
// global floating widget (components/dm-assistant/dm-assistant-widget). Both pass
// the same campaignContext (built by useDMAssistantContext) and a conversation
// from the shared dm-assistant store, so a thread continues seamlessly across the
// two entry points. Keep this component free of page-vs-widget chrome — it's just
// the message list + composer.
// ---------------------------------------------------------------------------

// useChat speaks AI SDK v5 `UIMessage` (role + parts[]); the store/Convex persist
// flat `{ id, role, content, timestamp }`. Convert at the boundary.

const extractText = (message: UIMessage): string =>
  message.parts.map((p) => (p.type === "text" ? p.text : "")).join("")

const storedToUI = (m: Message): UIMessage => ({
  id: m.id,
  role: m.role,
  parts: [{ type: "text" as const, text: m.content }],
})

const uiToStored = (m: UIMessage): Message | null => {
  if (m.role !== "user" && m.role !== "assistant") return null
  return {
    id: m.id,
    role: m.role,
    content: extractText(m),
    timestamp: new Date().toISOString(),
  }
}

const SUGGESTED_PROMPTS: { icon: typeof Scroll; label: string; prompt: string }[] = [
  {
    icon: Scroll,
    label: "Explain a rule",
    prompt: "How does the grappling rule work in D&D 5e? Walk me through the steps.",
  },
  {
    icon: Swords,
    label: "Build an encounter",
    prompt:
      "Build a balanced combat encounter for a party of four level-3 adventurers in a forest. Suggest monsters and tactics.",
  },
  {
    icon: Coins,
    label: "Generate loot",
    prompt:
      "Generate a themed loot hoard for a defeated bandit captain — mix of coins, a useful magic item, and something with story hooks.",
  },
  {
    icon: Wand2,
    label: "Improvise an NPC",
    prompt:
      "Give me a memorable tavern keeper NPC: name, personality, a secret, and a plot hook they could drop.",
  },
]

export function ChatPanel({
  conversation,
  campaignContext,
  // The full page sits inside AppShell, so its composer needs bottom padding to
  // clear the mobile bottom nav (the default). The floating widget owns its own
  // bottom edge, so it passes a compact variant.
  composerClassName = "border-t px-4 py-3 pb-20 sm:px-6 md:pb-3",
}: {
  conversation: Conversation
  campaignContext: string
  composerClassName?: string
}) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const dirtyRef = useRef(false)

  // Seed once per conversation mount; the component is keyed by id, so the
  // conversation never changes within a given ChatPanel instance.
  const initialMessages = useMemo(() => conversation.messages.map(storedToUI), [
    conversation.messages,
  ])

  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    id: conversation.id,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/dm-assistant" }),
    // The premium AI guard rejects (429/503/401) BEFORE the stream starts, so the
    // error surfaces here rather than mid-stream. Substring-match the body since
    // the SDK doesn't hand us a parsed payload.
    onError: (err) => {
      const raw = err?.message ?? ""
      let msg = "The DM Assistant hit a snag — try again."
      let offerUpgrade = false
      if (raw.includes("quota_exceeded")) {
        const premium = raw.includes('"isPremium":true')
        msg = premium
          ? "You've used today's AI generations — resets tomorrow."
          : "You've used your free AI generations for today."
        offerUpgrade = !premium
      } else if (raw.includes("ai_unavailable")) {
        msg = "AI is briefly unavailable — try again in a moment."
      } else if (raw.includes("Unauthorized")) {
        msg = "Please sign in to use the DM Assistant."
      }
      toast.error(
        msg,
        offerUpgrade
          ? { action: { label: "Upgrade", onClick: () => window.location.assign("/account") } }
          : undefined,
      )
    },
  })

  // Persist once per completed streamed turn (not on initial mount).
  useEffect(() => {
    if (status === "streaming" || status === "submitted") {
      dirtyRef.current = true
      return
    }
    if (status === "ready" && dirtyRef.current) {
      dirtyRef.current = false
      const flat = messages
        .map(uiToStored)
        .filter((m): m is Message => m !== null && m.content.length > 0)
      if (flat.length > 0) {
        void useDMAssistantStore.getState().commitMessages(conversation.id, flat)
      }
    }
  }, [status, messages, conversation.id])

  // Auto-scroll to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, status])

  const busy = status === "submitted" || status === "streaming"

  const submit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    sendMessage({ text: trimmed }, { body: { context: campaignContext } })
    setInput("")
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit(input)
  }

  return (
    <>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {messages.length === 0 && (
            <div className="pt-6">
              <p
                className="mb-4 text-center text-sm"
                style={{ color: "var(--scene-text-muted)" }}
              >
                Try one of these, or ask anything:
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTED_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                  <button
                    key={label}
                    onClick={() => submit(prompt)}
                    className="flex items-start gap-3 rounded-lg p-3 text-left text-sm transition-colors hover:opacity-90"
                    style={{
                      background: "var(--scene-surface)",
                      border: "1px solid var(--scene-border)",
                      color: "var(--scene-text-secondary)",
                    }}
                  >
                    <Icon
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: "var(--scene-accent)" }}
                    />
                    <span>
                      <span
                        className="block font-medium"
                        style={{ color: "var(--scene-text-primary)" }}
                      >
                        {label}
                      </span>
                      <span className="text-xs">{prompt}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {status === "submitted" && <ThinkingBubble />}

          {error && (
            <div
              className="flex items-center justify-between gap-3 rounded-lg p-3 text-sm"
              style={{
                background: "var(--scene-surface)",
                border: "1px solid #b91c1c",
                color: "var(--scene-text-secondary)",
              }}
            >
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" style={{ color: "#ef4444" }} />
                Something went wrong generating a response.
              </span>
              <button
                onClick={() => regenerate()}
                className="shrink-0 font-medium underline"
                style={{ color: "var(--scene-accent)" }}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div
        className={composerClassName}
        style={{ borderColor: "var(--scene-border)", background: "var(--scene-bg)" }}
      >
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                submit(input)
              }
            }}
            rows={1}
            placeholder="Ask your DM assistant…"
            className="max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{
              background: "var(--scene-surface)",
              border: "1px solid var(--scene-border)",
              color: "var(--scene-text-primary)",
            }}
          />
          {busy ? (
            <Button type="button" variant="secondary" onClick={() => stop()} className="h-11 gap-2">
              <Square className="h-4 w-4" />
              <span className="hidden sm:inline">Stop</span>
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()} className="h-11 gap-2">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          )}
        </form>
      </div>
    </>
  )
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user"
  const text = extractText(message)

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm px-4 py-2.5 text-sm"
          style={{ background: "var(--scene-accent)", color: "#fff" }}
        >
          {text}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <Bot className="h-4 w-4" style={{ color: "var(--scene-accent)" }} />
      </div>
      <div
        className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm"
        style={{
          background: "var(--scene-surface)",
          border: "1px solid var(--scene-border)",
          color: "var(--scene-text-primary)",
        }}
      >
        {text ? (
          <MarkdownRenderer content={text} variant="scene" />
        ) : (
          <span className="opacity-60">…</span>
        )}
      </div>
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div className="flex gap-3">
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <Bot className="h-4 w-4" style={{ color: "var(--scene-accent)" }} />
      </div>
      <div
        className="flex items-center gap-1 rounded-2xl rounded-tl-sm px-4 py-3"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <span className="h-2 w-2 animate-bounce rounded-full [animation-delay:-0.3s]" style={{ background: "var(--scene-text-muted)" }} />
        <span className="h-2 w-2 animate-bounce rounded-full [animation-delay:-0.15s]" style={{ background: "var(--scene-text-muted)" }} />
        <span className="h-2 w-2 animate-bounce rounded-full" style={{ background: "var(--scene-text-muted)" }} />
      </div>
    </div>
  )
}
