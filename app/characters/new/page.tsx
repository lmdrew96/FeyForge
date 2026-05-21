import { AppShell } from "@/components/app-shell"

export default function NewCharacterPage() {
  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        <h1
          className="text-2xl font-bold mb-4"
          style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
        >
          Create a Character
        </h1>
        <p className="mb-8" style={{ color: "var(--scene-text-muted)" }}>
          Three paths. One hero.
        </p>
        <div
          className="rounded-lg p-8 text-center"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <p style={{ color: "var(--scene-text-muted)" }}>
            Guided / Quick Roll / Normal creation coming in Phase 2.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
