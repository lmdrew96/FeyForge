import { Shield } from "lucide-react"
import { cn } from "@/lib/utils"

interface CharacterAvatarProps {
  imageUrl?: string | null
  name?: string
  // Box sizing + rounding, e.g. "w-14 h-14 rounded-xl". Applied to both the image
  // and the placeholder so they occupy the exact same footprint at every call site.
  className?: string
  // Shield size for the placeholder fallback, e.g. "h-7 w-7".
  iconClassName?: string
}

// A character's portrait, falling back to the accent Shield placeholder when no
// image is set. Shared so every surface that identifies a character (sheet header,
// roster, session party + picker) renders the portrait the same way.
export function CharacterAvatar({
  imageUrl,
  name,
  className,
  iconClassName = "h-5 w-5",
}: CharacterAvatarProps) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name ? `${name}'s portrait` : "Character portrait"}
        className={cn("object-cover flex-shrink-0", className)}
        style={{ border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, transparent)" }}
      />
    )
  }
  return (
    <div
      className={cn("flex items-center justify-center flex-shrink-0", className)}
      style={{
        background: "color-mix(in srgb, var(--scene-accent) 15%, var(--scene-surface))",
        border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, transparent)",
      }}
    >
      <Shield className={iconClassName} style={{ color: "var(--scene-accent)" }} />
    </div>
  )
}
