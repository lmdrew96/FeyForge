"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useCampaignStore } from "@/lib/campaign-store"
import { useDMAssistantStore } from "@/lib/dm-assistant-store"
import { ChatPanel } from "@/components/dm-assistant/chat-panel"
import { useDMAssistantContext } from "@/components/dm-assistant/use-assistant-context"
import { Bot, Plus, X } from "lucide-react"

// ---------------------------------------------------------------------------
// Global floating DM Assistant.
//
// A collapsed launcher present on every APP page (it's mounted inside AppShell,
// which the auth/marketing pages don't use, so they're excluded for free). It
// expands into the SAME chat the /dm/assistant page uses — same route, same
// shared conversation store, same grounding hook — so a DM mid-session can ask
// for help on the world map, combat tracker, or a character sheet without
// leaving the moment.
//
// GATE (load-bearing): render ONLY when the signed-in user is the DM (role ===
// "dm") of their ACTIVE campaign. Player in the active campaign → hidden; DM of
// another campaign but the active one is one they play in → hidden; no active
// campaign → hidden. Also suppressed on the full /dm/assistant page (redundant
// there).
//
// ND-design: collapsed by default, dismissible, no nag/auto-open/animation,
// thumb-reachable, and on mobile it expands to a near-full sheet rather than a
// cramped corner box. It never blocks content while collapsed.
// ---------------------------------------------------------------------------

export function DMAssistantWidget() {
  const pathname = usePathname()
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const role = useQuery(
    api.campaignMembers.getMyRole,
    activeCampaignId ? { campaignId: activeCampaignId as Id<"campaigns"> } : "skip",
  )
  const [open, setOpen] = useState(false)

  const isDmOfActive = role === "dm" && !!activeCampaignId
  const onFullAssistant = pathname === "/dm/assistant"

  // Collapse if the gate stops holding (e.g. the DM switches to a campaign they
  // only play in) so the panel can't linger out of context.
  useEffect(() => {
    if (!isDmOfActive || onFullAssistant) setOpen(false)
  }, [isDmOfActive, onFullAssistant])

  if (!isDmOfActive || onFullAssistant) return null

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open DM Assistant"
        className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 bottom-[calc(3.5rem+1rem+env(safe-area-inset-bottom))] right-4 md:bottom-6 md:right-6"
        style={{ background: "var(--scene-accent)", color: "#fff" }}
      >
        <Bot className="h-6 w-6" />
      </button>
    )
  }

  return <WidgetPanel campaignId={activeCampaignId} onClose={() => setOpen(false)} />
}

function WidgetPanel({
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
