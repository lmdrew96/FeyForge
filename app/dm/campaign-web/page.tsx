"use client"

import { AppShell } from "@/components/app-shell"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type OnNodeDrag,
  type OnEdgesDelete,
  type OnNodesDelete,
  Panel,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Users, MapPin, ScrollText, Shield, Milestone, Plus, Trash2, X, Check, Radio, ChevronDown } from "lucide-react"
import { metaFor } from "@/components/world-map/shared"
import { pinFilterKey } from "@/components/world-map/pins-panel"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"

// Pin meta shape returned by metaFor — reused so Story Web location nodes match
// the world map's icon/label/color for each pin kind exactly.
type PinMeta = ReturnType<typeof metaFor>

// Display order for grouping map pins in the Location picker: settlements, then
// combat/quest POIs, social/flavor, then terrain. Mirrors the world map panel.
const LOCATION_KIND_ORDER = [
  "settlement", "npc", "encounter", "monster", "dungeon", "ruin", "tavern", "landmark", "poi", "natural", "water", "region",
]
const locationKindOrder = (k: string): number => {
  const i = LOCATION_KIND_ORDER.indexOf(k)
  return i === -1 ? 999 : i
}

// ── Types ─────────────────────────────────────────────────────────────────────

type EntityType = "npc" | "location" | "wiki" | "faction" | "plot_hook"

const TYPE_META: Record<EntityType, { label: string; color: string; icon: React.ElementType }> = {
  npc:       { label: "NPC",        color: "#e8855a", icon: Users },
  location:  { label: "Location",   color: "#5a9e6f", icon: MapPin },
  wiki:      { label: "Wiki Entry", color: "#6b9be8", icon: ScrollText },
  faction:   { label: "Faction",    color: "#c27dd4", icon: Shield },
  plot_hook: { label: "Plot Hook",  color: "#d4a827", icon: Milestone },
}

const EDGE_LABELS = [
  "knows about", "allied with", "enemy of",
  "located in", "holds", "connected to", "member of", "seeks",
]

// ── Custom node component ─────────────────────────────────────────────────────

type WebNodeData = {
  label: string
  entityType: EntityType
  color?: string
  // For location nodes: the resolved pin kind's icon/label/color, so a tavern pin
  // renders as a tavern (not a generic green "Location"). Derived at render from
  // the live map pin, so it also corrects nodes added before this differentiation.
  locMeta?: PinMeta
  onDelete: (id: string) => void
  onReveal: (id: string) => void
  sessionActive: boolean
}

function WebNode({ id, data, selected }: { id: string; data: WebNodeData; selected: boolean }) {
  // Location nodes show their actual pin kind (tavern/dungeon/river…); everything
  // else uses the node-type meta. locMeta is resolved from the live map pin.
  const meta = data.entityType === "location" && data.locMeta ? data.locMeta : TYPE_META[data.entityType]
  const color = data.color ?? meta.color
  const Icon = meta.icon

  return (
    <div
      className="rounded-lg px-3 py-2 text-xs font-medium select-none relative"
      style={{
        background: "var(--scene-surface)",
        border: `2px solid ${selected ? color : color + "88"}`,
        boxShadow: selected ? `0 0 10px ${color}55` : `0 2px 6px rgba(0,0,0,0.4)`,
        minWidth: 120,
        maxWidth: 180,
        color: "var(--scene-text-primary)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color, border: "none", width: 8, height: 8 }} />

      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon size={10} style={{ color }} />
        <span className="text-xs uppercase tracking-wide" style={{ color, opacity: 0.8, fontSize: "9px" }}>
          {meta.label}
        </span>
      </div>
      <div className="truncate font-semibold" style={{ fontFamily: "var(--font-cinzel)", fontSize: "11px" }}>
        {data.label}
      </div>

      {data.sessionActive && (
        <button
          title="Reveal to players"
          className="absolute -top-2 -left-2 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "#5a9e6f", color: "#fff" }}
          onPointerDown={(e) => { e.stopPropagation(); data.onReveal(id) }}
        >
          <Radio size={8} />
        </button>
      )}

      <button
        className="absolute -top-2 -right-2 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "#e05555", color: "#fff" }}
        onPointerDown={(e) => { e.stopPropagation(); data.onDelete(id) }}
      >
        <X size={8} />
      </button>

      <Handle type="source" position={Position.Bottom} style={{ background: color, border: "none", width: 8, height: 8 }} />
    </div>
  )
}

const nodeTypes = { webNode: WebNode }

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CampaignWebPage() {
  const [campaignId, setCampaignId] = useState<Id<"campaigns"> | null>(null)
  const [sessionId, setSessionId] = useState<Id<"partySessions"> | null>(null)
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null)
  const [pendingEdgeLabel, setPendingEdgeLabel] = useState("")
  const [activeTab, setActiveTab] = useState<EntityType>("npc")
  const [newNodeLabel, setNewNodeLabel] = useState("")
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null)
  const [editingEdgeLabel, setEditingEdgeLabel] = useState("")
  const [openHookId, setOpenHookId] = useState<string | null>(null)

  const setupDMSession = useMutation(api.liveSessions.setupDMSession)
  const doAddNode = useMutation(api.campaignWeb.addNode)
  const doMoveNode = useMutation(api.campaignWeb.moveNode)
  const doRemoveNode = useMutation(api.campaignWeb.removeNode)
  const doAddEdge = useMutation(api.campaignWeb.addEdge)
  const doUpdateEdge = useMutation(api.campaignWeb.updateEdge)
  const doRemoveEdge = useMutation(api.campaignWeb.removeEdge)
  const doBroadcast = useMutation(api.liveSessions.broadcastReveal)

  const webNodes = useQuery(api.campaignWeb.listNodes, campaignId ? { campaignId } : "skip")
  const webEdges = useQuery(api.campaignWeb.listEdges, campaignId ? { campaignId } : "skip")
  const npcs = useQuery(api.npcs.list)
  const locations = useQuery(api.worldMap.listLocations, campaignId ? { campaignId } : "skip")
  // Saved plot threads (AI-generated diplomacy hooks + any created elsewhere), scoped
  // to this campaign — surfaced in the Plot Hook tab so the DM can read a hook and pull
  // it onto the web. listPlotThreads is by-user across campaigns; filter to this one.
  const plotThreads = useQuery(api.sessions.listPlotThreads)
  const campaignThreads = useMemo(
    () => (plotThreads ?? []).filter((t) => t.campaignId === campaignId),
    [plotThreads, campaignId],
  )

  // Role for the active campaign. Players reach DM tools only via a manual URL
  // (the nav hides them); don't invoke setupDMSession for a non-DM — the server
  // now refuses to create-and-flip their active campaign, and this avoids a
  // perpetual loading state.
  const context = useQuery(api.campaignMembers.getMyCampaignContext)
  const playerBlocked = context !== undefined && context !== null && context.role !== "dm"

  useEffect(() => {
    if (context === undefined) return // role still resolving
    if (context && context.role !== "dm") return // player — DM tools only
    setupDMSession()
      .then(({ campaignId: cid, sessionId: sid }) => {
        setCampaignId(cid)
        setSessionId(sid)
      })
      .catch(console.error)
  }, [context])

  // Map pin lookup, so a location node can resolve its live kind (icon/label/color).
  const locById = useMemo(() => {
    const m = new Map<string, NonNullable<typeof locations>[number]>()
    for (const l of locations ?? []) m.set(l._id, l)
    return m
  }, [locations])

  // Map Convex nodes → RF nodes
  const rfNodes: Node[] = useMemo(() => {
    if (!webNodes) return []
    return webNodes.map((n) => {
      // A location node tied to a map pin takes that pin's kind meta — derived
      // live, so even pre-existing generic nodes re-render as their true kind.
      const pin = n.entityType === "location" && n.entityId ? locById.get(n.entityId) : undefined
      const locMeta = pin ? metaFor(pin) : undefined
      return {
        id: n._id,
        type: "webNode",
        position: { x: n.x, y: n.y },
        data: {
          label: n.entityName ?? n.label,
          entityType: n.entityType,
          color: locMeta ? locMeta.color : n.color ?? TYPE_META[n.entityType].color,
          locMeta,
          onDelete: () => {}, // filled in below via nodeTypes prop
        },
      }
    })
  }, [webNodes, locById])

  // Map Convex edges → RF edges
  const rfEdges: Edge[] = useMemo(() => {
    if (!webEdges) return []
    return webEdges.map((e) => ({
      id: e._id,
      source: e.fromNodeId,
      target: e.toNodeId,
      label: e.label,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "var(--scene-accent)", strokeWidth: 1.5 },
      labelStyle: { fill: "var(--scene-text-muted)", fontSize: 10 },
      labelBgStyle: { fill: "var(--scene-surface)" },
    }))
  }, [webEdges])

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges)

  // Sync when Convex data loads/changes
  useEffect(() => { setNodes(rfNodes) }, [rfNodes, setNodes])
  useEffect(() => { setEdges(rfEdges) }, [rfEdges, setEdges])

  // IDs already on canvas
  const onCanvasEntityIds = useMemo(
    () => new Set((webNodes ?? []).map((n) => n.entityId).filter(Boolean)),
    [webNodes]
  )

  // ── Handlers ──────────────────────────────────────────────────────────────

  const onNodeDragStop: OnNodeDrag = useCallback((_: React.MouseEvent, node: Node) => {
    doMoveNode({ nodeId: node.id as Id<"campaignWebNodes">, x: node.position.x, y: node.position.y }).catch(console.error)
  }, [doMoveNode])

  const onConnect = useCallback((connection: Connection) => {
    setPendingConnection(connection)
    setPendingEdgeLabel("")
  }, [])

  const confirmEdge = async () => {
    if (!pendingConnection || !campaignId) return
    const label = pendingEdgeLabel.trim() || "connected to"
    await doAddEdge({
      campaignId,
      fromNodeId: pendingConnection.source as Id<"campaignWebNodes">,
      toNodeId: pendingConnection.target as Id<"campaignWebNodes">,
      label,
    })
    setPendingConnection(null)
    setPendingEdgeLabel("")
  }

  const onNodesDelete: OnNodesDelete = useCallback((deleted) => {
    deleted.forEach((n) => {
      doRemoveNode({ nodeId: n.id as Id<"campaignWebNodes"> }).catch(console.error)
    })
  }, [doRemoveNode])

  const onEdgesDelete: OnEdgesDelete = useCallback((deleted) => {
    deleted.forEach((e) => {
      doRemoveEdge({ edgeId: e.id as Id<"campaignWebEdges"> }).catch(console.error)
    })
  }, [doRemoveEdge])

  const handleDeleteNode = useCallback((id: string) => {
    doRemoveNode({ nodeId: id as Id<"campaignWebNodes"> }).catch(console.error)
  }, [doRemoveNode])

  const handleRevealNode = useCallback((id: string) => {
    if (!sessionId || !campaignId) return
    const node = webNodes?.find((n) => n._id === id)
    if (!node) return
    const pin = node.entityType === "location" && node.entityId ? locById.get(node.entityId) : undefined
    const kindLabel = pin ? metaFor(pin).label : TYPE_META[node.entityType].label
    doBroadcast({
      sessionId,
      campaignId,
      type: "web_node",
      title: node.entityName ?? node.label,
      body: kindLabel,
    }).catch(console.error)
  }, [sessionId, campaignId, webNodes, locById, doBroadcast])

  // Patch handlers into node data
  const nodesWithDelete = useMemo(() =>
    nodes.map((n) => ({
      ...n,
      className: "group",
      data: { ...n.data, onDelete: handleDeleteNode, onReveal: handleRevealNode, sessionActive: !!sessionId },
    })),
    [nodes, handleDeleteNode, handleRevealNode, sessionId]
  )

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setEditingEdgeId(edge.id)
    setEditingEdgeLabel(typeof edge.label === "string" ? edge.label : "")
  }, [])

  const confirmEditEdge = async () => {
    if (!editingEdgeId) return
    await doUpdateEdge({ edgeId: editingEdgeId as Id<"campaignWebEdges">, label: editingEdgeLabel.trim() || "connected to" })
    setEditingEdgeId(null)
  }

  const addEntityNode = async (entityType: EntityType, entityId: string, label: string) => {
    if (!campaignId) return
    const meta = TYPE_META[entityType]
    // Spread nodes out so they don't stack
    const offset = (webNodes?.length ?? 0) * 40
    await doAddNode({ campaignId, entityType, entityId, label, x: 100 + offset, y: 100 + offset, color: meta.color })
  }

  const addStandaloneNode = async () => {
    if (!campaignId || !newNodeLabel.trim()) return
    const meta = TYPE_META[activeTab]
    const offset = (webNodes?.length ?? 0) * 40
    await doAddNode({ campaignId, entityType: activeTab, label: newNodeLabel.trim(), x: 100 + offset, y: 100 + offset, color: meta.color })
    setNewNodeLabel("")
  }

  // ── Sidebar entity lists ────────────────────────────────────────────────────

  // npcs.list is by-user across ALL campaigns; scope to this campaign first (every
  // other Story Web source is per-campaign), then drop the ones already on the canvas.
  const campaignNpcs = useMemo(
    () => (npcs ?? []).filter((n) => n.campaignId === campaignId),
    [npcs, campaignId]
  )
  const filteredNPCs = useMemo(
    () => campaignNpcs.filter((n) => !onCanvasEntityIds.has(n._id)),
    [campaignNpcs, onCanvasEntityIds]
  )
  const filteredLocations = useMemo(
    () => (locations ?? []).filter((l) => !onCanvasEntityIds.has(l._id)),
    [locations, onCanvasEntityIds]
  )

  // Encounters ("Pirates", "Mules migration", roaming gangs) are narrative threads,
  // not places — they belong under Plot Hooks, not Location. Split them off so the
  // Location tab lists only true locations and the Plot Hook tab can offer the
  // encounter pins as ready-made hooks. (A "monster lair" is a place, so monster
  // pins stay under Location by design.)
  const locationPins = useMemo(
    () => filteredLocations.filter((l) => pinFilterKey(l) !== "encounter"),
    [filteredLocations]
  )
  const encounterPins = useMemo(
    () => filteredLocations.filter((l) => pinFilterKey(l) === "encounter"),
    [filteredLocations]
  )

  // Group the pickable location pins by kind (settlement/dungeon/tavern/river/…) so
  // the Location tab is an organized, scannable list instead of one flat dump.
  const groupedLocations = useMemo(() => {
    const groups = new Map<string, typeof locationPins>()
    for (const loc of locationPins) {
      const key = pinFilterKey(loc)
      const arr = groups.get(key)
      if (arr) arr.push(loc)
      else groups.set(key, [loc])
    }
    return [...groups.entries()].sort((a, b) => locationKindOrder(a[0]) - locationKindOrder(b[0]))
  }, [locationPins])

  const tabs: EntityType[] = ["npc", "location", "faction", "plot_hook"]

  if (playerBlocked) {
    return (
      <AppShell>
        <div className="p-8 max-w-2xl mx-auto text-center">
          <h1
            className="text-2xl font-bold mb-2"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            DM tools
          </h1>
          <p style={{ color: "var(--scene-text-muted)" }}>
            The Story Web is for the campaign&apos;s DM. You&apos;re a player in your active campaign.
          </p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex h-[calc(100dvh-3rem-3.5rem-env(safe-area-inset-bottom))] overflow-hidden md:h-[calc(100vh-4rem)]">

        {/* Sidebar */}
        <aside
          className="w-56 shrink-0 flex flex-col overflow-hidden"
          style={{ background: "var(--scene-surface)", borderRight: "1px solid var(--scene-border)" }}
        >
          <div className="p-3" style={{ borderBottom: "1px solid var(--scene-border)" }}>
            <h1
              className="text-base font-bold"
              style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
            >
              Story Web
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
              Add nodes · drag to place · connect
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 p-2" style={{ borderBottom: "1px solid var(--scene-border)" }}>
            {tabs.map((t) => {
              const meta = TYPE_META[t]
              return (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className="px-2 py-0.5 rounded text-xs font-medium transition-all"
                  style={{
                    background: activeTab === t ? meta.color + "33" : "transparent",
                    color: activeTab === t ? meta.color : "var(--scene-text-muted)",
                    border: `1px solid ${activeTab === t ? meta.color : "transparent"}`,
                  }}
                >
                  {meta.label}
                </button>
              )
            })}
          </div>

          {/* Entity list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {activeTab === "npc" && filteredNPCs.map((npc) => (
              <button
                key={npc._id}
                onClick={() => addEntityNode("npc", npc._id, npc.name)}
                className="w-full flex items-center justify-between gap-2 rounded px-2 py-1.5 text-left transition-opacity hover:opacity-80"
                style={{
                  background: TYPE_META.npc.color + "1a",
                  border: `1px solid ${TYPE_META.npc.color}44`,
                }}
              >
                <span className="text-xs truncate" style={{ color: "var(--scene-text-primary)" }}>{npc.name}</span>
                <Plus size={10} style={{ color: TYPE_META.npc.color, flexShrink: 0 }} />
              </button>
            ))}

            {activeTab === "location" && groupedLocations.map(([key, locs]) => {
              const groupMeta = metaFor(locs[0])
              const GroupIcon = groupMeta.icon
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center gap-1.5 px-1 pt-1.5">
                    <GroupIcon size={11} style={{ color: groupMeta.color }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: groupMeta.color }}>
                      {groupMeta.label}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>{locs.length}</span>
                  </div>
                  {locs.map((loc) => {
                    const m = metaFor(loc)
                    const Icon = m.icon
                    return (
                      <button
                        key={loc._id}
                        onClick={() => addEntityNode("location", loc._id, loc.name)}
                        className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left transition-opacity hover:opacity-80"
                        style={{ background: m.color + "1a", border: `1px solid ${m.color}44` }}
                      >
                        <Icon size={11} style={{ color: m.color, flexShrink: 0 }} />
                        <span className="flex-1 text-xs truncate" style={{ color: "var(--scene-text-primary)" }}>{loc.name}</span>
                        <Plus size={10} style={{ color: m.color, flexShrink: 0 }} />
                      </button>
                    )
                  })}
                </div>
              )
            })}

            {/* Saved plot threads (DM's AI-generated diplomacy hooks + any created
                elsewhere). Expand a row to read the hook; "+" pulls it onto the web as a
                plot_hook node (entityId = thread id → dedups off this list once placed). */}
            {activeTab === "plot_hook" && campaignThreads.length > 0 && (
              <div className="space-y-1 pb-2 mb-1" style={{ borderBottom: "1px solid var(--scene-border)" }}>
                <div className="flex items-center gap-1.5 px-1 pt-1">
                  <Milestone size={11} style={{ color: TYPE_META.plot_hook.color }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: TYPE_META.plot_hook.color }}>
                    Saved plot hooks
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>{campaignThreads.length}</span>
                </div>
                {campaignThreads.map((t) => {
                  const onCanvas = onCanvasEntityIds.has(t._id)
                  const open = openHookId === t._id
                  return (
                    <div
                      key={t._id}
                      className="rounded"
                      style={{ background: TYPE_META.plot_hook.color + "1a", border: `1px solid ${TYPE_META.plot_hook.color}44` }}
                    >
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => setOpenHookId(open ? null : t._id)}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                          aria-expanded={open}
                        >
                          <ChevronDown size={11} className="transition-transform" style={{ color: "var(--scene-text-muted)", flexShrink: 0, transform: open ? "rotate(180deg)" : undefined }} />
                          <span className="flex-1 text-xs truncate" style={{ color: "var(--scene-text-primary)" }}>{t.title}</span>
                        </button>
                        {onCanvas ? (
                          <span className="text-[9px] uppercase tracking-wide" style={{ color: "var(--scene-text-muted)", flexShrink: 0 }}>On web</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addEntityNode("plot_hook", t._id, t.title)}
                            title="Add to Web"
                            className="hover:opacity-80"
                            style={{ flexShrink: 0 }}
                          >
                            <Plus size={11} style={{ color: TYPE_META.plot_hook.color }} />
                          </button>
                        )}
                      </div>
                      {open && t.description && (
                        <div className="px-2 pb-2">
                          <MarkdownRenderer variant="scene" content={t.description} className="text-[11px]" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Encounter pins surface here (not under Location) as ready-made hooks.
                Clicking one adds it as a plot_hook node; entityId is retained so it
                drops off this list once on the canvas (dedup) and won't double-add. */}
            {activeTab === "plot_hook" && encounterPins.length > 0 && (
              <div className="space-y-1 pb-2 mb-1" style={{ borderBottom: "1px solid var(--scene-border)" }}>
                {(() => {
                  // All encounter pins share one kind meta (Swords / "Encounter").
                  const m = metaFor(encounterPins[0])
                  const Icon = m.icon
                  return (
                    <div className="flex items-center gap-1.5 px-1 pt-1">
                      <Icon size={11} style={{ color: m.color }} />
                      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: m.color }}>
                        From the map · Encounters
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--scene-text-muted)" }}>{encounterPins.length}</span>
                    </div>
                  )
                })()}
                {encounterPins.map((loc) => {
                  const m = metaFor(loc)
                  const Icon = m.icon
                  return (
                    <button
                      key={loc._id}
                      onClick={() => addEntityNode("plot_hook", loc._id, loc.name)}
                      className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left transition-opacity hover:opacity-80"
                      style={{ background: m.color + "1a", border: `1px solid ${m.color}44` }}
                    >
                      <Icon size={11} style={{ color: m.color, flexShrink: 0 }} />
                      <span className="flex-1 text-xs truncate" style={{ color: "var(--scene-text-primary)" }}>{loc.name}</span>
                      <Plus size={10} style={{ color: m.color, flexShrink: 0 }} />
                    </button>
                  )
                })}
              </div>
            )}

            {(activeTab === "faction" || activeTab === "plot_hook") && (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                  {activeTab === "faction" ? "Name the faction:" : encounterPins.length > 0 ? "Or write a custom hook:" : "Describe the hook:"}
                </p>
                <input
                  value={newNodeLabel}
                  onChange={(e) => setNewNodeLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addStandaloneNode() }}
                  placeholder={activeTab === "faction" ? "e.g. Thieves' Guild" : "e.g. Missing merchant"}
                  className="w-full rounded px-2 py-1.5 text-xs outline-none"
                  style={{
                    background: "var(--scene-bg)",
                    border: "1px solid var(--scene-border)",
                    color: "var(--scene-text-primary)",
                  }}
                />
                <button
                  onClick={addStandaloneNode}
                  disabled={!newNodeLabel.trim() || !campaignId}
                  className="w-full py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: TYPE_META[activeTab].color, color: "#fff" }}
                >
                  Add to Web
                </button>
              </div>
            )}

            {activeTab === "npc" && filteredNPCs.length === 0 && (
              <p className="text-xs p-2" style={{ color: "var(--scene-text-muted)" }}>
                {campaignNpcs.length === 0 ? "No NPCs yet — create them in DM Tools." : "All NPCs are on the canvas."}
              </p>
            )}

            {activeTab === "location" && locationPins.length === 0 && (
              <p className="text-xs p-2" style={{ color: "var(--scene-text-muted)" }}>
                {(locations ?? []).some((l) => pinFilterKey(l) !== "encounter")
                  ? "All locations are on the canvas."
                  : "No locations yet — create them in World Map."}
              </p>
            )}
          </div>

          <div className="p-3 text-xs space-y-0.5" style={{ color: "var(--scene-text-muted)", borderTop: "1px solid var(--scene-border)" }}>
            <p>Drag nodes to rearrange</p>
            <p>Connect handles to draw edges</p>
            <p>Click edge to rename · Delete key removes</p>
          </div>
        </aside>

        {/* Canvas */}
        <div className="flex-1 relative" style={{ background: "var(--scene-bg)" }}>
          <ReactFlow
            nodes={nodesWithDelete}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            deleteKeyCode={["Backspace", "Delete"]}
            proOptions={{ hideAttribution: true }}
            style={{ background: "transparent" }}
          >
            <Background
              color="var(--scene-border)"
              gap={24}
              size={1}
            />
            <Controls
              style={{
                background: "var(--scene-surface)",
                border: "1px solid var(--scene-border)",
              }}
            />

            {!campaignId && (
              <Panel position="top-center">
                <p className="text-xs px-3 py-1.5 rounded" style={{ background: "var(--scene-surface)", color: "var(--scene-text-muted)" }}>
                  Connecting…
                </p>
              </Panel>
            )}

            {(webNodes ?? []).length === 0 && campaignId && (
              <Panel position="top-center">
                <p className="text-xs px-4 py-2 rounded" style={{ background: "var(--scene-surface)", color: "var(--scene-text-muted)", border: "1px solid var(--scene-border)" }}>
                  Add nodes from the sidebar to begin your story web.
                </p>
              </Panel>
            )}
          </ReactFlow>

          {/* Edge connection modal */}
          {pendingConnection && (
            <div
              className="absolute inset-0 flex items-center justify-center z-50"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={() => setPendingConnection(null)}
            >
              <div
                className="rounded-xl p-5 w-80 space-y-4"
                style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                  Name this relationship
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {EDGE_LABELS.map((l) => (
                    <button
                      key={l}
                      onClick={() => setPendingEdgeLabel(l)}
                      className="px-2 py-0.5 rounded-full text-xs transition-all"
                      style={{
                        background: pendingEdgeLabel === l ? "var(--scene-accent)" : "var(--scene-bg)",
                        color: pendingEdgeLabel === l ? "var(--scene-bg)" : "var(--scene-text-muted)",
                        border: "1px solid var(--scene-border)",
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <input
                  value={pendingEdgeLabel}
                  onChange={(e) => setPendingEdgeLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmEdge() }}
                  placeholder="or type a custom label…"
                  autoFocus
                  className="w-full rounded px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--scene-bg)",
                    border: "1px solid var(--scene-border)",
                    color: "var(--scene-text-primary)",
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={confirmEdge}
                    className="flex-1 py-2 rounded text-sm font-medium transition-opacity hover:opacity-80"
                    style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                  >
                    Connect
                  </button>
                  <button
                    onClick={() => setPendingConnection(null)}
                    className="px-4 py-2 rounded text-sm transition-opacity hover:opacity-80"
                    style={{ background: "var(--scene-bg)", color: "var(--scene-text-muted)", border: "1px solid var(--scene-border)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edge label edit modal */}
          {editingEdgeId && (
            <div
              className="absolute inset-0 flex items-center justify-center z-50"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={() => setEditingEdgeId(null)}
            >
              <div
                className="rounded-xl p-5 w-72 space-y-4"
                style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                  Edit relationship
                </p>
                <input
                  value={editingEdgeLabel}
                  onChange={(e) => setEditingEdgeLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmEditEdge() }}
                  autoFocus
                  className="w-full rounded px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--scene-bg)",
                    border: "1px solid var(--scene-border)",
                    color: "var(--scene-text-primary)",
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={confirmEditEdge}
                    className="flex-1 py-2 rounded text-sm font-medium transition-opacity hover:opacity-80"
                    style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      doRemoveEdge({ edgeId: editingEdgeId as Id<"campaignWebEdges"> }).catch(console.error)
                      setEditingEdgeId(null)
                    }}
                    className="px-3 py-2 rounded text-sm transition-opacity hover:opacity-80"
                    style={{ background: "#e0555522", color: "#e05555", border: "1px solid #e0555544" }}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={() => setEditingEdgeId(null)}
                    className="px-3 py-2 rounded text-sm transition-opacity hover:opacity-80"
                    style={{ background: "var(--scene-bg)", color: "var(--scene-text-muted)", border: "1px solid var(--scene-border)" }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
