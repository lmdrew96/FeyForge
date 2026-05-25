"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useEffect, useMemo, useRef, useState } from "react"
import { X, Send, Sparkles } from "lucide-react"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface GuidedCompanionProps {
  characterState: string
}

const TRANSPORT = new DefaultChatTransport({ api: "/api/character/companion" })

const QUICK_PROMPTS = [
  "Is this class good for beginners?",
  "What does my racial bonus affect?",
  "What should I put my 15 into?",
  "Describe my character so far",
]

export function GuidedCompanion({ characterState }: GuidedCompanionProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, status, setMessages } = useChat({ transport: TRANSPORT })

  const isLoading = status === "submitted" || status === "streaming"
  const assistantCount = useMemo(
    () => messages.filter(m => m.role === "assistant").length,
    [messages]
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Reset chat when characterState resets (user restarts)
  const prevStateRef = useRef(characterState)
  useEffect(() => {
    if (characterState === "" && prevStateRef.current !== "") setMessages([])
    prevStateRef.current = characterState
  }, [characterState, setMessages])

  const send = (text: string) => {
    if (!text.trim() || isLoading) return
    void sendMessage({ text }, { body: { characterState } })
    setInput("")
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    send(input)
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:opacity-90 active:scale-95"
        style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
        aria-label="Open character companion"
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-medium hidden sm:block">Ask a question</span>
        {assistantCount > 0 && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold"
            style={{ background: "var(--scene-highlight)", color: "var(--scene-bg)" }}
          >
            {assistantCount}
          </span>
        )}
      </button>

      {/* Chat sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex flex-col p-0 w-full sm:max-w-md"
          style={{
            background: "var(--scene-bg)",
            borderLeft: "1px solid var(--scene-border)",
          }}
        >
          <SheetHeader
            className="px-4 py-4 border-b"
            style={{ borderColor: "var(--scene-border)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: "var(--scene-accent)" }} />
                <SheetTitle
                  className="text-sm font-semibold"
                  style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
                >
                  Character Companion
                </SheetTitle>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="transition-opacity hover:opacity-70"
                style={{ color: "var(--scene-text-muted)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
              Ask anything about your build — rules, synergies, lore.
            </p>
          </SheetHeader>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-2 pt-2">
                {QUICK_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => send(prompt)}
                    disabled={isLoading}
                    className="w-full text-left text-xs px-3 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40"
                    style={{
                      background: "var(--scene-surface)",
                      border: "1px solid var(--scene-border)",
                      color: "var(--scene-text-muted)",
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="flex items-start gap-2 max-w-[90%]">
                    <div
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                      style={{ background: "color-mix(in srgb, var(--scene-accent) 15%, var(--scene-surface))" }}
                    >
                      <Sparkles className="h-3 w-3" style={{ color: "var(--scene-accent)" }} />
                    </div>
                    <div
                      className="rounded-2xl rounded-tl-sm px-3 py-2.5"
                      style={{
                        background: "var(--scene-surface)",
                        border: "1px solid var(--scene-border)",
                      }}
                    >
                      {message.parts.map((part, i) =>
                        part.type === "text" ? (
                          <MarkdownRenderer key={i} content={part.text} />
                        ) : null
                      )}
                    </div>
                  </div>
                )}

                {message.role === "user" && (
                  <div
                    className="max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2.5 text-sm"
                    style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                  >
                    {message.parts.map((part, i) =>
                      part.type === "text" ? <span key={i}>{part.text}</span> : null
                    )}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-2">
                <div
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "color-mix(in srgb, var(--scene-accent) 15%, var(--scene-surface))" }}
                >
                  <Sparkles className="h-3 w-3" style={{ color: "var(--scene-accent)" }} />
                </div>
                <div
                  className="rounded-2xl rounded-tl-sm px-3 py-2.5"
                  style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
                >
                  <div className="flex gap-1 items-center h-5">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{
                          background: "var(--scene-text-muted)",
                          animationDelay: `${i * 0.15}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={onSubmit}
            className="px-4 py-4 border-t flex gap-2"
            style={{ borderColor: "var(--scene-border)" }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your build…"
              className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-transparent outline-none"
              style={{
                border: "1px solid var(--scene-border)",
                color: "var(--scene-text-primary)",
                background: "var(--scene-surface)",
              }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
