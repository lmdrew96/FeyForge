"use client"

import { AppShell } from "@/components/app-shell"
import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { SCENES, applySceneToBody } from "@/lib/scenes"
import { CLASS_COLORS } from "@/lib/character/constants"
import { cn } from "@/lib/utils"
import {
  Sparkles, Play, Square, Radio, Users, Clock, Heart, X,
  ChevronUp, ChevronDown, Shield, Trash2, Package, ScrollText,
} from "lucide-react"
import { toast } from "sonner"
import { DMAudioPanel, PlayerAudioReceiver } from "@/components/session/audio-panel"

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionId = Id<"partySessions">
type CampaignId = Id<"campaigns">
type CharacterId = Id<"characters">

type BroadcastDoc = {
  _id: Id<"sessionBroadcasts">
  type: "npc" | "location" | "scene" | "custom" | "web_node"
  title: string
  body?: string
}

const BROADCAST_TYPE_LABEL: Record<string, string> = {
  npc: "NPC",
  location: "Location",
  scene: "Scene",
  custom: "Custom",
  web_node: "Web Node",
}

type PartyMember = {
  _id: Id<"partyMembers">
  userId: string
  conditions: string[]
  character: {
    _id: CharacterId
    name: string
    characterClass: string
    level: number
    hitPoints: { current: number; max: number; temp: number }
  } | null
}

type MyMember = {
  _id: Id<"partyMembers">
  characterId: CharacterId
  conditions: string[]
  character: {
    _id: CharacterId
    name: string
    characterClass: string
    level: number
    hitPoints: { current: number; max: number; temp: number }
  } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CONDITIONS = [
  "Blinded", "Charmed", "Deafened", "Frightened", "Grappled",
  "Incapacitated", "Invisible", "Paralyzed", "Petrified",
  "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
]

const CONDITION_COLORS: Record<string, string> = {
  Blinded: "#6b7280", Charmed: "#ec4899", Deafened: "#6b7280",
  Frightened: "#f59e0b", Grappled: "#8b5cf6", Incapacitated: "#ef4444",
  Invisible: "#a1a1aa", Paralyzed: "#ef4444", Petrified: "#78716c",
  Poisoned: "#22c55e", Prone: "#94a3b8", Restrained: "#8b5cf6",
  Stunned: "#ef4444", Unconscious: "#1f2937",
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0
  const color = pct > 0.5 ? "var(--scene-accent)" : pct > 0.25 ? "#f59e0b" : "#ef4444"
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--scene-border)" }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, background: color }} />
    </div>
  )
}

type TabId = "live" | "notes" | "inventory"

function SessionTabs({ tab, setTab }: { tab: TabId; setTab: (t: TabId) => void }) {
  return (
    <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
      {([
        { id: "live" as TabId, label: "Live", icon: Sparkles },
        { id: "notes" as TabId, label: "Notes", icon: ScrollText },
        { id: "inventory" as TabId, label: "Inventory", icon: Package },
      ] as const).map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setTab(id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all"
          style={{
            background: tab === id ? "var(--scene-accent)" : "transparent",
            color: tab === id ? "var(--scene-bg)" : "var(--scene-text-muted)",
          }}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Notes View ────────────────────────────────────────────────────────────────

function NotesView({ sessionId, isDM }: { sessionId: SessionId; isDM: boolean }) {
  const notes = useQuery(api.sessionNotes.list, { sessionId })
  const doUpsert = useMutation(api.sessionNotes.upsert)

  const [content, setContent] = useState("")
  const initializedRef = useRef(false)
  const lastSavedRef = useRef("")

  const myNote = notes?.find((n) => n.isMyNote)
  const otherNotes = notes?.filter((n) => !n.isMyNote && n.content.trim())

  useEffect(() => {
    if (!initializedRef.current && myNote !== undefined) {
      const saved = myNote?.content ?? ""
      setContent(saved)
      lastSavedRef.current = saved
      initializedRef.current = true
    }
  }, [myNote])

  useEffect(() => {
    if (!initializedRef.current) return
    if (content === lastSavedRef.current) return
    const timer = setTimeout(() => {
      doUpsert({ sessionId, content })
        .then(() => { lastSavedRef.current = content })
        .catch(console.error)
    }, 800)
    return () => clearTimeout(timer)
  }, [content, sessionId, doUpsert])

  const isSaving = content !== lastSavedRef.current

  return (
    <div className="space-y-6">
      {/* My note */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>
            {isDM ? "DM Notes" : "Your Notes"}
          </h2>
          {isSaving && (
            <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>Saving…</span>
          )}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={isDM ? "Session prep, plot notes, reminders…" : "Session notes, loot wishlist, things to remember…"}
          rows={6}
          className="w-full px-4 py-3 rounded-xl text-sm bg-transparent outline-none resize-none leading-relaxed"
          style={{
            border: isDM
              ? "1px solid color-mix(in srgb, var(--scene-accent) 35%, var(--scene-border))"
              : "1px solid var(--scene-border)",
            color: "var(--scene-text-primary)",
            background: isDM
              ? "color-mix(in srgb, var(--scene-accent) 4%, var(--scene-surface))"
              : "var(--scene-surface)",
          }}
        />
      </section>

      {/* Others' notes */}
      {otherNotes && otherNotes.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
            Party Notes
          </h2>
          <div className="space-y-3">
            {otherNotes.map((note) => (
              <div
                key={note._id}
                className="rounded-xl px-4 py-3"
                style={{
                  background: note.isDM
                    ? "color-mix(in srgb, var(--scene-accent) 4%, var(--scene-surface))"
                    : "var(--scene-surface)",
                  border: note.isDM
                    ? "1px solid color-mix(in srgb, var(--scene-accent) 35%, var(--scene-border))"
                    : "1px solid var(--scene-border)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: note.isDM ? "var(--scene-accent)" : "var(--scene-border)",
                      color: note.isDM ? "var(--scene-bg)" : "var(--scene-text-muted)",
                    }}
                  >
                    {note.isDM ? "DM" : "Player"}
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--scene-text-primary)" }}>
                  {note.content}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {otherNotes?.length === 0 && notes !== undefined && (
        <p className="text-sm text-center" style={{ color: "var(--scene-text-muted)" }}>
          No one else has written notes yet.
        </p>
      )}
    </div>
  )
}

// ── Inventory View ────────────────────────────────────────────────────────────

function InventoryView({
  sessionId,
  campaignId,
  isDM,
  myCharacterId,
}: {
  sessionId: SessionId
  campaignId: CampaignId
  isDM: boolean
  myCharacterId?: CharacterId
}) {
  const items = useQuery(api.partyInventory.list, { sessionId })
  const partyMembers = useQuery(api.liveSessions.getPartyMembers, { sessionId })
  const doAdd = useMutation(api.partyInventory.add)
  const doAssign = useMutation(api.partyInventory.assign)
  const doRemove = useMutation(api.partyInventory.remove)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    if (!name.trim()) return
    setAdding(true)
    try {
      await doAdd({ sessionId, campaignId, name: name.trim(), description: description.trim() || undefined, quantity })
      setName("")
      setDescription("")
      setQuantity(1)
    } catch {
      toast.error("Failed to add item.")
    } finally {
      setAdding(false)
    }
  }

  const handleAssign = (itemId: Id<"partyInventory">, charId: string) => {
    doAssign({
      itemId,
      characterId: charId ? (charId as CharacterId) : undefined,
    }).catch(() => toast.error("Failed to assign item."))
  }

  const handleRemove = (itemId: Id<"partyInventory">) => {
    if (!confirm("Remove this item from the party inventory?")) return
    doRemove({ itemId }).catch(() => toast.error("Failed to remove item."))
  }

  return (
    <div className="space-y-6">
      {/* DM: Add item form */}
      {isDM && (
        <section>
          <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
            Add to Loot Pool
          </h2>
          <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
                placeholder="Item name…"
                className="flex-1 px-3 py-2 rounded-md text-sm bg-transparent outline-none"
                style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-9 rounded-md text-sm font-bold hover:opacity-80"
                  style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
                >
                  −
                </button>
                <span
                  className="w-10 text-center text-sm font-bold"
                  style={{ color: "var(--scene-text-primary)" }}
                >
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-8 h-9 rounded-md text-sm font-bold hover:opacity-80"
                  style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
                >
                  +
                </button>
              </div>
            </div>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)…"
              className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none"
              style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
            />
            <button
              onClick={handleAdd}
              disabled={adding || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
            >
              <Package className="h-4 w-4" />
              {adding ? "Adding…" : "Add Item"}
            </button>
          </div>
        </section>
      )}

      {/* Item list */}
      <section>
        <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
          Party Loot
          {items && items.length > 0 && ` — ${items.length} item${items.length !== 1 ? "s" : ""}`}
        </h2>

        {items === undefined && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-lg h-16" style={{ background: "var(--scene-surface)" }} />
            ))}
          </div>
        )}

        {items && items.length === 0 && (
          <div
            className="rounded-xl p-8 text-center"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            <Package className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--scene-text-muted)", opacity: 0.3 }} />
            <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
              {isDM ? "No loot yet. Add items above." : "No loot in the pool yet."}
            </p>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => {
              const isMyItem = myCharacterId && item.assignedToCharacterId === myCharacterId
              return (
                <div
                  key={item._id}
                  className="rounded-lg px-4 py-3"
                  style={{
                    background: isMyItem
                      ? "color-mix(in srgb, var(--scene-accent) 8%, var(--scene-surface))"
                      : "var(--scene-surface)",
                    border: `1px solid ${isMyItem ? "color-mix(in srgb, var(--scene-accent) 30%, var(--scene-border))" : "var(--scene-border)"}`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm" style={{ color: "var(--scene-text-primary)" }}>
                          {item.name}
                        </span>
                        {item.quantity > 1 && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}
                          >
                            ×{item.quantity}
                          </span>
                        )}
                        {item.assignedToCharacterName && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background: isMyItem ? "var(--scene-accent)" : "var(--scene-border)",
                              color: isMyItem ? "var(--scene-bg)" : "var(--scene-text-muted)",
                            }}
                          >
                            {isMyItem ? "Yours" : item.assignedToCharacterName}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* DM controls */}
                    {isDM && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <select
                          value={item.assignedToCharacterId ?? ""}
                          onChange={(e) => handleAssign(item._id, e.target.value)}
                          className="text-xs px-2 py-1 rounded-md bg-transparent outline-none"
                          style={{
                            border: "1px solid var(--scene-border)",
                            color: "var(--scene-text-muted)",
                            background: "var(--scene-surface)",
                          }}
                        >
                          <option value="">Unassigned</option>
                          {(partyMembers as PartyMember[] | undefined)?.map((m) =>
                            m.character ? (
                              <option key={m._id} value={m.character._id}>
                                {m.character.name}
                              </option>
                            ) : null
                          )}
                        </select>
                        <button
                          onClick={() => handleRemove(item._id)}
                          className="p-1.5 rounded transition-opacity hover:opacity-80"
                          style={{ color: "var(--scene-text-muted)" }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Broadcast Modal ───────────────────────────────────────────────────────────

function BroadcastModal({ broadcast, onClose }: { broadcast: BroadcastDoc; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl max-w-lg w-full p-6 shadow-2xl"
        style={{
          background: "var(--scene-surface)",
          border: "1px solid color-mix(in srgb, var(--scene-accent) 40%, var(--scene-border))",
          boxShadow: "0 0 40px var(--scene-accent-glow)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded transition-opacity hover:opacity-80" style={{ color: "var(--scene-text-muted)" }}>
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}>
            {BROADCAST_TYPE_LABEL[broadcast.type] ?? broadcast.type}
          </span>
        </div>
        <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
          {broadcast.title}
        </h2>
        {broadcast.body && (
          <p className="text-sm leading-relaxed" style={{ color: "var(--scene-text-muted)" }}>{broadcast.body}</p>
        )}
      </div>
    </div>
  )
}

// ── Party Rail ────────────────────────────────────────────────────────────────

function PartyRail({ sessionId }: { sessionId: SessionId }) {
  const members = useQuery(api.liveSessions.getPartyMembers, { sessionId })

  if (!members || members.length === 0) {
    return (
      <section>
        <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>The Party</h2>
        <div className="rounded-lg p-4 text-center text-sm" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-muted)" }}>
          No players have joined yet.
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>
        The Party — {members.length} adventurer{members.length !== 1 ? "s" : ""}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(members as PartyMember[]).map((m) => {
          const char = m.character
          if (!char) return null
          const classColor = CLASS_COLORS[char.characterClass.toLowerCase()] ?? "bg-gray-600 text-white"
          const visibleConditions = m.conditions.slice(0, 3)
          const extraCount = m.conditions.length - 3
          return (
            <div key={m._id} className="rounded-lg p-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
              <div className="flex items-start gap-2 mb-2">
                <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--scene-accent) 12%, var(--scene-surface))", border: "1px solid color-mix(in srgb, var(--scene-accent) 25%, transparent)" }}>
                  <Shield className="h-4 w-4" style={{ color: "var(--scene-accent)" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>{char.name}</p>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", classColor)}>{char.characterClass}</span>
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: "var(--scene-text-muted)" }}>{char.hitPoints.current}/{char.hitPoints.max}</span>
              </div>
              <HpBar current={char.hitPoints.current} max={char.hitPoints.max} />
              {m.conditions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {visibleConditions.map((c) => (
                    <span key={c} className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${CONDITION_COLORS[c] ?? "#6b7280"}22`, color: CONDITION_COLORS[c] ?? "#6b7280", border: `1px solid ${CONDITION_COLORS[c] ?? "#6b7280"}44` }}>{c}</span>
                  ))}
                  {extraCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--scene-text-muted)" }}>+{extraCount}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── My Character Panel ────────────────────────────────────────────────────────

function MyCharacterPanel({ sessionId, member }: { sessionId: SessionId; member: MyMember }) {
  const doUpdateHp = useMutation(api.characters.updateHp)
  const doToggleCondition = useMutation(api.liveSessions.toggleCondition)
  const [showConditions, setShowConditions] = useState(false)

  const char = member.character
  if (!char) return null
  const classColor = CLASS_COLORS[char.characterClass.toLowerCase()] ?? "bg-gray-600 text-white"

  const handleHpDelta = (delta: number) => {
    doUpdateHp({ id: char._id, delta }).catch(() => toast.error("Failed to update HP."))
  }
  const handleToggleCondition = (condition: string) => {
    doToggleCondition({ sessionId, condition }).catch(() => toast.error("Failed to update condition."))
  }

  const pct = char.hitPoints.max > 0 ? Math.max(0, char.hitPoints.current / char.hitPoints.max) : 0
  const barColor = pct > 0.5 ? "var(--scene-accent)" : pct > 0.25 ? "#f59e0b" : "#ef4444"

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--scene-accent) 15%, var(--scene-surface))", border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, transparent)" }}>
          <Shield className="h-5 w-5" style={{ color: "var(--scene-accent)" }} />
        </div>
        <div>
          <h3 className="font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>{char.name}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", classColor)}>{char.characterClass}</span>
            <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>Lv {char.level}</span>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5" style={{ color: "var(--scene-accent)" }} />
            <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)" }}>Hit Points</span>
          </div>
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--scene-text-primary)" }}>
            {char.hitPoints.current}<span style={{ color: "var(--scene-text-muted)" }}>/{char.hitPoints.max}</span>
          </span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden mb-2" style={{ background: "var(--scene-border)" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, background: barColor }} />
        </div>
        <div className="flex gap-1.5">
          {([-5, -1] as const).map((d) => (
            <button key={d} onClick={() => handleHpDelta(d)} disabled={char.hitPoints.current === 0}
              className="flex-1 py-1 rounded text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-30"
              style={{ background: "#ef444422", color: "#ef4444", border: "1px solid #ef444444" }}>
              {d}
            </button>
          ))}
          <div className="flex-1 py-1 rounded text-center text-sm font-bold tabular-nums" style={{ background: "var(--scene-border)", color: "var(--scene-text-primary)" }}>
            {char.hitPoints.current}
          </div>
          {([1, 5] as const).map((d) => (
            <button key={d} onClick={() => handleHpDelta(d)} disabled={char.hitPoints.current >= char.hitPoints.max}
              className="flex-1 py-1 rounded text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-30"
              style={{ background: "color-mix(in srgb, var(--scene-accent) 20%, transparent)", color: "var(--scene-accent)", border: "1px solid color-mix(in srgb, var(--scene-accent) 40%, transparent)" }}>
              +{d}
            </button>
          ))}
        </div>
      </div>

      <button onClick={() => setShowConditions((v) => !v)} className="flex items-center gap-1.5 text-xs w-full transition-opacity hover:opacity-80" style={{ color: "var(--scene-text-muted)" }}>
        <span className="uppercase tracking-widest flex-1 text-left">
          Conditions
          {member.conditions.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs" style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}>{member.conditions.length}</span>}
        </span>
        {showConditions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {showConditions && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {CONDITIONS.map((c) => {
            const active = member.conditions.includes(c)
            return (
              <button key={c} onClick={() => handleToggleCondition(c)} className="text-xs px-2 py-1 rounded transition-all"
                style={{ background: active ? `${CONDITION_COLORS[c] ?? "#6b7280"}22` : "var(--scene-border)", color: active ? (CONDITION_COLORS[c] ?? "#6b7280") : "var(--scene-text-muted)", border: active ? `1px solid ${CONDITION_COLORS[c] ?? "#6b7280"}66` : "1px solid transparent" }}>
                {c}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Join View ─────────────────────────────────────────────────────────────────

function JoinView({ sessionId }: { sessionId: SessionId }) {
  const characters = useQuery(api.characters.list)
  const doJoin = useMutation(api.liveSessions.joinSession)
  const [joining, setJoining] = useState<CharacterId | null>(null)

  const handleJoin = async (characterId: CharacterId) => {
    setJoining(characterId)
    try {
      await doJoin({ sessionId, characterId })
    } catch {
      toast.error("Failed to join session.")
      setJoining(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--scene-accent)" }} />
          <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-accent)" }}>Session Live</span>
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>Choose Your Character</h1>
        <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>Pick who you're playing to join the party.</p>
      </div>

      {characters === undefined && (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--scene-surface)" }} />)}</div>
      )}
      {characters && characters.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
          <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>You don't have any characters yet. Create one first.</p>
        </div>
      )}
      {characters && characters.length > 0 && (
        <div className="space-y-3">
          {characters.map((char) => {
            const classColor = CLASS_COLORS[char.characterClass.toLowerCase()] ?? "bg-gray-600 text-white"
            return (
              <button key={char._id} onClick={() => handleJoin(char._id)} disabled={joining !== null}
                className="w-full rounded-xl p-4 flex items-center gap-4 text-left transition-all hover:scale-[1.01] disabled:opacity-60"
                style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--scene-accent) 15%, var(--scene-surface))", border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, transparent)" }}>
                  <Shield className="h-5 w-5" style={{ color: "var(--scene-accent)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>{char.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", classColor)}>{char.characterClass}</span>
                    <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>Lv {char.level} · {char.hitPoints.current}/{char.hitPoints.max} HP</span>
                  </div>
                </div>
                <span className="text-sm font-medium flex-shrink-0 px-4 py-1.5 rounded-md" style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}>
                  {joining === char._id ? "Joining…" : "Play"}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Player Receiver View ──────────────────────────────────────────────────────

function ReceiverView({ sessionId, campaignId, myMember }: { sessionId: SessionId; campaignId: CampaignId; myMember: MyMember }) {
  const activeSession = useQuery(api.liveSessions.getActiveSession, { campaignId })
  const broadcasts = useQuery(api.liveSessions.listBroadcasts, { sessionId })
  const [selectedBroadcast, setSelectedBroadcast] = useState<BroadcastDoc | null>(null)

  const activeScene = activeSession?.activeScene ?? ""
  const activeScenePalette = activeSession?.activeScenePalette ?? null
  const currentScene = SCENES.find((s) => s.id === activeScene)

  useEffect(() => {
    applySceneToBody(activeScene, activeScenePalette)
    return () => applySceneToBody("")
  }, [activeScene, activeScenePalette])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--scene-accent)" }} />
        <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-accent)" }}>Session Live</span>
      </div>

      <MyCharacterPanel sessionId={sessionId} member={myMember} />

      <PlayerAudioReceiver sessionId={sessionId} campaignId={campaignId} />

      <div className="rounded-xl p-6 text-center" style={{ background: "color-mix(in srgb, var(--scene-accent) 6%, var(--scene-surface))", border: "1px solid color-mix(in srgb, var(--scene-accent) 20%, var(--scene-border))" }}>
        {activeScene ? (
          <>
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--scene-accent)" }}>Current Scene</div>
            <h2 className="text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>{currentScene?.label ?? activeScene}</h2>
            <p className="text-sm italic" style={{ color: "var(--scene-text-muted)" }}>{currentScene?.desc}</p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Clock className="h-6 w-6" style={{ color: "var(--scene-text-muted)", opacity: 0.4 }} />
            <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>The DM is preparing the scene…</p>
          </div>
        )}
      </div>

      {broadcasts && broadcasts.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>From the DM</h2>
          <div className="space-y-3">
            {broadcasts.map((b, i) => (
              <button key={b._id} onClick={() => setSelectedBroadcast(b as BroadcastDoc)}
                className="w-full rounded-xl p-4 text-left transition-all hover:scale-[1.005]"
                style={{ background: i === 0 ? "color-mix(in srgb, var(--scene-accent) 8%, var(--scene-surface))" : "var(--scene-surface)", border: `1px solid ${i === 0 ? "color-mix(in srgb, var(--scene-accent) 35%, transparent)" : "var(--scene-border)"}`, boxShadow: i === 0 ? "0 0 16px var(--scene-accent-glow)" : "none" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>{BROADCAST_TYPE_LABEL[b.type] ?? b.type}</span>
                  {i === 0 && <span className="text-xs px-2 py-0.5 rounded-full animate-pulse" style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}>New</span>}
                </div>
                <p className="font-semibold text-sm" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>{b.title}</p>
                {b.body && <p className="text-xs mt-1 truncate" style={{ color: "var(--scene-text-muted)" }}>{b.body}</p>}
                <p className="text-xs mt-2" style={{ color: "var(--scene-accent)", opacity: 0.7 }}>Tap to reveal →</p>
              </button>
            ))}
          </div>
        </section>
      )}

      <PartyRail sessionId={sessionId} />

      {selectedBroadcast && <BroadcastModal broadcast={selectedBroadcast} onClose={() => setSelectedBroadcast(null)} />}
    </div>
  )
}

// ── DM Conductor View ─────────────────────────────────────────────────────────

function ConductorView({ sessionId, campaignId, activeScene }: { sessionId: SessionId; campaignId: CampaignId; activeScene: string }) {
  const doActivateScene = useMutation(api.liveSessions.activateScene)
  const doEndSession = useMutation(api.liveSessions.endSession)
  const doBroadcast = useMutation(api.liveSessions.broadcastReveal)
  const broadcasts = useQuery(api.liveSessions.listBroadcasts, { sessionId })

  const [broadcastTitle, setBroadcastTitle] = useState("")
  const [broadcastBody, setBroadcastBody] = useState("")
  const [broadcastType, setBroadcastType] = useState<"npc" | "location" | "custom">("custom")
  const [sending, setSending] = useState(false)

  const currentScene = SCENES.find((s) => s.id === activeScene)

  const handleSetScene = (scene: string) => {
    doActivateScene({ sessionId, scene }).catch(() => toast.error("Failed to activate scene."))
  }
  const handleEndSession = async () => {
    if (!confirm("End this session?")) return
    try { await doEndSession({ sessionId }); toast.success("Session ended.") }
    catch { toast.error("Failed to end session.") }
  }
  const handleBroadcast = async () => {
    if (!broadcastTitle.trim()) return
    setSending(true)
    try {
      await doBroadcast({ sessionId, campaignId, type: broadcastType, title: broadcastTitle.trim(), body: broadcastBody.trim() || undefined })
      setBroadcastTitle(""); setBroadcastBody(""); toast.success("Broadcast sent.")
    } catch { toast.error("Failed to send broadcast.") }
    finally { setSending(false) }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--scene-accent)" }} />
            <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-accent)" }}>Session Live</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>DM Conductor</h1>
          {currentScene && currentScene.id !== "" && <p className="text-sm mt-0.5" style={{ color: "var(--scene-text-muted)" }}>{currentScene.label} — {currentScene.desc}</p>}
        </div>
        <button onClick={handleEndSession} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>
          <Square className="h-3.5 w-3.5" />End Session
        </button>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>Active Scene</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {SCENES.map((scene) => (
            <button key={scene.id} onClick={() => handleSetScene(scene.id)} className="rounded-lg p-3 text-left transition-all hover:opacity-90"
              style={{ background: "var(--scene-surface)", border: `1px solid ${activeScene === scene.id ? "var(--scene-accent)" : "var(--scene-border)"}`, boxShadow: activeScene === scene.id ? "0 0 10px var(--scene-accent-glow)" : "none" }}>
              <div className="text-sm font-semibold mb-0.5 truncate" style={{ fontFamily: "var(--font-cinzel)", color: activeScene === scene.id ? "var(--scene-accent)" : "var(--scene-text-primary)" }}>{scene.label}</div>
              <div className="text-xs truncate" style={{ color: "var(--scene-text-muted)" }}>{scene.desc}</div>
            </button>
          ))}
        </div>
      </section>

      <DMAudioPanel sessionId={sessionId} />

      <section>
        <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>Broadcast to Players</h2>
        <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
          <div className="flex gap-2">
            {(["npc", "location", "custom"] as const).map((t) => (
              <button key={t} onClick={() => setBroadcastType(t)} className="px-3 py-1 rounded-full text-xs font-medium capitalize transition-opacity"
                style={{ background: broadcastType === t ? "var(--scene-accent)" : "var(--scene-border)", color: broadcastType === t ? "var(--scene-bg)" : "var(--scene-text-muted)" }}>
                {t}
              </button>
            ))}
          </div>
          <input value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} placeholder="Title…" className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none" style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }} />
          <textarea value={broadcastBody} onChange={(e) => setBroadcastBody(e.target.value)} placeholder="Optional flavor text…" rows={2} className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none resize-none" style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }} />
          <button onClick={handleBroadcast} disabled={sending || !broadcastTitle.trim()} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50" style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}>
            <Radio className="h-4 w-4" />{sending ? "Sending…" : "Send Broadcast"}
          </button>
        </div>
      </section>

      {broadcasts && broadcasts.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--scene-text-muted)" }}>Sent This Session</h2>
          <div className="space-y-2">
            {broadcasts.map((b) => (
              <div key={b._id} className="rounded-lg px-4 py-3 flex items-start gap-3" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
                <span className="text-xs px-2 py-0.5 rounded-full mt-0.5" style={{ background: "var(--scene-border)", color: "var(--scene-text-muted)" }}>{BROADCAST_TYPE_LABEL[b.type] ?? b.type}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>{b.title}</p>
                  {b.body && <p className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>{b.body}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <PartyRail sessionId={sessionId} />
    </div>
  )
}

// ── DM Ready / Player Waiting ─────────────────────────────────────────────────

function DMReadyView({ campaignId }: { campaignId: CampaignId }) {
  const startSession = useMutation(api.liveSessions.startSession)
  const [starting, setStarting] = useState(false)

  const handleStart = async () => {
    setStarting(true)
    try { await startSession({ campaignId }); toast.success("Session started.") }
    catch { toast.error("Failed to start session."); setStarting(false) }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "color-mix(in srgb, var(--scene-accent) 15%, var(--scene-surface))", border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, transparent)" }}>
        <Sparkles className="h-8 w-8" style={{ color: "var(--scene-accent)" }} />
      </div>
      <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>Ready to Forge the Session</h2>
      <p className="text-sm mb-8 max-w-sm" style={{ color: "var(--scene-text-muted)" }}>Start a live session and your players will see scenes, atmosphere, and broadcasts in real time.</p>
      <button onClick={handleStart} disabled={starting} className="flex items-center gap-2 px-6 py-3 rounded-md font-medium transition-opacity hover:opacity-80 disabled:opacity-50" style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}>
        <Play className="h-4 w-4" />{starting ? "Starting…" : "Start Session"}
      </button>
    </div>
  )
}

function PlayerWaiting() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}>
        <Users className="h-8 w-8" style={{ color: "var(--scene-text-muted)", opacity: 0.4 }} />
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>Awaiting the DM</h2>
      <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>No active session yet. Sit tight — the forge will light soon.</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const [tab, setTab] = useState<TabId>("live")

  const myCampaign = useQuery(api.liveSessions.getMyDefaultCampaign)
  const activeSessionForDM = useQuery(
    api.liveSessions.getActiveSession,
    myCampaign ? { campaignId: myCampaign._id } : "skip"
  )
  const anyActiveSession = useQuery(api.liveSessions.getAnyActiveSession)
  const myPartyMember = useQuery(
    api.liveSessions.getMyPartyMember,
    myCampaign === null && anyActiveSession ? { sessionId: anyActiveSession._id } : "skip"
  )

  const isDM = !!myCampaign

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
          activeSessionForDM === undefined ? (
            <div className="animate-pulse rounded-xl h-48" style={{ background: "var(--scene-surface)" }} />
          ) : activeSessionForDM ? (
            <>
              <SessionTabs tab={tab} setTab={setTab} />
              {tab === "live" && (
                <ConductorView
                  sessionId={activeSessionForDM._id}
                  campaignId={activeSessionForDM.campaignId}
                  activeScene={activeSessionForDM.activeScene}
                />
              )}
              {tab === "notes" && <NotesView sessionId={activeSessionForDM._id} isDM={true} />}
              {tab === "inventory" && (
                <InventoryView
                  sessionId={activeSessionForDM._id}
                  campaignId={activeSessionForDM.campaignId}
                  isDM={true}
                />
              )}
            </>
          ) : (
            <DMReadyView campaignId={myCampaign._id} />
          )
        ) : anyActiveSession ? (
          myPartyMember === undefined ? (
            <div className="animate-pulse rounded-xl h-48" style={{ background: "var(--scene-surface)" }} />
          ) : myPartyMember ? (
            <>
              <SessionTabs tab={tab} setTab={setTab} />
              {tab === "live" && (
                <ReceiverView
                  sessionId={anyActiveSession._id}
                  campaignId={anyActiveSession.campaignId}
                  myMember={myPartyMember as MyMember}
                />
              )}
              {tab === "notes" && <NotesView sessionId={anyActiveSession._id} isDM={false} />}
              {tab === "inventory" && (
                <InventoryView
                  sessionId={anyActiveSession._id}
                  campaignId={anyActiveSession.campaignId}
                  isDM={false}
                  myCharacterId={myPartyMember.characterId}
                />
              )}
            </>
          ) : (
            <JoinView sessionId={anyActiveSession._id} />
          )
        ) : (
          <PlayerWaiting />
        )}
      </div>
    </AppShell>
  )
}
