"use client"

import { useState, useEffect, type FormEvent, type ChangeEvent } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { AppShell } from "@/components/app-shell"
import { toast } from "sonner"
import {
  UserPlus,
  UserCircle,
  Check,
  X,
  Copy,
  Trash2,
  Ban,
  Clock,
  Users,
} from "lucide-react"

// The Friends hub: a privacy-preserving social surface. Discovery is limited to
// a personal friend code + "people you've played with" (shared campaigns) — no
// open username search. Mirrors the hub page's shell/styling conventions.

type FriendCard = {
  friendshipId: string
  userId: string
  displayName: string
  avatarUrl: string | null
}
type Suggestion = FriendCard & { viaCampaign: string }

function Avatar({ url, name, size = 9 }: { url: string | null; name: string; size?: number }) {
  const dim = `${size * 0.25}rem`
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="rounded-full shrink-0 object-cover"
        style={{ width: dim, height: dim }}
      />
    )
  }
  return (
    <span
      className="rounded-full shrink-0 flex items-center justify-center font-semibold"
      style={{
        width: dim,
        height: dim,
        background: "color-mix(in srgb, var(--scene-accent) 16%, transparent)",
        color: "var(--scene-accent)",
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

function SectionCard({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string
  icon: typeof Users
  count?: number
  children: React.ReactNode
}) {
  return (
    <section
      className="rounded-lg p-4 sm:p-5"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" style={{ color: "var(--scene-accent)" }} />
        <h2 className="text-sm font-semibold" style={{ color: "var(--scene-text-primary)" }}>
          {title}
        </h2>
        {count !== undefined && count > 0 && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{
              background: "color-mix(in srgb, var(--scene-accent) 18%, transparent)",
              color: "var(--scene-accent)",
            }}
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

// Inline editor for the user's own display name — the name other players see.
// Re-seeds its draft when the stored name changes (e.g. the first Clerk seed
// lands after `me` loads), and only enables Save when the draft actually differs.
function DisplayNameEditor({ current }: { current: string }) {
  const setDisplayName = useMutation(api.users.setDisplayName)
  const [draft, setDraft] = useState(current)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(current)
  }, [current])

  const trimmed = draft.trim()
  const dirty = trimmed.length > 0 && trimmed !== current

  const save = async () => {
    if (!dirty) return
    setSaving(true)
    try {
      await setDisplayName({ displayName: trimmed })
      toast.success("Display name updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update your name")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <label className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
        Display name
      </label>
      <div className="flex items-center gap-2 mt-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={40}
          placeholder="Your name"
          className="flex-1 px-3 py-2 rounded-md text-sm"
          style={{
            background: "var(--scene-bg)",
            border: "1px solid var(--scene-border)",
            color: "var(--scene-text-primary)",
          }}
        />
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="px-3 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          style={{
            background: "color-mix(in srgb, var(--scene-accent) 16%, transparent)",
            color: "var(--scene-accent)",
            border: "1px solid color-mix(in srgb, var(--scene-accent) 38%, transparent)",
          }}
        >
          Save
        </button>
      </div>
      <p className="text-[11px] mt-1" style={{ color: "var(--scene-text-muted)" }}>
        This is what other players see.
      </p>
    </div>
  )
}

// Per-friend actions: invite to a DM campaign (native select), remove, block.
function FriendActions({
  friend,
  dmCampaigns,
}: {
  friend: FriendCard
  dmCampaigns: { campaignId: Id<"campaigns">; name: string }[]
}) {
  const invite = useMutation(api.friends.inviteFriendToCampaign)
  const removeFriend = useMutation(api.friends.removeFriend)
  const blockUser = useMutation(api.friends.blockUser)

  const handleInvite = async (e: ChangeEvent<HTMLSelectElement>) => {
    const campaignId = e.target.value
    e.target.value = "" // reset so the same campaign can be picked again
    if (!campaignId) return
    try {
      await invite({ campaignId: campaignId as Id<"campaigns">, friendUserId: friend.userId })
      const name = dmCampaigns.find((c) => c.campaignId === campaignId)?.name ?? "the campaign"
      toast.success(`Invited ${friend.displayName} to ${name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the invite")
    }
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {dmCampaigns.length > 0 && (
        <select
          defaultValue=""
          onChange={handleInvite}
          aria-label={`Invite ${friend.displayName} to a campaign`}
          className="text-xs rounded-md px-2 py-1 max-w-[8rem]"
          style={{
            background: "var(--scene-bg)",
            border: "1px solid var(--scene-border)",
            color: "var(--scene-text-muted)",
          }}
        >
          <option value="" disabled>
            Invite to…
          </option>
          {dmCampaigns.map((c) => (
            <option key={c.campaignId} value={c.campaignId}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={async () => {
          await removeFriend({ friendshipId: friend.friendshipId as Id<"friendships"> })
          toast.success(`Removed ${friend.displayName}`)
        }}
        title="Remove friend"
        className="p-1.5 rounded-md hover:bg-[var(--scene-bg)]"
        style={{ color: "var(--scene-text-muted)" }}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={async () => {
          if (!confirm(`Block ${friend.displayName}? They won't be able to add you.`)) return
          await blockUser({ userId: friend.userId })
          toast.success(`Blocked ${friend.displayName}`)
        }}
        title="Block"
        className="p-1.5 rounded-md hover:bg-[var(--scene-bg)]"
        style={{ color: "var(--scene-text-muted)" }}
      >
        <Ban className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function FriendsPage() {
  const me = useQuery(api.users.getMe)
  const friends = useQuery(api.friends.listFriends) as FriendCard[] | undefined
  const pending = useQuery(api.friends.listPendingRequests)
  const suggestions = useQuery(api.friends.listSuggestions) as Suggestion[] | undefined
  const myCampaigns = useQuery(api.campaignMembers.listMyCampaigns)

  const sendByCode = useMutation(api.friends.sendRequestByCode)
  const sendToUser = useMutation(api.friends.sendRequestToUser)
  const respond = useMutation(api.friends.respondToRequest)

  const [codeInput, setCodeInput] = useState("")
  const [sending, setSending] = useState(false)

  const myCode = me?.friendCode ?? null
  const dmCampaigns = (myCampaigns ?? [])
    .filter((c) => c.role === "dm")
    .map((c) => ({ campaignId: c.campaignId, name: c.name }))

  const handleSendByCode = async (e: FormEvent) => {
    e.preventDefault()
    const code = codeInput.trim()
    if (!code) return
    setSending(true)
    try {
      const res = await sendByCode({ code })
      toast.success(res.status === "accepted" ? "You're now friends!" : "Friend request sent")
      setCodeInput("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the request")
    } finally {
      setSending(false)
    }
  }

  const copyCode = async () => {
    if (!myCode) return
    try {
      await navigator.clipboard.writeText(myCode)
      toast.success("Friend code copied")
    } catch {
      toast.error("Couldn't copy — long-press to copy manually")
    }
  }

  const incoming = pending?.incoming ?? []
  const outgoing = pending?.outgoing ?? []

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 space-y-4">
        <div>
          <h1
            className="text-xl font-bold tracking-wide"
            style={{ fontFamily: "var(--font-display)", color: "var(--scene-text-primary)" }}
          >
            Friends
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
            Add people you adventure with, then invite them straight into your campaigns.
          </p>
        </div>

        {/* Your profile */}
        <SectionCard title="Your profile" icon={UserCircle}>
          <div className="space-y-3">
            <DisplayNameEditor current={me?.displayName ?? ""} />
            <div>
              <label className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                Your friend code
              </label>
              <div className="flex items-center gap-2 mt-1">
                <code
                  className="flex-1 px-3 py-2 rounded-md text-sm font-mono tracking-wider"
                  style={{
                    background: "var(--scene-bg)",
                    border: "1px solid var(--scene-border)",
                    color: "var(--scene-text-primary)",
                  }}
                >
                  {myCode ?? "Generating…"}
                </code>
                <button
                  onClick={copyCode}
                  disabled={!myCode}
                  className="p-2 rounded-md hover:bg-[var(--scene-bg)] disabled:opacity-50"
                  style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-muted)" }}
                  title="Copy"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] mt-1" style={{ color: "var(--scene-text-muted)" }}>
                Share this so a friend can add you.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Add a friend */}
        <SectionCard title="Add a friend" icon={UserPlus}>
          <form onSubmit={handleSendByCode}>
            <label className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
              Add by their friend code
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="FEY-XXXXXX"
                className="flex-1 px-3 py-2 rounded-md text-sm font-mono tracking-wider uppercase"
                style={{
                  background: "var(--scene-bg)",
                  border: "1px solid var(--scene-border)",
                  color: "var(--scene-text-primary)",
                }}
              />
              <button
                type="submit"
                disabled={sending || !codeInput.trim()}
                className="px-3 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                style={{
                  background: "color-mix(in srgb, var(--scene-accent) 16%, transparent)",
                  color: "var(--scene-accent)",
                  border: "1px solid color-mix(in srgb, var(--scene-accent) 38%, transparent)",
                }}
              >
                Send
              </button>
            </div>
          </form>
        </SectionCard>

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <SectionCard title="Friend requests" icon={UserPlus} count={incoming.length}>
            <ul className="space-y-2">
              {incoming.map((p) => (
                <li key={p.friendshipId} className="flex items-center gap-3">
                  <Avatar url={p.avatarUrl} name={p.displayName} />
                  <span className="flex-1 text-sm truncate" style={{ color: "var(--scene-text-primary)" }}>
                    {p.displayName}
                  </span>
                  <button
                    onClick={async () => {
                      await respond({ friendshipId: p.friendshipId as Id<"friendships">, accept: true })
                      toast.success(`You're now friends with ${p.displayName}`)
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium"
                    style={{
                      background: "color-mix(in srgb, var(--scene-accent) 16%, transparent)",
                      color: "var(--scene-accent)",
                    }}
                  >
                    <Check className="w-3.5 h-3.5" /> Accept
                  </button>
                  <button
                    onClick={async () => {
                      await respond({ friendshipId: p.friendshipId as Id<"friendships">, accept: false })
                    }}
                    title="Decline"
                    className="p-1.5 rounded-md hover:bg-[var(--scene-bg)]"
                    style={{ color: "var(--scene-text-muted)" }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Suggestions */}
        {suggestions && suggestions.length > 0 && (
          <SectionCard title="People you've played with" icon={Users}>
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li key={s.userId} className="flex items-center gap-3">
                  <Avatar url={s.avatarUrl} name={s.displayName} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate" style={{ color: "var(--scene-text-primary)" }}>
                      {s.displayName}
                    </span>
                    <span className="block text-[11px] truncate" style={{ color: "var(--scene-text-muted)" }}>
                      via {s.viaCampaign}
                    </span>
                  </span>
                  <button
                    onClick={async () => {
                      try {
                        const res = await sendToUser({ userId: s.userId })
                        toast.success(res.status === "accepted" ? "You're now friends!" : "Request sent")
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Couldn't send the request")
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium shrink-0"
                    style={{
                      background: "color-mix(in srgb, var(--scene-accent) 16%, transparent)",
                      color: "var(--scene-accent)",
                    }}
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Add
                  </button>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Friends */}
        <SectionCard title="Your friends" icon={Users} count={friends?.length}>
          {friends === undefined ? (
            <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
              Loading…
            </p>
          ) : friends.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
              No friends yet. Share your code or add someone you&apos;ve played with above.
            </p>
          ) : (
            <ul className="space-y-2">
              {friends.map((f) => (
                <li key={f.friendshipId} className="flex items-center gap-3 group">
                  <Avatar url={f.avatarUrl} name={f.displayName} />
                  <span className="flex-1 text-sm truncate" style={{ color: "var(--scene-text-primary)" }}>
                    {f.displayName}
                  </span>
                  <FriendActions friend={f} dmCampaigns={dmCampaigns} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Outgoing (sent) requests */}
        {outgoing.length > 0 && (
          <SectionCard title="Sent requests" icon={Clock} count={outgoing.length}>
            <ul className="space-y-2">
              {outgoing.map((p) => (
                <li key={p.friendshipId} className="flex items-center gap-3">
                  <Avatar url={p.avatarUrl} name={p.displayName} />
                  <span className="flex-1 text-sm truncate" style={{ color: "var(--scene-text-primary)" }}>
                    {p.displayName}
                  </span>
                  <span className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                    Pending
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>
    </AppShell>
  )
}
