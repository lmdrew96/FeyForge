"use client"

/**
 * Step 5: Details
 * Personality, backstory, and character details
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, Loader2 } from "lucide-react"
import type { CharacterCreationData } from "@/lib/character/types"

interface Step5DetailsProps {
  data: CharacterCreationData
  onUpdate: (updates: Partial<CharacterCreationData>) => void
  onGenerateBackstory?: () => Promise<void>
  suggestedTraits?: {
    personalityTraits?: string[]
    ideals?: string[]
    bonds?: string[]
    flaws?: string[]
  }
}

export function Step5Details({ 
  data, 
  onUpdate, 
  onGenerateBackstory,
  suggestedTraits,
}: Step5DetailsProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerateBackstory = async () => {
    if (!onGenerateBackstory) return
    setIsGenerating(true)
    try {
      await onGenerateBackstory()
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="font-serif text-2xl font-bold text-gold-gradient">Character Details</h2>
        <p className="text-muted-foreground mt-2">Add depth and personality to your character</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Personality */}
        <div className="space-y-4">
          <h3 className="font-medium text-foreground">Personality</h3>

          {/* Personality Traits */}
          <div className="space-y-2">
            <Label htmlFor="personality" className="text-foreground">
              Personality Traits
            </Label>
            <Textarea
              id="personality"
              placeholder="I idolize a particular hero and constantly refer to their deeds..."
              value={data.personalityTraits || ""}
              onChange={(e) => onUpdate({ personalityTraits: e.target.value })}
              className="bg-input border-border min-h-[80px]"
            />
            {suggestedTraits?.personalityTraits && (
              <div className="flex flex-wrap gap-1 mt-1">
                {suggestedTraits.personalityTraits.slice(0, 3).map((trait, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onUpdate({ personalityTraits: trait })}
                    className="text-xs px-2 py-1 rounded bg-accent/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {trait.slice(0, 40)}...
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ideals */}
          <div className="space-y-2">
            <Label htmlFor="ideals" className="text-foreground">
              Ideals
            </Label>
            <Textarea
              id="ideals"
              placeholder="My word is my bond. I never break a promise..."
              value={data.ideals || ""}
              onChange={(e) => onUpdate({ ideals: e.target.value })}
              className="bg-input border-border min-h-[60px]"
            />
            {suggestedTraits?.ideals && (
              <div className="flex flex-wrap gap-1 mt-1">
                {suggestedTraits.ideals.slice(0, 3).map((ideal, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onUpdate({ ideals: ideal })}
                    className="text-xs px-2 py-1 rounded bg-accent/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {ideal.slice(0, 30)}...
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bonds */}
          <div className="space-y-2">
            <Label htmlFor="bonds" className="text-foreground">
              Bonds
            </Label>
            <Textarea
              id="bonds"
              placeholder="I would die to recover an ancient relic of my faith..."
              value={data.bonds || ""}
              onChange={(e) => onUpdate({ bonds: e.target.value })}
              className="bg-input border-border min-h-[60px]"
            />
            {suggestedTraits?.bonds && (
              <div className="flex flex-wrap gap-1 mt-1">
                {suggestedTraits.bonds.slice(0, 3).map((bond, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onUpdate({ bonds: bond })}
                    className="text-xs px-2 py-1 rounded bg-accent/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {bond.slice(0, 30)}...
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Flaws */}
          <div className="space-y-2">
            <Label htmlFor="flaws" className="text-foreground">
              Flaws
            </Label>
            <Textarea
              id="flaws"
              placeholder="I am inflexible in my thinking..."
              value={data.flaws || ""}
              onChange={(e) => onUpdate({ flaws: e.target.value })}
              className="bg-input border-border min-h-[60px]"
            />
            {suggestedTraits?.flaws && (
              <div className="flex flex-wrap gap-1 mt-1">
                {suggestedTraits.flaws.slice(0, 3).map((flaw, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onUpdate({ flaws: flaw })}
                    className="text-xs px-2 py-1 rounded bg-accent/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {flaw.slice(0, 30)}...
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Physical & Backstory */}
        <div className="space-y-4">
          <h3 className="font-medium text-foreground">Appearance</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="age" className="text-foreground">
                Age
              </Label>
              <Input
                id="age"
                placeholder="25"
                value={data.age || ""}
                onChange={(e) => onUpdate({ age: e.target.value })}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height" className="text-foreground">
                Height
              </Label>
              <Input
                id="height"
                placeholder={'5\'10"'}
                value={data.height || ""}
                onChange={(e) => onUpdate({ height: e.target.value })}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight" className="text-foreground">
                Weight
              </Label>
              <Input
                id="weight"
                placeholder="160 lbs"
                value={data.weight || ""}
                onChange={(e) => onUpdate({ weight: e.target.value })}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eyes" className="text-foreground">
                Eyes
              </Label>
              <Input
                id="eyes"
                placeholder="Blue"
                value={data.eyes || ""}
                onChange={(e) => onUpdate({ eyes: e.target.value })}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skin" className="text-foreground">
                Skin
              </Label>
              <Input
                id="skin"
                placeholder="Fair"
                value={data.skin || ""}
                onChange={(e) => onUpdate({ skin: e.target.value })}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hair" className="text-foreground">
                Hair
              </Label>
              <Input
                id="hair"
                placeholder="Brown"
                value={data.hair || ""}
                onChange={(e) => onUpdate({ hair: e.target.value })}
                className="bg-input border-border"
              />
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="backstory" className="text-foreground">
                Backstory
              </Label>
              {onGenerateBackstory && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateBackstory}
                  disabled={isGenerating}
                  className="text-primary hover:text-primary hover:bg-primary/10 gap-1"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {isGenerating ? "Generating..." : "Generate with AI"}
                </Button>
              )}
            </div>
            <Textarea
              id="backstory"
              placeholder="Write your character's backstory here. Where did they come from? What motivates them? What are their goals?"
              value={data.backstory || ""}
              onChange={(e) => onUpdate({ backstory: e.target.value })}
              className="bg-input border-border min-h-[200px]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
