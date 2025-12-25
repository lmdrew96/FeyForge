import { AppShell } from "@/components/layout/app-shell"
import { SessionEditor } from "@/components/sessions/session-editor"

export default function NewSessionPage() {
  return (
    <AppShell title="New Session" subtitle="Plan your next adventure">
      <SessionEditor isNew />
    </AppShell>
  )
}
