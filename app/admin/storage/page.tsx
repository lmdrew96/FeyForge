"use client"

import { useState } from "react"
import { AppShell } from "@/components/app-shell"
import { AdminTabs } from "@/components/admin/admin-tabs"
import { HardDrive, Loader2, Trash2, Search } from "lucide-react"
import { toast } from "sonner"

interface SweepResult {
  dryRun: boolean
  scanned: number
  referenced: number
  skippedRecent: number
  orphans: number
  deleted: number
  orphanKeys: string[]
}

export default function AdminStoragePage() {
  const [running, setRunning] = useState<"dry" | "delete" | null>(null)
  const [result, setResult] = useState<SweepResult | null>(null)

  const runSweep = async (dryRun: boolean) => {
    if (!dryRun && !confirm("Permanently delete every orphaned portrait older than 24h?")) return
    setRunning(dryRun ? "dry" : "delete")
    try {
      const res = await fetch("/api/admin/portrait-gc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      })
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(error ?? "Sweep failed")
      }
      const data = (await res.json()) as SweepResult
      setResult(data)
      toast.success(
        dryRun
          ? `Found ${data.orphans} orphaned portrait${data.orphans === 1 ? "" : "s"}.`
          : `Reclaimed ${data.deleted} orphaned portrait${data.deleted === 1 ? "" : "s"}.`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sweep failed")
    } finally {
      setRunning(null)
    }
  }

  return (
    <AppShell>
      <div className="px-6 py-8 max-w-2xl mx-auto space-y-6">
        <AdminTabs />
        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] mb-1" style={{ color: "#7b68c8" }}>Admin</p>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-cinzel)", color: "#e8e0f8" }}>
            Storage
          </h1>
          <p className="text-sm" style={{ color: "#5a5272" }}>
            Reclaim orphaned character portraits in R2 — objects under{" "}
            <code style={{ color: "#7b68c8" }}>portraits/</code> that no character references and
            are older than 24h (the grace window for in-progress, unsaved uploads).
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => runSweep(true)}
            disabled={running !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "#16131f", border: "1px solid #2a2438", color: "#e8e0f8" }}
          >
            {running === "dry" ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Dry-run preview
          </button>
          <button
            onClick={() => runSweep(false)}
            disabled={running !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "#3a1f1f", border: "1px solid #5a2e2e", color: "#f0c8c8" }}
          >
            {running === "delete" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Delete orphans
          </button>
        </div>

        {/* Result */}
        {result && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: "#16131f", border: "1px solid #2a2438" }}
          >
            <div className="flex items-center gap-2">
              <HardDrive size={16} style={{ color: "#7b68c8" }} />
              <span className="text-sm font-medium" style={{ color: "#e8e0f8" }}>
                {result.dryRun ? "Dry-run results" : "Sweep complete"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm" style={{ color: "#a99fc4" }}>
              <Stat label="Scanned" value={result.scanned} />
              <Stat label="In use" value={result.referenced} />
              <Stat label="Skipped (recent)" value={result.skippedRecent} />
              <Stat label={result.dryRun ? "Would delete" : "Deleted"} value={result.dryRun ? result.orphans : result.deleted} />
            </div>
            {result.orphanKeys.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-widest" style={{ color: "#5a5272" }}>
                  Orphaned keys
                </p>
                <div
                  className="max-h-48 overflow-y-auto rounded-lg p-2 text-xs font-mono"
                  style={{ background: "#0d0d14", color: "#a99fc4" }}
                >
                  {result.orphanKeys.map((k) => (
                    <div key={k} className="truncate">{k}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "#0d0d14" }}>
      <span style={{ color: "#5a5272" }}>{label}</span>
      <span className="font-semibold" style={{ color: "#e8e0f8" }}>{value}</span>
    </div>
  )
}
