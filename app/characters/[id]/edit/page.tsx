"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ALIGNMENTS } from "@/lib/character/constants"
import { ArrowLeft, Sparkles, Loader2, ChevronRight, Wand2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"

type CharDoc = Doc<"characters">

type TraitSuggestion = {
  personalityTraits: string[]
  ideals: string[]
  bonds: string[]
  flaws: string[]
  namesuggestions: string[]
  backstoryHooks: string[]
}

type OptimizeRecommendation = {
  type: "asi" | "feat" | "multiclass"
  name: string
  description: string
  reason: string
  mechanicalBenefit: string
  synergies: string[]
  alternative?: { name: string; reason: string }
}

type OptimizeResponse = {
  recommendations: OptimizeRecommendation[]
  generalAdvice: string
  spellRecommendations?: string[]
  combatTips?: string[]
}

type EditState = {
  name: string
  playerName: string
  level: number
  experiencePoints: number
  alignment: string
  background: string
  age: string
  height: string
  weight: string
  eyes: string
  skin: string
  hair: string
  size: string
  hpMax: number
  personalityTraits: string
  ideals: string
  bonds: string
  flaws: string
  backstory: string
  imageUrl: string
  cp: number
  sp: number
  ep: number
  gp: number
  pp: number
}

const NO_ALIGNMENT = "__none__"

const draftFromCharacter = (c: CharDoc): EditState => ({
  name: c.name,
  playerName: c.playerName ?? "",
  level: c.level,
  experiencePoints: c.experiencePoints,
  alignment: c.alignment ?? "",
  background: c.background ?? "",
  age: c.age ?? "",
  height: c.height ?? "",
  weight: c.weight ?? "",
  eyes: c.eyes ?? "",
  skin: c.skin ?? "",
  hair: c.hair ?? "",
  size: c.size ?? "",
  hpMax: c.hitPoints.max,
  personalityTraits: c.personalityTraits ?? "",
  ideals: c.ideals ?? "",
  bonds: c.bonds ?? "",
  flaws: c.flaws ?? "",
  backstory: c.backstory ?? "",
  imageUrl: c.imageUrl ?? "",
  cp: c.currency.cp,
  sp: c.currency.sp,
  ep: c.currency.ep,
  gp: c.currency.gp,
  pp: c.currency.pp,
})

function FieldGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-6">
      <h2
        className="text-xs uppercase tracking-widest mb-3"
        style={{ color: "var(--scene-text-muted)" }}
      >
        {title}
      </h2>
      <div
        className="rounded-xl p-4 space-y-4"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        {children}
      </div>
    </section>
  )
}

export default function CharacterEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const characterId = id as Id<"characters">
  const router = useRouter()

  const char = useQuery(api.characters.get, { id: characterId })
  const updateCharacter = useMutation(api.characters.update)

  const [draft, setDraft] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  const [generatingBackstory, setGeneratingBackstory] = useState(false)
  const [suggestingTraits, setSuggestingTraits] = useState(false)
  const [traitSuggestions, setTraitSuggestions] = useState<TraitSuggestion | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeResponse, setOptimizeResponse] = useState<OptimizeResponse | null>(null)
  const [optimizeOpen, setOptimizeOpen] = useState(false)

  // Initialize draft once the character loads. We only seed on first load —
  // subsequent updates from the live query shouldn't overwrite in-flight edits.
  useEffect(() => {
    if (char && draft === null) setDraft(draftFromCharacter(char))
  }, [char, draft])

  if (char === undefined) {
    return (
      <AppShell>
        <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl h-32"
              style={{ background: "var(--scene-surface)" }}
            />
          ))}
        </div>
      </AppShell>
    )
  }

  if (!char) {
    return (
      <AppShell>
        <div className="p-6 max-w-3xl mx-auto text-center">
          <p className="text-sm mb-4" style={{ color: "var(--scene-text-muted)" }}>
            Character not found.
          </p>
          <Link
            href="/characters"
            className="text-sm hover:opacity-80 transition-opacity"
            style={{ color: "var(--scene-accent)" }}
          >
            ← Back to characters
          </Link>
        </div>
      </AppShell>
    )
  }

  if (!draft) return null

  const setField = <K extends keyof EditState>(key: K, value: EditState[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleGenerateBackstory = async () => {
    setGeneratingBackstory(true)
    try {
      const res = await fetch("/api/character/generate-backstory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          race: char.race,
          characterClass: char.characterClass,
          background: draft.background,
          alignment: draft.alignment,
          personality: draft.personalityTraits || undefined,
        }),
      })
      if (!res.ok) throw new Error("Failed to generate backstory")
      const data = (await res.json()) as { backstory?: string }
      if (data.backstory) setField("backstory", data.backstory)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate backstory.")
    } finally {
      setGeneratingBackstory(false)
    }
  }

  const handleSuggestTraits = async () => {
    setSuggestingTraits(true)
    try {
      const res = await fetch("/api/character/suggest-traits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          race: char.race,
          class: char.characterClass,
          background: draft.background,
          alignment: draft.alignment,
          partialBackstory: draft.backstory || undefined,
          existingTraits: {
            personalityTraits: draft.personalityTraits || undefined,
            ideals: draft.ideals || undefined,
            bonds: draft.bonds || undefined,
            flaws: draft.flaws || undefined,
          },
        }),
      })
      if (!res.ok) throw new Error("Failed to suggest traits")
      const data = (await res.json()) as { suggestion?: TraitSuggestion }
      if (data.suggestion) setTraitSuggestions(data.suggestion)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't suggest traits.")
    } finally {
      setSuggestingTraits(false)
    }
  }

  const handleOptimize = async () => {
    setOptimizing(true)
    setOptimizeOpen(true)
    setOptimizeResponse(null)
    try {
      const racialBonuses = char.racialBonuses ?? {}
      const currentAbilities = {
        strength: char.baseAbilities.strength + (racialBonuses.strength ?? 0),
        dexterity: char.baseAbilities.dexterity + (racialBonuses.dexterity ?? 0),
        constitution: char.baseAbilities.constitution + (racialBonuses.constitution ?? 0),
        intelligence: char.baseAbilities.intelligence + (racialBonuses.intelligence ?? 0),
        wisdom: char.baseAbilities.wisdom + (racialBonuses.wisdom ?? 0),
        charisma: char.baseAbilities.charisma + (racialBonuses.charisma ?? 0),
      }
      const res = await fetch("/api/character/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          race: char.race,
          class: char.characterClass,
          subclass: char.subclass,
          level: char.level,
          upcomingLevel: Math.min(20, char.level + 1),
          currentAbilities,
          skillProficiencies: char.skillProficiencies,
        }),
      })
      if (!res.ok) throw new Error("Failed to fetch advice")
      const data = (await res.json()) as OptimizeResponse
      setOptimizeResponse(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't fetch level-up advice.")
      setOptimizeOpen(false)
    } finally {
      setOptimizing(false)
    }
  }

  const handleSave = async () => {
    const name = draft.name.trim()
    if (!name) {
      toast.error("Character needs a name.")
      return
    }
    if (draft.level < 1 || draft.level > 20) {
      toast.error("Level must be between 1 and 20.")
      return
    }
    if (draft.hpMax < 1) {
      toast.error("Max HP must be at least 1.")
      return
    }

    setSaving(true)
    try {
      const newHitPoints = {
        ...char.hitPoints,
        max: draft.hpMax,
        // If max drops below current, clamp current. Don't auto-raise current on max raise.
        current: Math.min(char.hitPoints.current, draft.hpMax),
      }

      await updateCharacter({
        id: characterId,
        name,
        playerName: draft.playerName.trim() || undefined,
        level: draft.level,
        experiencePoints: draft.experiencePoints,
        alignment: draft.alignment || undefined,
        background: draft.background.trim() || undefined,
        age: draft.age.trim() || undefined,
        height: draft.height.trim() || undefined,
        weight: draft.weight.trim() || undefined,
        eyes: draft.eyes.trim() || undefined,
        skin: draft.skin.trim() || undefined,
        hair: draft.hair.trim() || undefined,
        size: draft.size.trim() || undefined,
        hitPoints: newHitPoints,
        personalityTraits: draft.personalityTraits.trim() || undefined,
        ideals: draft.ideals.trim() || undefined,
        bonds: draft.bonds.trim() || undefined,
        flaws: draft.flaws.trim() || undefined,
        backstory: draft.backstory.trim() || undefined,
        imageUrl: draft.imageUrl.trim() || undefined,
        currency: {
          cp: draft.cp,
          sp: draft.sp,
          ep: draft.ep,
          gp: draft.gp,
          pp: draft.pp,
        },
      })

      toast.success("Character saved.")
      router.push(`/characters/${characterId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save character.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-12">
        <Link
          href={`/characters/${characterId}`}
          className="inline-flex items-center gap-2 text-sm mb-6 transition-opacity hover:opacity-80"
          style={{ color: "var(--scene-text-muted)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to character sheet
        </Link>

        <div className="mb-6">
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            Edit {char.name}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--scene-text-muted)" }}>
            Class, race, and ability scores are locked in here. For a respec, create a new character.
          </p>
        </div>

        <FieldGroup title="Identity">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="char-name">Name</Label>
              <Input
                id="char-name"
                value={draft.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="char-player">Player name</Label>
              <Input
                id="char-player"
                value={draft.playerName}
                onChange={(e) => setField("playerName", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="char-level">Level</Label>
              <Input
                id="char-level"
                type="number"
                min={1}
                max={20}
                value={draft.level}
                onChange={(e) => setField("level", Number(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="char-xp">Experience points</Label>
              <Input
                id="char-xp"
                type="number"
                min={0}
                value={draft.experiencePoints}
                onChange={(e) => setField("experiencePoints", Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="char-alignment">Alignment</Label>
              <Select
                value={draft.alignment === "" ? NO_ALIGNMENT : draft.alignment}
                onValueChange={(value) => setField("alignment", value === NO_ALIGNMENT ? "" : value)}
              >
                <SelectTrigger id="char-alignment">
                  <SelectValue placeholder="Choose alignment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ALIGNMENT}>None</SelectItem>
                  {ALIGNMENTS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="char-background">Background</Label>
              <Input
                id="char-background"
                value={draft.background}
                onChange={(e) => setField("background", e.target.value)}
                placeholder="Folk hero, Sage…"
              />
            </div>
          </div>
        </FieldGroup>

        <FieldGroup title="Appearance">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label htmlFor="char-age">Age</Label>
              <Input
                id="char-age"
                value={draft.age}
                onChange={(e) => setField("age", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="char-height">Height</Label>
              <Input
                id="char-height"
                value={draft.height}
                onChange={(e) => setField("height", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="char-weight">Weight</Label>
              <Input
                id="char-weight"
                value={draft.weight}
                onChange={(e) => setField("weight", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="char-size">Size</Label>
              <Input
                id="char-size"
                value={draft.size}
                onChange={(e) => setField("size", e.target.value)}
                placeholder="Medium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="char-eyes">Eyes</Label>
              <Input
                id="char-eyes"
                value={draft.eyes}
                onChange={(e) => setField("eyes", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="char-skin">Skin</Label>
              <Input
                id="char-skin"
                value={draft.skin}
                onChange={(e) => setField("skin", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="char-hair">Hair</Label>
              <Input
                id="char-hair"
                value={draft.hair}
                onChange={(e) => setField("hair", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="char-image">Portrait URL</Label>
              <Input
                id="char-image"
                value={draft.imageUrl}
                onChange={(e) => setField("imageUrl", e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
        </FieldGroup>

        <FieldGroup title="Vitals">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="char-hpmax">Max HP</Label>
              <Input
                id="char-hpmax"
                type="number"
                min={1}
                value={draft.hpMax}
                onChange={(e) => setField("hpMax", Math.max(1, Number(e.target.value) || 1))}
              />
              <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                Current HP ({char.hitPoints.current}) will be clamped if it exceeds the new max.
              </p>
            </div>
          </div>
        </FieldGroup>

        <FieldGroup title="Personality">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="char-traits">Personality traits</Label>
              <Textarea
                id="char-traits"
                rows={2}
                value={draft.personalityTraits}
                onChange={(e) => setField("personalityTraits", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="char-ideals">Ideals</Label>
                <Textarea
                  id="char-ideals"
                  rows={2}
                  value={draft.ideals}
                  onChange={(e) => setField("ideals", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="char-bonds">Bonds</Label>
                <Textarea
                  id="char-bonds"
                  rows={2}
                  value={draft.bonds}
                  onChange={(e) => setField("bonds", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="char-flaws">Flaws</Label>
              <Textarea
                id="char-flaws"
                rows={2}
                value={draft.flaws}
                onChange={(e) => setField("flaws", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="char-backstory">Backstory</Label>
                <button
                  type="button"
                  onClick={handleGenerateBackstory}
                  disabled={generatingBackstory}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{
                    background: "color-mix(in srgb, var(--scene-accent) 12%, var(--scene-surface))",
                    color: "var(--scene-accent)",
                    border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, var(--scene-border))",
                  }}
                  title="Generate a backstory from your character's details"
                >
                  {generatingBackstory ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {generatingBackstory ? "Writing…" : "AI generate"}
                </button>
              </div>
              <Textarea
                id="char-backstory"
                rows={5}
                value={draft.backstory}
                onChange={(e) => setField("backstory", e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                Stuck on traits, ideals, bonds, or flaws? Ask the AI for ideas tailored to your build.
              </p>
              <button
                type="button"
                onClick={handleSuggestTraits}
                disabled={suggestingTraits}
                className="shrink-0 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{
                  background: "color-mix(in srgb, var(--scene-accent) 12%, var(--scene-surface))",
                  color: "var(--scene-accent)",
                  border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, var(--scene-border))",
                }}
              >
                {suggestingTraits ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {suggestingTraits ? "Thinking…" : "Suggest traits"}
              </button>
            </div>
          </div>
        </FieldGroup>

        <FieldGroup title="Level-up advisor">
          <div className="flex items-start gap-3">
            <Wand2 className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--scene-accent)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: "var(--scene-text-primary)" }}>
                Get ASI, feat, and multiclass recommendations tailored to{" "}
                <strong>{char.name}</strong> for level {Math.min(20, char.level + 1)}.
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--scene-text-muted)" }}>
                Suggestions are advisory — apply them via the level field above when you&rsquo;re ready.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOptimize}
              disabled={optimizing}
              className="shrink-0 inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                background: "color-mix(in srgb, var(--scene-accent) 12%, var(--scene-surface))",
                color: "var(--scene-accent)",
                border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, var(--scene-border))",
              }}
            >
              {optimizing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {optimizing ? "Thinking…" : "Get advice"}
            </button>
          </div>
        </FieldGroup>

        <FieldGroup title="Currency">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {(["cp", "sp", "ep", "gp", "pp"] as const).map((coin) => (
              <div key={coin} className="space-y-2">
                <Label htmlFor={`char-${coin}`} className="uppercase text-xs">
                  {coin}
                </Label>
                <Input
                  id={`char-${coin}`}
                  type="number"
                  min={0}
                  value={draft[coin]}
                  onChange={(e) => setField(coin, Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            ))}
          </div>
        </FieldGroup>

        <div className="flex items-center justify-end gap-3 mt-8 sticky bottom-4">
          <Button
            variant="outline"
            onClick={() => router.push(`/characters/${characterId}`)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <Dialog
        open={traitSuggestions !== null}
        onOpenChange={(open) => !open && setTraitSuggestions(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trait suggestions</DialogTitle>
            <DialogDescription>
              Click any option to apply it to your character. Suggestions are tailored to your race,
              class, background, and current backstory.
            </DialogDescription>
          </DialogHeader>
          {traitSuggestions && (
            <div className="space-y-5">
              {(
                [
                  ["Personality traits", "personalityTraits", "personalityTraits"],
                  ["Ideals", "ideals", "ideals"],
                  ["Bonds", "bonds", "bonds"],
                  ["Flaws", "flaws", "flaws"],
                ] as const
              ).map(([label, key, field]) => {
                const options = traitSuggestions[key]
                if (!options?.length) return null
                return (
                  <section key={key}>
                    <h3
                      className="text-xs uppercase tracking-widest mb-2"
                      style={{ color: "var(--scene-text-muted)" }}
                    >
                      {label}
                    </h3>
                    <div className="space-y-2">
                      {options.map((option, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setField(field as keyof EditState, option as EditState[keyof EditState])
                            toast.success(`Applied to ${label.toLowerCase()}.`)
                          }}
                          className="w-full text-left rounded-lg p-3 text-sm flex items-start gap-2 transition-opacity hover:opacity-80"
                          style={{
                            background: "var(--scene-surface)",
                            border: "1px solid var(--scene-border)",
                            color: "var(--scene-text-primary)",
                          }}
                        >
                          <span className="flex-1">{option}</span>
                          <ChevronRight
                            className="h-4 w-4 mt-0.5 shrink-0"
                            style={{ color: "var(--scene-text-muted)" }}
                          />
                        </button>
                      ))}
                    </div>
                  </section>
                )
              })}
              {traitSuggestions.backstoryHooks?.length > 0 && (
                <section>
                  <h3
                    className="text-xs uppercase tracking-widest mb-2"
                    style={{ color: "var(--scene-text-muted)" }}
                  >
                    Backstory hooks
                  </h3>
                  <ul
                    className="rounded-lg p-3 space-y-1.5 text-sm list-disc list-inside"
                    style={{
                      background: "var(--scene-surface)",
                      border: "1px solid var(--scene-border)",
                      color: "var(--scene-text-primary)",
                    }}
                  >
                    {traitSuggestions.backstoryHooks.map((hook, i) => (
                      <li key={i}>{hook}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTraitSuggestions(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={optimizeOpen} onOpenChange={setOptimizeOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Level {Math.min(20, char.level + 1)} advisor
            </DialogTitle>
            <DialogDescription>
              Recommendations for {char.name} based on current build and ability scores.
            </DialogDescription>
          </DialogHeader>
          {optimizing && (
            <div className="flex items-center gap-3 py-6" style={{ color: "var(--scene-text-muted)" }}>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Analysing the build…</span>
            </div>
          )}
          {optimizeResponse && !optimizing && (
            <div className="space-y-5">
              {optimizeResponse.recommendations.length === 0 && (
                <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
                  {optimizeResponse.generalAdvice}
                </p>
              )}
              {optimizeResponse.recommendations.map((rec, i) => (
                <section
                  key={i}
                  className="rounded-lg p-4"
                  style={{
                    background: "var(--scene-surface)",
                    border: "1px solid var(--scene-border)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{
                        background: "color-mix(in srgb, var(--scene-accent) 18%, transparent)",
                        color: "var(--scene-accent)",
                      }}
                    >
                      {rec.type}
                    </span>
                    <h3 className="font-semibold" style={{ color: "var(--scene-text-primary)" }}>
                      {rec.name}
                    </h3>
                  </div>
                  <p className="text-sm mb-2" style={{ color: "var(--scene-text-primary)" }}>
                    {rec.description}
                  </p>
                  <p className="text-sm mb-2" style={{ color: "var(--scene-text-muted)" }}>
                    <strong>Why: </strong>
                    {rec.reason}
                  </p>
                  <p className="text-sm mb-2" style={{ color: "var(--scene-text-muted)" }}>
                    <strong>Benefit: </strong>
                    {rec.mechanicalBenefit}
                  </p>
                  {rec.synergies?.length > 0 && (
                    <div className="text-sm mb-1" style={{ color: "var(--scene-text-muted)" }}>
                      <strong>Synergies:</strong>
                      <ul className="list-disc list-inside ml-2">
                        {rec.synergies.map((s, j) => (
                          <li key={j}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {rec.alternative && (
                    <p className="text-xs mt-2" style={{ color: "var(--scene-text-muted)" }}>
                      <em>Alternative — {rec.alternative.name}: {rec.alternative.reason}</em>
                    </p>
                  )}
                </section>
              ))}
              {optimizeResponse.generalAdvice && optimizeResponse.recommendations.length > 0 && (
                <section>
                  <h3
                    className="text-xs uppercase tracking-widest mb-2"
                    style={{ color: "var(--scene-text-muted)" }}
                  >
                    General advice
                  </h3>
                  <div
                    className="text-sm rounded-lg p-3"
                    style={{
                      background: "var(--scene-surface)",
                      border: "1px solid var(--scene-border)",
                      color: "var(--scene-text-primary)",
                    }}
                  >
                    <MarkdownRenderer content={optimizeResponse.generalAdvice} />
                  </div>
                </section>
              )}
              {optimizeResponse.spellRecommendations?.length ? (
                <section>
                  <h3
                    className="text-xs uppercase tracking-widest mb-2"
                    style={{ color: "var(--scene-text-muted)" }}
                  >
                    Spell picks
                  </h3>
                  <ul
                    className="rounded-lg p-3 space-y-1.5 text-sm list-disc list-inside"
                    style={{
                      background: "var(--scene-surface)",
                      border: "1px solid var(--scene-border)",
                      color: "var(--scene-text-primary)",
                    }}
                  >
                    {optimizeResponse.spellRecommendations.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {optimizeResponse.combatTips?.length ? (
                <section>
                  <h3
                    className="text-xs uppercase tracking-widest mb-2"
                    style={{ color: "var(--scene-text-muted)" }}
                  >
                    Combat tips
                  </h3>
                  <ul
                    className="rounded-lg p-3 space-y-1.5 text-sm list-disc list-inside"
                    style={{
                      background: "var(--scene-surface)",
                      border: "1px solid var(--scene-border)",
                      color: "var(--scene-text-primary)",
                    }}
                  >
                    {optimizeResponse.combatTips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOptimizeOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
