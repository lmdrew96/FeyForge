"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Crown, Users } from "lucide-react"

const campaigns = [
  { id: "1", name: "Curse of Strahd", role: "DM", players: 4 },
  { id: "2", name: "Waterdeep Dragon Heist", role: "Player", players: 5 },
  { id: "3", name: "Homebrew: The Lost Kingdom", role: "DM", players: 3 },
]

export function CampaignSelector() {
  const [selectedCampaign, setSelectedCampaign] = useState(campaigns[0].id)

  const currentCampaign = campaigns.find((c) => c.id === selectedCampaign)

  return (
    <Card className="campaign-scroll bg-card border-border overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/30 shadow-lg">
              <Crown className="h-6 w-6 text-primary animate-crown-glow" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider">Active Campaign</p>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger className="w-full bg-input border-border focus:border-primary h-10 font-serif text-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {campaigns.map((campaign) => (
                    <SelectItem
                      key={campaign.id}
                      value={campaign.id}
                      className="focus:bg-accent focus:text-accent-foreground font-serif"
                    >
                      <div className="flex items-center gap-2">
                        <span>{campaign.name}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            campaign.role === "DM"
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {campaign.role}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-center hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/30 border border-border">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold font-serif text-gold-gradient">{currentCampaign?.players}</p>
            </div>
          </div>
          <Button
            size="icon"
            variant="outline"
            className="border-border hover:border-primary/50 bg-transparent hover:bg-accent/50 h-10 w-10"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
