"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, ArrowRight, Wand2 } from "lucide-react"
import Link from "next/link"

const suggestions = [
  "Generate a mysterious NPC for a tavern",
  "Create a balanced encounter for level 5 PCs",
  "Describe a haunted forest at night",
  "Help me with combat rules",
]

export function AIAssistantWidget() {
  return (
    <Card className="bg-gradient-to-br from-card to-purple-deep/30 border-border border-glow overflow-hidden relative">
      <div className="absolute top-4 right-4 opacity-20">
        <Sparkles className="h-24 w-24 text-primary animate-sparkle" />
      </div>
      <div className="absolute bottom-4 left-4 opacity-10">
        <Wand2 className="h-16 w-16 text-arcane-glow animate-float" />
      </div>

      <CardHeader className="flex flex-row items-center gap-3 relative">
        <div className="relative">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/40 to-purple-glow/40 flex items-center justify-center border border-primary/30">
            <Sparkles className="h-5 w-5 text-primary icon-glow" />
          </div>
          <div className="absolute inset-0 blur-lg bg-primary/40 animate-glow-pulse" />
        </div>
        <div>
          <CardTitle className="font-serif text-xl text-gold-gradient">AI DM Assistant</CardTitle>
          <p className="text-xs text-muted-foreground">Powered by arcane intelligence</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 relative">
        <p className="text-sm text-foreground/80">
          Your magical co-DM is ready to help with NPCs, encounters, descriptions, rules, and more.
        </p>

        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              className="text-xs border-border/50 hover:border-primary/50 hover:bg-accent/50 text-muted-foreground hover:text-foreground bg-background/50 backdrop-blur-sm transition-all duration-200 hover:shadow-[0_0_15px_-5px_oklch(0.55_0.25_280_/_0.4)]"
              asChild
            >
              <Link href={`/dm-assistant?prompt=${encodeURIComponent(suggestion)}`}>{suggestion}</Link>
            </Button>
          ))}
        </div>

        <Button
          className="w-full bg-gradient-to-r from-primary via-primary/90 to-gold-dim hover:from-primary/90 hover:to-gold-dim/90 gap-2 font-medium shadow-lg animate-pulse-glow"
          asChild
        >
          <Link href="/dm-assistant">
            <Sparkles className="h-4 w-4" />
            Open AI Assistant
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
