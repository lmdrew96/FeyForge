"use client"

import { useEffect, useMemo, useRef } from "react"
import { useDMAssistantStore } from "@/lib/dm-assistant-store"
import { ChatPanel } from "@/components/dm-assistant/chat-panel"
import { useDMAssistantContext } from "@/components/dm-assistant/use-assistant-context"
import { Bot, Plus, X } from "lucide-react"

// ---------------------------------------------------------------------------
// DM Assistant panel.
//
// The expanded chat surface for the global DM Assistant. Its LAUNCHER lives in
// the app-shell chrome (mobile top bar + desktop sidebar) — see
// components/app-shell.tsx, which owns the open/close state, the
// DM-of-active-campaign gate (hidden for players / no active campaign /
// suppressed on the full /dm/assistant page), and the ⌘K toggle. Docking the
// launcher into reserved chrome (rather than floating a FAB) means it can never
// occlude page content — the map pins, the class grid, etc.
//
// This component is purely the panel that renders when the launcher is open. It
// expands into the SAME chat the /dm/assistant page uses — same shared
// conversation store, same grounding hook — so a DM mid-session can ask for
// help on the world map, combat tracker, or a character sheet without leaving
// the moment. Mobile = near-full sheet; desktop = right-side panel. The chat
// itself (ChatPanel) is unchanged.
// ---------------------------------------------------------------------------

export function DMAssistantPanel({
  campaignId,
  onClose,
}: {
  campaignId: string
  onClose: () => void
}) {
  const { activeCampaign, campaignContext } = useDMAssistantContext()
  const conversations = useDMAssistantStore((s) => s.conversations)
  const activeConversationId = useDMAssistantStore((s) => s.activeConversationId)
  const setActiveConversation = useDMAssistantStore((s) => s.setActiveConversation)
  const createConversation = useDMAssistantStore((s) => s.createConversation)
  const creatingRef = useRef(false)

  const campaignConversations = useMemo(
    () =>
      conversations
        .filter((c) => c.campaignId === campaignId)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
    [conversations, campaignId],
  )

  const activeConversation = useMemo(
    () => campaignConversations.find((c) => c.id === activeConversationId) ?? null,
    [campaignConversations, activeConversationId],
  )

  // Ensure the panel has a thread to mount: reuse the campaign's most recent
  // conversation; only create one when the campaign has none (so opening/closing
  // the widget doesn't spawn empties). createConversation sets it active, so the
  // page picks up the same thread too.
  useEffect(() => {
    if (campaignConversations.length === 0) {
      if (!creatingRef.current) {
        creatingRef.current = true
        void createConversation(campaignId).finally(() => {
          creatingRef.current = false
        })
      }
      return
    }
    if (!campaignConversations.some((c) => c.id === activeConversationId)) {
      setActiveConversation(campaignConversations[0].id)
    }
  }, [campaignConversations, activeConversationId, campaignId, createConversation, setActiveConversation])

  const handleNewChat = () => {
    if (creatingRef.current) return
    creatingRef.current = true
    void createConversation(campaignId).finally(() => {
      creatingRef.current = false
    })
  }

  return (
    <div
      className="fixed z-[70] flex flex-col overflow-hidden rounded-xl shadow-2xl inset-x-2 top-14 bottom-16 md:inset-auto md:bottom-6 md:right-6 md:left-auto md:top-auto md:h-[640px] md:max-h-[80vh] md:w-[400px]"
      style={{
        background: "var(--scene-bg)",
        border: "1px solid var(--scene-border)",
      }}
      role="dialog"
      aria-label="DM Assistant"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-2 border-b px-3 py-2.5"
        style={{ borderColor: "var(--scene-border)", background: "var(--scene-surface)" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Bot className="h-4 w-4 shrink-0" style={{ color: "var(--scene-accent)" }} />
          <div className="min-w-0">
            <p
              className="truncate text-sm font-semibold leading-tight"
              style={{ color: "var(--scene-text-primary)" }}
            >
              DM Assistant
            </p>
            {activeCampaign && (
              <p
                className="truncate text-[11px] leading-tight"
                style={{ color: "var(--scene-text-muted)" }}
              >
                {activeCampaign.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={handleNewChat}
            aria-label="New chat"
            className="rounded-md p-1.5 transition-colors hover:bg-[var(--scene-bg)]"
            style={{ color: "var(--scene-text-muted)" }}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            aria-label="Close DM Assistant"
            className="rounded-md p-1.5 transition-colors hover:bg-[var(--scene-bg)]"
            style={{ color: "var(--scene-text-muted)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chat */}
      {activeConversation ? (
        <ChatPanel
          key={activeConversation.id}
          conversation={activeConversation}
          campaignContext={campaignContext}
          composerClassName="border-t px-3 py-2.5"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-6">
          <span className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
            Starting a chat…
          </span>
        </div>
      )}
    </div>
  )
}
