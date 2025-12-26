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
    <Card className="campaign-scroll overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-copper/30 to-primary/20 flex items-center justify-center border border-copper/40 shadow-lg shrink-0 backdrop-blur-sm">
              <Crown className="h-7 w-7 text-copper animate-crown-glow" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-lavender mb-1.5 uppercase tracking-wider font-medium">Active Campaign</p>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger className="w-full bg-input/50 border-border/50 focus:border-primary h-11 font-serif text-lg backdrop-blur-sm rounded-xl hover:bg-input/70 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-xl backdrop-blur-xl">
                  {campaigns.map((campaign) => (
                    <SelectItem
                      key={campaign.id}
                      value={campaign.id}
                      className="focus:bg-accent focus:text-accent-foreground font-serif rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span>{campaign.name}</span>
                        <span className={campaign.role === "DM" ? "badge-copper" : "badge-lavender"}>
                          {campaign.role}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-center hidden sm:flex items-center gap-2 px-5 py-3 rounded-2xl bg-accent/30 border border-border/50 backdrop-blur-sm">
            <Users className="h-4 w-4 text-lavender" />
            <div>
              <p className="text-3xl font-bold font-serif text-fey-gradient">{currentCampaign?.players}</p>
            </div>
          </div>
          <Button
            size="icon"
            variant="outline"
            className="border-border/50 hover:border-primary/50 bg-transparent hover:bg-accent/50 h-11 w-11 rounded-xl backdrop-blur-sm"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
