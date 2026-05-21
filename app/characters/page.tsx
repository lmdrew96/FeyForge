"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { AppShell } from "@/components/app-shell"
import Link from "next/link"
import { Plus, Trash2, Shield, Sword } from "lucide-react"
import { toast } from "sonner"
import { CLASS_COLORS } from "@/lib/character/constants"
import { cn } from "@/lib/utils"
import type { Id } from "@/convex/_generated/dataModel"

function CharacterCard({
  character,
  onDelete,
}: {
  character: {
    _id: Id<"characters">
    name: string
    race: string
    characterClass: string
    level: number
    hitPoints: { current: number; max: number; temp: number }
    background?: string
    subrace?: string
  }
  onDelete: (id: Id<"characters">) => void
}) {
  const raceName = character.subrace
    ? `${character.subrace} ${character.race}`
    : character.race

  const classColorClass = CLASS_COLORS[character.characterClass.toLowerCase()] ?? "bg-gray-600 text-white"

  return (
    <div
      className="rounded-xl p-5 transition-all duration-200 hover:scale-[1.01] group relative"
      style={{
        background: "var(--scene-surface)",
        border: "1px solid var(--scene-border)",
        cursor: "pointer",
      }}
    >
      {/* Delete button */}
      <button
        onClick={(e) => { e.preventDefault(); onDelete(character._id) }}
        className="absolute top-3 right-3 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "var(--scene-text-muted)" }}
        title="Delete character"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {/* Name + icon */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: "color-mix(in srgb, var(--scene-accent) 15%, var(--scene-surface))",
            border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, transparent)",
          }}
        >
          <Shield className="h-5 w-5" style={{ color: "var(--scene-accent)" }} />
        </div>
        <div className="min-w-0">
          <h3
            className="font-bold truncate"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            {character.name}
          </h3>
          <p className="text-xs truncate" style={{ color: "var(--scene-text-muted)" }}>
            {raceName}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", classColorClass)}>
          {character.characterClass}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
        >
          Lv {character.level}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full ml-auto"
          style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
        >
          {character.hitPoints.current}/{character.hitPoints.max} HP
        </span>
      </div>

      {character.background && (
        <p className="text-xs mt-2" style={{ color: "var(--scene-text-muted)" }}>
          {character.background}
        </p>
      )}
    </div>
  )
}

export default function CharactersPage() {
  const characters = useQuery(api.characters.list)
  const removeCharacter = useMutation(api.characters.remove)

  const handleDelete = async (id: Id<"characters">) => {
    if (!confirm("Delete this character? This cannot be undone.")) return
    try {
      await removeCharacter({ id })
      toast.success("Character deleted.")
    } catch {
      toast.error("Failed to delete character.")
    }
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
            >
              Characters
            </h1>
            {characters && characters.length > 0 && (
              <p className="text-sm mt-1" style={{ color: "var(--scene-text-muted)" }}>
                {characters.length} adventurer{characters.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <Link
            href="/characters/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "var(--scene-accent)",
              color: "var(--scene-bg)",
            }}
          >
            <Plus className="h-4 w-4" />
            New Character
          </Link>
        </div>

        {/* Loading skeletons */}
        {characters === undefined && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-5 animate-pulse"
                style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", height: 120 }}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {characters && characters.length === 0 && (
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            <Sword
              className="h-12 w-12 mx-auto mb-4"
              style={{ color: "var(--scene-text-muted)", opacity: 0.4 }}
            />
            <h2
              className="text-lg font-bold mb-2"
              style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
            >
              No characters yet
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--scene-text-muted)" }}>
              Your roster awaits. Roll a hero and begin.
            </p>
            <Link
              href="/characters/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
            >
              <Plus className="h-4 w-4" />
              Create your first character
            </Link>
          </div>
        )}

        {/* Character grid */}
        {characters && characters.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {characters.map((char) => (
              <Link key={char._id} href={`/characters/${char._id}`}>
                <CharacterCard
                  character={char}
                  onDelete={handleDelete}
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
