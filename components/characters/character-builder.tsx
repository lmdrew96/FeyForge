"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  open5eApi,
  type Open5eRace,
  type Open5eClass,
  type Open5eBackground,
  type Open5eSpell,
  type ContentSource,
} from "@/lib/open5e-api"
import { abilities, calculateModifier, formatModifier, type Character } from "@/lib/dnd-data"
import { useCharacterStore } from "@/lib/character-store"
import { useRouter } from "next/navigation"
import {
  Sparkles,
  Dices,
  ChevronRight,
  ChevronLeft,
  Check,
  Shield,
  Heart,
  Zap,
  User,
  Loader2,
  Scroll,
  Swords,
  BookOpen,
  Library,
} from "lucide-react"
import ReactMarkdown from "react-markdown"

const steps = ["Basics", "Race", "Class", "Abilities", "Skills", "Background", "Spells", "Details"]

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

// Parse skill choices from prof_skills string like "Choose two from Arcana, History..."
function parseSkillChoices(profSkills: string): { count: number; skills: string[] } {
  const match = profSkills.match(/Choose (\w+)(?: skills)? from (.+)/i)
  if (!match) return { count: 0, skills: [] }

  const countMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
  }
  const count = countMap[match[1].toLowerCase()] || parseInt(match[1]) || 2
  const skills = match[2]
    .split(/,\s*(?:and\s*)?|(?:\s+and\s+)/)
    .map((s) => s.trim())
    .filter(Boolean)

  return { count, skills }
}

// Parse ASI from race data
function parseRacialASI(race: Open5eRace, subrace?: Open5eRace["subraces"][0]): Record<string, number> {
  const bonuses: Record<string, number> = {}

  // Parse base race ASI
  for (const asi of race.asi || []) {
    for (const attr of asi.attributes) {
      const key = attr.toLowerCase().slice(0, 3)
      bonuses[key] = (bonuses[key] || 0) + asi.value
    }
  }

  // Parse subrace ASI
  if (subrace) {
    for (const asi of subrace.asi || []) {
      for (const attr of asi.attributes) {
        const key = attr.toLowerCase().slice(0, 3)
        bonuses[key] = (bonuses[key] || 0) + asi.value
      }
    }
  }

  return bonuses
}

// Get hit die value from string like "1d12"
function getHitDieValue(hitDice: string): number {
  const match = hitDice.match(/d(\d+)/)
  return match ? parseInt(match[1]) : 8
}

export function CharacterBuilder() {
  const router = useRouter()
  const addCharacter = useCharacterStore((state) => state.addCharacter)

  // Loading states
  const [isLoading, setIsLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)

  // Open5e data
  const [races, setRaces] = useState<Open5eRace[]>([])
  const [classes, setClasses] = useState<Open5eClass[]>([])
  const [backgrounds, setBackgrounds] = useState<Open5eBackground[]>([])
  const [availableSpells, setAvailableSpells] = useState<Open5eSpell[]>([])

  // Form state
  const [currentStep, setCurrentStep] = useState(0)
  const [character, setCharacter] = useState<Partial<Character> & { selectedSkills: string[]; selectedCantrips: string[]; selectedSpells: string[] }>({
    name: "",
    race: "",
    subrace: "",
    class: "",
    level: 1,
    background: "",
    alignment: "",
    experiencePoints: 0,
    abilityScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
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
    selectedSkills: [],
    selectedCantrips: [],
    selectedSpells: [],
  })

  const [pointBuyRemaining, setPointBuyRemaining] = useState(27)
  const [abilityMethod, setAbilityMethod] = useState<"point-buy" | "roll">("point-buy")
  const [contentSource, setContentSource] = useState<ContentSource>("all")
  const [isGeneratingName, setIsGeneratingName] = useState(false)
  const [isGeneratingBackstory, setIsGeneratingBackstory] = useState(false)

  // Fetch Open5e data on mount and when content source changes
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true)
        const [racesData, classesData, backgroundsData] = await Promise.all([
          open5eApi.getRaces(contentSource),
          open5eApi.getClasses(contentSource),
          open5eApi.getBackgrounds(contentSource),
        ])
        setRaces(racesData)
        setClasses(classesData)
        setBackgrounds(backgroundsData)
        setLoadingError(null)
      } catch (error) {
        console.error("Failed to fetch Open5e data:", error)
        setLoadingError("Failed to load character data. Please refresh the page.")
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [contentSource])

  // Clear selections when content source changes
  const handleContentSourceChange = (source: ContentSource) => {
    if (source !== contentSource) {
      setContentSource(source)
      // Clear selections that may no longer be valid
      updateCharacter("race", "")
      updateCharacter("subrace", "")
      updateCharacter("class", "")
      updateCharacter("background", "")
      updateCharacter("selectedSkills", [])
      updateCharacter("selectedCantrips", [])
      updateCharacter("selectedSpells", [])
    }
  }

  // Memoize selected class before useEffect that depends on it
  const selectedClass = useMemo(() => classes.find((c) => c.slug === character.class), [classes, character.class])
  
  // Fetch spells when class is selected (for spellcasters)
  useEffect(() => {
    async function fetchSpells() {
      if (!selectedClass?.spellcasting_ability) {
        setAvailableSpells([])
        return
      }
      try {
        const spells = await open5eApi.getSpells({ class: selectedClass.name, level: 0 })
        const level1Spells = await open5eApi.getSpells({ class: selectedClass.name, level: 1 })
        setAvailableSpells([...spells, ...level1Spells])
      } catch (error) {
        console.error("Failed to fetch spells:", error)
      }
    }
    fetchSpells()
  }, [selectedClass])

  const selectedRace = useMemo(() => races.find((r) => r.slug === character.race), [races, character.race])
  const selectedSubrace = useMemo(
    () => selectedRace?.subraces?.find((s) => s.slug === character.subrace),
    [selectedRace, character.subrace]
  )
  // selectedClass is already defined above the useEffect
  const selectedBackground = useMemo(
    () => backgrounds.find((b) => b.slug === character.background),
    [backgrounds, character.background]
  )

  // Calculate racial bonuses
  const racialBonuses = useMemo(() => {
    if (!selectedRace) return {}
    return parseRacialASI(selectedRace, selectedSubrace)
  }, [selectedRace, selectedSubrace])

  // Calculate final ability scores with racial bonuses
  const finalAbilityScores = useMemo(() => {
    if (!character.abilityScores) return { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
    return {
      str: character.abilityScores.str + (racialBonuses.str || 0),
      dex: character.abilityScores.dex + (racialBonuses.dex || 0),
      con: character.abilityScores.con + (racialBonuses.con || 0),
      int: character.abilityScores.int + (racialBonuses.int || 0),
      wis: character.abilityScores.wis + (racialBonuses.wis || 0),
      cha: character.abilityScores.cha + (racialBonuses.cha || 0),
    }
  }, [character.abilityScores, racialBonuses])

  // Get skill choices for selected class
  const skillChoices = useMemo(() => {
    if (!selectedClass) return { count: 0, skills: [] }
    return parseSkillChoices(selectedClass.prof_skills)
  }, [selectedClass])

  // Check if class is a spellcaster
  const isSpellcaster = !!selectedClass?.spellcasting_ability

  // Cantrips and spells known at level 1 (simplified)
  const spellsKnown = useMemo(() => {
    if (!isSpellcaster) return { cantrips: 0, spells: 0 }
    // Simplified spell slots for level 1
    const className = selectedClass?.name.toLowerCase()
    if (className === "wizard") return { cantrips: 3, spells: 6 }
    if (className === "sorcerer") return { cantrips: 4, spells: 2 }
    if (className === "bard") return { cantrips: 2, spells: 4 }
    if (className === "cleric") return { cantrips: 3, spells: 0 } // Clerics prepare spells
    if (className === "druid") return { cantrips: 2, spells: 0 } // Druids prepare spells
    if (className === "warlock") return { cantrips: 2, spells: 2 }
    // Paladin and Ranger don't get cantrips and don't get spells until level 2
    if (className === "paladin" || className === "ranger") return { cantrips: 0, spells: 0 }
    return { cantrips: 2, spells: 2 }
  }, [isSpellcaster, selectedClass])

  const updateCharacter = <K extends keyof typeof character>(key: K, value: (typeof character)[K]) => {
    setCharacter((prev) => ({ ...prev, [key]: value }))
  }

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
      updateCharacter("abilityScores", {
        ...character.abilityScores,
        [ability]: value,
      })
    }
  }

  const rollAbilityScores = () => {
    const rollStat = () => {
      const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1)
      rolls.sort((a, b) => b - a)
      return rolls.slice(0, 3).reduce((a, b) => a + b, 0)
    }

    updateCharacter("abilityScores", {
      str: rollStat(),
      dex: rollStat(),
      con: rollStat(),
      int: rollStat(),
      wis: rollStat(),
      cha: rollStat(),
    })
  }

  const toggleSkill = (skill: string) => {
    const current = character.selectedSkills || []
    if (current.includes(skill)) {
      updateCharacter(
        "selectedSkills",
        current.filter((s) => s !== skill)
      )
    } else if (current.length < skillChoices.count) {
      updateCharacter("selectedSkills", [...current, skill])
    }
  }

  const toggleCantrip = (spellSlug: string) => {
    const current = character.selectedCantrips || []
    if (current.includes(spellSlug)) {
      updateCharacter(
        "selectedCantrips",
        current.filter((s) => s !== spellSlug)
      )
    } else if (current.length < spellsKnown.cantrips) {
      updateCharacter("selectedCantrips", [...current, spellSlug])
    }
  }

  const toggleSpell = (spellSlug: string) => {
    const current = character.selectedSpells || []
    if (current.includes(spellSlug)) {
      updateCharacter(
        "selectedSpells",
        current.filter((s) => s !== spellSlug)
      )
    } else if (current.length < spellsKnown.spells) {
      updateCharacter("selectedSpells", [...current, spellSlug])
    }
  }

  const handleSubmit = () => {
    const hitDie = selectedClass ? getHitDieValue(selectedClass.hit_dice) : 8
    const conMod = calculateModifier(finalAbilityScores.con)
    const maxHP = hitDie + conMod

    // Collect all proficiencies
    const proficiencies = [
      ...(character.selectedSkills || []),
      ...(selectedBackground?.skill_proficiencies?.split(", ") || []),
    ]

    // Collect features from race and class
    const features: string[] = []
    if (selectedRace?.traits) features.push(selectedRace.traits)
    if (selectedSubrace?.traits) features.push(selectedSubrace.traits)

    const newCharacter: Character = {
      id: crypto.randomUUID(),
      name: character.name || "Unnamed Hero",
      race: selectedRace?.name || "Human",
      subrace: selectedSubrace?.name,
      class: selectedClass?.name || "Fighter",
      level: 1,
      background: selectedBackground?.name || "Acolyte",
      alignment: character.alignment || "True Neutral",
      experiencePoints: 0,
      abilityScores: finalAbilityScores,
      proficiencies,
      hitPoints: { current: maxHP, max: maxHP, temp: 0 },
      armorClass: 10 + calculateModifier(finalAbilityScores.dex),
      initiative: calculateModifier(finalAbilityScores.dex),
      speed: selectedRace?.speed?.walk || 30,
      personalityTraits: character.personalityTraits || "",
      ideals: character.ideals || "",
      bonds: character.bonds || "",
      flaws: character.flaws || "",
      backstory: character.backstory || "",
      equipment: character.equipment || [],
      spells: [...(character.selectedCantrips || []), ...(character.selectedSpells || [])],
      features,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    try {
      addCharacter(newCharacter)
      router.push(`/characters/${newCharacter.id}`)
    } catch (error) {
      console.error("Error adding character:", error)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return character.name && character.name.length > 0
      case 1:
        // Require subrace if the selected race has subraces
        if (!character.race) return false
        if (selectedRace?.subraces && selectedRace.subraces.length > 0 && !character.subrace) return false
        return true
      case 2:
        return character.class
      case 3:
        return true
      case 4:
        return character.selectedSkills.length === skillChoices.count
      case 5:
        return character.background
      case 6:
        // Check cantrips and spells separately for spellcasters
        if (!isSpellcaster) return true
        const hasEnoughCantrips = (character.selectedCantrips?.length || 0) >= spellsKnown.cantrips
        const hasEnoughSpells = spellsKnown.spells === 0 || (character.selectedSpells?.length || 0) >= spellsKnown.spells
        return hasEnoughCantrips && hasEnoughSpells
      case 7:
        return true
      default:
        return false
    }
  }

  // Skip spells step if not a spellcaster
  const actualSteps = isSpellcaster ? steps : steps.filter((s) => s !== "Spells")
  const actualCurrentStep = currentStep
  const getStepIndex = (stepName: string) => actualSteps.indexOf(stepName)

  const previewStats = {
    hp: (selectedClass ? getHitDieValue(selectedClass.hit_dice) : 8) + calculateModifier(finalAbilityScores.con),
    ac: 10 + calculateModifier(finalAbilityScores.dex),
    initiative: formatModifier(calculateModifier(finalAbilityScores.dex)),
    speed: selectedRace?.speed?.walk || 30,
  }

  const handleGenerateName = async () => {
    setIsGeneratingName(true)
    try {
      const response = await fetch("/api/character/generate-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          race: selectedRace?.name,
          characterClass: selectedClass?.name,
          gender: character.gender,
        }),
      })

      if (!response.ok) throw new Error("Failed to generate name")

      const data = await response.json()
      updateCharacter("name", data.name)
    } catch (error) {
      console.error("Name generation error:", error)
    } finally {
      setIsGeneratingName(false)
    }
  }

  const handleGenerateBackstory = async () => {
    setIsGeneratingBackstory(true)
    try {
      const response = await fetch("/api/character/generate-backstory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: character.name,
          race: selectedRace?.name,
          characterClass: selectedClass?.name,
          background: selectedBackground?.name,
          alignment: character.alignment,
          personality: `${character.personalityTraits}, ${character.ideals}, ${character.bonds}, ${character.flaws}`,
        }),
      })

      if (!response.ok) throw new Error("Failed to generate backstory")

      const data = await response.json()
      updateCharacter("backstory", data.backstory)
    } catch (error) {
      console.error("Backstory generation error:", error)
    } finally {
      setIsGeneratingBackstory(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
          <p className="text-muted-foreground">Loading character options from Open5e...</p>
        </div>
      </div>
    )
  }

  if (loadingError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-destructive">{loadingError}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Content Source Toggle */}
      <div className="flex items-center justify-center gap-2">
        <Library className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Content:</span>
        <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
          <button
            onClick={() => handleContentSourceChange("srd")}
            className={`px-3 py-1 text-sm rounded-md transition-all ${
              contentSource === "srd"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            SRD Only
          </button>
          <button
            onClick={() => handleContentSourceChange("all")}
            className={`px-3 py-1 text-sm rounded-md transition-all ${
              contentSource === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Content
          </button>
        </div>
        <span className="text-xs text-muted-foreground">
          ({races.length} races, {classes.length} classes, {backgrounds.length} backgrounds)
        </span>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
        {actualSteps.map((step, index) => (
          <div key={step} className="flex items-center">
            <button
              onClick={() => index < actualCurrentStep && setCurrentStep(index)}
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-300 ${
                index === actualCurrentStep
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : index < actualCurrentStep
                    ? "bg-accent/80 text-foreground cursor-pointer hover:bg-accent"
                    : "bg-muted/50 text-muted-foreground"
              }`}
            >
              {index < actualCurrentStep ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <span className="w-4 text-center text-sm font-bold">{index + 1}</span>
              )}
              <span className="text-sm font-medium hidden sm:inline">{step}</span>
            </button>
            {index < actualSteps.length - 1 && (
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
          {selectedRace && (
            <Badge variant="outline" className="border-primary/50 text-primary">
              {selectedRace.name}
              {selectedSubrace && ` (${selectedSubrace.name})`}
            </Badge>
          )}
          {selectedClass && (
            <Badge variant="outline" className="border-primary/50 text-primary">
              {selectedClass.name}
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
          {actualSteps[actualCurrentStep] === "Basics" && (
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
                    onChange={(e) => updateCharacter("name", e.target.value)}
                    className="bg-input border-border focus:border-primary focus:ring-primary/20 text-lg h-12"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground font-medium">Alignment</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {alignments.map((alignment) => (
                      <button
                        key={alignment}
                        onClick={() => updateCharacter("alignment", alignment)}
                        className={`p-2 text-sm rounded-lg border transition-all ${
                          character.alignment === alignment
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        {alignment}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={handleGenerateName}
                  disabled={isGeneratingName}
                  className="w-full border-primary/50 text-primary hover:bg-primary/10 gap-2 bg-transparent mt-4"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGeneratingName ? "Generating..." : "Generate Random Name with AI"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 1: Race */}
          {actualSteps[actualCurrentStep] === "Race" && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="font-serif text-2xl font-bold text-gold-gradient">Choose Your Race</h2>
                <p className="text-muted-foreground mt-2">Your ancestry shapes who you are</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {races.map((race) => (
                  <button
                    key={race.slug}
                    onClick={() => updateCharacter("race", race.slug)}
                    className={`p-4 rounded-lg border text-left transition-all duration-300 hover:scale-[1.02] ${
                      character.race === race.slug
                        ? "border-primary bg-primary/10 border-glow shadow-lg"
                        : "border-border bg-card hover:border-primary/50 hover:bg-accent/30"
                    }`}
                  >
                    <h3 className="font-serif font-bold text-foreground text-lg">{race.name}</h3>
                    <div className="text-sm text-primary mt-1 prose prose-sm prose-invert max-w-none [&>p]:m-0">
                      <ReactMarkdown>{race.asi_desc}</ReactMarkdown>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{race.size} • Speed: {race.speed?.walk || 30} ft.</p>
                    {race.vision && (
                      <Badge variant="outline" className="mt-2 text-xs border-border text-muted-foreground">
                        {race.vision.includes("60") ? "Darkvision 60ft" : race.vision.includes("120") ? "Darkvision 120ft" : "Normal Vision"}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>

              {selectedRace?.subraces && selectedRace.subraces.length > 0 && (
                <div className="mt-6 p-4 rounded-lg bg-accent/20 border border-border">
                  <Label className="text-foreground font-medium mb-3 block">Choose Subrace</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedRace.subraces.map((subrace) => (
                      <button
                        key={subrace.slug}
                        onClick={() => updateCharacter("subrace", subrace.slug)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          character.subrace === subrace.slug
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        <h4 className="font-medium text-foreground">{subrace.name}</h4>
                        <div className="text-sm text-primary mt-1 prose prose-sm prose-invert max-w-none [&>p]:m-0">
                          <ReactMarkdown>{subrace.asi_desc}</ReactMarkdown>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedRace && (
                <Card className="bg-accent/10 border-border mt-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-serif">{selectedRace.name} Traits</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <div className="prose prose-sm prose-invert max-w-none [&>p]:my-1 [&_strong]:text-foreground [&_em]:text-primary">
                      <ReactMarkdown>{`**Age.** ${selectedRace.age}\n\n**Size.** ${selectedRace.size}\n\n**Languages.** ${selectedRace.languages}${selectedRace.traits ? `\n\n**Traits.**\n${selectedRace.traits}` : ''}`}</ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 2: Class */}
          {actualSteps[actualCurrentStep] === "Class" && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="font-serif text-2xl font-bold text-gold-gradient">Choose Your Class</h2>
                <p className="text-muted-foreground mt-2">Your path to adventure</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {classes.map((cls) => (
                  <button
                    key={cls.slug}
                    onClick={() => {
                      updateCharacter("class", cls.slug)
                      updateCharacter("selectedSkills", [])
                      updateCharacter("selectedCantrips", [])
                      updateCharacter("selectedSpells", [])
                    }}
                    className={`p-4 rounded-lg border text-left transition-all duration-300 hover:scale-[1.02] ${
                      character.class === cls.slug
                        ? "border-primary bg-primary/10 border-glow shadow-lg"
                        : "border-border bg-card hover:border-primary/50 hover:bg-accent/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif font-bold text-foreground text-lg">{cls.name}</h3>
                      <Badge variant="outline" className="border-red-500/50 text-red-400">
                        {cls.hit_dice}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Saves: {cls.prof_saving_throws}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {cls.spellcasting_ability && (
                        <Badge className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30">
                          <Scroll className="h-3 w-3 mr-1" />
                          Spellcaster
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {selectedClass && (
                <Card className="bg-accent/10 border-border mt-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-serif flex items-center gap-2">
                      <Swords className="h-5 w-5" />
                      {selectedClass.name} Proficiencies
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p><strong>Hit Points:</strong> {selectedClass.hp_at_1st_level}</p>
                    <p><strong>Armor:</strong> {selectedClass.prof_armor || "None"}</p>
                    <p><strong>Weapons:</strong> {selectedClass.prof_weapons}</p>
                    <p><strong>Tools:</strong> {selectedClass.prof_tools || "None"}</p>
                    <p><strong>Skills:</strong> {selectedClass.prof_skills}</p>
                    {selectedClass.spellcasting_ability && (
                      <p><strong>Spellcasting:</strong> {selectedClass.spellcasting_ability}</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 3: Abilities */}
          {actualSteps[actualCurrentStep] === "Abilities" && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="font-serif text-2xl font-bold text-gold-gradient">Ability Scores</h2>
                <p className="text-muted-foreground mt-2">Define your character's capabilities</p>
                {Object.keys(racialBonuses).length > 0 && (
                  <p className="text-primary text-sm mt-2">
                    Racial bonuses: {Object.entries(racialBonuses).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(", ")}
                  </p>
                )}
              </div>

              <Tabs
                value={abilityMethod}
                onValueChange={(v) => {
                  const newMethod = v as "point-buy" | "roll"
                  setAbilityMethod(newMethod)
                  // Reset to default values when switching to point-buy
                  if (newMethod === "point-buy") {
                    updateCharacter("abilityScores", { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })
                    setPointBuyRemaining(27)
                  }
                }}
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
                      const baseScore = character.abilityScores?.[ability.id as keyof typeof character.abilityScores] || 8
                      const bonus = racialBonuses[ability.id] || 0
                      const finalScore = baseScore + bonus
                      const mod = calculateModifier(finalScore)
                      return (
                        <div key={ability.id} className="p-4 rounded-lg border border-border bg-card/50">
                          <div className="text-center">
                            <h4 className="font-serif font-bold text-foreground">{ability.name}</h4>
                            <p className="text-xs text-muted-foreground">{ability.abbr}</p>
                          </div>
                          <div className="flex items-center justify-center gap-2 mt-3">
                            <span className="text-3xl font-bold text-gold-gradient">{finalScore}</span>
                            {bonus > 0 && <span className="text-sm text-primary">(+{bonus})</span>}
                            <span className={`text-lg font-medium ${mod >= 0 ? "text-green-400" : "text-red-400"}`}>
                              ({formatModifier(mod)})
                            </span>
                          </div>
                          <Slider
                            value={[baseScore]}
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
                      const baseScore = character.abilityScores?.[ability.id as keyof typeof character.abilityScores] || 8
                      const bonus = racialBonuses[ability.id] || 0
                      const finalScore = baseScore + bonus
                      const mod = calculateModifier(finalScore)
                      return (
                        <div key={ability.id} className="p-4 rounded-lg border border-border bg-card/50 text-center">
                          <h4 className="font-serif font-bold text-foreground">{ability.name}</h4>
                          <p className="text-xs text-muted-foreground">{ability.abbr}</p>
                          <div className="flex items-center justify-center gap-2 mt-3">
                            <span className="text-3xl font-bold text-gold-gradient">{finalScore}</span>
                            {bonus > 0 && <span className="text-sm text-primary">(+{bonus})</span>}
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

          {/* Step 4: Skills */}
          {actualSteps[actualCurrentStep] === "Skills" && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="font-serif text-2xl font-bold text-gold-gradient">Choose Skills</h2>
                <p className="text-muted-foreground mt-2">
                  Select {skillChoices.count} skill{skillChoices.count > 1 ? "s" : ""} from your class options
                </p>
                <p className="text-primary text-sm mt-2">
                  Selected: {character.selectedSkills.length} / {skillChoices.count}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl mx-auto">
                {skillChoices.skills.map((skill) => {
                  const isSelected = character.selectedSkills.includes(skill)
                  const canSelect = isSelected || character.selectedSkills.length < skillChoices.count
                  return (
                    <button
                      key={skill}
                      onClick={() => canSelect && toggleSkill(skill)}
                      disabled={!canSelect}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : canSelect
                            ? "border-border bg-card hover:border-primary/50"
                            : "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <span className="font-medium text-foreground">{skill}</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {selectedBackground && (
                <div className="mt-6 p-4 rounded-lg bg-accent/20 border border-border max-w-3xl mx-auto">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Background Skills:</strong> Your {selectedBackground.name} background
                    will also grant proficiency in: {selectedBackground.skill_proficiencies}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Background */}
          {actualSteps[actualCurrentStep] === "Background" && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="font-serif text-2xl font-bold text-gold-gradient">Choose Your Background</h2>
                <p className="text-muted-foreground mt-2">Where did your story begin?</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {backgrounds.map((bg) => (
                  <button
                    key={bg.slug}
                    onClick={() => updateCharacter("background", bg.slug)}
                    className={`p-4 rounded-lg border text-left transition-all duration-300 hover:scale-[1.02] ${
                      character.background === bg.slug
                        ? "border-primary bg-primary/10 border-glow shadow-lg"
                        : "border-border bg-card hover:border-primary/50 hover:bg-accent/30"
                    }`}
                  >
                    <h3 className="font-serif font-bold text-foreground text-lg">{bg.name}</h3>
                    <p className="text-sm text-primary mt-1">{bg.feature}</p>
                    <p className="text-xs text-muted-foreground mt-2">Skills: {bg.skill_proficiencies}</p>
                  </button>
                ))}
              </div>

              {selectedBackground && (
                <Card className="bg-accent/10 border-border mt-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-serif flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      {selectedBackground.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p><strong>Feature: {selectedBackground.feature}</strong></p>
                    <p>{selectedBackground.feature_desc}</p>
                    <Separator className="my-2" />
                    <p><strong>Equipment:</strong> {selectedBackground.equipment}</p>
                    {selectedBackground.languages && (
                      <p><strong>Languages:</strong> {selectedBackground.languages}</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 6: Spells (only for spellcasters) */}
          {actualSteps[actualCurrentStep] === "Spells" && isSpellcaster && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="font-serif text-2xl font-bold text-gold-gradient">Choose Your Spells</h2>
                <p className="text-muted-foreground mt-2">
                  Select {spellsKnown.cantrips} cantrip{spellsKnown.cantrips > 1 ? "s" : ""}
                  {spellsKnown.spells > 0 && ` and ${spellsKnown.spells} 1st-level spell${spellsKnown.spells > 1 ? "s" : ""}`}
                </p>
                <div className="flex justify-center gap-4 text-sm mt-2">
                  <span className={character.selectedCantrips.length >= spellsKnown.cantrips ? "text-green-400" : "text-primary"}>
                    Cantrips: {character.selectedCantrips.length} / {spellsKnown.cantrips}
                  </span>
                  {spellsKnown.spells > 0 && (
                    <span className={character.selectedSpells.length >= spellsKnown.spells ? "text-green-400" : "text-primary"}>
                      Spells: {character.selectedSpells.length} / {spellsKnown.spells}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                {/* Cantrips */}
                <div>
                  <h3 className="font-serif text-lg font-bold text-foreground mb-4">Cantrips</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {availableSpells
                      .filter((s) => s.level_int === 0)
                      .map((spell) => {
                        const isSelected = character.selectedCantrips.includes(spell.slug)
                        const canSelect = isSelected || character.selectedCantrips.length < spellsKnown.cantrips
                        return (
                          <button
                            key={spell.slug}
                            onClick={() => canSelect && toggleCantrip(spell.slug)}
                            disabled={!canSelect}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              isSelected
                                ? "border-primary bg-primary/10"
                                : canSelect
                                  ? "border-border bg-card hover:border-primary/50"
                                  : "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox checked={isSelected} className="pointer-events-none" />
                              <span className="font-medium text-foreground">{spell.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{spell.desc.slice(0, 100)}...</p>
                          </button>
                        )
                      })}
                  </div>
                </div>

                {/* 1st Level Spells */}
                {spellsKnown.spells > 0 && (
                  <div>
                    <h3 className="font-serif text-lg font-bold text-foreground mb-4">1st Level Spells</h3>
                    <ScrollArea className="h-[300px]">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pr-4">
                        {availableSpells
                          .filter((s) => s.level_int === 1)
                          .map((spell) => {
                            const isSelected = character.selectedSpells.includes(spell.slug)
                            const canSelect = isSelected || character.selectedSpells.length < spellsKnown.spells
                            return (
                              <button
                                key={spell.slug}
                                onClick={() => canSelect && toggleSpell(spell.slug)}
                                disabled={!canSelect}
                                className={`p-3 rounded-lg border text-left transition-all ${
                                  isSelected
                                    ? "border-primary bg-primary/10"
                                    : canSelect
                                      ? "border-border bg-card hover:border-primary/50"
                                      : "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Checkbox checked={isSelected} className="pointer-events-none" />
                                  <span className="font-medium text-foreground">{spell.name}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {spell.school} • {spell.casting_time}
                                </p>
                              </button>
                            )
                          })}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 7: Details */}
          {actualSteps[actualCurrentStep] === "Details" && (
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
                    onChange={(e) => updateCharacter("personalityTraits", e.target.value)}
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
                    onChange={(e) => updateCharacter("ideals", e.target.value)}
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
                    onChange={(e) => updateCharacter("bonds", e.target.value)}
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
                    onChange={(e) => updateCharacter("flaws", e.target.value)}
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
                    onChange={(e) => updateCharacter("backstory", e.target.value)}
                    className="bg-input border-border focus:border-primary min-h-[150px]"
                  />
                </div>

                <div className="md:col-span-2">
                  <Button
                    variant="outline"
                    onClick={handleGenerateBackstory}
                    disabled={isGeneratingBackstory || !character.name}
                    className="w-full border-primary/50 text-primary hover:bg-primary/10 gap-2 bg-transparent"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isGeneratingBackstory ? "Generating..." : "Generate Backstory with AI"}
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
              disabled={actualCurrentStep === 0}
              className="border-border hover:border-primary/50 bg-transparent"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {actualCurrentStep < actualSteps.length - 1 ? (
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
