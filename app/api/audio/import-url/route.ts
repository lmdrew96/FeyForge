import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { r2, R2_BUCKET, getR2Url } from "@/lib/r2"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { randomUUID } from "crypto"

const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY
const FREESOUND_API_KEY = process.env.FREESOUND_API_KEY

async function resolvePixabay(url: string): Promise<{ downloadUrl: string; name: string; duration: number }> {
  const match = url.match(/pixabay\.com\/sound-effects\/([^/]+)-(\d+)/)
  if (!match) throw new Error("Could not parse Pixabay URL")
  const id = match[2]
  const apiUrl = `https://pixabay.com/api/sounds/?key=${PIXABAY_API_KEY}&id=${id}`
  const res = await fetch(apiUrl)
  const data = await res.json()
  const hit = data.hits?.[0]
  if (!hit) throw new Error("Pixabay track not found")
  return { downloadUrl: hit.audio, name: hit.tags?.split(",")[0] ?? hit.id.toString(), duration: hit.duration }
}

async function resolveFreesound(url: string): Promise<{ downloadUrl: string; name: string; duration: number }> {
  const match = url.match(/freesound\.org\/people\/[^/]+\/sounds\/(\d+)/)
  if (!match) throw new Error("Could not parse Freesound URL")
  const id = match[1]
  const apiUrl = `https://freesound.org/apiv2/sounds/${id}/?token=${FREESOUND_API_KEY}`
  const res = await fetch(apiUrl)
  const data = await res.json()
  if (!data.id) throw new Error("Freesound track not found")
  const dlRes = await fetch(`https://freesound.org/apiv2/sounds/${id}/download/`, {
    headers: { Authorization: `Token ${FREESOUND_API_KEY}` },
    redirect: "manual",
  })
  const downloadUrl = dlRes.headers.get("location") ?? data.previews?.["preview-hq-mp3"]
  if (!downloadUrl) throw new Error("Could not get Freesound download URL")
  return { downloadUrl, name: data.name, duration: Math.round(data.duration) }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { sourceUrl, trackType } = await req.json()
  if (!sourceUrl || !trackType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  let resolved: { downloadUrl: string; name: string; duration: number }
  try {
    if (sourceUrl.includes("pixabay.com")) {
      resolved = await resolvePixabay(sourceUrl)
    } else if (sourceUrl.includes("freesound.org")) {
      resolved = await resolveFreesound(sourceUrl)
    } else {
      return NextResponse.json({ error: "Only Pixabay and Freesound URLs are supported" }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 })
  }

  const audioRes = await fetch(resolved.downloadUrl)
  if (!audioRes.ok) return NextResponse.json({ error: "Failed to download audio" }, { status: 502 })

  const contentType = audioRes.headers.get("content-type") ?? "audio/mpeg"
  const ext = contentType.includes("ogg") ? "ogg" : contentType.includes("wav") ? "wav" : "mp3"
  const key = `feyforge/audio/${trackType}/${randomUUID()}.${ext}`

  const buffer = await audioRes.arrayBuffer()
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: contentType,
    })
  )

  return NextResponse.json({
    r2Key: key,
    r2Url: getR2Url(key),
    name: resolved.name,
    duration: resolved.duration,
    sourceUrl,
  })
}
