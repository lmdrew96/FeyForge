"use client"

import { useState, useMemo, useRef, useEffect, type FormEvent } from "react"
import Link from "next/link"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { formatWorldContext, formatSessionState } from "@/lib/worldMap/ai-context"
import { AppShell } from "@/components/app-shell"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useCampaignStore } from "@/lib/campaign-store"
import {
  useDMAssistantStore,
  type Conversation,
  type Message,
} from "@/lib/dm-assistant-store"
import {
  Plus,
  Send,
  Square,
  Trash2,
  Sparkles,
  MessageSquarePlus,
  Bot,
  Scroll,
  Swords,
  Coins,
  Wand2,
  AlertCircle,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Message format bridging
// useChat speaks AI SDK v5 `UIMessage` (role + parts[]); the store/Convex
// persist flat `{ id, role, content, timestamp }`. Convert at the boundary.
// ---------------------------------------------------------------------------

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

export default function DMAssistantPage() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const campaigns = useQuery(api.campaigns.list)
  const activeCampaign = useMemo(
    () => campaigns?.find((c) => c._id === activeCampaignId) ?? null,
    [campaigns, activeCampaignId],
  )

  // World context for the assistant: the map's realms/faiths/events/settlements so
  // answers stay consistent with the DM's actual world (see lib/worldMap/ai-context).
  const campaignArg = activeCampaignId ? { campaignId: activeCampaignId as Id<"campaigns"> } : "skip"
  const worldMap = useQuery(api.worldMap.getMap, campaignArg)
  const worldLocations = useQuery(api.worldMap.listLocations, campaignArg)
  const worldbuilding = useQuery(api.worldMap.getWorldbuilding, campaignArg)
  const worldContext = useMemo(
    () =>
      formatWorldContext({
        mapName: worldMap?.name,
        realms: worldbuilding?.realms,
        faiths: worldbuilding?.faiths,
        worldEvents: worldMap?.worldEvents,
        settlements: worldLocations,
      }),
    [worldMap, worldbuilding, worldLocations],
  )

  // Live session awareness: when a session is running, also feed the assistant the
  // NOW — active scene, the live fight (whose turn/round/HP/conditions), and the
  // party roster. All three reads are membership-gated; the DM here is a member, so
  // getCombat returns exact HP. Skip the session-scoped reads until a session exists.
  const activeSession = useQuery(api.liveSessions.getActiveSession, campaignArg)
  const sessionArg = activeSession?._id
    ? { sessionId: activeSession._id }
    : "skip"
  const liveCombat = useQuery(api.liveCombat.getCombat, sessionArg)
  const partyMembers = useQuery(api.liveSessions.getPartyMembers, sessionArg)
  const sessionContext = useMemo(
    () =>
      formatSessionState({
        sceneName: activeSession?.activeScene,
        sceneTime: activeSession?.sceneTime ?? null,
        combat: liveCombat
          ? { round: liveCombat.round, combatants: liveCombat.combatants }
          : null,
        party: (partyMembers ?? []).map((m) => ({
          name: m.character?.name ?? "Unknown",
          characterClass: m.character?.characterClass,
          subclass: m.character?.subclass,
          level: m.character?.level,
          hitPoints: m.character?.hitPoints,
          conditions: m.conditions,
        })),
      }),
    [activeSession, liveCombat, partyMembers],
  )

  const conversations = useDMAssistantStore((s) => s.conversations)
  const activeConversationId = useDMAssistantStore((s) => s.activeConversationId)
  const setActiveConversation = useDMAssistantStore((s) => s.setActiveConversation)
  const createConversation = useDMAssistantStore((s) => s.createConversation)
  const deleteConversation = useDMAssistantStore((s) => s.deleteConversation)

  const [creating, setCreating] = useState(false)

  const campaignConversations = useMemo(
    () =>
      conversations
        .filter((c) => c.campaignId === activeCampaignId)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
    [conversations, activeCampaignId],
  )

  const activeConversation = useMemo(
    () => campaignConversations.find((c) => c.id === activeConversationId) ?? null,
    [campaignConversations, activeConversationId],
  )

  // Keep the active selection valid for the current campaign.
  useEffect(() => {
    if (!activeCampaignId) return
    if (activeConversation) return
    setActiveConversation(campaignConversations[0]?.id ?? null)
  }, [activeCampaignId, activeConversation, campaignConversations, setActiveConversation])

  const handleNewChat = async () => {
    if (!activeCampaignId || creating) return
    setCreating(true)
    try {
      await createConversation(activeCampaignId)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteConversation(id)
  }

  // ---- No campaign selected -------------------------------------------------
  if (!activeCampaignId || !activeCampaign) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div
            className="max-w-md rounded-xl p-8 text-center"
            style={{
              background: "var(--scene-surface)",
              border: "1px solid var(--scene-border)",
            }}
          >
            <Bot
              className="mx-auto mb-4 h-10 w-10"
              style={{ color: "var(--scene-accent)" }}
            />
            <h1
              className="mb-2 text-xl font-bold"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "var(--scene-text-primary)",
              }}
            >
              DM Assistant
            </h1>
            <p className="mb-6 text-sm" style={{ color: "var(--scene-text-muted)" }}>
              Select an active campaign to start a conversation. The assistant uses
              your campaign as context for rules, encounters, and loot.
            </p>
            <Link
              href="/campaigns"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{ background: "var(--scene-accent)", color: "#fff" }}
            >
              Choose a campaign
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex h-[100dvh] flex-col lg:h-screen">
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6"
          style={{ borderColor: "var(--scene-border)" }}
        >
          <div className="min-w-0">
            <h1
              className="flex items-center gap-2 text-lg font-bold sm:text-xl"
              style={{
                fontFamily: "var(--font-cinzel)",
                color: "var(--scene-text-primary)",
              }}
            >
              <Sparkles className="h-5 w-5 shrink-0" style={{ color: "var(--scene-accent)" }} />
              DM Assistant
            </h1>
            <p className="truncate text-xs" style={{ color: "var(--scene-text-muted)" }}>
              {activeCampaign.name}
            </p>
          </div>
          <Button onClick={handleNewChat} disabled={creating} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Chat</span>
          </Button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Sidebar: conversation list */}
          <aside
            className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r md:flex"
            style={{ borderColor: "var(--scene-border)", background: "var(--scene-bg)" }}
          >
            {campaignConversations.length === 0 ? (
              <p
                className="p-4 text-xs"
                style={{ color: "var(--scene-text-muted)" }}
              >
                No conversations yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-1 p-2">
                {campaignConversations.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conversation={c}
                    active={c.id === activeConversationId}
                    onSelect={() => setActiveConversation(c.id)}
                    onDelete={() => handleDelete(c.id)}
                  />
                ))}
              </ul>
            )}
          </aside>

          {/* Chat area */}
          <main className="flex min-h-0 flex-1 flex-col">
            {activeConversation ? (
              <ChatPanel
                key={activeConversation.id}
                conversation={activeConversation}
                campaignContext={buildContext(activeCampaign, worldContext, sessionContext)}
              />
            ) : (
              <EmptyConversationState onNewChat={handleNewChat} creating={creating} />
            )}
          </main>
        </div>
      </div>
    </AppShell>
  )
}

// ---------------------------------------------------------------------------

const buildContext = (
  campaign: {
    name: string
    description?: string
    edition?: string
  } | null,
  worldContext = "",
  sessionContext = "",
): string => {
  // Both world + session blocks already lead with their own blank-line separator
  // (or are ""), so they concatenate cleanly onto the campaign header.
  if (!campaign) return (worldContext + sessionContext).trim()
  const lines = [`Campaign: ${campaign.name}`]
  if (campaign.edition) lines.push(`D&D edition: ${campaign.edition}`)
  if (campaign.description) lines.push(`Description: ${campaign.description}`)
  return lines.join("\n") + worldContext + sessionContext
}

function ConversationRow({
  conversation,
  active,
  onSelect,
  onDelete,
}: {
  conversation: Conversation
  active: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <li className="group relative">
      <button
        onClick={onSelect}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors"
        style={{
          background: active ? "var(--scene-surface-hover)" : "transparent",
          color: active ? "var(--scene-text-primary)" : "var(--scene-text-secondary)",
        }}
      >
        <MessageSquarePlus className="h-4 w-4 shrink-0 opacity-60" />
        <span className="truncate pr-6">{conversation.title}</span>
      </button>
      <button
        onClick={onDelete}
        aria-label="Delete conversation"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 transition-opacity hover:bg-black/10 group-hover:opacity-100"
        style={{ color: "var(--scene-text-muted)" }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

function EmptyConversationState({
  onNewChat,
  creating,
}: {
  onNewChat: () => void
  creating: boolean
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md text-center">
        <Bot
          className="mx-auto mb-4 h-12 w-12"
          style={{ color: "var(--scene-accent)" }}
        />
        <h2
          className="mb-2 text-lg font-bold"
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "var(--scene-text-primary)",
          }}
        >
          Your DM co-pilot
        </h2>
        <p className="mb-6 text-sm" style={{ color: "var(--scene-text-muted)" }}>
          Ask about rules, design balanced encounters, generate loot, or
          improvise NPCs on the fly. Start a chat to begin.
        </p>
        <Button onClick={onNewChat} disabled={creating} className="gap-2">
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function ChatPanel({
  conversation,
  campaignContext,
}: {
  conversation: Conversation
  campaignContext: string
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
        className="border-t px-4 py-3 pb-20 sm:px-6 md:pb-3"
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
