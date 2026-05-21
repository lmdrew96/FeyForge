"use client"

import { AppShell } from "@/components/app-shell"
import { useEffect, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { SCENES } from "@/lib/scenes"
import { Sparkles, Play, Square, Radio, Users, Clock } from "lucide-react"
import { toast } from "sonner"

// ── DM Conductor View ───────────────────────────────────────────────────────

function ConductorView({
  sessionId,
  campaignId,
  activeScene,
}: {
  sessionId: Id<"partySessions">
  campaignId: Id<"campaigns">
  activeScene: string
}) {
  const doActivateScene = useMutation(api.liveSessions.activateScene)
  const doEndSession = useMutation(api.liveSessions.endSession)
  const doBroadcast = useMutation(api.liveSessions.broadcastReveal)

  const broadcasts = useQuery(api.liveSessions.listBroadcasts, { sessionId })

  const [broadcastTitle, setBroadcastTitle] = useState("")
  const [broadcastBody, setBroadcastBody] = useState("")
  const [broadcastType, setBroadcastType] = useState<"npc" | "location" | "custom">("custom")
  const [sending, setSending] = useState(false)

  const handleSetScene = (scene: string) => {
    doActivateScene({ sessionId, scene }).catch(() => toast.error("Failed to activate scene."))
  }

  const handleEndSession = async () => {
    if (!confirm("End this session? Players will see the session as closed.")) return
    try {
      await doEndSession({ sessionId })
      toast.success("Session ended.")
    } catch {
      toast.error("Failed to end session.")
    }
  }

  const handleBroadcast = async () => {
    if (!broadcastTitle.trim()) return
    setSending(true)
    try {
      await doBroadcast({
        sessionId,
        campaignId,
        type: broadcastType,
        title: broadcastTitle.trim(),
        body: broadcastBody.trim() || undefined,
      })
      setBroadcastTitle("")
      setBroadcastBody("")
      toast.success("Broadcast sent.")
    } catch {
      toast.error("Failed to send broadcast.")
    } finally {
      setSending(false)
    }
  }

  const currentScene = SCENES.find((s) => s.id === activeScene)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: "var(--scene-accent)" }}
            />
            <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-accent)" }}>
              Session Live
            </span>
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            DM Conductor
          </h1>
          {currentScene && currentScene.id !== "" && (
            <p className="text-sm mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
              {currentScene.label} — {currentScene.desc}
            </p>
          )}
        </div>
        <button
          onClick={handleEndSession}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
        >
          <Square className="h-3.5 w-3.5" />
          End Session
        </button>
      </div>

      {/* Scene Grid */}
      <section>
        <h2
          className="text-xs uppercase tracking-widest mb-3"
          style={{ color: "var(--scene-text-muted)" }}
        >
          Active Scene
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {SCENES.map((scene) => (
            <button
              key={scene.id}
              onClick={() => handleSetScene(scene.id)}
              className="rounded-lg p-3 text-left transition-all hover:opacity-90"
              style={{
                background: "var(--scene-surface)",
                border: `1px solid ${activeScene === scene.id ? "var(--scene-accent)" : "var(--scene-border)"}`,
                boxShadow: activeScene === scene.id ? "0 0 10px var(--scene-accent-glow)" : "none",
              }}
            >
              <div
                className="text-sm font-semibold mb-0.5 truncate"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  color: activeScene === scene.id ? "var(--scene-accent)" : "var(--scene-text-primary)",
                }}
              >
                {scene.label}
              </div>
              <div className="text-xs truncate" style={{ color: "var(--scene-text-muted)" }}>
                {scene.desc}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Broadcast Panel */}
      <section>
        <h2
          className="text-xs uppercase tracking-widest mb-3"
          style={{ color: "var(--scene-text-muted)" }}
        >
          Broadcast to Players
        </h2>
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          <div className="flex gap-2">
            {(["npc", "location", "custom"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setBroadcastType(t)}
                className="px-3 py-1 rounded-full text-xs font-medium capitalize transition-opacity"
                style={{
                  background: broadcastType === t ? "var(--scene-accent)" : "var(--scene-border)",
                  color: broadcastType === t ? "var(--scene-bg)" : "var(--scene-text-muted)",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            value={broadcastTitle}
            onChange={(e) => setBroadcastTitle(e.target.value)}
            placeholder="Title (e.g. Mara the innkeeper appears…)"
            className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none"
            style={{
              border: "1px solid var(--scene-border)",
              color: "var(--scene-text-primary)",
            }}
          />
          <textarea
            value={broadcastBody}
            onChange={(e) => setBroadcastBody(e.target.value)}
            placeholder="Optional description or flavor text…"
            rows={2}
            className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none resize-none"
            style={{
              border: "1px solid var(--scene-border)",
              color: "var(--scene-text-primary)",
            }}
          />
          <button
            onClick={handleBroadcast}
            disabled={sending || !broadcastTitle.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
          >
            <Radio className="h-4 w-4" />
            {sending ? "Sending…" : "Send Broadcast"}
          </button>
        </div>
      </section>

      {/* Broadcast History */}
      {broadcasts && broadcasts.length > 0 && (
        <section>
          <h2
            className="text-xs uppercase tracking-widest mb-3"
            style={{ color: "var(--scene-text-muted)" }}
          >
            Sent This Session
          </h2>
          <div className="space-y-2">
            {broadcasts.map((b) => (
              <div
                key={b._id}
                className="rounded-lg px-4 py-3 flex items-start gap-3"
                style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
              >
                <span
                  className="text-xs px-2 py-0.5 rounded-full capitalize mt-0.5"
                  style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
                >
                  {b.type}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
                    {b.title}
                  </p>
                  {b.body && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
                      {b.body}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── DM No-Session View ───────────────────────────────────────────────────────

function DMReadyView({ campaignId }: { campaignId: Id<"campaigns"> }) {
  const startSession = useMutation(api.liveSessions.startSession)
  const [starting, setStarting] = useState(false)

  const handleStart = async () => {
    setStarting(true)
    try {
      await startSession({ campaignId })
      toast.success("Session started. Players can now join.")
    } catch {
      toast.error("Failed to start session.")
      setStarting(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{
          background: "color-mix(in srgb, var(--scene-accent) 15%, var(--scene-surface))",
          border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, transparent)",
        }}
      >
        <Sparkles className="h-8 w-8" style={{ color: "var(--scene-accent)" }} />
      </div>
      <h2
        className="text-2xl font-bold mb-2"
        style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
      >
        Ready to Forge the Session
      </h2>
      <p className="text-sm mb-8 max-w-sm" style={{ color: "var(--scene-text-muted)" }}>
        Start a live session and your players will see scenes, atmosphere, and broadcasts in real time.
      </p>
      <button
        onClick={handleStart}
        disabled={starting}
        className="flex items-center gap-2 px-6 py-3 rounded-md font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
      >
        <Play className="h-4 w-4" />
        {starting ? "Starting…" : "Start Session"}
      </button>
    </div>
  )
}

// ── Player Receiver View ─────────────────────────────────────────────────────

function ReceiverView({
  sessionId,
  campaignId,
}: {
  sessionId: Id<"partySessions">
  campaignId: Id<"campaigns">
}) {
  const activeSession = useQuery(api.liveSessions.getActiveSession, { campaignId })
  const broadcasts = useQuery(api.liveSessions.listBroadcasts, { sessionId })

  const activeScene = activeSession?.activeScene ?? ""
  const currentScene = SCENES.find((s) => s.id === activeScene)

  // Apply scene to body reactively
  useEffect(() => {
    document.body.setAttribute("data-scene", activeScene)
    return () => document.body.setAttribute("data-scene", "")
  }, [activeScene])

  return (
    <div className="space-y-6">
      {/* Scene Display */}
      <div
        className="rounded-xl p-6 text-center"
        style={{
          background: "color-mix(in srgb, var(--scene-accent) 6%, var(--scene-surface))",
          border: "1px solid color-mix(in srgb, var(--scene-accent) 20%, var(--scene-border))",
        }}
      >
        {activeScene ? (
          <>
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-accent)" }}>
              Current Scene
            </div>
            <h2
              className="text-3xl font-bold mb-1"
              style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
            >
              {currentScene?.label ?? activeScene}
            </h2>
            <p className="text-sm italic" style={{ color: "var(--scene-text-muted)" }}>
              {currentScene?.desc}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="h-4 w-4" style={{ color: "var(--scene-text-muted)" }} />
              <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
                Awaiting Scene
              </span>
            </div>
            <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
              The DM is preparing the scene…
            </p>
          </>
        )}
      </div>

      {/* Broadcasts */}
      {broadcasts && broadcasts.length > 0 && (
        <section>
          <h2
            className="text-xs uppercase tracking-widest mb-3"
            style={{ color: "var(--scene-text-muted)" }}
          >
            From the DM
          </h2>
          <div className="space-y-3">
            {broadcasts.map((b, i) => (
              <div
                key={b._id}
                className="rounded-xl p-4 transition-all"
                style={{
                  background: i === 0
                    ? "color-mix(in srgb, var(--scene-accent) 8%, var(--scene-surface))"
                    : "var(--scene-surface)",
                  border: `1px solid ${i === 0
                    ? "color-mix(in srgb, var(--scene-accent) 30%, transparent)"
                    : "var(--scene-border)"}`,
                  boxShadow: i === 0 ? "0 0 16px var(--scene-accent-glow)" : "none",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full capitalize"
                    style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
                  >
                    {b.type}
                  </span>
                  {i === 0 && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full animate-pulse"
                      style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                    >
                      New
                    </span>
                  )}
                </div>
                <p
                  className="font-semibold text-sm"
                  style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
                >
                  {b.title}
                </p>
                {b.body && (
                  <p className="text-xs mt-1 italic" style={{ color: "var(--scene-text-muted)" }}>
                    {b.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── No Active Session (Player) ───────────────────────────────────────────────

function PlayerWaiting() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{
          background: "var(--scene-surface)",
          border: "1px solid var(--scene-border)",
        }}
      >
        <Users className="h-8 w-8" style={{ color: "var(--scene-text-muted)", opacity: 0.4 }} />
      </div>
      <h2
        className="text-xl font-bold mb-2"
        style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
      >
        Awaiting the DM
      </h2>
      <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
        No active session yet. Sit tight — the forge will light soon.
      </p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const myCampaign = useQuery(api.liveSessions.getMyDefaultCampaign)
  const activeSessionForDM = useQuery(
    api.liveSessions.getActiveSession,
    myCampaign ? { campaignId: myCampaign._id } : "skip"
  )
  const anyActiveSession = useQuery(api.liveSessions.getAnyActiveSession)

  const isDM = myCampaign !== null && myCampaign !== undefined

  // Loading state
  if (myCampaign === undefined) {
    return (
      <AppShell>
        <div className="p-6 max-w-3xl mx-auto">
          <div className="animate-pulse rounded-xl h-48" style={{ background: "var(--scene-surface)" }} />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {isDM ? (
          // DM path
          activeSessionForDM === undefined ? (
            <div className="animate-pulse rounded-xl h-48" style={{ background: "var(--scene-surface)" }} />
          ) : activeSessionForDM ? (
            <ConductorView
              sessionId={activeSessionForDM._id}
              campaignId={activeSessionForDM.campaignId}
              activeScene={activeSessionForDM.activeScene}
            />
          ) : (
            <DMReadyView campaignId={myCampaign._id} />
          )
        ) : (
          // Player path
          anyActiveSession ? (
            <ReceiverView sessionId={anyActiveSession._id} campaignId={anyActiveSession.campaignId} />
          ) : (
            <PlayerWaiting />
          )
        )}
      </div>
    </AppShell>
  )
}
