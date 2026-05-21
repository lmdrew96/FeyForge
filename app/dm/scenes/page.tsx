"use client"

import { AppShell } from "@/components/app-shell"
import { useEffect, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { SCENES } from "@/lib/scenes"

export default function ScenesPage() {
  const [sessionId, setSessionId] = useState<Id<"partySessions"> | null>(null)
  const [campaignId, setCampaignId] = useState<Id<"campaigns"> | null>(null)

  const setupDMSession = useMutation(api.liveSessions.setupDMSession)
  const doActivateScene = useMutation(api.liveSessions.activateScene)

  const activeSession = useQuery(
    api.liveSessions.getActiveSession,
    campaignId ? { campaignId } : "skip"
  )

  useEffect(() => {
    setupDMSession()
      .then(({ campaignId: cid, sessionId: sid }) => {
        setCampaignId(cid)
        setSessionId(sid)
      })
      .catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeScene = activeSession?.activeScene ?? ""

  useEffect(() => {
    document.body.setAttribute("data-scene", activeScene)
    return () => document.body.setAttribute("data-scene", "")
  }, [activeScene])

  const handleSetScene = (scene: string) => {
    if (!sessionId) return
    doActivateScene({ sessionId, scene }).catch(console.error)
  }

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
              onClick={() => handleSetScene(scene.id)}
              className="rounded-lg p-4 text-left transition-all hover:opacity-90"
              style={{
                background: "var(--scene-surface)",
                border: `1px solid ${activeScene === scene.id ? "var(--scene-accent)" : "var(--scene-border)"}`,
                boxShadow: activeScene === scene.id ? "0 0 12px var(--scene-accent-glow)" : "none",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className="font-semibold text-sm"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    color: activeScene === scene.id ? "var(--scene-accent)" : "var(--scene-text-primary)",
                  }}
                >
                  {scene.label}
                </span>
                {activeScene === scene.id && (
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

        {!sessionId && (
          <p className="mt-6 text-xs" style={{ color: "var(--scene-text-muted)" }}>
            Connecting to live session…
          </p>
        )}
      </div>
    </AppShell>
  )
}
