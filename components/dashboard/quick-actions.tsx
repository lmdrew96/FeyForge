import { Button } from "@/components/ui/button"
import { Dices, UserPlus, Sparkles, Scroll, Swords, BookOpenCheck } from "lucide-react"
import Link from "next/link"

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
      <h2 className="font-serif text-base sm:text-xl mb-3 sm:mb-4 text-silver text-center">Quick Actions</h2>
      <div className="grid gap-2 sm:gap-3 grid-cols-3 sm:grid-cols-3">
        {quickActions.map((action) => (
          <Button
            key={action.name}
            variant="outline"
            className="h-auto py-2.5 sm:py-4 px-2 sm:px-3 flex-col gap-1 sm:gap-2 rounded-xl sm:rounded-2xl border-border/20 hover:border-primary/30 bg-transparent hover:bg-primary/5 transition-colors active:scale-[0.97] min-h-[60px] sm:min-h-[80px]"
            asChild
          >
            <Link href={action.href}>
              <action.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${action.colorClass}`} />
              <span className="text-[10px] sm:text-xs font-medium text-center leading-tight">{action.name}</span>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  )
}
