import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { listR2Objects, deleteFromR2, R2_PUBLIC_URL } from "@/lib/r2"

// Garbage-collect orphaned character portraits in R2.
//
// Why it exists: portrait upload (v0.136.0) presigns a direct-to-R2 PUT the moment
// a file is chosen, BEFORE the character/edit is saved. The inline cleanup (drop a
// replaced session upload; delete the displaced original after a save) covers every
// path except one — upload once, then navigate away WITHOUT saving. That object has
// no DB reference and no displaced predecessor to trigger deletion, so it strands.
//
// This sweep reclaims those: list every object under portraits/, subtract the set
// of in-use character imageUrls, and delete the remainder — but ONLY objects older
// than a 24h grace window, so an upload that's mid-edit (not yet saved) is never
// racing-deleted. Scoped to the portraits/ prefix, so it can never touch maps/ or
// any other subsystem's objects in the shared bucket. deleteFromR2 is idempotent.
//
// Admin-gated. POST body: { dryRun?: boolean } — dryRun returns what WOULD be
// deleted without touching anything.

const PREFIX = "portraits/"
const GRACE_MS = 24 * 60 * 60 * 1000

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Admin check via the Convex identity (same pattern as the audio-delete route).
  const convexToken = await getToken({ template: "convex" })
  if (!convexToken) {
    return NextResponse.json({ error: "Could not get Convex token" }, { status: 500 })
  }
  const client = new ConvexHttpClient(
    (process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(/\/$/, ""),
  )
  client.setAuth(convexToken)
  const me = await client.query(api.users.getMe, {})
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { dryRun = false } = (await req.json().catch(() => ({}))) as { dryRun?: boolean }

  try {
    // 1. Every object under portraits/.
    const objects = await listR2Objects(PREFIX)

    // 2. In-use set: each character imageUrl under our R2 host → its object key.
    const inUseUrls = await client.query(api.characters.listAllImageUrls, {})
    const hostPrefix = `${R2_PUBLIC_URL}/`
    const referencedKeys = new Set<string>()
    for (const url of inUseUrls) {
      if (url.startsWith(hostPrefix)) referencedKeys.add(url.slice(hostPrefix.length))
    }

    // 3. Orphan = under portraits/, unreferenced, and past the grace window.
    const now = Date.now()
    const orphans: string[] = []
    let skippedRecent = 0
    for (const obj of objects) {
      if (referencedKeys.has(obj.key)) continue
      const age = obj.lastModified ? now - obj.lastModified.getTime() : 0
      // No timestamp, or too new → leave it (could be a just-uploaded, unsaved edit).
      if (!obj.lastModified || age <= GRACE_MS) {
        skippedRecent++
        continue
      }
      orphans.push(obj.key)
    }

    // 4. Delete (unless dry-run). Idempotent + best-effort per key.
    let deleted = 0
    if (!dryRun) {
      for (const key of orphans) {
        try {
          await deleteFromR2(key)
          deleted++
        } catch (err) {
          console.error("[FeyForge] portrait-gc delete failed:", key, err)
        }
      }
    }

    return NextResponse.json({
      dryRun,
      scanned: objects.length,
      referenced: referencedKeys.size,
      skippedRecent,
      orphans: orphans.length,
      deleted: dryRun ? 0 : deleted,
      orphanKeys: orphans,
    })
  } catch (err) {
    console.error("[FeyForge] portrait-gc sweep error:", err)
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 })
  }
}
