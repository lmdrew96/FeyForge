"use client"

import { AppShell } from "@/components/app-shell"
import { useEffect, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { SCENES, buildSceneVars, applySceneToBody } from "@/lib/scenes"
import type { CustomPalette } from "@/lib/scenes"
import { Trash2 } from "lucide-react"

const DEFAULT_PALETTE: CustomPalette = {
  bg: "#111118",
  surface: "#1a1a26",
  accent: "#7b68c8",
  highlight: "#9b8ec4",
}

const PALETTE_FIELDS: { key: keyof CustomPalette; label: string; hint: string }[] = [
  { key: "bg", label: "Background", hint: "Main page background" },
  { key: "surface", label: "Surface", hint: "Cards, panels, drawers" },
  { key: "accent", label: "Accent", hint: "Highlights, active states, glow" },
  { key: "highlight", label: "Highlight", hint: "Secondary accents, tags" },
]

function ScenePreview({ name, palette }: { name: string; palette: CustomPalette }) {
  const vars = buildSceneVars(palette)
  return (
    <div
      className="rounded-lg p-4 text-xs space-y-3 select-none"
      style={vars as React.CSSProperties}
    >
      <div
        className="rounded p-2 flex items-center justify-between"
        style={{ background: vars["--scene-surface"], border: `1px solid ${vars["--scene-border"]}` }}
      >
        <span style={{ color: vars["--scene-text-primary"], fontWeight: 600 }}>
          {name || "Untitled Scene"}
        </span>
        <span
          className="px-1.5 py-0.5 rounded-full"
          style={{ background: vars["--scene-accent"], color: vars["--scene-bg"] }}
        >
          Active
        </span>
      </div>
      <div className="flex gap-2">
        <div
          className="flex-1 rounded p-2"
          style={{ background: vars["--scene-surface"], border: `1px solid ${vars["--scene-border"]}` }}
        >
          <div className="mb-1.5" style={{ color: vars["--scene-text-muted"] }}>HP</div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: vars["--scene-border"] }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: "72%", background: vars["--scene-accent"] }}
            />
          </div>
        </div>
        <div
          className="flex-1 rounded p-2"
          style={{ background: vars["--scene-surface"], border: `1px solid ${vars["--scene-border"]}` }}
        >
          <div style={{ color: vars["--scene-text-muted"] }}>Conditions</div>
          <div className="flex gap-1 mt-1 flex-wrap">
            {["Poison", "Haste"].map(t => (
              <span
                key={t}
                className="px-1.5 py-0.5 rounded"
                style={{ background: vars["--scene-highlight"] + "33", color: vars["--scene-highlight"] }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div
        className="rounded p-2"
        style={{ background: vars["--scene-accent"] + "1a", border: `1px solid ${vars["--scene-accent"]}44` }}
      >
        <span style={{ color: vars["--scene-accent"] }}>Broadcast received</span>
        <p style={{ color: vars["--scene-text-muted"] }}>The torchlight flickers…</p>
      </div>
    </div>
  )
}

export default function ScenesPage() {
  const [sessionId, setSessionId] = useState<Id<"partySessions"> | null>(null)
  const [campaignId, setCampaignId] = useState<Id<"campaigns"> | null>(null)
  const [palette, setPalette] = useState<CustomPalette>(DEFAULT_PALETTE)
  const [builderName, setBuilderName] = useState("")

  const setupDMSession = useMutation(api.liveSessions.setupDMSession)
  const doActivateScene = useMutation(api.liveSessions.activateScene)
  const doCreateScene = useMutation(api.campaignScenes.create)
  const doRemoveScene = useMutation(api.campaignScenes.remove)

  const activeSession = useQuery(
    api.liveSessions.getActiveSession,
    campaignId ? { campaignId } : "skip"
  )
  const customScenes = useQuery(
    api.campaignScenes.list,
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

  const activeScene = (activeSession?.activeScene ?? "") as string
  const activeScenePalette = activeSession?.activeScenePalette ?? null

  useEffect(() => {
    applySceneToBody(activeScene, activeScenePalette)
    return () => applySceneToBody("")
  }, [activeScene, activeScenePalette])

  const handleSetScene = (scene: string, pal?: CustomPalette) => {
    if (!sessionId) return
    doActivateScene({ sessionId, scene, palette: pal }).catch(console.error)
  }

  const handleSaveCustomScene = async () => {
    if (!campaignId || !builderName.trim()) return
    await doCreateScene({ campaignId, name: builderName.trim(), ...palette })
    setBuilderName("")
    setPalette(DEFAULT_PALETTE)
  }

  const handleActivateCustom = (scene: { bg: string; surface: string; accent: string; highlight: string }) => {
    const pal: CustomPalette = { bg: scene.bg, surface: scene.surface, accent: scene.accent, highlight: scene.highlight }
    handleSetScene("custom", pal)
  }

  const updatePalette = (key: keyof CustomPalette, value: string) => {
    setPalette(prev => ({ ...prev, [key]: value }))
  }

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto">
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

        {/* Preset scenes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
          {SCENES.map((scene) => {
            const isActive = activeScene === scene.id
            return (
              <button
                key={scene.id}
                onClick={() => handleSetScene(scene.id)}
                className="rounded-lg p-4 text-left transition-all hover:opacity-90"
                style={{
                  background: "var(--scene-surface)",
                  border: `1px solid ${isActive ? "var(--scene-accent)" : "var(--scene-border)"}`,
                  boxShadow: isActive ? "0 0 12px var(--scene-accent-glow)" : "none",
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="font-semibold text-sm"
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      color: isActive ? "var(--scene-accent)" : "var(--scene-text-primary)",
                    }}
                  >
                    {scene.label}
                  </span>
                  {isActive && (
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
            )
          })}
        </div>

        {/* Saved custom scenes */}
        {customScenes && customScenes.length > 0 && (
          <div className="mb-10">
            <h2
              className="text-lg font-semibold mb-4"
              style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
            >
              Saved Custom Scenes
            </h2>
            <div className="space-y-2">
              {customScenes.map((cs: { _id: Id<"campaignScenes">; name: string; bg: string; surface: string; accent: string; highlight: string }) => {
                const isActive = activeScene === "custom" &&
                  activeScenePalette?.accent === cs.accent &&
                  activeScenePalette?.bg === cs.bg
                return (
                  <div
                    key={cs._id}
                    className="flex items-center gap-3 rounded-lg p-3"
                    style={{
                      background: "var(--scene-surface)",
                      border: `1px solid ${isActive ? "var(--scene-accent)" : "var(--scene-border)"}`,
                      boxShadow: isActive ? "0 0 8px var(--scene-accent-glow)" : "none",
                    }}
                  >
                    <div className="flex gap-1.5">
                      {[cs.bg, cs.surface, cs.accent, cs.highlight].map((color, i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-full border"
                          style={{ background: color, borderColor: "var(--scene-border)" }}
                        />
                      ))}
                    </div>
                    <span
                      className="flex-1 text-sm font-medium"
                      style={{ color: "var(--scene-text-primary)" }}
                    >
                      {cs.name}
                    </span>
                    {isActive && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                      >
                        Active
                      </span>
                    )}
                    <button
                      onClick={() => handleActivateCustom(cs)}
                      className="text-xs px-3 py-1 rounded transition-opacity hover:opacity-80"
                      style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                    >
                      Activate
                    </button>
                    <button
                      onClick={() => doRemoveScene({ id: cs._id }).catch(console.error)}
                      className="p-1.5 rounded transition-opacity hover:opacity-80"
                      style={{ color: "var(--scene-text-muted)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Custom scene builder */}
        <div
          className="rounded-xl p-6"
          style={{
            background: "var(--scene-surface)",
            border: "1px solid var(--scene-border)",
          }}
        >
          <h2
            className="text-lg font-semibold mb-1"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            Custom Scene Builder
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--scene-text-muted)" }}>
            Design a palette. Preview updates live.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Controls */}
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--scene-text-primary)" }}>
                  Scene Name
                </label>
                <input
                  type="text"
                  value={builderName}
                  onChange={(e) => setBuilderName(e.target.value)}
                  placeholder="e.g. Dragon's Lair"
                  className="w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-1"
                  style={{
                    background: "var(--scene-bg)",
                    border: "1px solid var(--scene-border)",
                    color: "var(--scene-text-primary)",
                  }}
                />
              </div>

              {PALETTE_FIELDS.map(({ key, label, hint }) => (
                <div key={key}>
                  <label className="text-sm font-medium block mb-1" style={{ color: "var(--scene-text-primary)" }}>
                    {label}
                    <span className="ml-2 text-xs font-normal" style={{ color: "var(--scene-text-muted)" }}>
                      {hint}
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={palette[key]}
                      onChange={(e) => updatePalette(key, e.target.value)}
                      className="w-10 h-9 rounded cursor-pointer border-0 p-0.5"
                      style={{ background: "var(--scene-bg)" }}
                    />
                    <input
                      type="text"
                      value={palette[key]}
                      onChange={(e) => {
                        const v = e.target.value
                        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) updatePalette(key, v)
                      }}
                      className="flex-1 rounded-md px-3 py-2 text-sm font-mono outline-none focus:ring-1"
                      style={{
                        background: "var(--scene-bg)",
                        border: "1px solid var(--scene-border)",
                        color: "var(--scene-text-primary)",
                      }}
                    />
                  </div>
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleSetScene("custom", palette)}
                  disabled={!sessionId}
                  className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                >
                  Activate Now
                </button>
                <button
                  onClick={handleSaveCustomScene}
                  disabled={!campaignId || !builderName.trim()}
                  className="flex-1 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--scene-accent)",
                    color: "var(--scene-accent)",
                  }}
                >
                  Save Scene
                </button>
              </div>
            </div>

            {/* Live preview */}
            <div>
              <p className="text-xs mb-2" style={{ color: "var(--scene-text-muted)" }}>Preview</p>
              <ScenePreview name={builderName} palette={palette} />
            </div>
          </div>
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
