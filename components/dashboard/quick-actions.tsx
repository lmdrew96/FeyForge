import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dices, UserPlus, Sparkles, Scroll, Swords, BookOpenCheck } from "lucide-react"
import Link from "next/link"

const quickActions = [
  {
    name: "Roll Dice",
    description: "Quick d20 or custom roll",
    icon: Dices,
    href: "/dice",
    primary: true,
  },
  {
    name: "Generate NPC",
    description: "AI-powered creation",
    icon: Sparkles,
    href: "/npcs/generate",
    primary: true,
  },
  {
    name: "New Character",
    description: "Create a PC",
    icon: UserPlus,
    href: "/characters/new",
    primary: false,
  },
  {
    name: "Start Session",
    description: "Begin a new session",
    icon: Scroll,
    href: "/sessions/new",
    primary: false,
  },
  {
    name: "Run Combat",
    description: "Initiative tracker",
    icon: Swords,
    href: "/combat",
    primary: false,
  },
  {
    name: "Rules Lookup",
    description: "Search the SRD",
    icon: BookOpenCheck,
    href: "/codex",
    primary: false,
  },
]

export function QuickActions() {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-xl text-gold-gradient">Quick Actions</CardTitle>
      </CardHeader>
      <div className="magical-divider mx-6" />
      <CardContent className="grid gap-3 sm:grid-cols-2 pt-4">
        {quickActions.map((action) => (
          <Button
            key={action.name}
            variant={action.primary ? "default" : "outline"}
            className={`h-auto py-4 px-4 justify-start transition-all duration-300 rounded-2xl ${
              action.primary
                ? "btn-fey-glow shadow-lg"
                : "border-border/50 hover:border-primary/40 bg-card/50 hover:bg-accent/50 backdrop-blur-sm hover:shadow-[0_0_20px_-5px_oklch(0.75_0.15_210_/_0.25)]"
            }`}
            asChild
          >
            <Link href={action.href}>
              <action.icon className={`h-5 w-5 mr-3 ${action.primary ? "" : "text-primary"}`} />
              <div className="text-left">
                <div className="font-medium">{action.name}</div>
                <div className={`text-xs ${action.primary ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {action.description}
                </div>
              </div>
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}
