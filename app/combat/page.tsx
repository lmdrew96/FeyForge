import { AppShell } from "@/components/layout/app-shell"
import { InitiativeTracker } from "@/components/combat/initiative-tracker"

export default function CombatPage() {
  return (
    <AppShell title="Combat Tracker" subtitle="Manage initiative and track the battle">
      <InitiativeTracker />
    </AppShell>
  )
}
