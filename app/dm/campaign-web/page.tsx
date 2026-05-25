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
import { Users, MapPin, ScrollText, Shield, Milestone, Plus, Trash2, X, Check, Radio } from "lucide-react"

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
  onDelete: (id: string) => void
  onReveal: (id: string) => void
  sessionActive: boolean
}

function WebNode({ id, data, selected }: { id: string; data: WebNodeData; selected: boolean }) {
  const meta = TYPE_META[data.entityType]
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
  const locations = useQuery(api.world.list)

  useEffect(() => {
    setupDMSession()
      .then(({ campaignId: cid, sessionId: sid }) => {
        setCampaignId(cid)
        setSessionId(sid)
      })
      .catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Map Convex nodes → RF nodes
  const rfNodes: Node[] = useMemo(() => {
    if (!webNodes) return []
    return webNodes.map((n) => ({
      id: n._id,
      type: "webNode",
      position: { x: n.x, y: n.y },
      data: {
        label: n.entityName ?? n.label,
        entityType: n.entityType,
        color: n.color ?? TYPE_META[n.entityType].color,
        onDelete: () => {}, // filled in below via nodeTypes prop
      },
    }))
  }, [webNodes])

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
    doBroadcast({
      sessionId,
      campaignId,
      type: "web_node",
      title: node.entityName ?? node.label,
      body: TYPE_META[node.entityType].label,
    }).catch(console.error)
  }, [sessionId, campaignId, webNodes, doBroadcast])

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

  const filteredNPCs = useMemo(
    () => (npcs ?? []).filter((n) => !onCanvasEntityIds.has(n._id)),
    [npcs, onCanvasEntityIds]
  )
  const filteredLocations = useMemo(
    () => (locations ?? []).filter((l) => !onCanvasEntityIds.has(l._id)),
    [locations, onCanvasEntityIds]
  )

  const tabs: EntityType[] = ["npc", "location", "faction", "plot_hook"]

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

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

            {activeTab === "location" && filteredLocations.map((loc) => (
              <button
                key={loc._id}
                onClick={() => addEntityNode("location", loc._id, loc.name)}
                className="w-full flex items-center justify-between gap-2 rounded px-2 py-1.5 text-left transition-opacity hover:opacity-80"
                style={{
                  background: TYPE_META.location.color + "1a",
                  border: `1px solid ${TYPE_META.location.color}44`,
                }}
              >
                <span className="text-xs truncate" style={{ color: "var(--scene-text-primary)" }}>{loc.name}</span>
                <Plus size={10} style={{ color: TYPE_META.location.color }} />
              </button>
            ))}

            {(activeTab === "faction" || activeTab === "plot_hook") && (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                  {activeTab === "faction" ? "Name the faction:" : "Describe the hook:"}
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
                {(npcs?.length ?? 0) === 0 ? "No NPCs yet — create them in DM Tools." : "All NPCs are on the canvas."}
              </p>
            )}

            {activeTab === "location" && filteredLocations.length === 0 && (
              <p className="text-xs p-2" style={{ color: "var(--scene-text-muted)" }}>
                {(locations?.length ?? 0) === 0 ? "No locations yet — create them in World Map." : "All locations are on the canvas."}
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
