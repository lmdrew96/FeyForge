"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "convex/react"
import { Bell, UserPlus, UserCheck, BookMarked, Sparkles, Check } from "lucide-react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useCampaignStore } from "@/lib/campaign-store"

type NotificationDoc = {
  _id: Id<"notifications">
  type: string
  payload: {
    fromName?: string
    fromAvatarUrl?: string
    campaignId?: Id<"campaigns">
    campaignName?: string
  }
  readAt?: number
  createdAt: number
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}

function describe(n: NotificationDoc): string {
  const who = n.payload.fromName ?? "Someone"
  switch (n.type) {
    case "friend_request":
      return `${who} sent you a friend request`
    case "friend_accepted":
      return `${who} accepted your friend request`
    case "campaign_invite":
      return `${who} added you to ${n.payload.campaignName ?? "a campaign"}`
    case "session_invite":
      return `${who} invited you to join their live session`
    default:
      return "New notification"
  }
}

function iconFor(type: string) {
  switch (type) {
    case "friend_request":
      return UserPlus
    case "friend_accepted":
      return UserCheck
    case "campaign_invite":
      return BookMarked
    case "session_invite":
      return Sparkles
    default:
      return Bell
  }
}

// Reactive notification bell for the app-shell chrome. `align` controls which
// edge the dropdown anchors to: "left" opens rightward (desktop sidebar), "right"
// opens leftward (mobile top bar).
export function NotificationBell({ align = "right" }: { align?: "left" | "right" }) {
  const router = useRouter()
  const notifications = useQuery(api.notifications.list) as
    | NotificationDoc[]
    | undefined
  const unread = useQuery(api.notifications.unreadCount) ?? 0
  const markRead = useMutation(api.notifications.markRead)
  const markAllRead = useMutation(api.notifications.markAllRead)
  const setActiveCampaign = useCampaignStore((s) => s.setActiveCampaign)

  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // The panel is portaled to <body> (fixed) so it escapes the sidebar/top-bar
  // stacking context. An in-flow dropdown painted BEHIND page content: it lived
  // inside the aside's z-10, the same layer as <main> but earlier in the DOM.
  const [coords, setCoords] = useState<{
    top: number
    left?: number
    right?: number
  } | null>(null)

  const updateCoords = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCoords(
      align === "left"
        ? { top: rect.bottom + 8, left: rect.left }
        : { top: rect.bottom + 8, right: window.innerWidth - rect.right },
    )
  }, [align])

  // Measure on open, and keep the panel pinned to the trigger while open.
  useEffect(() => {
    if (!open) return
    updateCoords()
    window.addEventListener("resize", updateCoords)
    window.addEventListener("scroll", updateCoords, true)
    return () => {
      window.removeEventListener("resize", updateCoords)
      window.removeEventListener("scroll", updateCoords, true)
    }
  }, [open, updateCoords])

  // Close on outside click. The panel is portaled out of this subtree, so dismiss
  // only when the click misses BOTH the trigger and the panel.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  const handleClick = (n: NotificationDoc) => {
    void markRead({ id: n._id })
    setOpen(false)
    if (
      (n.type === "campaign_invite" || n.type === "session_invite") &&
      n.payload.campaignId
    ) {
      setActiveCampaign(n.payload.campaignId as string)
      // A session invite is "come play now" → drop them at the live session.
      router.push(n.type === "session_invite" ? "/session" : "/hub")
    } else {
      router.push("/friends")
    }
  }

  const badge = unread > 0 ? (unread >= 50 ? "50+" : String(unread)) : null

  return (
    <div ref={triggerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative p-2 rounded-md hover:bg-[var(--scene-bg)]"
        style={{ color: open ? "var(--scene-accent)" : "var(--scene-text-muted)" }}
      >
        <Bell className="w-5 h-5" />
        {badge && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full text-[10px] font-semibold leading-none"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
          >
            {badge}
          </span>
        )}
      </button>

      {open && coords && typeof document !== "undefined" &&
        createPortal(
        <div
          ref={panelRef}
          className="fixed w-80 max-w-[calc(100vw-1rem)] max-h-96 overflow-y-auto rounded-md shadow-lg z-[100]"
          style={{
            top: coords.top,
            left: coords.left,
            right: coords.right,
            background: "var(--scene-surface)",
            border: "1px solid var(--scene-border)",
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 sticky top-0"
            style={{
              background: "var(--scene-surface)",
              borderBottom: "1px solid var(--scene-border)",
            }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--scene-text-primary)" }}
            >
              Notifications
            </span>
            {unread > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="flex items-center gap-1 text-xs hover:opacity-80"
                style={{ color: "var(--scene-accent)" }}
              >
                <Check className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {notifications === undefined ? (
            <div
              className="px-3 py-6 text-center text-xs"
              style={{ color: "var(--scene-text-muted)" }}
            >
              Loading…
            </div>
          ) : notifications.length === 0 ? (
            <div
              className="px-3 py-8 text-center text-xs"
              style={{ color: "var(--scene-text-muted)" }}
            >
              You're all caught up.
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = iconFor(n.type)
              const isUnread = n.readAt === undefined
              return (
                <button
                  key={n._id}
                  onClick={() => handleClick(n)}
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--scene-bg)] transition-colors"
                  style={{
                    background: isUnread
                      ? "color-mix(in srgb, var(--scene-accent) 8%, transparent)"
                      : undefined,
                    borderBottom: "1px solid var(--scene-border)",
                  }}
                >
                  {n.payload.fromAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={n.payload.fromAvatarUrl}
                      alt=""
                      className="w-7 h-7 rounded-full shrink-0 object-cover mt-0.5"
                    />
                  ) : (
                    <span
                      className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-0.5"
                      style={{
                        background: "color-mix(in srgb, var(--scene-accent) 16%, transparent)",
                        color: "var(--scene-accent)",
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span
                      className="block text-xs leading-snug"
                      style={{ color: "var(--scene-text-primary)" }}
                    >
                      {describe(n)}
                    </span>
                    <span
                      className="block text-[10px] mt-0.5"
                      style={{ color: "var(--scene-text-muted)" }}
                    >
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                  {isUnread && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                      style={{ background: "var(--scene-accent)" }}
                    />
                  )}
                </button>
              )
            })
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
