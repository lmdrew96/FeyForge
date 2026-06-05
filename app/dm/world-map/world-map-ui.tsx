"use client"

// Small shared presentational primitives for the world-map surfaces. These leaves
// are used by BOTH the setup flow (world-map-setup.tsx) and the workspace/page
// (page.tsx), so they live here to keep those two modules from importing each
// other (which would be a circular dependency).

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

export function CenteredCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div
        className="max-w-md rounded-xl p-8 text-center"
        style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
      >
        <Icon className="mx-auto mb-4 h-10 w-10" style={{ color: "var(--scene-accent)", opacity: 0.6 }} />
        <h1 className="mb-2 text-xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
          {title}
        </h1>
        <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>{body}</p>
      </div>
    </div>
  )
}

export function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: "var(--scene-accent)", color: "#fff" }}
    >
      {children}
    </button>
  )
}
