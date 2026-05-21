import { AppShell } from "@/components/app-shell"

export default function JoinSessionPage() {
  return (
    <AppShell>
      <div className="p-6 max-w-lg mx-auto">
        <h1
          className="text-2xl font-bold mb-8"
          style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
        >
          Join Session
        </h1>
        <div
          className="rounded-lg p-8 text-center"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <p style={{ color: "var(--scene-text-muted)" }}>
            Player join flow coming in Phase 3.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
