import { Button } from "@/components/ui/button"
import { Dices, UserPlus, Sparkles, Scroll, Swords, BookOpenCheck } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const quickActions = [
  {
    name: "Roll Dice",
    icon: Dices,
    href: "/dice",
    colorClass: "text-primary",
  },
  {
    name: "Generate NPC",
    icon: Sparkles,
    href: "/npcs/generate",
    colorClass: "text-accent",
  },
  {
    name: "New Character",
    icon: UserPlus,
    href: "/characters/new",
    colorClass: "text-primary",
  },
  {
    name: "Start Session",
    icon: Scroll,
    href: "/sessions/new",
    colorClass: "text-accent",
  },
  {
    name: "Run Combat",
    icon: Swords,
    href: "/combat",
    colorClass: "text-primary",
  },
  {
    name: "Rules Lookup",
    icon: BookOpenCheck,
    href: "/codex",
    colorClass: "text-primary",
  },
]

export function QuickActions() {
  return (
    <div>
      <h2 className="font-serif text-title-lg spacing-mb-title text-silver text-center">Quick Actions</h2>
      <div className="grid gap-fluid-md grid-cols-3 sm:grid-cols-3">
        {quickActions.map((action) => (
          <Button
            key={action.name}
            variant="outline"
            className="h-auto py-action px-fluid-sm flex-col gap-fluid-xs rounded-card border-border/20 hover:border-primary/30 bg-transparent hover:bg-primary/5 transition-colors active:scale-[0.97] min-h-action"
            asChild
          >
            <Link href={action.href}>
              <action.icon className={cn("icon-md", action.colorClass)} />
              <span className="text-label-sm font-medium text-center leading-tight">{action.name}</span>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  )
}
