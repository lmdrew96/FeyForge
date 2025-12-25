import { AppShell } from "@/components/layout/app-shell"
import { NPCGenerator } from "@/components/npcs/npc-generator"

export default function GenerateNPCPage() {
  return (
    <AppShell title="Generate NPC" subtitle="Create memorable characters with AI">
      <NPCGenerator />
    </AppShell>
  )
}
