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
      <div className="flex items-center gap-3 mb-4">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-serif text-xl text-silver">AI DM Assistant</h2>
          <p className="text-xs text-muted-foreground text-left">Powered by fey intelligence</p>
        </div>
      </div>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Your magical co-DM is ready to help with NPCs, encounters, descriptions, rules, and more.
        </p>

        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              className="text-xs border-border/20 hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-colors rounded-full bg-transparent"
              asChild
            >
              <Link href={`/dm-assistant?prompt=${encodeURIComponent(suggestion)}`}>{suggestion}</Link>
            </Button>
          ))}
        </div>

        <Button className="w-full btn-primary gap-2 font-medium" asChild>
          <Link href="/dm-assistant">
            <Sparkles className="h-4 w-4" />
            Open AI Assistant
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
