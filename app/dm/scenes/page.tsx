"use client"

import { AppShell } from "@/components/app-shell"
import { useEffect, useState } from "react"

const SCENES = [
  { id: "", label: "Neutral", desc: "No active scene — expectant dark" },
  { id: "dungeon", label: "Dungeon", desc: "Cold, oppressive, ancient" },
  { id: "tavern", label: "Tavern", desc: "Warm, chaotic, alive" },
  { id: "forest", label: "Forest", desc: "Dappled, breathing, alive" },
  { id: "underdark", label: "Underdark", desc: "Void, alien, bioluminescent" },
  { id: "castle", label: "Castle", desc: "Imposing, regal, cold stone" },
  { id: "coastal", label: "Coastal", desc: "Open, salt-air, vast" },
  { id: "infernal", label: "Infernal", desc: "Scorched, suffocating, red" },
  { id: "celestial", label: "Celestial", desc: "Radiant, impossibly bright" },
  { id: "shadowfell", label: "Shadowfell", desc: "Ashen, grief-heavy, still" },
  { id: "feywild", label: "Feywild", desc: "Saturated, shifting, alive" },
]

export default function ScenesPage() {
  const [active, setActive] = useState("")

  useEffect(() => {
    document.body.setAttribute("data-scene", active)
    return () => document.body.setAttribute("data-scene", "")
  }, [active])

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1
            className="text-2xl font-bold mb-2"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            Scene Manager
          </h1>
          <p style={{ color: "var(--scene-text-muted)" }}>
            Activate a scene to transform the UI for everyone at the table. 600ms crossfade.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SCENES.map((scene) => (
            <button
              key={scene.id}
              onClick={() => setActive(scene.id)}
              className="rounded-lg p-4 text-left transition-all hover:opacity-90"
              style={{
                background: "var(--scene-surface)",
                border: `1px solid ${active === scene.id ? "var(--scene-accent)" : "var(--scene-border)"}`,
                boxShadow: active === scene.id ? "0 0 12px var(--scene-accent-glow)" : "none",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className="font-semibold text-sm"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    color: active === scene.id ? "var(--scene-accent)" : "var(--scene-text-primary)",
                  }}
                >
                  {scene.label}
                </span>
                {active === scene.id && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                  >
                    Active
                  </span>
                )}
              </div>
              <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                {scene.desc}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs" style={{ color: "var(--scene-text-muted)" }}>
          In Phase 3, activating a scene here will broadcast to every connected player in real time.
        </p>
      </div>
    </AppShell>
  )
}
