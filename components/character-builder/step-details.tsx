"use client"

import { useCharacterStore } from "@/lib/character-store"
import { personalitySuggestions } from "@/lib/character-data"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, User, Heart, ScrollText, Lightbulb } from "lucide-react"

export function StepDetails() {
  const { character, updateCharacter } = useCharacterStore()

  const bgKey = character.background as keyof typeof personalitySuggestions
  const suggestions = personalitySuggestions[bgKey] || personalitySuggestions.default

  const applySuggestion = (field: "personalityTraits" | "ideals" | "bonds" | "flaws", value: string) => {
    const current = character[field]
    const newValue = current ? `${current}\n${value}` : value
    updateCharacter({ [field]: newValue })
  }

  return (
    <div className="space-y-8">
      {/* Personality Section */}
      <Card className="bg-card border-2 border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Heart className="h-5 w-5 text-fey-purple" />
            Personality
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Personality Traits */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="traits" className="font-semibold text-foreground">
                Personality Traits
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  applySuggestion(
                    "personalityTraits",
                    suggestions.traits[Math.floor(Math.random() * suggestions.traits.length)],
                  )
                }
                className="text-fey-cyan hover:text-fey-cyan hover:bg-fey-cyan/10"
              >
                <Lightbulb className="h-4 w-4 mr-1" />
                Suggest
              </Button>
            </div>
            <Textarea
              id="traits"
              placeholder="How does your character typically act?"
              value={character.personalityTraits}
              onChange={(e) => updateCharacter({ personalityTraits: e.target.value })}
              className="min-h-24 bg-secondary/30 border-2 border-border focus:border-fey-cyan resize-none"
            />
          </div>

          {/* Ideals */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="ideals" className="font-semibold text-foreground">
                Ideals
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  applySuggestion("ideals", suggestions.ideals[Math.floor(Math.random() * suggestions.ideals.length)])
                }
                className="text-fey-gold hover:text-fey-gold hover:bg-fey-gold/10"
              >
                <Lightbulb className="h-4 w-4 mr-1" />
                Suggest
              </Button>
            </div>
            <Textarea
              id="ideals"
              placeholder="What principles guide your character?"
              value={character.ideals}
              onChange={(e) => updateCharacter({ ideals: e.target.value })}
              className="min-h-24 bg-secondary/30 border-2 border-border focus:border-fey-cyan resize-none"
            />
          </div>

          {/* Bonds */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="bonds" className="font-semibold text-foreground">
                Bonds
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  applySuggestion("bonds", suggestions.bonds[Math.floor(Math.random() * suggestions.bonds.length)])
                }
                className="text-fey-cyan hover:text-fey-cyan hover:bg-fey-cyan/10"
              >
                <Lightbulb className="h-4 w-4 mr-1" />
                Suggest
              </Button>
            </div>
            <Textarea
              id="bonds"
              placeholder="What connections matter most to your character?"
              value={character.bonds}
              onChange={(e) => updateCharacter({ bonds: e.target.value })}
              className="min-h-24 bg-secondary/30 border-2 border-border focus:border-fey-cyan resize-none"
            />
          </div>

          {/* Flaws */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="flaws" className="font-semibold text-foreground">
                Flaws
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  applySuggestion("flaws", suggestions.flaws[Math.floor(Math.random() * suggestions.flaws.length)])
                }
                className="text-fey-purple hover:text-fey-purple hover:bg-fey-purple/10"
              >
                <Lightbulb className="h-4 w-4 mr-1" />
                Suggest
              </Button>
            </div>
            <Textarea
              id="flaws"
              placeholder="What weaknesses does your character have?"
              value={character.flaws}
              onChange={(e) => updateCharacter({ flaws: e.target.value })}
              className="min-h-24 bg-secondary/30 border-2 border-border focus:border-fey-cyan resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Backstory */}
      <Card className="bg-card border-2 border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ScrollText className="h-5 w-5 text-fey-gold" />
            Backstory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Tell the tale of your hero's origins..."
            value={character.backstory}
            onChange={(e) => updateCharacter({ backstory: e.target.value })}
            className="min-h-40 bg-secondary/30 border-2 border-border focus:border-fey-cyan resize-none"
          />
        </CardContent>
      </Card>

      {/* Physical Description */}
      <Card className="bg-card border-2 border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <User className="h-5 w-5 text-fey-cyan" />
            Physical Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age" className="text-sm text-foreground/80 font-medium">
                Age
              </Label>
              <Input
                id="age"
                placeholder="25"
                value={character.age}
                onChange={(e) => updateCharacter({ age: e.target.value })}
                className="bg-secondary/30 border-2 border-border focus:border-fey-cyan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height" className="text-sm text-foreground/80 font-medium">
                Height
              </Label>
              <Input
                id="height"
                placeholder={`5'10"`}
                value={character.height}
                onChange={(e) => updateCharacter({ height: e.target.value })}
                className="bg-secondary/30 border-2 border-border focus:border-fey-cyan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight" className="text-sm text-foreground/80 font-medium">
                Weight
              </Label>
              <Input
                id="weight"
                placeholder="160 lbs"
                value={character.weight}
                onChange={(e) => updateCharacter({ weight: e.target.value })}
                className="bg-secondary/30 border-2 border-border focus:border-fey-cyan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eyes" className="text-sm text-foreground/80 font-medium">
                Eyes
              </Label>
              <Input
                id="eyes"
                placeholder="Green"
                value={character.eyes}
                onChange={(e) => updateCharacter({ eyes: e.target.value })}
                className="bg-secondary/30 border-2 border-border focus:border-fey-cyan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skin" className="text-sm text-foreground/80 font-medium">
                Skin
              </Label>
              <Input
                id="skin"
                placeholder="Fair"
                value={character.skin}
                onChange={(e) => updateCharacter({ skin: e.target.value })}
                className="bg-secondary/30 border-2 border-border focus:border-fey-cyan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hair" className="text-sm text-foreground/80 font-medium">
                Hair
              </Label>
              <Input
                id="hair"
                placeholder="Black"
                value={character.hair}
                onChange={(e) => updateCharacter({ hair: e.target.value })}
                className="bg-secondary/30 border-2 border-border focus:border-fey-cyan"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Character Image */}
      <Card className="bg-card border-2 border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Sparkles className="h-5 w-5 text-fey-purple" />
            Character Portrait
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="imageUrl" className="text-sm text-foreground/80 font-medium">
                Image URL
              </Label>
              <Input
                id="imageUrl"
                placeholder="https://example.com/character.jpg"
                value={character.imageUrl}
                onChange={(e) => updateCharacter({ imageUrl: e.target.value })}
                className="bg-secondary/30 border-2 border-border focus:border-fey-cyan"
              />
            </div>

            {character.imageUrl && (
              <div className="w-32 h-32 rounded-lg border-2 border-fey-cyan overflow-hidden">
                <img
                  src={character.imageUrl || "/placeholder.svg"}
                  alt="Character portrait"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <p className="text-xs text-foreground/70">
              Tip: You can use AI art generators to create your character's portrait!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
