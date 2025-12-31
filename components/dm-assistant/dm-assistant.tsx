"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, Sparkles, PanelLeftClose, PanelLeft, Plus, Trash2, History } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useDMAssistantStore, getSimulatedResponse } from "@/lib/dm-assistant-store"
import { useCampaignStore } from "@/lib/campaign-store"
import { useActiveCampaignId, useActiveCampaign } from "@/lib/hooks/use-campaign-data"
import { ChatMessages } from "./chat-messages"
import { QuickPrompts } from "./quick-prompts"
import { ChatHistory } from "./chat-history"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function DMAssistant() {
  const [input, setInput] = useState("")
  const [showDesktopHistory, setShowDesktopHistory] = useState(false)
  const [showMobileHistory, setShowMobileHistory] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeCampaignId = useActiveCampaignId()
  const activeCampaign = useActiveCampaign()

  const {
    activeConversationId,
    isLoading,
    createConversation,
    addMessage,
    getActiveConversation,
    clearMessages,
    setActiveConversation,
    setLoading,
  } = useDMAssistantStore()

  const activeConversation = getActiveConversation()
  const messages = activeConversation?.messages || []

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isLoading || !activeCampaignId) return

    let conversationId = activeConversationId

    // Create new conversation if none exists
    if (!conversationId) {
      const newConversation = createConversation(activeCampaignId)
      conversationId = newConversation.id
    }

    // Add user message
    addMessage(conversationId, {
      role: "user",
      content: input.trim(),
    })

    const userInput = input.trim()
    setInput("")
    setLoading(true)

    // Simulate AI response (replace with actual API call later)
    setTimeout(() => {
      addMessage(conversationId!, {
        role: "assistant",
        content: getSimulatedResponse(userInput),
      })
      setLoading(false)
    }, 800 + Math.random() * 700)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt)
    textareaRef.current?.focus()
  }

  const handleNewChat = () => {
    if (activeCampaignId) {
      createConversation(activeCampaignId)
    }
  }

  const handleClearChat = () => {
    if (activeConversationId) {
      clearMessages(activeConversationId)
    }
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Chat History Sidebar - Desktop */}
      <div
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-card/50 backdrop-blur-sm transition-all duration-300 overflow-hidden",
          showDesktopHistory ? "w-64 lg:w-72" : "w-0"
        )}
      >
        {showDesktopHistory && (
          <ChatHistory
            onClose={() => setShowDesktopHistory(false)}
            onSelectConversation={(id: string) => setActiveConversation(id)}
          />
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border bg-card/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile history button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 md:hidden"
              onClick={() => setShowMobileHistory(true)}
              aria-label="Open chat history"
            >
              <History className="h-4 w-4" />
            </Button>
            {/* Desktop history button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 hidden md:flex"
              onClick={() => setShowDesktopHistory(!showDesktopHistory)}
              aria-label="Toggle chat history"
            >
              {showDesktopHistory ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <Bot className="h-5 w-5 text-fey-cyan flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="font-semibold text-sm sm:text-base truncate">
                  {activeConversation?.title || "New Chat"}
                </h2>
                {activeCampaign && (
                  <p className="text-xs text-muted-foreground truncate">
                    {activeCampaign.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs sm:text-sm"
              onClick={handleNewChat}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </Button>

            {messages.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear this conversation?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all messages in this chat. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearChat}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Clear Chat
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-3 sm:p-4" ref={scrollRef}>
          {messages.length > 0 ? (
            <ChatMessages messages={messages} isLoading={isLoading} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-fey-cyan/20 blur-xl rounded-full" />
                <div className="relative bg-gradient-to-br from-fey-cyan/20 to-fey-purple/20 p-6 rounded-full border border-fey-cyan/30">
                  <Sparkles className="h-12 w-12 text-fey-cyan" />
                </div>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2">
                Greetings, Dungeon Master
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                I'm your AI-powered assistant, ready to help with plot hooks, NPC ideas,
                encounter balancing, rules clarifications, and more. What shall we create?
              </p>
              <QuickPrompts onSelectPrompt={handleQuickPrompt} />
            </div>
          )}
        </ScrollArea>

        {/* Quick Prompts - Show when there are messages */}
        {messages.length > 0 && (
          <div className="px-3 sm:px-4 pb-2">
            <QuickPrompts onSelectPrompt={handleQuickPrompt} compact />
          </div>
        )}

        {/* Input Area */}
        <div className="p-3 sm:p-4 border-t border-border bg-card/30 backdrop-blur-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex gap-2 items-end"
          >
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything... (Shift+Enter for new line)"
                className="min-h-[44px] max-h-[200px] resize-none bg-muted/50 border-border pr-4"
                disabled={isLoading || !activeCampaignId}
                rows={1}
              />
            </div>
            <Button
              type="submit"
              size="icon"
              className="h-11 w-11 bg-fey-cyan hover:bg-fey-cyan/80 text-white flex-shrink-0"
              disabled={!input.trim() || isLoading || !activeCampaignId}
            >
              {isLoading ? (
                <Sparkles className="h-5 w-5 animate-pulse" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
          {!activeCampaignId && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Please select a campaign to start chatting
            </p>
          )}
        </div>
      </div>

      {/* Mobile Chat History Sheet */}
      <ChatHistory
        mobile
        open={showMobileHistory}
        onOpenChange={setShowMobileHistory}
        onClose={() => setShowMobileHistory(false)}
        onSelectConversation={(id: string) => {
          setActiveConversation(id)
          setShowMobileHistory(false)
        }}
      />
    </div>
  )
}
