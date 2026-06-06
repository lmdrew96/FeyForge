"use client"

// ── Realms & Faiths worldbuilding panel ──────────────────────────────────────
// A reference drawer listing the world's realms (Azgaar states — crest, government,
// capital, population, culture, notable wars) and faiths (religions — type, form,
// named deity), lifted from the .map. No geometry; pure lore reference. Lazy-loaded
// via worldMap.getWorldbuilding, opened from a toolbar button on both the DM page
// and the in-session viewer. Setting lore — shown to DMs and players alike.

import { useEffect, useState } from "react"
import { ChevronDown, Church, Crown, Handshake, MapPin, Swords, Users, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { CoatOfArms } from "./shared"
import type { FaithInfo, RealmInfo } from "@/lib/worldMap/azgaar-map"

// Diplomacy relation → colour + label. Suzerain = this realm's overlord; Vassal =
// realms sworn to it. Ordered alliance→enmity for a readable grouping.
const REL_STYLE: Record<string, string> = {
  Suzerain: "#7c3aed",
  Ally: "#16a34a",
  Friendly: "#0d9488",
  Vassal: "#a16207",
  Rival: "#d97706",
  Enemy: "#dc2626",
}
const REL_LABEL: Record<string, string> = {
  Suzerain: "Sworn to",
  Ally: "Allies",
  Friendly: "Friendly",
  Vassal: "Vassals",
  Rival: "Rivals",
  Enemy: "Enemies",
}
const REL_ORDER = ["Suzerain", "Ally", "Friendly", "Vassal", "Rival", "Enemy"]

export function RealmsFaithsPanel({
  realms,
  faiths,
  onClose,
}: {
  realms: RealmInfo[]
  faiths: FaithInfo[]
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Per-realm expand state (multiple may be open). Collapsed by default so the panel
  // stays scannable; expanding a realm reveals its full campaign list.
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const empty = realms.length === 0 && faiths.length === 0

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-stretch sm:justify-end"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Bottom sheet on mobile (map + backdrop stay visible above → tap to
          dismiss), right-side panel on desktop. Matches the detail + filter panels.
          The mobile bottom nav paints over this overlay (it's a sibling of <main>,
          which is z-10, so z-[60] here can't escape it), so pad past it (3.5rem nav
          + 1rem) until md, where the nav is gone. */}
      <div
        className="relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-2xl border-t pb-[calc(3.5rem+1rem+env(safe-area-inset-bottom))] shadow-2xl sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:border-t-0 sm:border-l md:pb-0"
        style={{ background: "var(--scene-surface)", borderColor: "var(--scene-border)" }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--scene-border)" }}
        >
          <h2
            className="flex items-center gap-2 text-lg font-bold"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            <Crown className="h-5 w-5" style={{ color: "var(--scene-accent)" }} />
            Realms &amp; Faiths
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:opacity-70" style={{ color: "var(--scene-text-muted)" }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {empty ? (
            <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
              No realms or faiths recorded for this map. Re-import the world to populate them.
            </p>
          ) : (
            <>
              {realms.length > 0 && (
                <section>
                  <h3
                    className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--scene-text-muted)" }}
                  >
                    <Crown className="h-3.5 w-3.5" /> Realms · {realms.length}
                  </h3>
                  <div className="space-y-3">
                    {realms.map((r, i) => {
                      const wars = r.campaigns ?? []
                      const rels = r.relations ?? []
                      const hasWars = wars.length > 0
                      const hasRels = rels.length > 0
                      const expandable = hasWars || hasRels
                      const isOpen = expanded.has(i)
                      // Crest + name + stat line — the always-visible head, shared by the
                      // expandable (button) and static (div) variants.
                      const head = (
                        <>
                          {r.coa ? (
                            <CoatOfArms coa={r.coa} name={r.name} />
                          ) : (
                            <span className="mt-0.5 h-5 w-5 shrink-0 rounded-sm" style={{ background: r.color ?? "var(--scene-border)" }} />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {r.coa && r.color && (
                                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: r.color }} />
                              )}
                              <p className="truncate text-sm font-bold" style={{ color: "var(--scene-text-primary)" }}>
                                {r.name}
                              </p>
                            </div>
                            {r.form && (
                              <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>{r.form}</p>
                            )}
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: "var(--scene-text-muted)" }}>
                              {r.capital && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {r.capital}
                                </span>
                              )}
                              {r.population != null && (
                                <span className="inline-flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {r.population.toLocaleString()}
                                </span>
                              )}
                              {r.culture && <span>{r.culture}</span>}
                              {r.provinces != null && <span>{r.provinces} provinces</span>}
                            </div>
                          </div>
                          {expandable && (
                            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
                              {hasRels && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Handshake className="h-3 w-3" />
                                  {rels.length}
                                </span>
                              )}
                              {hasWars && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Swords className="h-3 w-3" />
                                  {wars.length}
                                </span>
                              )}
                              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                            </span>
                          )}
                        </>
                      )
                      return (
                        <div
                          key={i}
                          className="rounded-lg p-2.5"
                          style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
                        >
                          {expandable ? (
                            <button onClick={() => toggle(i)} className="flex w-full gap-3 text-left" aria-expanded={isOpen}>
                              {head}
                            </button>
                          ) : (
                            <div className="flex gap-3">{head}</div>
                          )}
                          {expandable && isOpen && (
                            <div className="mt-2 space-y-2 border-t pt-2" style={{ borderColor: "var(--scene-border)" }}>
                              {hasRels && (
                                <div>
                                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
                                    Diplomacy
                                  </p>
                                  <div className="space-y-0.5">
                                    {REL_ORDER.filter((rel) => rels.some((x) => x.relation === rel)).map((rel) => (
                                      <div key={rel} className="flex gap-1.5 text-[11px] leading-snug">
                                        <span className="shrink-0 font-semibold" style={{ color: REL_STYLE[rel] }}>
                                          {REL_LABEL[rel]}
                                        </span>
                                        <span style={{ color: "var(--scene-text-muted)" }}>
                                          {rels.filter((x) => x.relation === rel).map((x) => x.realm).join(", ")}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {hasWars && (
                                <div>
                                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
                                    Notable campaigns
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {wars.map((w, j) => (
                                      <span
                                        key={j}
                                        className="rounded px-1.5 py-0.5 text-[11px]"
                                        style={{ background: "var(--scene-surface)", color: "var(--scene-text-muted)", border: "1px solid var(--scene-border)" }}
                                      >
                                        {w}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {faiths.length > 0 && (
                <section className="mt-5">
                  <h3
                    className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--scene-text-muted)" }}
                  >
                    <Church className="h-3.5 w-3.5" /> Faiths · {faiths.length}
                  </h3>
                  <div className="space-y-2">
                    {faiths.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 rounded-lg p-2.5"
                        style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
                      >
                        <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: f.color ?? "var(--scene-border)" }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold" style={{ color: "var(--scene-text-primary)" }}>{f.name}</p>
                          {(f.type || f.form) && (
                            <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                              {[f.type, f.form].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {f.deity && (
                            <p className="mt-0.5 text-xs italic" style={{ color: "var(--scene-accent)" }}>{f.deity}</p>
                          )}
                          {f.expansion && (
                            <p className="mt-0.5 text-[11px]" style={{ color: "var(--scene-text-muted)" }}>{f.expansion}</p>
                          )}
                          {f.origin && (
                            <p className="text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
                              Descended from {f.origin}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
