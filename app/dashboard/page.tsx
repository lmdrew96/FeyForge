import { AppShell } from "@/components/app-shell"
import Link from "next/link"
import { Sparkles, UserSquare2, Swords } from "lucide-react"

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1
            className="text-3xl font-bold mb-2"
            style={{ fontFamily: "var(--font-display)", color: "var(--scene-accent)" }}
          >
            Welcome to FeyForge
          </h1>
          <p style={{ color: "var(--scene-text-muted)" }}>
            Your campaign awaits. The DM sets the scene — the table comes alive.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              href: "/session",
              icon: Sparkles,
              label: "Live Session",
              desc: "Join or start a session",
            },
            {
              href: "/characters",
              icon: UserSquare2,
              label: "Characters",
              desc: "Your roster",
            },
            {
              href: "/dm",
              icon: Swords,
              label: "DM Tools",
              desc: "Conductor's panel",
            },
          ].map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg p-5 flex flex-col gap-3 hover:opacity-90 transition-opacity"
              style={{
                background: "var(--scene-surface)",
                border: "1px solid var(--scene-border)",
              }}
            >
              <Icon className="w-6 h-6" style={{ color: "var(--scene-accent)" }} />
              <div>
                <div
                  className="font-semibold"
                  style={{ color: "var(--scene-text-primary)" }}
                >
                  {label}
                </div>
                <div className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
                  {desc}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
