"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { useDMAssistantStore, type Conversation } from "@/lib/dm-assistant-store"
import { ChatPanel } from "@/components/dm-assistant/chat-panel"
import { useDMAssistantContext } from "@/components/dm-assistant/use-assistant-context"
import {
  Plus,
  Trash2,
  Sparkles,
  MessageSquarePlus,
  Bot,
} from "lucide-react"

export default function DMAssistantPage() {
  // Campaign + world + live-session grounding, shared with the floating widget.
  const { activeCampaignId, activeCampaign, campaignContext } = useDMAssistantContext()

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
                campaignContext={campaignContext}
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
