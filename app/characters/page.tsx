import { AppShell } from "@/components/app-shell"
import Link from "next/link"

export default function CharactersPage() {
  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            Characters
          </h1>
          <Link
            href="/characters/new"
            className="px-4 py-2 rounded-md text-sm font-medium"
            style={{
              background: "var(--scene-accent)",
              color: "var(--scene-bg)",
            }}
          >
            New Character
          </Link>
        </div>
        <div
          className="rounded-lg p-8 text-center"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <p style={{ color: "var(--scene-text-muted)" }}>
            Character creation coming in Phase 2.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
