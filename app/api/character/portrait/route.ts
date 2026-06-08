import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getPresignedUploadUrl, getR2Url, deleteFromR2, R2_PUBLIC_URL } from "@/lib/r2"

// Issues a presigned R2 PUT for a character portrait, then the client uploads
// directly to R2 (dodging Vercel's 4.5MB body cap) and saves the returned public
// URL on the character's imageUrl. Mirrors app/api/world-map/upload/route.ts, but
// gated to any signed-in user — portraits are a free player tool, not premium.

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { contentType } = (await req.json()) as { contentType?: string }
    if (!contentType || !ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Unsupported image type. Use PNG, JPG, or WebP." },
        { status: 400 },
      )
    }

    // Namespaced key: portraits/<userId>/<random>.<ext>. Random suffix avoids
    // collisions and makes keys unguessable.
    const ext = EXT[contentType]
    const key = `portraits/${userId}/${crypto.randomUUID()}.${ext}`
    const uploadUrl = await getPresignedUploadUrl(key, contentType)

    return NextResponse.json({ uploadUrl, key, publicUrl: getR2Url(key) })
  } catch (err) {
    console.error("[FeyForge] Character portrait upload presign error:", err)
    return NextResponse.json({ error: "Could not start upload" }, { status: 500 })
  }
}

// Best-effort cleanup of a replaced/removed portrait. We only ever delete objects
// the caller owns — under our R2 host and their own portraits/<userId>/ prefix —
// so a crafted key or an external pasted URL is a silent no-op, never a way to
// delete someone else's object.
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { imageUrl } = (await req.json()) as { imageUrl?: string }
    const ownPrefix = `${R2_PUBLIC_URL}/portraits/${userId}/`
    if (!imageUrl || !imageUrl.startsWith(ownPrefix)) {
      return NextResponse.json({ deleted: false })
    }

    const key = imageUrl.slice(R2_PUBLIC_URL.length + 1) // strip "<host>/"
    await deleteFromR2(key)
    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error("[FeyForge] Character portrait delete error:", err)
    return NextResponse.json({ error: "Could not delete" }, { status: 500 })
  }
}
