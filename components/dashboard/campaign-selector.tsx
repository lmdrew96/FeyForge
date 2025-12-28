"use client"

import { Check, ChevronDown, Crown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCampaignsStore } from "@/lib/campaigns-store"
import { cn } from "@/lib/utils"

export function CampaignSelector() {
  const { campaigns, activeCampaignId, setActiveCampaign, getActiveCampaign } = useCampaignsStore()
  const activeCampaign = getActiveCampaign()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between bg-card/80 border-border hover:border-fey-cyan hover:bg-card transition-colors"
        >
          <div className="flex items-center gap-2 truncate">
            <Crown className="h-4 w-4 text-fey-gold shrink-0" />
            <span className="truncate">{activeCampaign?.name || "Select Campaign"}</span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        {campaigns.map((campaign) => (
          <DropdownMenuItem
            key={campaign.id}
            onClick={() => setActiveCampaign(campaign.id)}
            className={cn("cursor-pointer", campaign.id === activeCampaignId && "bg-fey-cyan/10")}
          >
            <div className="flex items-center gap-2 w-full">
              {campaign.id === activeCampaignId ? (
                <Check className="h-4 w-4 text-fey-cyan shrink-0" />
              ) : (
                <div className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{campaign.name}</span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer text-fey-cyan">
          <Plus className="h-4 w-4 mr-2" />
          Create New Campaign
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
