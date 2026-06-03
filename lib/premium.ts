// Single source of truth for the Premium upgrade surface — the Ko-fi link, the
// daily AI caps shown in copy, and the "what you get" feature list. Imported by
// the Account page, the nav upsell, and the in-app premium notices so the pitch
// and the destination never drift.
//
// IMPORTANT — premium is granted by the Ko-fi webhook (app/api/webhooks/kofi),
// which acts ONLY on recurring MEMBERSHIP payments (is_subscription_payment) and
// matches the payment email to the user's account. So KOFI_URL must point at a
// Ko-fi membership/subscription tier (not a one-time donation), and the upgrade
// copy tells users to subscribe with the same email they use here.

// Ko-fi membership page. A plain string (not NEXT_PUBLIC_*): the URL is public,
// not a secret, and an env var would be inlined at build time anyway — but it
// would silently fall back to a placeholder in prod if it wasn't set in the
// Vercel build env (Convex deploys separately; see memory/deploy_topology).
export const KOFI_URL = "https://ko-fi.com/adhdesigns/tiers"

// Display caps for upsell copy. The live, authoritative numbers come from
// convex/aiUsage (getUsage.cap); these are only for the static feature list so
// we don't import server code into the client bundle.
export const AI_CAP_FREE = 3
export const AI_CAP_PREMIUM = 50

export type PremiumFeature = { title: string; desc: string }

// What a free user unlocks by subscribing. Every entry is a real, shipped gate
// (verified against the codebase) — no aspirational bullets.
export const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    title: `${AI_CAP_PREMIUM} AI generations a day`,
    desc: `Instead of ${AI_CAP_FREE}. Fuels the DM Assistant, location & NPC generation, and AI encounters all session long.`,
  },
  {
    title: "Bring your own world maps",
    desc: "Upload custom map art or import a finished Azgaar world, pins and all — not just the built-in starter maps.",
  },
  {
    title: "The premium map library",
    desc: "A growing, curated collection of beautiful worlds you filter by vibe — terrain, mood, and scale — to match your campaign.",
  },
  {
    title: "Bigger maps",
    desc: "Scatter up to ~100 points of interest across a world for sprawling, mega-campaign maps (free tops out around ~40).",
  },
  {
    title: "Illustrate your map pins",
    desc: "Attach artwork to map locations so a tavern or dungeon opens with a picture, not just text.",
  },
]
