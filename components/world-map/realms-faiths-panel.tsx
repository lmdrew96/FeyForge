"use client"

// ── Realms & Faiths worldbuilding panel ──────────────────────────────────────
// A reference drawer listing the world's realms (Azgaar states — crest, government,
// capital, population, culture, notable wars) and faiths (religions — type, form,
// named deity), lifted from the .map. Lazy-loaded via worldMap.getWorldbuilding, opened
// from a toolbar button on both the DM page and the in-session viewer.
//
// Living Diplomacy (thread ①) makes the diplomacy slice editable: the DM changes a
// realm's relationships inline, each change logs to a campaign political timeline, and
// each shift can be surfaced to players as curated "World News" — on the DM's schedule.
// The merge is server-side (worldMap.getWorldbuilding): the `realms` prop already shows
// the DM the truth and players only what's been REVEALED. This component owns the editor
// + the feed (its own diplomacy.feed / diplomacy.realmNames queries + mutations), so the
// two parents just pass campaignId + isDM.

import { useEffect, useState } from "react"
import {
  ChevronDown,
  Church,
  Crown,
  Eye,
  EyeOff,
  GitBranch,
  Handshake,
  Loader2,
  MapPin,
  Newspaper,
  Plus,
  Radio,
  ScrollText,
  Sparkles,
  Swords,
  Users,
  X,
} from "lucide-react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { CoatOfArms } from "./shared"
import { DIPLOMACY_STATUSES, NEUTRAL, autoHeadline } from "@/lib/worldMap/diplomacy"
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
const relColor = (status: string) => REL_STYLE[status] ?? "var(--scene-text-muted)"

// Faith type → accent colour. Folk = traditional, Organized = institutional,
// Cult/Heresy = ominous. Drives the type chip + the card's left swatch ring.
const FAITH_TYPE_STYLE: Record<string, string> = {
  Folk: "#0d9488",
  Organized: "#7c3aed",
  Cult: "#dc2626",
  Heresy: "#d97706",
}

// A campaign PC who follows a faith — surfaced in the faith card's Followers section
// (Slice B wires the query; the card renders whatever it's handed).
export type FaithFollower = { name: string; className?: string }

// The DM's "make this news?" prompt state (also drives "+ add relationship").
type PendingEdit = {
  selfRealm: string
  otherRealm: string
  addMode: boolean
  status: string
  from: string
  headline: string
  headlineDirty: boolean
}

export function RealmsFaithsPanel({
  realms,
  faiths,
  onClose,
  campaignId,
  isDM,
}: {
  realms: RealmInfo[]
  faiths: FaithInfo[]
  onClose: () => void
  campaignId: Id<"campaigns">
  isDM: boolean
}) {
  // Per-realm expand state (multiple may be open). Collapsed by default so the panel
  // stays scannable.
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  // Living Diplomacy: the role-aware feed (DM shift timeline / player World News) + the
  // realm-name list for the add-relationship picker, plus the DM mutations.
  const feed = useQuery(api.diplomacy.feed, { campaignId })
  const realmNames = useQuery(api.diplomacy.realmNames, isDM ? { campaignId } : "skip")
  // Campaign PCs grouped by faith → each faith card's Followers section (Slice B).
  const faithFollowers = useQuery(api.faiths.followersByFaith, { campaignId })
  const setRelationMut = useMutation(api.diplomacy.setRelation)
  const setDisposition = useMutation(api.diplomacy.setShiftDisposition)
  const setWorldNews = useMutation(api.diplomacy.setWorldNewsEnabled)

  const [pending, setPending] = useState<PendingEdit | null>(null)

  // Escape closes the news prompt first (if open), else the whole panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setPending((p) => {
        if (p) return null
        onClose()
        return p
      })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Open the prompt from changing a relationship's status on a realm card.
  const onChangeRelation = (selfRealm: string, otherRealm: string, from: string, to: string) => {
    if (to === from) return
    setPending({
      selfRealm,
      otherRealm,
      addMode: false,
      status: to,
      from,
      headline: autoHeadline(selfRealm, otherRealm, to, from),
      headlineDirty: false,
    })
  }
  // Open the prompt in "add a new relationship" mode for a realm.
  const onAddRelation = (selfRealm: string) =>
    setPending({
      selfRealm,
      otherRealm: "",
      addMode: true,
      status: "Ally",
      from: NEUTRAL,
      headline: "",
      headlineDirty: false,
    })

  const recomputeHeadline = (p: PendingEdit, patch: Partial<PendingEdit>): PendingEdit => {
    const next = { ...p, ...patch }
    if (!next.headlineDirty && next.otherRealm) {
      next.headline = autoHeadline(next.selfRealm, next.otherRealm, next.status, next.from)
    }
    return next
  }

  const commit = async (reveal: "revealed" | "held" | "private") => {
    if (!pending || !pending.otherRealm) return
    await setRelationMut({
      campaignId,
      realmA: pending.selfRealm,
      realmB: pending.otherRealm,
      status: pending.status,
      reveal,
      headline: pending.headline.trim() || undefined,
    })
    setPending(null)
  }

  const empty = realms.length === 0 && faiths.length === 0
  const dmFeed = feed && feed.role === "dm" ? feed : null
  const playerNews = feed && feed.role === "player" ? feed.news : []

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-stretch sm:justify-end"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Bottom sheet on mobile, right-side panel on desktop. Cap height to clear the
          fixed top bar (dvh, not vh, for iOS) and pad past the bottom nav until md. */}
      <div
        className="relative z-10 flex max-h-[calc(100dvh-4rem)] w-full flex-col rounded-t-2xl border-t pb-[calc(3.5rem+1rem+env(safe-area-inset-bottom))] shadow-2xl sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:border-t-0 sm:border-l md:pb-0"
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
          {/* ── World News / diplomacy feed ─────────────────────────────────── */}
          {dmFeed && (
            <DmDiplomacyFeed
              feed={dmFeed}
              onToggleWorldNews={(enabled) => setWorldNews({ campaignId, enabled })}
              onReveal={(overrideId, entryIndex) =>
                setDisposition({ overrideId, entryIndex, reveal: "revealed" })
              }
              onHold={(overrideId, entryIndex) =>
                setDisposition({ overrideId, entryIndex, reveal: "held" })
              }
              onHide={(overrideId, entryIndex) =>
                setDisposition({ overrideId, entryIndex, reveal: "private" })
              }
            />
          )}
          {!isDM && playerNews.length > 0 && (
            <section className="mb-4 rounded-lg p-3" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
                <Newspaper className="h-3.5 w-3.5" /> World News
              </h3>
              <ul className="space-y-1.5">
                {playerNews.map((n, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-snug" style={{ color: "var(--scene-text-primary)" }}>
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--scene-accent)" }} />
                    <span className="italic">{n.headline}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

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
                      // DM cards are always expandable (the diplomacy editor lives inside);
                      // player cards expand only when there's something to show.
                      const expandable = isDM || hasWars || hasRels
                      const isOpen = expanded.has(i)
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
                              {/* Diplomacy — editable for the DM, grouped read-only for players. */}
                              {isDM ? (
                                <DmDiplomacyEditor
                                  realm={r}
                                  rels={rels}
                                  realmNames={realmNames ?? []}
                                  onChangeRelation={onChangeRelation}
                                  onAddRelation={onAddRelation}
                                />
                              ) : (
                                hasRels && (
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
                                )
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
                      <FaithCard key={i} faith={f} followers={faithFollowers?.[f.name]} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── "Make this news?" prompt (DM) ──────────────────────────────────── */}
      {pending && (
        <NewsPrompt
          pending={pending}
          realmNames={realmNames ?? []}
          campaignId={campaignId}
          onChange={(patch) => setPending((p) => (p ? recomputeHeadline(p, patch) : p))}
          onHeadline={(headline) => setPending((p) => (p ? { ...p, headline, headlineDirty: true } : p))}
          onCommit={commit}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}

// ── Faith card (Realms & Faiths) ─────────────────────────────────────────────
// Expandable, at parity with the realm card: type/form chips, the deity epithet as a
// headline, and an expanded detail block (following-culture, spread mode, lineage, and
// the Followers list Slice B fills). Azgaar faith data is name/type/form/deity/culture/
// expansion/lineage — follower COUNTS aren't in the .map (rural/urban are null), so the
// "Followers" section lists campaign PCs, not a population number.
function FaithCard({ faith, followers }: { faith: FaithInfo; followers?: FaithFollower[] }) {
  const [open, setOpen] = useState(false)
  const typeColor = (faith.type && FAITH_TYPE_STYLE[faith.type]) || "var(--scene-accent)"
  const hasFollowers = !!followers?.length
  const expandable = !!(faith.culture || faith.expansion || faith.origin) || hasFollowers

  const head = (
    <>
      <span
        className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full"
        style={{ background: faith.color ?? "var(--scene-border)", boxShadow: `0 0 0 1.5px ${typeColor}` }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-bold" style={{ color: "var(--scene-text-primary)" }}>{faith.name}</p>
          {faith.type && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: typeColor, border: `1px solid ${typeColor}` }}>
              {faith.type}
            </span>
          )}
          {faith.form && (
            <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ color: "var(--scene-text-muted)", background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
              {faith.form}
            </span>
          )}
        </div>
        {faith.deity ? (
          <p className="mt-0.5 text-xs italic" style={{ color: "var(--scene-accent)" }}>{faith.deity}</p>
        ) : (
          <p className="mt-0.5 text-[11px] italic" style={{ color: "var(--scene-text-muted)" }}>No named deity</p>
        )}
      </div>
      {expandable && (
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
          {hasFollowers && (
            <span className="inline-flex items-center gap-0.5">
              <Users className="h-3 w-3" />
              {followers!.length}
            </span>
          )}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </span>
      )}
    </>
  )

  return (
    <div className="rounded-lg p-2.5" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
      {expandable ? (
        <button onClick={() => setOpen((o) => !o)} className="flex w-full gap-2.5 text-left" aria-expanded={open}>
          {head}
        </button>
      ) : (
        <div className="flex gap-2.5">{head}</div>
      )}
      {expandable && open && (
        <div className="mt-2 space-y-1.5 border-t pt-2 text-[11px]" style={{ borderColor: "var(--scene-border)" }}>
          {faith.culture && (
            <div className="flex items-center gap-1.5" style={{ color: "var(--scene-text-muted)" }}>
              <Users className="h-3 w-3 shrink-0" /> Followed by the {faith.culture}
            </div>
          )}
          {faith.expansion && (
            <div className="flex items-center gap-1.5" style={{ color: "var(--scene-text-muted)" }}>
              <Church className="h-3 w-3 shrink-0" /> {faith.expansion}
            </div>
          )}
          {faith.origin && (
            <div className="flex items-center gap-1.5" style={{ color: "var(--scene-text-muted)" }}>
              <GitBranch className="h-3 w-3 shrink-0" /> Descended from {faith.origin}
            </div>
          )}
          {hasFollowers && (
            <div className="pt-0.5">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
                Followers
              </p>
              <div className="flex flex-wrap gap-1">
                {followers!.map((p, j) => (
                  <span
                    key={j}
                    className="rounded px-1.5 py-0.5 text-[11px]"
                    style={{ background: "var(--scene-surface)", color: "var(--scene-text-primary)", border: "1px solid var(--scene-border)" }}
                  >
                    {p.name}
                    {p.className && <span style={{ color: "var(--scene-text-muted)" }}> · {p.className}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── DM: World News header + recent-shifts timeline + held tray ───────────────
function DmDiplomacyFeed({
  feed,
  onToggleWorldNews,
  onReveal,
  onHold,
  onHide,
}: {
  feed: {
    shifts: {
      overrideId: Id<"diplomacyOverrides">
      entryIndex: number
      realmA: string
      realmB: string
      from: string
      to: string
      reveal: "pending" | "revealed" | "held" | "private"
      headline?: string
    }[]
    heldCount: number
    pendingCount: number
    worldNewsEnabled: boolean
  }
  onToggleWorldNews: (enabled: boolean) => void
  onReveal: (id: Id<"diplomacyOverrides">, entryIndex: number) => void
  onHold: (id: Id<"diplomacyOverrides">, entryIndex: number) => void
  onHide: (id: Id<"diplomacyOverrides">, entryIndex: number) => void
}) {
  const REVEAL_PILL: Record<string, { label: string; color: string }> = {
    revealed: { label: "Live", color: "#16a34a" },
    held: { label: "Held", color: "#d97706" },
    pending: { label: "New", color: "var(--scene-accent)" },
    private: { label: "Hidden", color: "var(--scene-text-muted)" },
  }
  return (
    <section className="mb-4 rounded-lg p-3" style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
          <Newspaper className="h-3.5 w-3.5" /> World News
        </h3>
        <button
          onClick={() => onToggleWorldNews(!feed.worldNewsEnabled)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium"
          style={{
            background: feed.worldNewsEnabled ? "var(--scene-accent)" : "var(--scene-surface)",
            color: feed.worldNewsEnabled ? "var(--scene-bg)" : "var(--scene-text-muted)",
            border: "1px solid var(--scene-border)",
          }}
          aria-pressed={feed.worldNewsEnabled}
          title={feed.worldNewsEnabled ? "Players can see revealed headlines" : "Players see no diplomacy news"}
        >
          {feed.worldNewsEnabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {feed.worldNewsEnabled ? "On" : "Off"}
        </button>
      </div>

      {!feed.worldNewsEnabled && (
        <p className="mt-1.5 text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
          Off — players won&apos;t see diplomacy headlines. Shifts still log here for you.
        </p>
      )}

      {feed.shifts.length === 0 ? (
        <p className="mt-2 text-[11px]" style={{ color: "var(--scene-text-muted)" }}>
          No diplomatic shifts yet. Change a realm&apos;s relations below to start the timeline.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {feed.shifts.slice(0, 12).map((s, i) => {
            const pill = REVEAL_PILL[s.reveal]
            return (
              <li key={i} className="flex items-start gap-2 text-[11px] leading-snug">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: relColor(s.to) }} />
                <div className="min-w-0 flex-1">
                  <p style={{ color: "var(--scene-text-primary)" }}>
                    {s.headline ?? `${s.realmA} & ${s.realmB}: ${s.from} → ${s.to}`}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>
                    {s.realmA} ⇄ {s.realmB} · {s.from} → {s.to}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase" style={{ color: pill.color, border: `1px solid ${pill.color}` }}>
                    {pill.label}
                  </span>
                  {s.reveal === "revealed" ? (
                    <button onClick={() => onHold(s.overrideId, s.entryIndex)} className="rounded p-0.5 hover:opacity-70" title="Hold (hide from players)" style={{ color: "var(--scene-text-muted)" }}>
                      <EyeOff className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button onClick={() => onReveal(s.overrideId, s.entryIndex)} className="rounded p-0.5 hover:opacity-70" title="Reveal to players" style={{ color: "#16a34a" }}>
                      <Radio className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {(s.reveal === "pending" || s.reveal === "held") && (
                    <button onClick={() => onHide(s.overrideId, s.entryIndex)} className="rounded p-0.5 hover:opacity-70" title="Dismiss (keep private)" style={{ color: "var(--scene-text-muted)" }}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ── DM: editable diplomacy inside a realm card ───────────────────────────────
function DmDiplomacyEditor({
  realm,
  rels,
  realmNames,
  onChangeRelation,
  onAddRelation,
}: {
  realm: RealmInfo
  rels: { relation: string; realm: string }[]
  realmNames: string[]
  onChangeRelation: (selfRealm: string, otherRealm: string, from: string, to: string) => void
  onAddRelation: (selfRealm: string) => void
}) {
  const rank = (s: string) => {
    const i = REL_ORDER.indexOf(s)
    return i === -1 ? 999 : i
  }
  const ordered = [...rels].sort((a, b) => rank(a.relation) - rank(b.relation))
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
        Diplomacy
      </p>
      <div className="space-y-1">
        {ordered.map((rel) => {
          // Offer the symmetric set + None. If the current value is an asymmetric
          // Vassal/Suzerain (v2), surface it as a read-only option so the select isn't blank.
          const options = [
            ...(DIPLOMACY_STATUSES.includes(rel.relation as never) ? [] : [rel.relation]),
            ...DIPLOMACY_STATUSES,
          ]
          return (
            <div key={rel.realm} className="flex items-center gap-1.5 text-[11px]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: relColor(rel.relation) }} />
              <span className="min-w-0 flex-1 truncate" style={{ color: "var(--scene-text-primary)" }}>{rel.realm}</span>
              <select
                value={rel.relation}
                onChange={(e) => onChangeRelation(realm.name, rel.realm, rel.relation, e.target.value)}
                className="rounded border px-1 py-0.5 text-[11px]"
                style={{ background: "var(--scene-surface)", color: "var(--scene-text-primary)", borderColor: "var(--scene-border)" }}
              >
                {options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
                <option value={NEUTRAL}>None</option>
              </select>
            </div>
          )
        })}
      </div>
      <button
        onClick={() => onAddRelation(realm.name)}
        disabled={realmNames.length <= 1}
        className="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium hover:opacity-80 disabled:opacity-40"
        style={{ color: "var(--scene-accent)", border: "1px dashed var(--scene-border)" }}
      >
        <Plus className="h-3 w-3" /> Add relationship
      </button>
    </div>
  )
}

// ── DM: "make this news?" prompt ─────────────────────────────────────────────
function NewsPrompt({
  pending,
  realmNames,
  campaignId,
  onChange,
  onHeadline,
  onCommit,
  onCancel,
}: {
  pending: PendingEdit
  realmNames: string[]
  campaignId: Id<"campaigns">
  onChange: (patch: Partial<PendingEdit>) => void
  onHeadline: (headline: string) => void
  onCommit: (reveal: "revealed" | "held" | "private") => void
  onCancel: () => void
}) {
  const targets = realmNames.filter((n) => n !== pending.selfRealm)

  // AI plot hooks (thread ③): generate a player headline + a private DM plot seed
  // from this diplomatic shift. Purely ADDITIVE — the deterministic autoHeadline and
  // the three commit buttons work unchanged when AI is unavailable or out of quota.
  const createPlotThread = useMutation(api.sessions.createPlotThread)
  const [generating, setGenerating] = useState(false)
  const [seed, setSeed] = useState<{ title: string; hook: string } | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [quotaHit, setQuotaHit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const generate = async () => {
    if (!pending.otherRealm || generating) return
    setGenerating(true)
    setGenError(null)
    setQuotaHit(false)
    try {
      const res = await fetch("/api/world-map/plot-hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          realmA: pending.selfRealm,
          realmB: pending.otherRealm,
          from: pending.from,
          to: pending.status,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { isPremium?: boolean }
        if (res.status === 429) {
          setQuotaHit(!data.isPremium)
          setGenError(data.isPremium ? "You're out of AI generations today." : "Out of free AI generations today.")
        } else if (res.status === 403) {
          setGenError("Only the DM can generate plot hooks.")
        } else {
          setGenError("Couldn't generate right now — try again.")
        }
        return
      }
      const data = (await res.json()) as { headline: string; hook: string; title: string }
      onHeadline(data.headline) // fills the field + flags headlineDirty so it isn't clobbered
      setSeed({ title: data.title, hook: data.hook })
      setSaved(false)
    } catch {
      setGenError("Couldn't generate right now — try again.")
    } finally {
      setGenerating(false)
    }
  }

  const savePlotThread = async () => {
    if (!seed || saving || saved) return
    setSaving(true)
    setGenError(null)
    try {
      await createPlotThread({
        campaignId,
        title: seed.title,
        description: seed.hook,
        status: "active",
        importance: "minor",
        relatedLocations: [pending.selfRealm, pending.otherRealm].filter(Boolean),
      })
      setSaved(true)
    } catch {
      setGenError("Couldn't save the plot thread — try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div
        className="relative z-10 w-full max-w-sm rounded-xl border p-4 shadow-2xl"
        style={{ background: "var(--scene-surface)", borderColor: "var(--scene-border)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
            Make this news?
          </h3>
          <button onClick={onCancel} aria-label="Cancel" className="rounded p-1 hover:opacity-70" style={{ color: "var(--scene-text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold" style={{ color: "var(--scene-text-primary)" }}>{pending.selfRealm}</span>
            <Handshake className="h-3.5 w-3.5" style={{ color: "var(--scene-text-muted)" }} />
            {pending.addMode ? (
              <select
                value={pending.otherRealm}
                onChange={(e) => onChange({ otherRealm: e.target.value })}
                className="min-w-0 flex-1 rounded border px-1.5 py-1"
                style={{ background: "var(--scene-bg)", color: "var(--scene-text-primary)", borderColor: "var(--scene-border)" }}
              >
                <option value="">Choose a realm…</option>
                {targets.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            ) : (
              <span className="font-semibold" style={{ color: "var(--scene-text-primary)" }}>{pending.otherRealm}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span style={{ color: "var(--scene-text-muted)" }}>Status</span>
            <select
              value={pending.status}
              onChange={(e) => onChange({ status: e.target.value })}
              className="rounded border px-1.5 py-1"
              style={{ background: "var(--scene-bg)", color: relColor(pending.status), borderColor: "var(--scene-border)" }}
            >
              {DIPLOMACY_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value={NEUTRAL}>None</option>
            </select>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label style={{ color: "var(--scene-text-muted)" }}>Headline (players see this when revealed)</label>
              <button
                type="button"
                onClick={generate}
                disabled={!pending.otherRealm || generating}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium hover:opacity-80 disabled:opacity-40"
                style={{ color: "var(--scene-accent)", border: "1px solid var(--scene-border)" }}
                title="Generate a headline + private DM plot seed with AI"
              >
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {generating ? "Generating…" : "Generate"}
              </button>
            </div>
            <input
              value={pending.headline}
              onChange={(e) => onHeadline(e.target.value)}
              placeholder={pending.otherRealm ? "" : "Choose a realm first…"}
              className="w-full rounded border px-2 py-1.5 text-sm"
              style={{ background: "var(--scene-bg)", color: "var(--scene-text-primary)", borderColor: "var(--scene-border)" }}
            />
            {genError && (
              <p className="mt-1 text-[11px]" style={{ color: "#dc2626" }}>
                {genError}
                {quotaHit && (
                  <>
                    {" "}
                    <a href="/account" className="underline" style={{ color: "var(--scene-accent)" }}>
                      Upgrade
                    </a>
                  </>
                )}
              </p>
            )}
          </div>

          {seed && (
            <div className="rounded-lg border p-2.5" style={{ background: "var(--scene-bg)", borderColor: "var(--scene-border)" }}>
              <div className="mb-1 flex items-center gap-1.5">
                <ScrollText className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
                  DM plot seed · never shown to players
                </span>
              </div>
              <p className="text-xs font-bold" style={{ color: "var(--scene-text-primary)" }}>{seed.title}</p>
              <MarkdownRenderer variant="scene" content={seed.hook} className="mt-0.5 text-[11px]" />
              <button
                type="button"
                onClick={savePlotThread}
                disabled={saving || saved}
                className="mt-2 inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold hover:opacity-80 disabled:opacity-60"
                style={{
                  background: saved ? "var(--scene-bg)" : "var(--scene-accent)",
                  color: saved ? "var(--scene-text-muted)" : "var(--scene-bg)",
                  border: "1px solid var(--scene-border)",
                }}
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScrollText className="h-3 w-3" />}
                {saved ? "Saved to plot threads" : saving ? "Saving…" : "Save as plot thread"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => onCommit("revealed")}
            disabled={!pending.otherRealm}
            className="flex-1 rounded px-2 py-1.5 text-xs font-semibold disabled:opacity-40"
            style={{ background: "#16a34a", color: "#fff" }}
          >
            Reveal now
          </button>
          <button
            onClick={() => onCommit("held")}
            disabled={!pending.otherRealm}
            className="flex-1 rounded px-2 py-1.5 text-xs font-semibold disabled:opacity-40"
            style={{ background: "var(--scene-bg)", color: "var(--scene-text-primary)", border: "1px solid var(--scene-border)" }}
          >
            Save for later
          </button>
          <button
            onClick={() => onCommit("private")}
            disabled={!pending.otherRealm}
            className="rounded px-2 py-1.5 text-xs font-medium disabled:opacity-40"
            style={{ color: "var(--scene-text-muted)" }}
            title="Apply the change, but never show players"
          >
            Ignore
          </button>
        </div>
      </div>
    </div>
  )
}
