import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getPresignedUploadUrl, getR2Url } from "@/lib/r2"
import { randomUUID } from "crypto"

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { fileName, contentType, trackType } = await req.json()
  if (!fileName || !contentType || !trackType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "mp3"
  const key = `feyforge/audio/${trackType}/${randomUUID()}.${ext}`

  const uploadUrl = await getPresignedUploadUrl(key, contentType)
  const r2Url = getR2Url(key)

  return NextResponse.json({ uploadUrl, r2Key: key, r2Url })
}
