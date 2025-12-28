"use client"

import Link from "next/link"
import { Users, Dice6, Play, UserPlus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const actions = [
  {
    label: "New Character",
    icon: Users,
    href: "/create-character",
    color: "text-fey-cyan",
    hoverBorder: "hover:border-fey-cyan",
    hoverShadow: "hover:shadow-fey-cyan/20",
  },
  {
    label: "Roll Dice",
    icon: Dice6,
    href: "/dice",
    color: "text-fey-gold",
    hoverBorder: "hover:border-fey-gold",
    hoverShadow: "hover:shadow-fey-gold/20",
  },
  {
    label: "Start Session",
    icon: Play,
    href: "/sessions",
    color: "text-fey-purple",
    hoverBorder: "hover:border-fey-purple",
    hoverShadow: "hover:shadow-fey-purple/20",
  },
  {
    label: "Add NPC",
    icon: UserPlus,
    href: "/npcs",
    color: "text-fey-forest",
    hoverBorder: "hover:border-fey-forest",
    hoverShadow: "hover:shadow-fey-forest/20",
  },
]

export function QuickActions() {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Dice6 className="h-4 w-4 sm:h-5 sm:w-5 text-fey-gold flex-shrink-0" />
          <span className="truncate">Quick Actions</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => (
          <Link key={action.label} href={action.href} className="block">
            <Button
              variant="outline"
              className={`w-full justify-start gap-2 sm:gap-3 h-10 sm:h-12 text-sm bg-card border-border transition-all duration-200 ${action.hoverBorder} hover:shadow-lg ${action.hoverShadow}`}
            >
              <action.icon className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${action.color}`} />
              <span className="truncate">{action.label}</span>
            </Button>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
