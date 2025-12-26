"use client"

import { Button } from "@/components/ui/button"
import { Sparkles, ArrowRight } from "lucide-react"
import Link from "next/link"

const suggestions = [
  "Generate a mysterious NPC for a tavern",
  "Create a balanced encounter for level 5 PCs",
  "Describe a haunted forest at night",
  "Help me with combat rules",
]

export function AIAssistantWidget() {
  return (
    <div className="relative">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
          <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-serif text-base sm:text-xl text-silver">AI DM Assistant</h2>
          <p className="text-[10px] sm:text-xs text-muted-foreground text-left">Powered by fey intelligence</p>
        </div>
      </div>
      <div className="space-y-3 sm:space-y-4">
        <p className="text-xs sm:text-sm text-muted-foreground">
          Your magical co-DM is ready to help with NPCs, encounters, descriptions, rules, and more.
        </p>

        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              className="text-[10px] sm:text-xs border-border/20 hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-colors rounded-full bg-transparent h-7 sm:h-8 px-2 sm:px-3 active:scale-[0.97]"
              asChild
            >
              <Link href={`/dm-assistant?prompt=${encodeURIComponent(suggestion)}`}>{suggestion}</Link>
            </Button>
          ))}
        </div>

        <Button className="w-full btn-primary gap-1.5 sm:gap-2 font-medium h-9 sm:h-10 text-sm" asChild>
          <Link href="/dm-assistant">
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Open AI Assistant
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
