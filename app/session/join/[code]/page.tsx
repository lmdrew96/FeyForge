"use client"

import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { CLASS_COLORS } from "@/lib/character/constants"
import { useOnboardingStore } from "@/lib/onboarding-store"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Shield, Users, ScrollText, AlertCircle } from "lucide-react"

type CharacterId = Id<"characters">

export default function JoinByCodePage() {
  const params = useParams<{ code: string }>()
  const code = (params.code ?? "").toUpperCase()
  const router = useRouter()

  const info = useQuery(api.campaignMembers.resolveJoinCode, { code })
  const characters = useQuery(api.characters.list)
  const doJoin = useMutation(api.campaignMembers.joinByCode)
  const [joining, setJoining] = useState<CharacterId | null>(null)
  const setPendingJoinCode = useOnboardingStore((s) => s.setPendingJoinCode)
  const clearPendingJoinCode = useOnboardingStore((s) => s.clearPendingJoinCode)

  const handleJoin = async (characterId: CharacterId) => {
    setJoining(characterId)
    try {
      await doJoin({ code, characterId })
      // Joined — the pending-code hand-off (if any) has done its job.
      clearPendingJoinCode()
      toast.success("You've joined the party!")
      router.push("/session")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join the campaign.")
      setJoining(null)
    }
  }

  // Send a character-less newcomer to creation, stashing this invite so the
  // creation flow returns them here automatically — no "come back to this link".
  const handleCreateCharacter = () => {
    setPendingJoinCode(code)
    router.push("/characters/new")
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        {/* Loading */}
        {info === undefined && (
          <div className="space-y-4">
            <div className="h-28 rounded-xl animate-pulse" style={{ background: "var(--scene-surface)" }} />
            <div className="h-20 rounded-xl animate-pulse" style={{ background: "var(--scene-surface)" }} />
          </div>
        )}

        {/* Invalid / expired code */}
        {info === null && (
          <div
            className="rounded-xl p-10 text-center"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            <AlertCircle className="h-10 w-10 mx-auto mb-4" style={{ color: "var(--scene-text-muted)", opacity: 0.5 }} />
            <h1 className="text-lg font-bold mb-2" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
              Invite not found
            </h1>
            <p className="text-sm mb-6" style={{ color: "var(--scene-text-muted)" }}>
              The code <span className="font-mono">{code}</span> is invalid or has been regenerated. Ask your DM for a fresh invite link.
            </p>
            <Link
              href="/session"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
            >
              Back to session
            </Link>
          </div>
        )}

        {info && (
          <>
            {/* Campaign banner */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4" style={{ color: "var(--scene-accent)" }} />
                <span className="text-xs uppercase tracking-widest" style={{ color: "var(--scene-accent)" }}>
                  Campaign invite
                </span>
              </div>
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                {info.campaignName}
              </h1>
              {info.description && (
                <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
                  {info.description}
                </p>
              )}
              {info.sessionLive && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--scene-accent)" }} />
                  <span className="text-xs" style={{ color: "var(--scene-accent)" }}>A session is live right now</span>
                </div>
              )}
            </div>

            {/* DM following their own link */}
            {info.alreadyMember && info.myRole === "dm" ? (
              <div
                className="rounded-xl p-8 text-center"
                style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
              >
                <ScrollText className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--scene-text-muted)", opacity: 0.5 }} />
                <p className="text-sm mb-6" style={{ color: "var(--scene-text-muted)" }}>
                  This is your campaign — you&apos;re the DM. Share this link with your players instead.
                </p>
                <Link
                  href="/session"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                >
                  Go to your session
                </Link>
              </div>
            ) : (
              <>
                <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--scene-text-primary)" }}>
                  {info.alreadyMember ? "Choose your character" : "Pick a character to join with"}
                </h2>

                {characters === undefined && (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--scene-surface)" }} />
                    ))}
                  </div>
                )}

                {characters && characters.length === 0 && (
                  <div
                    className="rounded-xl p-8 text-center"
                    style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
                  >
                    <p className="text-sm mb-6" style={{ color: "var(--scene-text-muted)" }}>
                      You don&apos;t have any characters yet. Create one and we&apos;ll bring you right back here to join.
                    </p>
                    <button
                      onClick={handleCreateCharacter}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
                      style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                    >
                      Create a character
                    </button>
                  </div>
                )}

                {characters && characters.length > 0 && (
                  <div className="space-y-3">
                    {characters.map((char) => {
                      const classColor = CLASS_COLORS[char.characterClass.toLowerCase()] ?? "bg-gray-600 text-white"
                      return (
                        <button
                          key={char._id}
                          onClick={() => handleJoin(char._id)}
                          disabled={joining !== null}
                          className="w-full rounded-xl p-4 flex items-center gap-4 text-left transition-all hover:scale-[1.01] disabled:opacity-60"
                          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
                        >
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background: "color-mix(in srgb, var(--scene-accent) 15%, var(--scene-surface))",
                              border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, transparent)",
                            }}
                          >
                            <Shield className="h-5 w-5" style={{ color: "var(--scene-accent)" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate" style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}>
                              {char.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", classColor)}>
                                {char.characterClass}
                              </span>
                              <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                                Lv {char.level} · {char.hitPoints.current}/{char.hitPoints.max} HP
                              </span>
                            </div>
                          </div>
                          <span
                            className="text-sm font-medium flex-shrink-0 px-4 py-1.5 rounded-md"
                            style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
                          >
                            {joining === char._id ? "Joining…" : "Join"}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
