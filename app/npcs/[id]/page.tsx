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
  Skull,
  CircleHelp,
  Eye,
  MessageSquare,
  Book,
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
import { useNPCStore, type NPC } from "@/lib/npc-store"

export default function NPCDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { npcs, deleteNPC, initialize, isInitialized } = useNPCStore()
  const [npc, setNPC] = useState<NPC | null>(null)

  useEffect(() => {
    if (!isInitialized) {
      initialize()
    }
  }, [initialize, isInitialized])

  useEffect(() => {
    const id = params.id as string
    const found = npcs.find(n => n.id === id)
    if (found) {
      setNPC(found)
    }
  }, [params.id, npcs])

  const handleDelete = async () => {
    if (npc) {
      await deleteNPC(npc.id)
      router.push("/npcs")
    }
  }

  const getRelationshipStyle = () => {
    switch (npc?.relationship) {
      case "friendly":
        return { color: "bg-fey-forest/20 border-fey-forest/50 text-fey-forest", icon: Heart, label: "Friendly" }
      case "hostile":
        return { color: "bg-red-500/20 border-red-500/50 text-red-500", icon: Skull, label: "Hostile" }
      case "neutral":
      default:
        return { color: "bg-muted border-border text-muted-foreground", icon: CircleHelp, label: "Neutral" }
    }
  }

  const getStatusStyle = () => {
    switch (npc?.status) {
      case "alive":
        return "bg-fey-forest/20 border-fey-forest/50 text-fey-forest"
      case "dead":
        return "bg-red-500/20 border-red-500/50 text-red-500"
      case "unknown":
      default:
        return "bg-muted border-border text-muted-foreground"
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

  const relationshipStyle = getRelationshipStyle()
  const RelationshipIcon = relationshipStyle.icon

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
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-muted/50 flex items-center justify-center">
                  <UserCircle className="w-16 h-16 sm:w-20 sm:h-20 text-fey-cyan" />
                </div>
              </div>
              <div className="absolute top-4 right-4 flex gap-2">
                <Badge className={`border ${relationshipStyle.color}`}>
                  <RelationshipIcon className="w-3 h-3 mr-1" />
                  {relationshipStyle.label}
                </Badge>
                <Badge className={`border ${getStatusStyle()}`}>
                  {npc.status}
                </Badge>
              </div>
            </div>

            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-display">{npc.name}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2 mt-2">
                    <span>{npc.race}</span>
                    <span>·</span>
                    <span>{npc.age}</span>
                    <span>·</span>
                    <span>{npc.gender}</span>
                    <span>·</span>
                    <span className="capitalize">{npc.alignment}</span>
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
                <Badge variant="outline" className="bg-fey-cyan/10 border-fey-cyan/30 text-fey-cyan">
                  <Shield className="w-3 h-3 mr-1" />
                  {npc.occupation}
                </Badge>
                {npc.faction && (
                  <Badge variant="outline" className="bg-fey-purple/10 border-fey-purple/30 text-fey-purple">
                    <Users className="w-3 h-3 mr-1" />
                    {npc.faction}
                  </Badge>
                )}
                <Badge variant="outline" className="bg-fey-forest/10 border-fey-forest/30 text-fey-forest">
                  <MapPin className="w-3 h-3 mr-1" />
                  {npc.location}
                </Badge>
              </div>

              {/* Appearance */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-fey-cyan" />
                  Appearance
                </h3>
                <p className="text-foreground leading-relaxed">{npc.appearance}</p>
              </div>

              {/* Personality */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-fey-cyan" />
                  Personality
                </h3>
                <div className="flex flex-wrap gap-2">
                  {npc.personality.map((trait, index) => (
                    <Badge key={index} variant="secondary">{trait}</Badge>
                  ))}
                </div>
              </div>

              {/* Mannerisms & Voice */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-fey-purple" />
                    Mannerisms
                  </h3>
                  <p className="text-foreground leading-relaxed">{npc.mannerisms}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Voice
                  </h3>
                  <p className="text-foreground leading-relaxed">{npc.voiceDescription}</p>
                </div>
              </div>

              {/* Motivation */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-fey-gold" />
                  Motivation
                </h3>
                <p className="text-foreground leading-relaxed">{npc.motivation}</p>
              </div>

              {/* Secret */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Skull className="h-4 w-4 text-red-400" />
                  Secret
                </h3>
                <p className="text-foreground leading-relaxed italic">{npc.secret}</p>
              </div>

              {/* Backstory */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Book className="h-4 w-4 text-fey-forest" />
                  Backstory
                </h3>
                <p className="text-foreground leading-relaxed">{npc.backstory}</p>
              </div>

              {/* Tags */}
              {npc.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {npc.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="bg-fey-cyan/10 border-fey-cyan/30 text-fey-cyan">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {npc.notes && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Notes
                  </h3>
                  <p className="text-foreground leading-relaxed">{npc.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
