"use client"

// ── AI "Flesh out NPC" (premium) ──────────────────────────────────────────────
// The social counterpart to EncounterGenerator: a DM-only action on tavern and
// landmark world-map pins that conjures a full, roleplay-ready NPC the party would
// meet there — then optionally drops it into the campaign's NPC roster.
//
// SELF-CONTAINED like EncounterGenerator: from just {loc, campaignId, mapName} it
// pulls its own AI quota (aiUsage) and the world's realms/faiths (getWorldbuilding)
// so the NPC fits the DM's actual world instead of a generic one. No new route and
// no schema change — it calls the existing /api/npc/generate (guardAi-gated) and
// the existing npcs.create mutation; the pin legend + world context ride along in
// the prompt.

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from "sonner"
import { Loader2, RefreshCw, Save, Sparkles, UserPlus, X, Check } from "lucide-react"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { postAi, AiError } from "@/lib/ai-client"
import { formatWorldContext } from "@/lib/worldMap/ai-context"
import { SecondaryButton, type CampaignId, type MapLocation } from "./shared"

// POI kinds that host a person worth fleshing out. The parent gates on the same
// set; exported so it stays the one source of truth (mirrors COMBAT_POI_KINDS).
export const NPC_GEN_POI_KINDS = new Set(["tavern", "landmark"])

// The shape /api/npc/generate returns under { npc }. Mirrors the route's zod schema.
type NpcGenerated = {
  name: string
  race: string
  occupation: string
  age: string
  gender: string
  alignment: string
  appearance: string
  personality: string[]
  mannerisms: string
  voiceDescription: string
  motivation: string
  secret: string
  backstory: string
}

const NPC_ACCENT = "#db2777" // the npc-pin pink — ties this tool to NPC visuals

export function NpcGenerator({
  loc,
  campaignId,
  mapName,
}: {
  loc: MapLocation
  campaignId: CampaignId
  mapName: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<NpcGenerated | null>(null)

  const usage = useQuery(api.aiUsage.getUsage)
  const worldbuilding = useQuery(api.worldMap.getWorldbuilding, { campaignId })
  const createNpc = useMutation(api.npcs.create)

  const remaining = usage?.remaining
  const outOfQuota = remaining === 0
  const kindLabel = loc.poiKind === "tavern" ? "tavern or inn" : "landmark"

  const generate = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      // Ground the NPC in the DM's real world (realms/faiths) + this pin's legend,
      // all folded into the prompt so the existing route needs no new params.
      const worldCtx = formatWorldContext({
        mapName,
        realms: worldbuilding?.realms,
        faiths: worldbuilding?.faiths,
      })
      const legend = (loc.dmNotes || loc.playerNotes || "").slice(0, 600)
      const prompt = [
        `Generate a memorable NPC the party would meet at "${loc.name}", a ${kindLabel}${mapName ? ` on the map of ${mapName}` : ""}.`,
        legend ? `What's already known about this place: ${legend}` : "",
        worldCtx ? `Ground the NPC in this world — use its real realms and faiths, don't invent contradictions:\n${worldCtx}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")

      const data = await postAi<{ npc?: NpcGenerated }>("/api/npc/generate", {
        prompt,
        location: loc.name,
      })
      if (!data.npc) throw new Error("No NPC returned")
      setResult(data.npc)
      setSaved(false)
      toast.success("NPC ready — save it to your roster if you like.")
    } catch (err) {
      setError(err instanceof AiError ? err.message : "Couldn't generate the NPC.")
    } finally {
      setLoading(false)
    }
  }

  const saveToRoster = async () => {
    if (!result) return
    setSaving(true)
    try {
      await createNpc({
        campaignId,
        name: result.name,
        race: result.race,
        occupation: result.occupation,
        age: result.age,
        gender: result.gender,
        alignment: result.alignment,
        appearance: result.appearance,
        personality: result.personality,
        mannerisms: result.mannerisms,
        voiceDescription: result.voiceDescription,
        motivation: result.motivation,
        secret: result.secret,
        backstory: result.backstory,
        location: loc.name,
        relationship: "neutral",
        status: "alive",
        tags: [],
      })
      setSaved(true)
      toast.success("Saved — find it in DM → NPCs.")
    } catch {
      toast.error("Couldn't save the NPC.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SecondaryButton onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4" />
        Flesh out NPC
      </SecondaryButton>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl"
            style={{ borderColor: "var(--scene-border)", background: "var(--scene-surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: "var(--scene-border)" }}>
              <div className="flex min-w-0 items-center gap-2">
                <UserPlus className="h-5 w-5 shrink-0" style={{ color: NPC_ACCENT }} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                    An NPC at {loc.name}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
                    AI-generated · grounded in your world
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 hover:opacity-70" style={{ color: "var(--scene-text-muted)" }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <button
                onClick={generate}
                disabled={loading || outOfQuota}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: NPC_ACCENT }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : result ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {loading ? "Conjuring…" : result ? "Regenerate" : "Generate NPC"}
              </button>
              {typeof remaining === "number" && (
                <p className="mt-1.5 text-center text-[11px]" style={{ color: outOfQuota ? "#dc2626" : "var(--scene-text-muted)" }}>
                  {outOfQuota ? "Out of AI generations today — resets tomorrow." : `${remaining} AI generation${remaining === 1 ? "" : "s"} left today`}
                </p>
              )}

              {error && (
                <p className="mt-3 rounded-md px-3 py-2 text-xs" style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
                  {error}
                </p>
              )}

              {result && (
                <div className="mt-4 space-y-3">
                  <div>
                    <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                      {result.name}
                    </h3>
                    <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                      {[result.race, result.occupation, result.age, result.gender, result.alignment].filter(Boolean).join(" · ")}
                    </p>
                  </div>

                  {result.appearance && <Field label="Appearance" body={result.appearance} />}

                  {result.personality.length > 0 && (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--scene-text-muted)" }}>
                        Personality
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {result.personality.map((t) => (
                          <span key={t} className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.mannerisms && <Field label="Mannerisms" body={result.mannerisms} />}
                  {result.voiceDescription && <Field label="Voice" body={result.voiceDescription} />}
                  {result.motivation && <Field label="Motivation" body={result.motivation} />}
                  {result.backstory && <Field label="Backstory" body={result.backstory} />}

                  {result.secret && (
                    <div
                      className="rounded-lg px-3 py-2"
                      style={{
                        background: `color-mix(in srgb, ${NPC_ACCENT} 10%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${NPC_ACCENT} 30%, transparent)`,
                      }}
                    >
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: NPC_ACCENT }}>
                        Secret · DM only
                      </p>
                      <MarkdownRenderer variant="scene" content={result.secret} className="text-sm" />
                    </div>
                  )}

                  <button
                    onClick={saveToRoster}
                    disabled={saving || saved}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ borderColor: "var(--scene-border)", color: "var(--scene-text-primary)", background: "var(--scene-surface)" }}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    {saved ? "In your NPC roster" : "Save to NPCs"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, body }: { label: string; body: string }) {
  if (!body?.trim()) return null
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--scene-text-muted)" }}>
        {label}
      </p>
      <MarkdownRenderer variant="scene" content={body} className="text-sm" />
    </div>
  )
}
