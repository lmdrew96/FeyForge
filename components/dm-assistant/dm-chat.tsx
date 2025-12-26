"use client"

import type React from "react"

import { useState, useRef, useEffect, useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Send, Loader2, Sparkles, Sword, Map, Users, BookOpen, Dices, Trash2 } from "lucide-react"
import ReactMarkdown from "react-markdown"

const QUICK_PROMPTS = [
  {
    icon: Sword,
    label: "Combat Help",
    prompt: "Help me design a balanced combat encounter for a party of 4 level 5 adventurers",
  },
  {
    icon: Users,
    label: "NPC Roleplay",
    prompt: "Give me tips for roleplaying a suspicious tavern keeper who knows more than they let on",
  },
  {
    icon: Map,
    label: "Location",
    prompt: "Describe an interesting location for my party to explore - make it mysterious and full of potential",
  },
  {
    icon: BookOpen,
    label: "Rules",
    prompt: "Explain how grappling works in D&D 5e, including all the relevant rules",
  },
  {
    icon: Dices,
    label: "Random Event",
    prompt: "Generate a random interesting event that could happen during travel through a forest",
  },
]

interface DmChatProps {
  campaignContext?: string
}

export function DmChat({ campaignContext }: DmChatProps) {
  const [inputValue, setInputValue] = useState("")
  const [hasUsedInitialPrompt, setHasUsedInitialPrompt] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const contextRef = useRef(campaignContext)
  contextRef.current = campaignContext

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/dm-assistant",
        body: () => ({ context: contextRef.current }),
      }),
    [],
  )

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
  })

  const isLoading = status === "streaming" || status === "submitted"

  useEffect(() => {
    if (hasUsedInitialPrompt || isLoading) return

    const params = new URLSearchParams(window.location.search)
    const initialPrompt = params.get("prompt")

    if (initialPrompt) {
      setHasUsedInitialPrompt(true)
      sendMessage({ text: initialPrompt })
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [hasUsedInitialPrompt, isLoading, sendMessage])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    sendMessage({ text: inputValue })
    setInputValue("")
  }

  const handleQuickPrompt = (prompt: string) => {
    if (isLoading) return
    sendMessage({ text: prompt })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  return (
    <div className="flex h-full flex-col min-h-0">
      {/* Chat Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="mb-2 text-xl font-semibold text-foreground">DM Assistant</h3>
              <p className="max-w-md text-muted-foreground">
                Your AI-powered Dungeon Master helper. Ask about rules, get encounter ideas, generate content, or get
                help with any aspect of running your game.
              </p>
            </div>

            {/* Quick Prompts */}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {QUICK_PROMPTS.map((item) => (
                <Button
                  key={item.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickPrompt(item.prompt)}
                  className="gap-2 border-border/50 bg-card/50 hover:bg-card"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg p-4 ${
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                  }`}
                >
                  {message.role === "assistant" && (
                    <Badge variant="outline" className="mb-2 border-primary/30 text-primary">
                      <Sparkles className="mr-1 h-3 w-3" />
                      DM Assistant
                    </Badge>
                  )}
                  <div className="prose prose-sm max-w-none break-words overflow-hidden">
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        return (
                          <ReactMarkdown 
                            key={index}
                            components={{
                              pre: ({node, ...props}) => <pre className="overflow-x-auto" {...props} />,
                              code: ({node, ...props}) => <code className="break-all" {...props} />,
                            }}
                          >
                            {part.text}
                          </ReactMarkdown>
                        )
                      }
                      return null
                    })}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Consulting the ancient tomes...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border bg-card/50 p-4">
        {messages.length > 0 && (
          <div className="mb-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Clear Chat
            </Button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about rules, encounters, NPCs, or anything else..."
            className="min-h-[60px] flex-1 resize-none border-border/50 bg-background"
            disabled={isLoading}
          />
          <Button type="submit" disabled={!inputValue.trim() || isLoading} className="self-end">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  )
}
