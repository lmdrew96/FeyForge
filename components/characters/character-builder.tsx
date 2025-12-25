"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import {
  races,
  classes,
  backgrounds,
  abilities,
  calculateModifier,
  formatModifier,
  type Character,
} from "@/lib/dnd-data"
import { useCharacterStore } from "@/lib/character-store"
import { useRouter } from "next/navigation"
import { Sparkles, Dices, ChevronRight, ChevronLeft, Check, Shield, Heart, Zap, User } from "lucide-react"

const steps = ["Basics", "Race", "Class", "Abilities", "Background", "Details"]

const alignments = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "True Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
]

export function CharacterBuilder() {
  const router = useRouter()
  const addCharacter = useCharacterStore((state) => state.addCharacter)
  const [currentStep, setCurrentStep] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [character, setCharacter] = useState<Partial<Character>>({
    name: "",
    race: "",
    subrace: "",
    class: "",
    level: 1,
    background: "",
    alignment: "",
    experiencePoints: 0,
    abilityScores: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    },
    proficiencies: [],
    hitPoints: { current: 0, max: 0, temp: 0 },
    armorClass: 10,
    initiative: 0,
    speed: 30,
    personalityTraits: "",
    ideals: "",
    bonds: "",
    flaws: "",
    backstory: "",
    equipment: [],
    features: [],
  })

  const [pointBuyRemaining, setPointBuyRemaining] = useState(27)
  const [abilityMethod, setAbilityMethod] = useState<"point-buy" | "roll">("point-buy")

  useEffect(() => {
    setMounted(true)
  }, [])

  const updateCharacter = (updates: Partial<Character>) => {
    setCharacter((prev) => ({ ...prev, ...updates }))
  }

  const selectedRace = races.find((r) => r.id === character.race)
  const selectedClass = classes.find((c) => c.id === character.class)
  const selectedBackground = backgrounds.find((b) => b.id === character.background)

  const getPointCost = (score: number): number => {
    if (score <= 8) return 0
    if (score <= 13) return score - 8
    if (score === 14) return 7
    if (score === 15) return 9
    return 0
  }

  const handlePointBuy = (ability: keyof typeof character.abilityScores, value: number) => {
    if (!character.abilityScores) return

    const currentScore = character.abilityScores[ability]
    const currentCost = getPointCost(currentScore)
    const newCost = getPointCost(value)
    const costDiff = newCost - currentCost

    if (pointBuyRemaining - costDiff >= 0 || value < currentScore) {
      setPointBuyRemaining((prev) => prev - costDiff)
      updateCharacter({
        abilityScores: {
          ...character.abilityScores,
          [ability]: value,
        },
      })
    }
  }

  const rollAbilityScores = () => {
    const rollStat = () => {
      const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1)
      rolls.sort((a, b) => b - a)
      return rolls.slice(0, 3).reduce((a, b) => a + b, 0)
    }

    updateCharacter({
      abilityScores: {
        str: rollStat(),
        dex: rollStat(),
        con: rollStat(),
        int: rollStat(),
        wis: rollStat(),
        cha: rollStat(),
      },
    })
  }

  const handleSubmit = () => {
    console.log("[v0] Starting character submission...")
    console.log("[v0] Character data:", character)
    console.log("[v0] Selected class:", selectedClass)
    console.log("[v0] Selected race:", selectedRace)

    const hitDie = selectedClass?.hitDie || 8
    const conMod = calculateModifier(character.abilityScores?.con || 10)
    const maxHP = hitDie + conMod

    const newCharacter: Character = {
      id: crypto.randomUUID(),
      name: character.name || "Unnamed Hero",
      race: character.race || "human",
      subrace: character.subrace,
      class: character.class || "fighter",
      level: 1,
      background: character.background || "acolyte",
      alignment: character.alignment || "True Neutral",
      experiencePoints: 0,
      abilityScores: character.abilityScores || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencies: character.proficiencies || [],
      hitPoints: { current: maxHP, max: maxHP, temp: 0 },
      armorClass: 10 + calculateModifier(character.abilityScores?.dex || 10),
      initiative: calculateModifier(character.abilityScores?.dex || 10),
      speed: selectedRace?.speed || 30,
      personalityTraits: character.personalityTraits || "",
      ideals: character.ideals || "",
      bonds: character.bonds || "",
      flaws: character.flaws || "",
      backstory: character.backstory || "",
      equipment: character.equipment || [],
      features: [...(selectedRace?.traits || []), ...(selectedClass?.features || [])],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    console.log("[v0] New character to add:", newCharacter)

    try {
      addCharacter(newCharacter)
      console.log("[v0] Character added successfully, navigating to:", `/characters/${newCharacter.id}`)
      router.push(`/characters/${newCharacter.id}`)
    } catch (error) {
      console.error("[v0] Error adding character:", error)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return character.name && character.name.length > 0
      case 1:
        return character.race
      case 2:
        return character.class
      case 3:
        return true
      case 4:
        return character.background
      case 5:
        return true
      default:
        return false
    }
  }

  const previewStats = {
    hp: (selectedClass?.hitDie || 8) + calculateModifier(character.abilityScores?.con || 10),
    ac: 10 + calculateModifier(character.abilityScores?.dex || 10),
    initiative: formatModifier(calculateModifier(character.abilityScores?.dex || 10)),
    speed: selectedRace?.speed || 30,
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Dices className="h-12 w-12 text-primary mx-auto animate-spin" />
          <p className="text-muted-foreground">Loading character builder...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center">
            <button
              onClick={() => index < currentStep && setCurrentStep(index)}
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-300 ${
                index === currentStep
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : index < currentStep
                    ? "bg-accent/80 text-foreground cursor-pointer hover:bg-accent"
                    : "bg-muted/50 text-muted-foreground"
              }`}
            >
              {index < currentStep ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <span className="w-4 text-center text-sm font-bold">{index + 1}</span>
              )}
              <span className="text-sm font-medium hidden sm:inline">{step}</span>
            </button>
            {index < steps.length - 1 && (
              <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground hidden sm:block" />
            )}
          </div>
        ))}
      </div>

      {/* Character Preview Bar */}
      {(character.name || character.race || character.class) && (
        <div className="flex flex-wrap items-center justify-center gap-4 p-3 rounded-lg bg-accent/30 border border-border">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <span className="font-serif font-bold text-foreground">{character.name || "Unnamed"}</span>
          </div>
          {character.race && (
            <Badge variant="outline" className="border-primary/50 text-primary">
              {selectedRace?.name}
            </Badge>
          )}
          {character.class && (
            <Badge variant="outline" className="border-primary/50 text-primary">
              {selectedClass?.name}
            </Badge>
          )}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3 text-red-400" /> {previewStats.hp}
            </span>
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-blue-400" /> {previewStats.ac}
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-yellow-400" /> {previewStats.initiative}
            </span>
          </div>
        </div>
      )}

      {/* Step Content */}
      <Card className="bg-card/80 backdrop-blur border-border shadow-xl">
        <CardContent className="p-6">
          {/* Step 0: Basics */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="font-serif text-2xl font-bold text-gold-gradient">Name Your Hero</h2>
                <p className="text-muted-foreground mt-2">Every legend begins with a name</p>
              </div>

              <div className="max-w-md mx-auto space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground font-medium">
                    Character Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="Enter your character's name..."
                    value={character.name}
                    onChange={(e) => updateCharacter({ name: e.target.value })}
                    className="bg-input border-border focus:border-primary focus:ring-primary/20 text-lg h-12"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alignment" className="text-foreground font-medium">
                    Alignment
                  </Label>
                  <Select value={character.alignment} onValueChange={(v) => updateCharacter({ alignment: v })}>
                    <SelectTrigger className="bg-input border-border focus:border-primary">
                      <SelectValue placeholder="Choose alignment..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {alignments.map((alignment) => (
                        <SelectItem
                          key={alignment}
                          value={alignment}
                          className="focus:bg-accent focus:text-accent-foreground"
                        >
                          {alignment}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  className="w-full border-primary/50 text-primary hover:bg-primary/10 gap-2 bg-transparent mt-4"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Random Name with AI
                </Button>
              </div>
            </div>
          )}

          {/* Step 1: Race */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="font-serif text-2xl font-bold text-gold-gradient">Choose Your Race</h2>
                <p className="text-muted-foreground mt-2">Your ancestry shapes who you are</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {races.map((race) => (
                  <button
                    key={race.id}
                    onClick={() => updateCharacter({ race: race.id, subrace: "" })}
                    className={`p-4 rounded-lg border text-left transition-all duration-300 hover:scale-[1.02] ${
                      character.race === race.id
                        ? "border-primary bg-primary/10 border-glow shadow-lg"
                        : "border-border bg-card hover:border-primary/50 hover:bg-accent/30"
                    }`}
                  >
                    <h3 className="font-serif font-bold text-foreground text-lg">{race.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{race.description}</p>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {race.traits.slice(0, 3).map((trait) => (
                        <Badge key={trait} variant="outline" className="text-xs border-border text-muted-foreground">
                          {trait}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-primary/80">Speed: {race.speed} ft.</div>
                  </button>
                ))}
              </div>

              {selectedRace?.subraces && selectedRace.subraces.length > 0 && (
                <div className="mt-6 p-4 rounded-lg bg-accent/20 border border-border">
                  <Label className="text-foreground font-medium mb-3 block">Choose Subrace</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedRace.subraces.map((subrace) => (
                      <button
                        key={subrace.id}
                        onClick={() => updateCharacter({ subrace: subrace.id })}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          character.subrace === subrace.id
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        <h4 className="font-medium text-foreground">{subrace.name}</h4>
                        <div className="flex gap-1 mt-2">
                          {subrace.traits.map((trait) => (
                            <Badge
                              key={trait}
                              variant="outline"
                              className="text-xs border-border text-muted-foreground"
                            >
                              {trait}
                            </Badge>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Class */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="font-serif text-2xl font-bold text-gold-gradient">Choose Your Class</h2>
                <p className="text-muted-foreground mt-2">Your path to adventure</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => updateCharacter({ class: cls.id })}
                    className={`p-4 rounded-lg border text-left transition-all duration-300 hover:scale-[1.02] ${
                      character.class === cls.id
                        ? "border-primary bg-primary/10 border-glow shadow-lg"
                        : "border-border bg-card hover:border-primary/50 hover:bg-accent/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif font-bold text-foreground text-lg">{cls.name}</h3>
                      <Badge variant="outline" className="border-red-500/50 text-red-400">
                        d{cls.hitDie}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{cls.description}</p>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {cls.features.map((feature) => (
                        <Badge key={feature} variant="outline" className="text-xs border-border text-muted-foreground">
                          {feature}
                        </Badge>
                      ))}
                      {cls.spellcaster && (
                        <Badge className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30">
                          Spellcaster
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Abilities */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="font-serif text-2xl font-bold text-gold-gradient">Ability Scores</h2>
                <p className="text-muted-foreground mt-2">Define your character's capabilities</p>
              </div>

              <Tabs
                value={abilityMethod}
                onValueChange={(v) => setAbilityMethod(v as "point-buy" | "roll")}
                className="w-full"
              >
                <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-muted">
                  <TabsTrigger
                    value="point-buy"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    Point Buy
                  </TabsTrigger>
                  <TabsTrigger
                    value="roll"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    Roll
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="point-buy" className="mt-6">
                  <div className="text-center mb-6">
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                        pointBuyRemaining > 0 ? "bg-primary/20 text-primary" : "bg-green-500/20 text-green-400"
                      }`}
                    >
                      <span className="font-bold text-xl">{pointBuyRemaining}</span>
                      <span className="text-sm">points remaining</span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl mx-auto">
                    {abilities.map((ability) => {
                      const score = character.abilityScores?.[ability.id as keyof typeof character.abilityScores] || 10
                      const mod = calculateModifier(score)
                      return (
                        <div key={ability.id} className="p-4 rounded-lg border border-border bg-card/50">
                          <div className="text-center">
                            <h4 className="font-serif font-bold text-foreground">{ability.name}</h4>
                            <p className="text-xs text-muted-foreground">{ability.abbr}</p>
                          </div>
                          <div className="flex items-center justify-center gap-4 mt-3">
                            <span className="text-3xl font-bold text-gold-gradient">{score}</span>
                            <span className={`text-lg font-medium ${mod >= 0 ? "text-green-400" : "text-red-400"}`}>
                              ({formatModifier(mod)})
                            </span>
                          </div>
                          <Slider
                            value={[score]}
                            min={8}
                            max={15}
                            step={1}
                            onValueChange={([v]) =>
                              handlePointBuy(ability.id as keyof typeof character.abilityScores, v)
                            }
                            className="mt-3"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>8</span>
                            <span>15</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="roll" className="mt-6">
                  <div className="text-center mb-6">
                    <Button
                      onClick={rollAbilityScores}
                      className="bg-primary hover:bg-primary/90 gap-2 shadow-lg shadow-primary/25"
                    >
                      <Dices className="h-5 w-5" />
                      Roll 4d6 Drop Lowest
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">Click to roll new ability scores</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl mx-auto">
                    {abilities.map((ability) => {
                      const score = character.abilityScores?.[ability.id as keyof typeof character.abilityScores] || 10
                      const mod = calculateModifier(score)
                      return (
                        <div key={ability.id} className="p-4 rounded-lg border border-border bg-card/50 text-center">
                          <h4 className="font-serif font-bold text-foreground">{ability.name}</h4>
                          <p className="text-xs text-muted-foreground">{ability.abbr}</p>
                          <div className="flex items-center justify-center gap-2 mt-3">
                            <span className="text-3xl font-bold text-gold-gradient">{score}</span>
                            <span className={`text-lg font-medium ${mod >= 0 ? "text-green-400" : "text-red-400"}`}>
                              ({formatModifier(mod)})
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Step 4: Background */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="font-serif text-2xl font-bold text-gold-gradient">Choose Your Background</h2>
                <p className="text-muted-foreground mt-2">Where did your story begin?</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {backgrounds.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => updateCharacter({ background: bg.id })}
                    className={`p-4 rounded-lg border text-left transition-all duration-300 hover:scale-[1.02] ${
                      character.background === bg.id
                        ? "border-primary bg-primary/10 border-glow shadow-lg"
                        : "border-border bg-card hover:border-primary/50 hover:bg-accent/30"
                    }`}
                  >
                    <h3 className="font-serif font-bold text-foreground text-lg">{bg.name}</h3>
                    <p className="text-sm text-primary mt-1">{bg.feature}</p>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {bg.skillProficiencies.map((skill) => (
                        <Badge key={skill} variant="outline" className="text-xs border-border text-muted-foreground">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Details */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="font-serif text-2xl font-bold text-gold-gradient">Character Details</h2>
                <p className="text-muted-foreground mt-2">Add personality and backstory</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
                <div className="space-y-2">
                  <Label htmlFor="personality" className="text-foreground font-medium">
                    Personality Traits
                  </Label>
                  <Textarea
                    id="personality"
                    placeholder="I always have a plan for what to do when things go wrong..."
                    value={character.personalityTraits}
                    onChange={(e) => updateCharacter({ personalityTraits: e.target.value })}
                    className="bg-input border-border focus:border-primary min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ideals" className="text-foreground font-medium">
                    Ideals
                  </Label>
                  <Textarea
                    id="ideals"
                    placeholder="Freedom. The sea is freedom—the freedom to go anywhere..."
                    value={character.ideals}
                    onChange={(e) => updateCharacter({ ideals: e.target.value })}
                    className="bg-input border-border focus:border-primary min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bonds" className="text-foreground font-medium">
                    Bonds
                  </Label>
                  <Textarea
                    id="bonds"
                    placeholder="I'll never forget the crushing defeat my company suffered..."
                    value={character.bonds}
                    onChange={(e) => updateCharacter({ bonds: e.target.value })}
                    className="bg-input border-border focus:border-primary min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="flaws" className="text-foreground font-medium">
                    Flaws
                  </Label>
                  <Textarea
                    id="flaws"
                    placeholder="I have a 'tell' that reveals when I'm lying..."
                    value={character.flaws}
                    onChange={(e) => updateCharacter({ flaws: e.target.value })}
                    className="bg-input border-border focus:border-primary min-h-[100px]"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="backstory" className="text-foreground font-medium">
                    Backstory
                  </Label>
                  <Textarea
                    id="backstory"
                    placeholder="Write your character's history..."
                    value={character.backstory}
                    onChange={(e) => updateCharacter({ backstory: e.target.value })}
                    className="bg-input border-border focus:border-primary min-h-[150px]"
                  />
                </div>

                <div className="md:col-span-2">
                  <Button
                    variant="outline"
                    className="w-full border-primary/50 text-primary hover:bg-primary/10 gap-2 bg-transparent"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate Backstory with AI
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              disabled={currentStep === 0}
              className="border-border hover:border-primary/50 bg-transparent"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button
                onClick={() => setCurrentStep((prev) => prev + 1)}
                disabled={!canProceed()}
                className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                className="bg-primary hover:bg-primary/90 border-glow shadow-lg shadow-primary/25"
              >
                <Check className="h-4 w-4 mr-2" />
                Create Character
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
