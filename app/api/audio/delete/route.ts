import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { deleteFromR2 } from "@/lib/r2"

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { r2Key } = await req.json()
  if (!r2Key) return NextResponse.json({ error: "Missing r2Key" }, { status: 400 })

  await deleteFromR2(r2Key)
  return NextResponse.json({ ok: true })
}
