import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { deleteFromR2 } from "@/lib/r2"

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Only admins may delete files from storage.
  const convexToken = await getToken({ template: "convex" })
  if (!convexToken) {
    return NextResponse.json({ error: "Could not get Convex token" }, { status: 500 })
  }
  const client = new ConvexHttpClient(
    (process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(/\/$/, "")
  )
  client.setAuth(convexToken)
  const me = await client.query(api.users.getMe, {})
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { r2Key } = await req.json()
  if (!r2Key) return NextResponse.json({ error: "Missing r2Key" }, { status: 400 })

  await deleteFromR2(r2Key)
  return NextResponse.json({ ok: true })
}
