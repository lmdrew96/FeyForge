"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Character } from "@/lib/characters-store"
import { Download, Pencil, Save, Trash2, User, X } from "lucide-react"

interface CharacterHeaderProps {
  character: Character
  isEditing: boolean
  onUpdate: (data: Partial<Character>) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
  onExport: () => void
}

export function CharacterHeader({
  character,
  isEditing,
  onUpdate,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onExport,
}: CharacterHeaderProps) {
  const classData = {
    barbarian: { color: "bg-red-600 text-white" },
    bard: { color: "bg-pink-500 text-white" },
    cleric: { color: "bg-yellow-500 text-black" },
    druid: { color: "bg-green-600 text-white" },
    fighter: { color: "bg-orange-600 text-white" },
    monk: { color: "bg-blue-500 text-white" },
    paladin: { color: "bg-yellow-400 text-black" },
    ranger: { color: "bg-emerald-600 text-white" },
    rogue: { color: "bg-gray-700 text-white" },
    sorcerer: { color: "bg-purple-600 text-white" },
    warlock: { color: "bg-violet-800 text-white" },
    wizard: { color: "bg-indigo-600 text-white" },
  }

  const classStyle = classData[character.characterClass as keyof typeof classData] || {
    color: "bg-primary text-primary-foreground",
  }

  return (
    <Card className="p-4 md:p-6 bg-card/80 backdrop-blur-sm border-fey-sage/30">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* Portrait */}
        <div className="relative group flex-shrink-0">
          <Avatar className="h-20 w-20 md:h-24 md:w-24 border-2 border-fey-gold/50">
            <AvatarImage src={character.imageUrl || "/placeholder.svg"} alt={character.name} />
            <AvatarFallback className="bg-fey-forest text-white text-2xl">
              <User className="h-10 w-10" />
            </AvatarFallback>
          </Avatar>
          {isEditing && (
            <Button
              size="icon"
              variant="secondary"
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Name & Info */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              value={character.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="text-2xl md:text-3xl font-display font-bold mb-2 bg-transparent border-fey-cyan/30 focus:border-fey-cyan"
            />
          ) : (
            <h1 className="md:text-3xl font-display font-bold text-foreground truncate text-lg">{character.name}</h1>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge className={classStyle.color}>
              {character.characterClass.charAt(0).toUpperCase() + character.characterClass.slice(1)} {character.level}
            </Badge>
            <Badge variant="outline" className="border-fey-sage text-foreground">
              {character.subrace || character.race.charAt(0).toUpperCase() + character.race.slice(1)}
            </Badge>
            <Badge variant="secondary" className="bg-fey-sage/20 text-foreground/70">
              {character.background.charAt(0).toUpperCase() + character.background.slice(1)}
            </Badge>
          </div>
          <p className="text-sm text-foreground/70 mt-1">{character.alignment}</p>
        </div>

        {/* XP - hidden on small screens */}
        <div className="text-right hidden md:block flex-shrink-0">
          <p className="text-sm text-foreground/70">Experience</p>
          <p className="text-lg font-semibold text-fey-gold">{character.experiencePoints.toLocaleString()} XP</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 sm:ml-4">
          {isEditing ? (
            <>
              <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1.5">
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
              <Button size="sm" onClick={onSave} className="gap-1.5 bg-fey-forest hover:bg-fey-forest/80">
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">Save</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onExport}
                className="gap-1.5 border-fey-sage/30 bg-transparent"
              >
                <Download className="h-4 w-4" />
                <span className="hidden lg:inline">Export</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="gap-1.5 border-fey-sage/30 bg-transparent"
              >
                <Pencil className="h-4 w-4" />
                <span className="hidden lg:inline">Edit</span>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5">
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden lg:inline">Delete</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-fey-sage/30 overflow-hidden">
                  <AlertDialogHeader className="min-w-0">
                    <AlertDialogTitle>Delete Character?</AlertDialogTitle>
                    <AlertDialogDescription className="break-words">
                      Are you sure you want to delete {character.name}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-fey-sage/30">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/80">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
