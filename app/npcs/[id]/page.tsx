"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  UserCircle,
  MapPin,
  Shield,
  Users,
  Target,
  Heart,
  Pencil,
  Trash2,
} from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { useNPCsStore, type NPC } from "@/lib/npcs-store"

export default function NPCDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { getNPC, deleteNPC } = useNPCsStore()
  const [npc, setNPC] = useState<NPC | null>(null)

  useEffect(() => {
    const id = params.id as string
    const found = getNPC(id)
    if (found) {
      setNPC(found)
    }
  }, [params.id, getNPC])

  const handleDelete = () => {
    if (npc) {
      deleteNPC(npc.id)
      router.push("/npcs")
    }
  }

  const getImportanceColor = () => {
    switch (npc?.importance) {
      case "key":
        return "bg-fey-gold/20 border-fey-gold/50 text-fey-gold"
      case "major":
        return "bg-fey-purple/20 border-fey-purple/50 text-fey-purple"
      case "minor":
        return "bg-muted border-border text-muted-foreground"
      default:
        return "bg-muted border-border text-muted-foreground"
    }
  }

  const getImportanceLabel = () => {
    switch (npc?.importance) {
      case "key":
        return "Key NPC"
      case "major":
        return "Major NPC"
      case "minor":
        return "Minor NPC"
      default:
        return npc?.importance
    }
  }

  if (!npc) {
    return (
      <AppShell pageTitle="NPC">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <UserCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-display font-bold text-foreground mb-4">
              NPC Not Found
            </h1>
            <p className="text-foreground/70 mb-6">
              The NPC you&apos;re looking for doesn&apos;t exist.
            </p>
            <Button asChild className="bg-fey-cyan hover:bg-fey-cyan/80">
              <Link href="/npcs">Return to NPCs</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell pageTitle={npc.name}>
      <div className="p-3 sm:p-4 lg:p-6 w-full max-w-full">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Back Button */}
          <Link
            href="/npcs"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to NPCs
          </Link>

          {/* Main Card */}
          <Card className="bg-card/80 backdrop-blur-sm border-border overflow-hidden">
            {/* Portrait Header */}
            <div className="relative h-48 sm:h-64 bg-gradient-to-br from-fey-forest/20 to-fey-purple/20">
              {npc.imageUrl ? (
                <img
                  src={npc.imageUrl}
                  alt={npc.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-muted/50 flex items-center justify-center">
                    <UserCircle className="w-16 h-16 sm:w-20 sm:h-20 text-fey-cyan" />
                  </div>
                </div>
              )}
              <Badge className={`absolute top-4 right-4 border ${getImportanceColor()}`}>
                {getImportanceLabel()}
              </Badge>
            </div>

            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-display">{npc.name}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2 mt-2">
                    {npc.race && <span>{npc.race}</span>}
                    {npc.race && npc.class && <span>·</span>}
                    {npc.class && <span>{npc.class}</span>}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete NPC?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete {npc.name}.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Quick Info */}
              <div className="flex flex-wrap gap-3">
                {npc.role && (
                  <Badge variant="outline" className="bg-fey-cyan/10 border-fey-cyan/30 text-fey-cyan">
                    <Shield className="w-3 h-3 mr-1" />
                    {npc.role}
                  </Badge>
                )}
                {npc.faction && (
                  <Badge variant="outline" className="bg-fey-purple/10 border-fey-purple/30 text-fey-purple">
                    <Users className="w-3 h-3 mr-1" />
                    {npc.faction}
                  </Badge>
                )}
                {npc.location && (
                  <Badge variant="outline" className="bg-fey-forest/10 border-fey-forest/30 text-fey-forest">
                    <MapPin className="w-3 h-3 mr-1" />
                    {npc.location}
                  </Badge>
                )}
              </div>

              {/* Personality */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-fey-cyan" />
                  Personality
                </h3>
                <p className="text-foreground leading-relaxed">
                  {npc.personality || "No personality notes yet."}
                </p>
              </div>

              {/* Goals */}
              {npc.goals && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-fey-gold" />
                    Goals & Motivations
                  </h3>
                  <p className="text-foreground leading-relaxed">{npc.goals}</p>
                </div>
              )}

              {/* Relationships */}
              {npc.relationships && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-fey-purple" />
                    Relationships
                  </h3>
                  <p className="text-foreground leading-relaxed">{npc.relationships}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
