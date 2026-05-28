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
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"

type CharDoc = Doc<"characters">

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
              <Label htmlFor="char-backstory">Backstory</Label>
              <Textarea
                id="char-backstory"
                rows={5}
                value={draft.backstory}
                onChange={(e) => setField("backstory", e.target.value)}
              />
            </div>
          </div>
        </FieldGroup>

        <FieldGroup title="Currency">
          <div className="grid grid-cols-5 gap-3">
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
    </AppShell>
  )
}
