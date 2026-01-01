"use client"

import { useState, type FormEvent } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Bot, ChevronDown, ChevronUp, Send, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

const suggestedPrompts = ["Plot hook", "NPC name", "Tavern", "Encounter"]

// Helper function to extract text content from message parts
function getMessageContent(message: {
  parts?: Array<{ type: string; text?: string }>
}): string {
  if (!message.parts) return ""
  return message.parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("")
}

export function AIAssistantWidget() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [input, setInput] = useState("")

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/dm-assistant",
    }),
    id: "dashboard-widget",
  })

  const isLoading = status === "streaming" || status === "submitted"

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput("")
  }

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt)
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border overflow-hidden min-w-0">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <CardTitle className="flex items-center justify-between text-base sm:text-lg">
              <div className="flex items-center gap-2 min-w-0">
                <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-fey-cyan flex-shrink-0" />
                <span className="truncate">DM Assistant</span>
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {/* Messages Area */}
            {messages.length > 0 ? (
              <ScrollArea className="h-[180px] pr-2">
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "text-sm p-2 rounded-lg break-words",
                        message.role === "user"
                          ? "bg-fey-cyan/10 text-foreground ml-4"
                          : "bg-muted text-foreground mr-4"
                      )}
                    >
                      {getMessageContent(message)}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="bg-muted text-muted-foreground text-sm p-2 rounded-lg mr-4 flex items-center gap-2">
                      <Sparkles className="h-3 w-3 animate-pulse flex-shrink-0" />
                      Thinking...
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-4">
                <Sparkles className="h-8 w-8 mx-auto mb-2 text-fey-cyan/50" />
                <p className="text-sm text-muted-foreground">
                  Ask me for plot hooks, NPC ideas, or rules help
                </p>
              </div>
            )}

            {/* Suggested Prompts */}
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestedPrompts.map((prompt) => (
                  <Button
                    key={prompt}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2 bg-muted/50 hover:bg-fey-cyan/10 hover:border-fey-cyan/50"
                    onClick={() => handleSuggestedPrompt(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
                Failed to get response. Please try again.
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask..."
                className="flex-1 min-w-0 bg-muted/50 border-border text-sm h-9"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="sm"
                className="bg-fey-cyan hover:bg-fey-cyan/80 text-white h-9 px-3 flex-shrink-0"
                disabled={!input.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </CollapsibleContent>

        {/* Collapsed Preview */}
        {!isExpanded && (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground truncate">
              Click to get DM help and plot hooks
            </p>
          </CardContent>
        )}
      </Collapsible>
    </Card>
  )
}
