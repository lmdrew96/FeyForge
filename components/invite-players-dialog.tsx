"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Copy, RefreshCw, UserMinus, Crown } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

// The invite panel body — code, link, regenerate, and the party roster. Shared
// between the Campaigns page and the live-session DM screens so there's one
// source of truth for how players get invited.
export function InviteDialogBody({ campaign }: { campaign: Doc<"campaigns"> }) {
  const members = useQuery(api.campaignMembers.listMembers, { campaignId: campaign._id })
  const regenerate = useMutation(api.campaignMembers.regenerateJoinCode)
  const removeMember = useMutation(api.campaignMembers.removeMember)
  const [regenerating, setRegenerating] = useState(false)

  const code = campaign.joinCode ?? null
  const link =
    code && typeof window !== "undefined" ? `${window.location.origin}/session/join/${code}` : ""

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied.`)
    } catch {
      toast.error("Couldn't copy to clipboard.")
    }
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      await regenerate({ campaignId: campaign._id })
      toast.success("New invite code generated. The old link no longer works.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't regenerate the code.")
    } finally {
      setRegenerating(false)
    }
  }

  const handleRemove = async (memberId: Id<"campaignMembers">) => {
    try {
      await removeMember({ memberId })
      toast.success("Player removed.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that player.")
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Invite players to {campaign.name}</DialogTitle>
        <DialogDescription>
          Share the code or link. Players sign in, pick a character, and join your party.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        {/* Code + link */}
        <div className="space-y-2">
          <Label>Invite code</Label>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 px-3 py-2 rounded-md text-base font-mono tracking-widest text-center"
              style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}
            >
              {code ?? "—"}
            </code>
            <Button variant="outline" size="icon" onClick={() => code && copy(code, "Code")} disabled={!code} title="Copy code">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleRegenerate} disabled={regenerating} title="Regenerate code">
              <RefreshCw className={regenerating ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
          </div>
          <button
            onClick={() => link && copy(link, "Invite link")}
            disabled={!link}
            className="text-xs underline underline-offset-2 transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ color: "var(--scene-accent)" }}
          >
            Copy invite link
          </button>
        </div>

        {/* Roster */}
        <div className="space-y-2">
          <Label>Party</Label>
          {members === undefined ? (
            <div className="h-12 rounded-md animate-pulse" style={{ background: "var(--scene-surface)" }} />
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m._id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md"
                  style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
                >
                  {m.role === "dm" ? (
                    <Crown className="h-4 w-4 flex-shrink-0" style={{ color: "var(--scene-accent)" }} />
                  ) : (
                    <span className="h-4 w-4 flex-shrink-0 rounded-full" style={{ background: "var(--scene-border)" }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: "var(--scene-text-primary)" }}>
                      {m.character?.name ?? (m.role === "dm" ? "Dungeon Master" : "Player")}
                      {m.isMe && <span className="text-xs ml-1.5" style={{ color: "var(--scene-text-muted)" }}>(you)</span>}
                    </p>
                    <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                      {m.role === "dm" ? "DM" : "Player"}
                    </p>
                  </div>
                  {m.role === "player" && (
                    <button
                      onClick={() => handleRemove(m._id)}
                      className="p-1.5 rounded transition-opacity hover:opacity-80"
                      style={{ color: "var(--scene-text-muted)" }}
                      title="Remove player"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// Self-contained invite dialog that resolves the campaign from just an id —
// for DM screens (live session, scene manager) that only carry a campaignId.
export function InvitePlayersDialog({
  campaignId,
  open,
  onOpenChange,
}: {
  campaignId: Id<"campaigns">
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const campaign = useQuery(api.campaigns.get, open ? { campaignId } : "skip")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {campaign ? (
          <InviteDialogBody campaign={campaign} />
        ) : (
          <div className="h-40 rounded-md animate-pulse" style={{ background: "var(--scene-surface)" }} />
        )}
      </DialogContent>
    </Dialog>
  )
}
