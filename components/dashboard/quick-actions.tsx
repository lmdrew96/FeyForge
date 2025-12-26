import { Button } from "@/components/ui/button"
import { Dices, UserPlus, Sparkles, Scroll, Swords, BookOpenCheck } from "lucide-react"
import Link from "next/link"

const quickActions = [
  {
    name: "Roll Dice",
    icon: Dices,
    href: "/dice",
    color: "#95B851",
  },
  {
    name: "Generate NPC",
    icon: Sparkles,
    href: "/npcs/generate",
    color: "#931BE4",
  },
  {
    name: "New Character",
    icon: UserPlus,
    href: "/characters/new",
    color: "#47D1BB",
  },
  {
    name: "Start Session",
    icon: Scroll,
    href: "/sessions/new",
    color: "#521BC0",
  },
  {
    name: "Run Combat",
    icon: Swords,
    href: "/combat",
    color: "#95B851",
  },
  {
    name: "Rules Lookup",
    icon: BookOpenCheck,
    href: "/codex",
    color: "#47D1BB",
  },
]

export function QuickActions() {
  return (
    <div>
      <h2 className="font-serif text-xl mb-4 text-silver text-center">Quick Actions</h2>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        {quickActions.map((action) => (
          <Button
            key={action.name}
            variant="outline"
            className="h-auto py-4 px-3 flex-col gap-2 rounded-2xl border-border/20 hover:border-primary/30 bg-transparent hover:bg-primary/5 transition-colors"
            asChild
          >
            <Link href={action.href}>
              <action.icon className="h-6 w-6" style={{ color: action.color }} />
              <span className="text-xs font-medium">{action.name}</span>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  )
}
