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
      <div className="flex items-center gap-fluid-md spacing-mb-title">
        <div className="container-sm rounded-card bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
          <Sparkles className="icon-md text-primary" />
        </div>
        <div>
          <h2 className="font-serif text-title-lg text-silver">AI DM Assistant</h2>
          <p className="text-label-sm text-muted-foreground text-left">Powered by fey intelligence</p>
        </div>
      </div>
      <div className="space-y-fluid-md">
        <p className="text-subtitle text-muted-foreground">
          Your magical co-DM is ready to help with NPCs, encounters, descriptions, rules, and more.
        </p>

        <div className="flex flex-wrap gap-fluid-sm">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              className="text-label-sm border-border/20 hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-colors rounded-full bg-transparent btn-height-sm px-fluid-sm active:scale-[0.97]"
              asChild
            >
              <Link href={`/dm-assistant?prompt=${encodeURIComponent(suggestion)}`}>{suggestion}</Link>
            </Button>
          ))}
        </div>

        <Button className="w-full btn-primary gap-fluid-sm font-medium btn-height text-sm" asChild>
          <Link href="/dm-assistant">
            <Sparkles className="icon-xs" />
            Open AI Assistant
            <ArrowRight className="icon-xs" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
