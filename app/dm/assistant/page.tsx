import { AppShell } from "@/components/app-shell"

export default function DMAssistantPage() {
  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        <h1
          className="text-2xl font-bold mb-8"
          style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
        >
          DM Assistant
        </h1>
        <div
          className="rounded-lg p-8 text-center"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <p style={{ color: "var(--scene-text-muted)" }}>
            AI assistant coming in Phase 5.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
