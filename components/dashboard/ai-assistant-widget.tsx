"use client"

import { useState } from "react"
import { Bot, ChevronDown, ChevronUp, Send, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

const suggestedPrompts = ["Plot hook", "NPC name", "Tavern", "Encounter"]

export function AIAssistantWidget() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // Simulate AI response (replace with actual AI integration later)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getSimulatedResponse(userMessage.content),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1000)
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
                          : "bg-muted text-foreground mr-4",
                      )}
                    >
                      {message.content}
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
                <p className="text-sm text-muted-foreground">Ask me for plot hooks, NPC ideas, or rules help</p>
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

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex gap-2"
            >
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
                className="bg-fey-cyan hover:bg-fey-cyan/80 text-fey-cyan-foreground h-9 px-3 flex-shrink-0"
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
            <p className="text-xs text-muted-foreground truncate">Click to get DM help and plot hooks</p>
          </CardContent>
        )}
      </Collapsible>
    </Card>
  )
}

// Simulated responses for demo
function getSimulatedResponse(input: string): string {
  const lowerInput = input.toLowerCase()

  if (lowerInput.includes("plot hook") || lowerInput.includes("hook")) {
    const hooks = [
      "A local merchant's prized possession—a music box that plays a haunting melody—has started attracting strange, luminescent moths every midnight.",
      "The party finds a wanted poster with one of their faces on it, but for a crime they didn't commit... yet.",
      "An ancient tree in the town square has begun weeping silver sap, and anyone who touches it experiences vivid visions of a forgotten war.",
    ]
    return hooks[Math.floor(Math.random() * hooks.length)]
  }

  if (lowerInput.includes("npc") || lowerInput.includes("name")) {
    const names = [
      "Thornwick Bramblefoot - A nervous halfling herbalist with an encyclopedic knowledge of poisonous plants.",
      "Seraphina Duskwalker - A stoic tiefling blacksmith who only speaks in the hours after sunset.",
      "Bargle Stonewhisper - A jovial dwarf prospector who claims to hear the voices of gems.",
    ]
    return names[Math.floor(Math.random() * names.length)]
  }

  if (lowerInput.includes("tavern") || lowerInput.includes("inn")) {
    return "The Gilded Acorn: A cozy establishment built inside an enormous hollowed oak. Fairy lights dance between the branches above, and the ale is served in acorn-cap tankards. The barkeep, an elderly satyr named Mossworth, tells fortunes in the foam of each drink."
  }

  if (lowerInput.includes("encounter")) {
    const encounters = [
      "A group of pixies has stolen something valuable and hidden it somewhere in the nearby forest. They'll only return it if the party can make them laugh.",
      "The road ahead is blocked by two awakened shrubs engaged in a heated philosophical debate. They demand the party settle their argument before allowing passage.",
      "A wounded unicorn stumbles onto the path, pursued by poachers. But something about the unicorn's behavior suggests not all is as it seems...",
    ]
    return encounters[Math.floor(Math.random() * encounters.length)]
  }

  return "I can help you with plot hooks, NPC ideas, tavern descriptions, encounter suggestions, and rules clarifications. What would you like to explore?"
}
