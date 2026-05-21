import { AppShell } from "@/components/app-shell"

export default function SessionPage() {
  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        <h1
          className="text-2xl font-bold mb-4"
          style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
        >
          Live Session
        </h1>
        <p className="mb-8" style={{ color: "var(--scene-text-muted)" }}>
          The DM conducts. The table receives.
        </p>
        <div
          className="rounded-lg p-8 text-center"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <p style={{ color: "var(--scene-text-muted)" }}>
            Live session layer coming in Phase 3.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
