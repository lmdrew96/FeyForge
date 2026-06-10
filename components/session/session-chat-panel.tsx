"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { MessagesSquare, X, Send, ChevronDown, Lock, Shield } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSessionChatStore } from "@/lib/session-chat-store"

// In-session chat panel. Same surface idiom as the DM Assistant
// (components/dm-assistant/dm-assistant-widget): a fixed z-[70] panel — near-full
// sheet on mobile, right-side panel on desktop — toggled by a launcher in the
// AppShell chrome. Unlike the assistant this is real human↔human messaging over
// Convex (api.sessionChat): a shared group channel plus optional private 1:1
// whispers. The launcher + open state live in AppShell; this is purely the panel.
export function SessionChatPanel({
  sessionId,
  myUserId,
  onClose,
}: {
  sessionId: Id<"partySessions">
  myUserId: string
  onClose: () => void
}) {
  const messages = useQuery(api.sessionChat.listMessages, { sessionId })
  const participants = useQuery(api.sessionChat.listParticipants, { sessionId })
  const send = useMutation(api.sessionChat.send)
  const markSeen = useSessionChatStore((s) => s.markSeen)

  const [input, setInput] = useState("")
  const [recipientId, setRecipientId] = useState<string | null>(null) // null = group
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const recipient = useMemo(
    () => participants?.find((p) => p.userId === recipientId) ?? null,
    [participants, recipientId],
  )

  // If the chosen whisper target leaves the session, fall back to the group.
  useEffect(() => {
    if (recipientId && participants && !participants.some((p) => p.userId === recipientId)) {
      setRecipientId(null)
    }
  }, [participants, recipientId])

  // Mark everything visible as read while the panel is open (clears the launcher
  // badge); newest message drives the high-water mark.
  useEffect(() => {
    if (messages && messages.length > 0) {
      markSeen(sessionId, messages[messages.length - 1].createdAt)
    }
  }, [messages, sessionId, markSeen])

  // Stick to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const submit = async () => {
    const body = input.trim()
    if (!body || sending) return
    setSending(true)
    try {
      await send({ sessionId, body, recipientUserId: recipientId ?? undefined })
      setInput("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the message.")
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit()
  }

  return (
    <div
      className="fixed z-[70] flex flex-col overflow-hidden rounded-xl shadow-2xl inset-x-2 top-14 bottom-16 md:inset-auto md:bottom-6 md:right-6 md:left-auto md:top-auto md:h-[640px] md:max-h-[80vh] md:w-[400px]"
      style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
      role="dialog"
      aria-label="Session chat"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-2 border-b px-3 py-2.5"
        style={{ borderColor: "var(--scene-border)", background: "var(--scene-surface)" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <MessagesSquare className="h-4 w-4 shrink-0" style={{ color: "var(--scene-accent)" }} />
          <p className="truncate text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>
            Session chat
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close chat"
          className="rounded-md p-1.5 transition-colors hover:bg-[var(--scene-bg)]"
          style={{ color: "var(--scene-text-muted)" }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {messages === undefined ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: "var(--scene-surface)" }} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="pt-10 text-center text-sm" style={{ color: "var(--scene-text-muted)" }}>
            No messages yet. Say hello to the party.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <MessageRow key={m._id} message={m} mine={m.senderUserId === myUserId} />
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t px-3 py-2.5" style={{ borderColor: "var(--scene-border)", background: "var(--scene-bg)" }}>
        {/* To: recipient picker — group by default, optional 1:1 whisper */}
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
            To
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                style={{
                  background: recipient ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)" : "var(--scene-surface)",
                  color: recipient ? "var(--scene-accent)" : "var(--scene-text-primary)",
                  border: "1px solid var(--scene-border)",
                }}
              >
                {recipient ? <Lock className="h-3 w-3" /> : null}
                {recipient ? `${recipient.name}${recipient.isDm ? " (DM)" : ""}` : "Everyone"}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
              <DropdownMenuItem onSelect={() => setRecipientId(null)} className="cursor-pointer">
                <span className="flex-1">Everyone</span>
                {recipientId === null && <span style={{ color: "var(--scene-accent)" }}>✓</span>}
              </DropdownMenuItem>
              {(participants ?? []).map((p) => (
                <DropdownMenuItem key={p.userId} onSelect={() => setRecipientId(p.userId)} className="cursor-pointer">
                  {p.isDm && <Shield className="mr-1.5 h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />}
                  <span className="flex-1 truncate">{p.name}{p.isDm ? " (DM)" : ""}</span>
                  {recipientId === p.userId && <span style={{ color: "var(--scene-accent)" }}>✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {recipient && (
            <span className="text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
              private
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void submit()
              }
            }}
            rows={1}
            placeholder={recipient ? `Whisper to ${recipient.name}…` : "Message the party…"}
            className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Send"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

function MessageRow({
  message,
  mine,
}: {
  message: {
    senderName: string
    body: string
    recipientUserId?: string
    recipientName?: string
  }
  mine: boolean
}) {
  const isPrivate = !!message.recipientUserId

  if (mine) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div
          className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm px-3.5 py-2 text-sm"
          style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
        >
          {message.body}
        </div>
        {isPrivate && (
          <span className="flex items-center gap-1 px-1 text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
            <Lock className="h-2.5 w-2.5" /> private to {message.recipientName}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="flex items-center gap-1 px-1 text-[11px] font-medium" style={{ color: "var(--scene-text-muted)" }}>
        {message.senderName}
        {isPrivate && (
          <>
            <Lock className="h-2.5 w-2.5" /> whispers to you
          </>
        )}
      </span>
      <div
        className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm"
        style={{
          background: "var(--scene-surface)",
          border: isPrivate
            ? "1px dashed color-mix(in srgb, var(--scene-accent) 50%, var(--scene-border))"
            : "1px solid var(--scene-border)",
          color: "var(--scene-text-primary)",
        }}
      >
        {message.body}
      </div>
    </div>
  )
}
