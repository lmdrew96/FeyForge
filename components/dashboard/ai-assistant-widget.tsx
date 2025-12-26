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
    <Card className="glass-card overflow-hidden relative border-primary/20">
      <div className="floating-orb copper w-32 h-32 -top-8 -right-8 opacity-40 animate-float-gentle" />
      <div className="floating-orb lavender w-24 h-24 -bottom-6 -left-6 opacity-30" style={{ animationDelay: "2s" }} />

      <div className="absolute top-6 right-6 opacity-15">
        <Sparkles className="h-20 w-20 text-primary animate-twinkle" />
      </div>
      <div className="absolute bottom-6 left-6 opacity-10">
        <Wand2 className="h-14 w-14 text-copper animate-float-gentle" style={{ animationDelay: "1s" }} />
      </div>

      <CardHeader className="flex flex-row items-center gap-3 relative z-10">
        <div className="relative">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-copper/30 to-primary/20 flex items-center justify-center border border-copper/40 backdrop-blur-sm shadow-lg">
            <Sparkles className="h-6 w-6 text-copper animate-ethereal-glow" />
          </div>
        </div>
        <div>
          <CardTitle className="font-serif text-xl text-gold-gradient">AI DM Assistant</CardTitle>
          <p className="text-xs text-lavender">Powered by fey intelligence</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 relative z-10">
        <p className="text-sm text-foreground/90">
          Your magical co-DM is ready to help with NPCs, encounters, descriptions, rules, and more.
        </p>

        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              className="text-xs border-border/40 hover:border-primary/50 hover:bg-accent/50 text-muted-foreground hover:text-foreground backdrop-blur-sm transition-all duration-200 hover:shadow-[0_0_15px_-5px_oklch(0.75_0.15_210_/_0.3)] rounded-full bg-transparent"
              asChild
            >
              <Link href={`/dm-assistant?prompt=${encodeURIComponent(suggestion)}`}>{suggestion}</Link>
            </Button>
          ))}
        </div>

        <Button className="w-full btn-copper-glow gap-2 font-medium shadow-lg animate-gentle-pulse" asChild>
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
