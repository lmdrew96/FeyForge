"use client"

/**
 * Step 1: Basics
 * Name, Race, Class, Background, Alignment selection
 */

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sparkles, Loader2, Shield, Sword, User, BookOpen, ChevronRight, Check } from "lucide-react"
import ReactMarkdown from "react-markdown"
import type { CharacterCreationData } from "@/lib/character/types"
import type { Open5eRace, Open5eClass, Open5eBackground } from "@/lib/open5e-api"
import { open5eApi } from "@/lib/open5e-api"
import { ALIGNMENTS } from "@/lib/character/constants"

interface Step1BasicsProps {
  data: CharacterCreationData
  onUpdate: (updates: Partial<CharacterCreationData>) => void
  onGenerateName?: () => Promise<void>
  raceData: Open5eRace | null
  classData: Open5eClass | null
  backgroundData: Open5eBackground | null
  onRaceSelect: (race: Open5eRace | null) => void
  onClassSelect: (cls: Open5eClass | null) => void
  onBackgroundSelect: (bg: Open5eBackground | null) => void
}

export function Step1Basics({ 
  data, 
  onUpdate, 
  onGenerateName,
  raceData,
  classData,
  backgroundData,
  onRaceSelect,
  onClassSelect,
  onBackgroundSelect,
}: Step1BasicsProps) {
  const [isGeneratingName, setIsGeneratingName] = useState(false)
  const [races, setRaces] = useState<Open5eRace[]>([])
  const [classes, setClasses] = useState<Open5eClass[]>([])
  const [backgrounds, setBackgrounds] = useState<Open5eBackground[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("race")
  const [selectedSubrace, setSelectedSubrace] = useState<string | null>(data.subrace || null)

  // Load data from Open5e API
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [racesData, classesData, backgroundsData] = await Promise.all([
          open5eApi.getRaces("srd"),
          open5eApi.getClasses("srd"),
          open5eApi.getBackgrounds("srd"),
        ])
        setRaces(racesData)
        setClasses(classesData)
        setBackgrounds(backgroundsData)
      } catch (error) {
        console.error("Failed to load Open5e data:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleGenerateName = async () => {
    if (!onGenerateName) return
    setIsGeneratingName(true)
    try {
      await onGenerateName()
    } finally {
      setIsGeneratingName(false)
    }
  }

  const handleRaceSelect = (race: Open5eRace) => {
    onRaceSelect(race)
    onUpdate({ 
      race: race.name,
      subrace: undefined,
    })
    setSelectedSubrace(null)
    
    // Parse racial ability bonuses
    const racialBonuses: Partial<Record<string, number>> = {}
    if (race.asi) {
      for (const bonus of race.asi) {
        for (const attr of bonus.attributes) {
          const abilityName = attr.toLowerCase()
          racialBonuses[abilityName] = (racialBonuses[abilityName] || 0) + bonus.value
        }
      }
    }
    onUpdate({ racialBonuses })
  }

  const handleSubraceSelect = (subraceName: string) => {
    setSelectedSubrace(subraceName)
    onUpdate({ subrace: subraceName })
    
    // Add subrace bonuses to racial bonuses
    if (raceData) {
      const subrace = raceData.subraces?.find(s => s.name === subraceName)
      const racialBonuses: Partial<Record<string, number>> = {}
      
      // Base race bonuses
      if (raceData.asi) {
        for (const bonus of raceData.asi) {
          for (const attr of bonus.attributes) {
            const abilityName = attr.toLowerCase()
            racialBonuses[abilityName] = (racialBonuses[abilityName] || 0) + bonus.value
          }
        }
      }
      
      // Subrace bonuses
      if (subrace?.asi) {
        for (const bonus of subrace.asi) {
          for (const attr of bonus.attributes) {
            const abilityName = attr.toLowerCase()
            racialBonuses[abilityName] = (racialBonuses[abilityName] || 0) + bonus.value
          }
        }
      }
      
      onUpdate({ racialBonuses })
    }
  }

  const handleClassSelect = (cls: Open5eClass) => {
    onClassSelect(cls)
    onUpdate({ class: cls.name })
  }

  const handleBackgroundSelect = (bg: Open5eBackground) => {
    onBackgroundSelect(bg)
    onUpdate({ background: bg.name })
  }

  // Get selected subrace data
  const selectedSubraceData = useMemo(() => {
    if (!raceData || !selectedSubrace) return null
    return raceData.subraces?.find(s => s.name === selectedSubrace) || null
  }, [raceData, selectedSubrace])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading character options...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="font-serif text-2xl font-bold text-gold-gradient">Create Your Hero</h2>
        <p className="text-muted-foreground mt-2">Choose your race, class, and begin your legend</p>
      </div>

      {/* Character Name */}
      <div className="max-w-md mx-auto space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground font-medium">
            Character Name
          </Label>
          <div className="flex gap-2">
            <Input
              id="name"
              placeholder="Enter your character's name..."
              value={data.name || ""}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="bg-input border-border focus:border-primary focus:ring-primary/20"
            />
            {onGenerateName && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleGenerateName}
                disabled={isGeneratingName}
                className="border-primary/50 text-primary hover:bg-primary/10 shrink-0"
              >
                {isGeneratingName ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Race, Class, Background Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="race" className="gap-2">
            <User className="h-4 w-4" />
            Race
            {data.race && <Check className="h-3 w-3 text-green-500" />}
          </TabsTrigger>
          <TabsTrigger value="class" className="gap-2">
            <Sword className="h-4 w-4" />
            Class
            {data.class && <Check className="h-3 w-3 text-green-500" />}
          </TabsTrigger>
          <TabsTrigger value="background" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Background
            {data.background && <Check className="h-3 w-3 text-green-500" />}
          </TabsTrigger>
        </TabsList>

        {/* Race Selection */}
        <TabsContent value="race" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Race List */}
            <ScrollArea className="h-[400px] rounded-lg border border-border p-2">
              <div className="space-y-2">
                {races.map((race) => (
                  <Card
                    key={race.slug}
                    className={`cursor-pointer transition-all hover:border-primary/50 ${
                      data.race === race.name ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => handleRaceSelect(race)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{race.name}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {race.asi_desc}
                          </p>
                        </div>
                        {data.race === race.name && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* Race Details */}
            <div className="rounded-lg border border-border p-4">
              {raceData ? (
                <ScrollArea className="h-[380px]">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-serif text-xl font-bold">{raceData.name}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline">Size: {raceData.size}</Badge>
                        <Badge variant="outline">Speed: {raceData.speed?.walk || 30}ft</Badge>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Ability Score Increase</h4>
                      <p className="text-sm">
                        <ReactMarkdown>{raceData.asi_desc}</ReactMarkdown>
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Traits</h4>
                      <div className="text-sm prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{raceData.traits}</ReactMarkdown>
                      </div>
                    </div>

                    {/* Subraces */}
                    {raceData.subraces && raceData.subraces.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-2">Subraces</h4>
                        <div className="space-y-2">
                          {raceData.subraces.map((subrace) => (
                            <Card
                              key={subrace.slug}
                              className={`cursor-pointer transition-all hover:border-primary/50 ${
                                selectedSubrace === subrace.name ? "border-primary bg-primary/5" : ""
                              }`}
                              onClick={() => handleSubraceSelect(subrace.name)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h5 className="font-medium text-sm">{subrace.name}</h5>
                                    <p className="text-xs text-muted-foreground">
                                      <ReactMarkdown>{subrace.asi_desc}</ReactMarkdown>
                                    </p>
                                  </div>
                                  {selectedSubrace === subrace.name && (
                                    <Check className="h-4 w-4 text-primary" />
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                        
                        {/* Selected Subrace Details */}
                        {selectedSubraceData && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                            <h5 className="font-medium text-sm mb-1">{selectedSubraceData.name} Traits</h5>
                            <div className="text-sm prose prose-sm prose-invert max-w-none">
                              <ReactMarkdown>{selectedSubraceData.traits}</ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Languages</h4>
                      <p className="text-sm">{raceData.languages}</p>
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-[380px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Select a race to see details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Class Selection */}
        <TabsContent value="class" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Class List */}
            <ScrollArea className="h-[400px] rounded-lg border border-border p-2">
              <div className="space-y-2">
                {classes.map((cls) => (
                  <Card
                    key={cls.slug}
                    className={`cursor-pointer transition-all hover:border-primary/50 ${
                      data.class === cls.name ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => handleClassSelect(cls)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{cls.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            Hit Die: {cls.hit_dice}
                          </p>
                        </div>
                        {data.class === cls.name && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* Class Details */}
            <div className="rounded-lg border border-border p-4">
              {classData ? (
                <ScrollArea className="h-[380px]">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-serif text-xl font-bold">{classData.name}</h3>
                      <Badge variant="outline" className="mt-2">Hit Die: {classData.hit_dice}</Badge>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Hit Points</h4>
                      <p className="text-sm">{classData.hp_at_1st_level}</p>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Proficiencies</h4>
                      <div className="space-y-1 text-sm">
                        <p><strong>Armor:</strong> {classData.prof_armor || "None"}</p>
                        <p><strong>Weapons:</strong> {classData.prof_weapons || "None"}</p>
                        <p><strong>Saving Throws:</strong> {classData.prof_saving_throws}</p>
                        <p><strong>Skills:</strong> {classData.prof_skills}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Starting Equipment</h4>
                      <div className="text-sm prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{classData.equipment}</ReactMarkdown>
                      </div>
                    </div>

                    {classData.spellcasting_ability && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-1">Spellcasting</h4>
                        <p className="text-sm">Spellcasting Ability: {classData.spellcasting_ability}</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-[380px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Sword className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Select a class to see details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Background Selection */}
        <TabsContent value="background" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Background List */}
            <ScrollArea className="h-[400px] rounded-lg border border-border p-2">
              <div className="space-y-2">
                {backgrounds.map((bg) => (
                  <Card
                    key={bg.slug}
                    className={`cursor-pointer transition-all hover:border-primary/50 ${
                      data.background === bg.name ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => handleBackgroundSelect(bg)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{bg.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            Skills: {bg.skill_proficiencies}
                          </p>
                        </div>
                        {data.background === bg.name && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* Background Details */}
            <div className="rounded-lg border border-border p-4">
              {backgroundData ? (
                <ScrollArea className="h-[380px]">
                  <div className="space-y-4">
                    <h3 className="font-serif text-xl font-bold">{backgroundData.name}</h3>

                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Skill Proficiencies</h4>
                      <p className="text-sm">{backgroundData.skill_proficiencies}</p>
                    </div>

                    {backgroundData.tool_proficiencies && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-1">Tool Proficiencies</h4>
                        <p className="text-sm">{backgroundData.tool_proficiencies}</p>
                      </div>
                    )}

                    {backgroundData.languages && (
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-1">Languages</h4>
                        <p className="text-sm">{backgroundData.languages}</p>
                      </div>
                    )}

                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Equipment</h4>
                      <p className="text-sm">{backgroundData.equipment}</p>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Feature: {backgroundData.feature}</h4>
                      <div className="text-sm prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{backgroundData.feature_desc}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-[380px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Select a background to see details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Alignment Selection */}
      <div className="max-w-2xl mx-auto">
        <Label className="text-foreground font-medium mb-2 block">Alignment</Label>
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

      {/* Summary */}
      {(data.race || data.class || data.background) && (
        <div className="max-w-2xl mx-auto p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Character Summary</h4>
          <div className="flex flex-wrap gap-2">
            {data.race && (
              <Badge variant="secondary">
                {data.subrace ? `${data.subrace} ` : ""}{data.race}
              </Badge>
            )}
            {data.class && <Badge variant="secondary">{data.class}</Badge>}
            {data.background && <Badge variant="secondary">{data.background}</Badge>}
            {data.alignment && <Badge variant="outline">{data.alignment}</Badge>}
          </div>
        </div>
      )}
    </div>
  )
}
