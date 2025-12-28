"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import type { Character } from "@/lib/characters-store"
import { ChevronDown, Plus, Sparkles, Star, Trash2, Users } from "lucide-react"
import { useState } from "react"

interface FeaturesPanelProps {
  character: Character
  isEditing: boolean
  onUpdate: (data: Partial<Character>) => void
}

export function FeaturesPanel({ character, isEditing, onUpdate }: FeaturesPanelProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(["racial", "class"])
  const [newFeature, setNewFeature] = useState({ racial: "", class: "", feat: "" })

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]))
  }

  const addFeature = (type: "racialTraits" | "classFeatures" | "feats", value: string) => {
    if (value.trim()) {
      onUpdate({
        [type]: [...character[type], value.trim()],
      })
      setNewFeature((prev) => ({
        ...prev,
        [type.replace("Traits", "").replace("Features", "").replace("feats", "feat")]: "",
      }))
    }
  }

  const removeFeature = (type: "racialTraits" | "classFeatures" | "feats", index: number) => {
    onUpdate({
      [type]: character[type].filter((_, i) => i !== index),
    })
  }

  const sections = [
    {
      id: "racial",
      title: "Racial Traits",
      icon: <Users className="h-4 w-4" />,
      items: character.racialTraits,
      type: "racialTraits" as const,
      color: "text-fey-purple",
    },
    {
      id: "class",
      title: "Class Features",
      icon: <Sparkles className="h-4 w-4" />,
      items: character.classFeatures,
      type: "classFeatures" as const,
      color: "text-fey-cyan",
    },
    {
      id: "feats",
      title: "Feats",
      icon: <Star className="h-4 w-4" />,
      items: character.feats,
      type: "feats" as const,
      color: "text-fey-gold",
    },
  ]

  return (
    <Card className="p-4 bg-card/80 backdrop-blur-sm border-fey-sage/30">
      <h2 className="text-lg font-display font-semibold mb-4 text-fey-gold">Features & Traits</h2>

      <div className="space-y-3">
        {sections.map((section) => (
          <Collapsible
            key={section.id}
            open={expandedSections.includes(section.id)}
            onOpenChange={() => toggleSection(section.id)}
          >
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-fey-forest/10 transition-colors">
                <div className="flex items-center gap-2">
                  <span className={section.color}>{section.icon}</span>
                  <span className="font-medium text-foreground">{section.title}</span>
                  <Badge variant="secondary" className="ml-2 bg-fey-sage/20">
                    {section.items.length}
                  </Badge>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    expandedSections.includes(section.id) ? "rotate-180" : ""
                  }`}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-4 pr-2 py-2 space-y-2">
                {section.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-background/50"
                  >
                    <span className="text-sm text-foreground">{item}</span>
                    {isEditing && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeFeature(section.type, index)}
                        className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {section.items.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">No {section.title.toLowerCase()} yet</p>
                )}
                {isEditing && (
                  <div className="flex gap-2 pt-2">
                    <Input
                      placeholder={`Add ${section.title.slice(0, -1).toLowerCase()}...`}
                      value={newFeature[section.id as keyof typeof newFeature] || ""}
                      onChange={(e) => setNewFeature((prev) => ({ ...prev, [section.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addFeature(section.type, newFeature[section.id as keyof typeof newFeature] || "")
                        }
                      }}
                      className="h-8 text-sm bg-background border-fey-sage/30"
                    />
                    <Button
                      size="icon"
                      onClick={() => addFeature(section.type, newFeature[section.id as keyof typeof newFeature] || "")}
                      className="h-8 w-8 bg-fey-forest hover:bg-fey-forest/80 shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </Card>
  )
}
