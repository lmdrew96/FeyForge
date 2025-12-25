import { AppShell } from "@/components/layout/app-shell"
import { DiceRoller } from "@/components/dice/dice-roller"

export default function DicePage() {
  return (
    <AppShell title="Dice Roller" subtitle="Roll the bones and let fate decide">
      <DiceRoller />
    </AppShell>
  )
}
