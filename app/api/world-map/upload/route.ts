import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { getPresignedUploadUrl, getR2Url } from "@/lib/r2"

// Issues a presigned R2 PUT for a world-map image, then the client uploads
// directly to R2 and saves the returned key on a worldMaps row.
// Gated to admins (preset authoring) and premium users (custom maps) — mirrors
// the admin-check pattern in app/api/audio/delete/route.ts.

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? "")

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"])
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
}

export async function POST(req: Request) {
  try {
    const { userId, getToken } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = await getToken({ template: "convex" })
    if (token) convex.setAuth(token)
    const me = await convex.query(api.users.getMe, {})
    const allowed = me?.role === "admin" || me?.isPremium === true
    if (!allowed) {
      return NextResponse.json(
        { error: "World map uploads require a premium account." },
        { status: 403 },
      )
    }

    const { contentType } = (await req.json()) as { contentType?: string }
    if (!contentType || !ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Unsupported image type. Use PNG, JPG, WebP, or SVG." },
        { status: 400 },
      )
    }

    // Namespaced key: maps/<userId>/<random>.<ext>. Random suffix avoids
    // collisions and makes keys unguessable.
    const ext = EXT[contentType]
    const key = `maps/${userId}/${crypto.randomUUID()}.${ext}`
    const uploadUrl = await getPresignedUploadUrl(key, contentType)

    return NextResponse.json({ uploadUrl, key, publicUrl: getR2Url(key) })
  } catch (err) {
    console.error("[FeyForge] World map upload presign error:", err)
    return NextResponse.json({ error: "Could not start upload" }, { status: 500 })
  }
}
