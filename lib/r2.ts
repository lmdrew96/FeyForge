import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export const R2_BUCKET = process.env.R2_BUCKET_NAME!
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!

export function getR2Url(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`
}

export async function getPresignedUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(r2, command, { expiresIn: 300 })
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
}

export interface R2Object {
  key: string
  lastModified?: Date
}

// List every object under `prefix`, following pagination (R2/S3 returns at most
// 1000 keys per page). Used by the orphaned-portrait GC sweep — scope the prefix
// tightly (e.g. "portraits/") so a sweep can never see other subsystems' objects.
export async function listR2Objects(prefix: string): Promise<R2Object[]> {
  const out: R2Object[] = []
  let continuationToken: string | undefined
  do {
    const res = await r2.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )
    for (const o of res.Contents ?? []) {
      if (o.Key) out.push({ key: o.Key, lastModified: o.LastModified })
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)
  return out
}
