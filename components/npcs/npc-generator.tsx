"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useNPCStore, npcRaces, npcOccupations, type NPC } from "@/lib/npc-store"
import { useActiveCampaignId } from "@/lib/hooks/use-campaign-data"
import { Sparkles, Save, RefreshCw, User, MapPin, Volume2, Edit } from "lucide-react"
import { NPCEditDialog } from "./npc-edit-dialog"
import { cn } from "@/lib/utils"

export function NPCGenerator() {
  const addNPC = useNPCStore((state) => state.addNPC)
  const activeCampaignId = useActiveCampaignId()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedNPC, setGeneratedNPC] = useState<Partial<NPC> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [options, setOptions] = useState({
    prompt: "",
    location: "",
    occupation: "",
    race: "",
  })
  const [isEditing, setIsEditing] = useState(false)

  const generateNPC = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch("/api/npc/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      })

      if (!response.ok) {
        throw new Error("Failed to generate NPC")
      }

      const data = await response.json()
      setGeneratedNPC({
        ...data.npc,
        id: crypto.randomUUID(),
        campaignId: activeCampaignId || "",
        location: options.location || "Unknown",
        relationship: "neutral",
        status: "alive",
        tags: [data.npc.occupation, data.npc.race].filter(Boolean),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    } catch (err) {
      setError("Failed to generate NPC. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const saveNPC = () => {
    if (!generatedNPC) return

    addNPC(generatedNPC as NPC)
    setGeneratedNPC(null)
  }

  const regenerate = () => {
    generateNPC()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 min-w-0">
      {/* Generation Options */}
      <Card className="bg-card/80 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-fey-cyan" />
            Generate NPC
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Custom Prompt (Optional)</Label>
            <Textarea
              placeholder="Describe the NPC you want... e.g., 'A shady information broker who knows everyone's secrets'"
              value={options.prompt}
              onChange={(e) => setOptions((prev) => ({ ...prev, prompt: e.target.value }))}
              className="bg-background/50 min-h-[100px]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Race</Label>
              <Select value={options.race} onValueChange={(v) => setOptions((prev) => ({ ...prev, race: v }))}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Any race" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {npcRaces.map((race) => (
                    <SelectItem key={race} value={race}>
                      {race}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Occupation</Label>
              <Select
                value={options.occupation}
                onValueChange={(v) => setOptions((prev) => ({ ...prev, occupation: v }))}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Any occupation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {npcOccupations.map((occ) => (
                    <SelectItem key={occ} value={occ}>
                      {occ}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                placeholder="e.g., Tavern, Market"
                value={options.location}
                onChange={(e) => setOptions((prev) => ({ ...prev, location: e.target.value }))}
                className="bg-background/50"
              />
            </div>
          </div>

          <Button
            className="w-full bg-fey-cyan hover:bg-fey-cyan/90 text-white"
            onClick={generateNPC}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate NPC
              </>
            )}
          </Button>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}
        </CardContent>
      </Card>

      {/* Generated NPC Preview */}
      <Card className={cn(
        "bg-card/80 backdrop-blur-sm border-border",
        generatedNPC && "border-fey-cyan/50"
      )}>
        <CardHeader>
          <CardTitle className="text-lg">Generated NPC</CardTitle>
        </CardHeader>
        <CardContent>
          {!generatedNPC ? (
            <div className="text-center py-12">
              <User className="h-16 w-16 mx-auto text-muted-foreground opacity-30 mb-4" />
              <p className="text-muted-foreground">
                Your generated NPC will appear here. <br />
                Click Generate to create a new NPC!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-fey-gold">{generatedNPC.name}</h2>
                  <p className="text-muted-foreground">
                    {generatedNPC.age} {generatedNPC.race} {generatedNPC.occupation}
                  </p>
                  <Badge variant="outline" className="mt-2 border-fey-cyan/20">
                    {generatedNPC.alignment}
                  </Badge>
                </div>
              </div>

              {/* Appearance */}
              <div>
                <h3 className="text-sm font-medium text-fey-cyan mb-1">Appearance</h3>
                <p className="text-sm">{generatedNPC.appearance}</p>
              </div>

              {/* Personality */}
              <div>
                <h3 className="text-sm font-medium text-fey-cyan mb-2">Personality</h3>
                <div className="flex flex-wrap gap-2">
                  {generatedNPC.personality?.map((trait) => (
                    <Badge key={trait} variant="outline" className="border-fey-cyan/30">
                      {trait}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Voice & Mannerisms */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-fey-cyan mb-1 flex items-center gap-1">
                    <Volume2 className="h-3 w-3" />
                    Voice
                  </h3>
                  <p className="text-sm">{generatedNPC.voiceDescription}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-fey-cyan mb-1">Mannerisms</h3>
                  <p className="text-sm">{generatedNPC.mannerisms}</p>
                </div>
              </div>

              {/* Motivation */}
              <div>
                <h3 className="text-sm font-medium text-fey-cyan mb-1">Motivation</h3>
                <p className="text-sm">{generatedNPC.motivation}</p>
              </div>

              {/* Secret */}
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <h3 className="text-sm font-medium text-destructive mb-1">Secret</h3>
                <p className="text-sm italic">{generatedNPC.secret}</p>
              </div>

              {/* Backstory */}
              <div>
                <h3 className="text-sm font-medium text-fey-cyan mb-1">Backstory</h3>
                <p className="text-sm">{generatedNPC.backstory}</p>
              </div>

              {/* Location */}
              {options.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {options.location}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={regenerate}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  className="flex-1 bg-fey-cyan hover:bg-fey-cyan/90 text-white" 
                  onClick={saveNPC}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save NPC
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <NPCEditDialog
        npc={generatedNPC}
        open={isEditing}
        onOpenChange={setIsEditing}
        onSave={(edited) => {
          setGeneratedNPC(edited)
          setIsEditing(false)
        }}
        mode="review"
      />
    </div>
  )
}
