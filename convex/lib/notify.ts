import type { MutationCtx } from "../_generated/server"
import type { Id } from "../_generated/dataModel"

// ── Notifications spine ───────────────────────────────────────────────────────
// Shared insert helper so every feature writes notifications the same way (the
// "build once, not retrofit 4×" rationale on the notifications table). Plain
// async helper — not a Convex function — so friends.ts / campaign-invite call it
// directly inside their own transaction (no ctx.runMutation hop). Mirrors the
// lib/auth.ts helper convention.

export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "campaign_invite"

export type NotificationPayload = {
  fromUserId?: string
  fromName?: string
  fromAvatarUrl?: string
  friendshipId?: Id<"friendships">
  campaignId?: Id<"campaigns">
  campaignName?: string
}

export async function createNotification(
  ctx: MutationCtx,
  userId: string,
  type: NotificationType,
  payload: NotificationPayload,
): Promise<void> {
  await ctx.db.insert("notifications", {
    userId,
    type,
    payload,
    createdAt: Date.now(),
  })
}
