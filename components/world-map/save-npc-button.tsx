"use client"

// ── Save NPC to roster (DM-only) ──────────────────────────────────────────────
// A per-pin DM action on "npc" world-map pins, wired through LocationDetail's
// extraActions slot (same pattern as EncounterGenerator on combat pins). Lifts the
// pin's dealt first-party NPC into the campaign's NPC roster so the DM can flesh it
// out, link it in the Story Web, etc. Self-contained: the mutation reads the pin's
// bio server-side and is idempotent (re-saving returns the existing entry).

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from "sonner"
import { Loader2, UserPlus, Check } from "lucide-react"
import { SecondaryButton, type LocationId } from "./shared"

export function SaveNpcButton({ locationId }: { locationId: LocationId }) {
  const save = useMutation(api.npcs.saveFromMapPin)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const onClick = async () => {
    setSaving(true)
    try {
      const res = await save({ locationId })
      setSaved(true)
      toast.success(res.alreadyExisted ? "Already in your NPC roster." : "Saved to your NPC roster.")
    } catch {
      toast.error("Couldn't save the NPC.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <SecondaryButton onClick={onClick} disabled={saving || saved}>
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
      {saved ? "In roster" : "Save to roster"}
    </SecondaryButton>
  )
}
