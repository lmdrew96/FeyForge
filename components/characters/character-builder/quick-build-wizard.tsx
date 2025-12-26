"use client"

/**
 * Quick Build Wizard
 * AI-powered character concept to build generator
 * Implements best practice: "Quick Build" one-click character generation
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sparkles, Loader2, Wand2, Check, ChevronRight, Dice6, Shield, Sword, Target } from "lucide-react"
import type { CharacterCreationData } from "@/lib/character/types"

interface QuickBuildWizardProps {
  onApplyBuild: (build: Partial<CharacterCreationData>) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface BuildSuggestion {
  race: string
  raceSynergies: string
  class: string
  classSynergies: string
  background: string
  backgroundSynergies: string
  abilityPriority: string[]
  suggestedAbilities: Record<string, number>
  keyFeatures: string[]
  playstyleTips: string[]
  multiclassOptions?: string[]
}

const PLAYSTYLE_OPTIONS = [
  { value: "damage", label: "Damage Dealer", icon: Sword, description: "Focus on dealing maximum damage" },
  { value: "tank", label: "Tank / Defender", icon: Shield, description: "Protect allies and soak damage" },
  { value: "support", label: "Support / Healer", icon: Target, description: "Buff allies and heal wounds" },
  { value: "control", label: "Controller", icon: Wand2, description: "Manipulate the battlefield" },
  { value: "utility", label: "Utility / Face", icon: Dice6, description: "Social skills and problem solving" },
]

const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "New to D&D", description: "Simple, straightforward builds" },
  { value: "intermediate", label: "Some Experience", description: "Balanced complexity" },
  { value: "advanced", label: "Veteran Player", description: "Complex, optimized builds" },
]

export function QuickBuildWizard({ onApplyBuild, open, onOpenChange }: QuickBuildWizardProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const setIsOpen = onOpenChange ?? setInternalOpen

  const [step, setStep] = useState<"input" | "loading" | "result">("input")
  const [concept, setConcept] = useState("")
  const [playstyle, setPlaystyle] = useState<string>("")
  const [experience, setExperience] = useState<string>("intermediate")
  const [preferences, setPreferences] = useState({
    preferMelee: false,
    preferRanged: false,
    preferMagic: false,
    preferStealth: false,
  })

  const [suggestion, setSuggestion] = useState<BuildSuggestion | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!concept.trim()) {
      setError("Please describe your character concept")
      return
    }

    setStep("loading")
    setError(null)

    try {
      const response = await fetch("/api/character/suggest-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept,
          playstyle,
          experienceLevel: experience,
          preferences: Object.entries(preferences)
            .filter(([_, v]) => v)
            .map(([k]) => k.replace("prefer", "").toLowerCase()),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate build suggestion")
      }

      const data = await response.json()
      setSuggestion(data)
      setStep("result")
    } catch (err) {
      console.error("Quick build error:", err)
      setError("Failed to generate build. Please try again.")
      setStep("input")
    }
  }

  const handleApply = () => {
    if (!suggestion) return

    // Convert suggestion to CharacterCreationData format
    // Note: We pass abilityScores as a custom property that will be handled by the parent
    const build: Partial<CharacterCreationData> & { abilityScores?: Record<string, number> } = {
      race: suggestion.race,
      class: suggestion.class,
      background: suggestion.background,
    }
    
    // Add ability scores as a separate property for the handler to process
    ;(build as any).abilityScores = suggestion.suggestedAbilities

    onApplyBuild(build)
    setIsOpen(false)
    resetWizard()
  }

  const resetWizard = () => {
    setStep("input")
    setConcept("")
    setPlaystyle("")
    setExperience("intermediate")
    setPreferences({
      preferMelee: false,
      preferRanged: false,
      preferMagic: false,
      preferStealth: false,
    })
    setSuggestion(null)
    setError(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetWizard()
    }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-primary/50 text-primary hover:bg-primary/10"
        >
          <Wand2 className="h-4 w-4" />
          Quick Build
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Quick Build
          </DialogTitle>
          <DialogDescription>
            Describe your character concept and let AI suggest the perfect build
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-6 py-4">
            {/* Character Concept */}
            <div className="space-y-2">
              <Label htmlFor="concept" className="text-foreground font-medium">
                Character Concept
              </Label>
              <Textarea
                id="concept"
                placeholder="Describe your character idea... e.g., 'A mysterious wanderer who uses shadow magic to hunt monsters' or 'A cheerful halfling chef who fights with kitchen implements'"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                className="min-h-[100px] bg-input border-border"
              />
            </div>

            {/* Playstyle Selection */}
            <div className="space-y-2">
              <Label className="text-foreground font-medium">
                Preferred Playstyle
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PLAYSTYLE_OPTIONS.map((style) => {
                  const Icon = style.icon
                  return (
                    <Card
                      key={style.value}
                      className={`cursor-pointer transition-all hover:border-primary/50 ${
                        playstyle === style.value ? "border-primary bg-primary/5" : ""
                      }`}
                      onClick={() => setPlaystyle(style.value)}
                    >
                      <CardContent className="p-3 flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${playstyle === style.value ? "text-primary" : "text-muted-foreground"}`} />
                        <div>
                          <p className="text-sm font-medium">{style.label}</p>
                        </div>
                        {playstyle === style.value && (
                          <Check className="h-4 w-4 text-primary ml-auto" />
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Experience Level */}
            <div className="space-y-2">
              <Label className="text-foreground font-medium">
                Player Experience
              </Label>
              <Select value={experience} onValueChange={setExperience}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Select your experience level" />
                </SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      <div className="flex flex-col">
                        <span>{level.label}</span>
                        <span className="text-xs text-muted-foreground">{level.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Combat Preferences */}
            <div className="space-y-2">
              <Label className="text-foreground font-medium">
                Combat Preferences (Optional)
              </Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "preferMelee", label: "Melee Combat" },
                  { key: "preferRanged", label: "Ranged Combat" },
                  { key: "preferMagic", label: "Spellcasting" },
                  { key: "preferStealth", label: "Stealth" },
                ].map(({ key, label }) => (
                  <Badge
                    key={key}
                    variant={preferences[key as keyof typeof preferences] ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setPreferences((p) => ({ ...p, [key]: !p[key as keyof typeof preferences] }))}
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Generate Build
              </Button>
            </div>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground animate-pulse">
              Crafting your perfect build...
            </p>
          </div>
        )}

        {step === "result" && suggestion && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 py-4 pr-4">
              {/* Race Suggestion */}
              <Card className="border-primary/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Race</p>
                      <p className="text-xl font-bold text-primary">{suggestion.race}</p>
                    </div>
                    <Badge variant="outline">Recommended</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{suggestion.raceSynergies}</p>
                </CardContent>
              </Card>

              {/* Class Suggestion */}
              <Card className="border-primary/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Class</p>
                      <p className="text-xl font-bold text-primary">{suggestion.class}</p>
                    </div>
                    <Badge variant="outline">Recommended</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{suggestion.classSynergies}</p>
                </CardContent>
              </Card>

              {/* Background Suggestion */}
              <Card className="border-primary/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Background</p>
                      <p className="text-xl font-bold text-primary">{suggestion.background}</p>
                    </div>
                    <Badge variant="outline">Recommended</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{suggestion.backgroundSynergies}</p>
                </CardContent>
              </Card>

              {/* Ability Scores */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-2">Suggested Ability Scores</p>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {Object.entries(suggestion.suggestedAbilities).map(([ability, score]) => (
                      <div key={ability} className="text-center p-2 bg-muted/50 rounded">
                        <p className="text-xs text-muted-foreground uppercase">{ability}</p>
                        <p className="text-xl font-bold">{score}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Priority: {suggestion.abilityPriority.join(" > ")}
                  </p>
                </CardContent>
              </Card>

              {/* Key Features */}
              <div className="space-y-2">
                <p className="font-medium">Key Features to Look For</p>
                <ul className="space-y-1">
                  {suggestion.keyFeatures.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Playstyle Tips */}
              <div className="space-y-2">
                <p className="font-medium">Playstyle Tips</p>
                <ul className="space-y-1">
                  {suggestion.playstyleTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Sparkles className="h-4 w-4 text-primary/50 shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {suggestion.multiclassOptions && suggestion.multiclassOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium">Multiclass Options</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestion.multiclassOptions.map((option, i) => (
                      <Badge key={i} variant="secondary">{option}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setStep("input")}>
                  Try Again
                </Button>
                <Button onClick={handleApply} className="gap-2">
                  <Check className="h-4 w-4" />
                  Apply This Build
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
