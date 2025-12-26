"use client"

/**
 * Step 1: Basics
 * Name, alignment selection
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sparkles, Loader2 } from "lucide-react"
import type { CharacterCreationData } from "@/lib/character/types"
import { ALIGNMENTS } from "@/lib/character/constants"

interface Step1BasicsProps {
  data: CharacterCreationData
  onUpdate: (updates: Partial<CharacterCreationData>) => void
  onGenerateName?: () => Promise<void>
}

export function Step1Basics({ data, onUpdate, onGenerateName }: Step1BasicsProps) {
  const [isGeneratingName, setIsGeneratingName] = useState(false)

  const handleGenerateName = async () => {
    if (!onGenerateName) return
    setIsGeneratingName(true)
    try {
      await onGenerateName()
    } finally {
      setIsGeneratingName(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="font-serif text-2xl font-bold text-gold-gradient">Name Your Hero</h2>
        <p className="text-muted-foreground mt-2">Every legend begins with a name</p>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        {/* Character Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground font-medium">
            Character Name
          </Label>
          <Input
            id="name"
            placeholder="Enter your character's name..."
            value={data.name || ""}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="bg-input border-border focus:border-primary focus:ring-primary/20 text-lg h-12"
            autoFocus
          />
        </div>

        {/* Alignment Selection */}
        <div className="space-y-2">
          <Label className="text-foreground font-medium">Alignment</Label>
          <div className="grid grid-cols-3 gap-2">
            {ALIGNMENTS.map((alignment) => (
              <button
                key={alignment}
                type="button"
                onClick={() => onUpdate({ alignment })}
                className={`p-2 text-sm rounded-lg border transition-all ${
                  data.alignment === alignment
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:border-primary/50 text-foreground"
                }`}
              >
                {alignment}
              </button>
            ))}
          </div>
        </div>

        {/* AI Name Generator */}
        {onGenerateName && (
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateName}
            disabled={isGeneratingName}
            className="w-full border-primary/50 text-primary hover:bg-primary/10 gap-2 bg-transparent"
          >
            {isGeneratingName ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGeneratingName ? "Generating..." : "Generate Random Name with AI"}
          </Button>
        )}
      </div>
    </div>
  )
}
