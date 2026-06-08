"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, Loader2 } from "lucide-react"
import { toast } from "sonner"

const MAX_BYTES = 5 * 1024 * 1024

// Best-effort delete of a previously-uploaded portrait from R2. The server only
// removes objects under the caller's own portraits/ prefix and no-ops on anything
// else (external URLs, other users' keys), so this is always safe to call.
// Fire-and-forget — orphan cleanup shouldn't block the UI or surface errors.
export const deletePortraitObject = (imageUrl: string): void => {
  if (!imageUrl) return
  void fetch("/api/character/portrait", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl }),
  }).catch(() => {})
}

interface PortraitUploadProps {
  value: string
  onChange: (url: string) => void
  // The portrait URL currently persisted in the DB, if any. A displaced URL that
  // differs from this is an unsaved session upload and is deleted from R2 right
  // away; the committed one is left for the caller to clean up after a successful
  // save (so cancelling an edit never orphans a still-referenced image).
  committedUrl?: string
  allowUrlPaste?: boolean
  disabled?: boolean
  inputId?: string
}

export function PortraitUpload({
  value,
  onChange,
  committedUrl = "",
  allowUrlPaste = true,
  disabled = false,
  inputId = "char-portrait",
}: PortraitUploadProps) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Drop the displaced object only if it was an unsaved session upload — never
  // the committed original (the caller deletes that after the save lands).
  const cleanupDisplaced = (displaced: string) => {
    if (displaced && displaced !== committedUrl) deletePortraitObject(displaced)
  }

  const handleFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error("Image is too large (max 5MB).")
      return
    }
    setUploading(true)
    try {
      const presign = await fetch("/api/character/portrait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      })
      if (!presign.ok) {
        const { error } = await presign.json().catch(() => ({ error: "Upload failed" }))
        throw new Error(error)
      }
      const { uploadUrl, publicUrl } = await presign.json()

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!put.ok) throw new Error("Upload to storage failed.")

      const displaced = value
      onChange(publicUrl)
      cleanupDisplaced(displaced)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleRemove = () => {
    const displaced = value
    onChange("")
    cleanupDisplaced(displaced)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Character portrait"
            className="h-16 w-16 rounded-lg object-cover shrink-0"
            style={{ border: "1px solid var(--scene-border)" }}
          />
        ) : (
          <div
            className="h-16 w-16 rounded-lg shrink-0 flex items-center justify-center"
            style={{ border: "1px dashed var(--scene-border)", color: "var(--scene-text-muted)" }}
          >
            <Upload className="h-5 w-5" />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {value ? "Replace" : "Upload image"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled || uploading}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      {allowUrlPaste && (
        <Input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="or paste an image URL"
          disabled={disabled}
        />
      )}
    </div>
  )
}
