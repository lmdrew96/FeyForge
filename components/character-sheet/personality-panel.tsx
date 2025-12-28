"use client"

import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import type { Character } from "@/lib/characters-store"
import { BookOpen, Heart, Link2, MessageCircle, Skull } from "lucide-react"

interface PersonalityPanelProps {
  character: Character
  isEditing: boolean
  onUpdate: (data: Partial<Character>) => void
}

export function PersonalityPanel({ character, isEditing, onUpdate }: PersonalityPanelProps) {
  const sections = [
    {
      key: "personalityTraits",
      label: "Personality Traits",
      icon: <MessageCircle className="h-4 w-4" />,
      value: character.personalityTraits,
    },
    {
      key: "ideals",
      label: "Ideals",
      icon: <Heart className="h-4 w-4" />,
      value: character.ideals,
    },
    {
      key: "bonds",
      label: "Bonds",
      icon: <Link2 className="h-4 w-4" />,
      value: character.bonds,
    },
    {
      key: "flaws",
      label: "Flaws",
      icon: <Skull className="h-4 w-4" />,
      value: character.flaws,
    },
  ] as const

  return (
    <Card className="p-4 bg-card/80 backdrop-blur-sm border-fey-sage/30">
      <h2 className="text-lg font-display font-semibold mb-4 text-fey-gold">Personality</h2>

      <div className="space-y-4">
        {sections.map(({ key, label, icon, value }) => (
          <div key={key}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-fey-cyan">{icon}</span>
              <span className="text-sm font-medium text-foreground">{label}</span>
            </div>
            {isEditing ? (
              <Textarea
                value={value}
                onChange={(e) => onUpdate({ [key]: e.target.value })}
                className="min-h-[60px] text-sm bg-background border-fey-sage/30 resize-none"
                placeholder={`Enter your ${label.toLowerCase()}...`}
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                {value || <span className="italic">Not set</span>}
              </p>
            )}
          </div>
        ))}

        {/* Backstory */}
        <div className="pt-4 border-t border-fey-sage/20">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4 text-fey-gold" />
            <span className="text-sm font-medium text-foreground">Backstory</span>
          </div>
          {isEditing ? (
            <Textarea
              value={character.backstory}
              onChange={(e) => onUpdate({ backstory: e.target.value })}
              className="min-h-[120px] text-sm bg-background border-fey-sage/30 resize-none"
              placeholder="Write your character's backstory..."
            />
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {character.backstory || <span className="italic">No backstory written yet</span>}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
