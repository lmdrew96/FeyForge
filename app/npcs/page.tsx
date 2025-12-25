import { AppShell } from "@/components/layout/app-shell"
import { NPCList } from "@/components/npcs/npc-list"

export default function NPCsPage() {
  return (
    <AppShell title="NPCs" subtitle="Manage your cast of characters">
      <NPCList />
    </AppShell>
  )
}
