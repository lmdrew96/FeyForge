"use client"

import { useRef, useEffect, useState } from "react"
import { Bot, User, Copy, Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { cn } from "@/lib/utils"
import type { Message } from "@/lib/dm-assistant-store"

interface ChatMessagesProps {
  messages: Message[]
  isLoading?: boolean
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  return (
    <div className="space-y-4 pb-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {isLoading && (
        <div className="flex gap-3 items-start">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-fey-cyan/20 flex items-center justify-center">
            <Bot className="h-4 w-4 text-fey-cyan" />
          </div>
          <div className="bg-muted rounded-lg rounded-tl-none p-3 max-w-[85%]">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span>Thinking...</span>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}

interface MessageBubbleProps {
  message: Message
}

function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === "user"

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        "flex gap-3 items-start group",
        isUser && "flex-row-reverse"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-fey-purple/20" : "bg-fey-cyan/20"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-fey-purple" />
        ) : (
          <Bot className="h-4 w-4 text-fey-cyan" />
        )}
      </div>

      <div
        className={cn(
          "relative rounded-lg p-3 max-w-[85%] text-sm break-words",
          isUser
            ? "bg-fey-cyan/10 border border-fey-cyan/20 rounded-tr-none"
            : "bg-muted rounded-tl-none"
        )}
      >
        {isUser ? (
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownRenderer content={message.content} />
        )}

        {/* Copy button - only show for assistant messages */}
        {!isUser && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute -right-2 -top-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity",
              "bg-background border border-border shadow-sm hover:bg-muted"
            )}
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        )}

        {/* Timestamp */}
        <div
          className={cn(
            "text-[10px] text-muted-foreground mt-1",
            isUser && "text-right"
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  )
}
