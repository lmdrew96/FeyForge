import { NextRequest, NextResponse } from "next/server"
import { fetchMutation } from "convex/nextjs"
import { api } from "@/convex/_generated/api"

const KOFI_TOKEN = process.env.KOFI_VERIFICATION_TOKEN

type KofiData = {
  verification_token: string
  type: "Subscription" | "Donation" | "Commission" | "Shop Order"
  is_subscription_payment: boolean
  is_first_subscription_payment: boolean
  kofi_transaction_id: string
  timestamp: string
  email: string
  message: string | null
  amount: string
  currency: string
  url: string
  shop_items: unknown[] | null
  tier_name: string | null
  shipping: unknown | null
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.formData()
  const dataRaw = body.get("data")
  if (!dataRaw || typeof dataRaw !== "string") {
    return NextResponse.json({ error: "Missing data" }, { status: 400 })
  }

  let data: KofiData
  try {
    data = JSON.parse(dataRaw)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Fail closed: a missing token means the endpoint is misconfigured, not open.
  if (!KOFI_TOKEN) {
    console.error("Ko-fi webhook: KOFI_VERIFICATION_TOKEN is not set")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }
  if (data.verification_token !== KOFI_TOKEN) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  // Only handle subscription events
  if (!data.is_subscription_payment) {
    return NextResponse.json({ ok: true, skipped: "not a subscription" })
  }

  // Map Ko-fi email to Clerk user → find Convex user by email
  // Ko-fi gives us email, Clerk stores it — we match by email via Clerk API
  // For now: look up user by email in Convex (requires email stored on user)
  // Simpler path: store email on user record at first login
  // For this webhook, we use the email to find the user and set isPremium
  const clerkRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(data.email)}`,
    { headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` } }
  )
  const clerkUsers = await clerkRes.json()
  const clerkUser = clerkUsers[0]

  if (!clerkUser) {
    console.warn(`Ko-fi webhook: no Clerk user found for email ${data.email}`)
    return NextResponse.json({ ok: true, warning: "user not found" })
  }

  // Convex tokenIdentifier format: <issuer>|<subject>
  // We need the full tokenIdentifier — use clerkId as the key
  const clerkId = clerkUser.id

  await fetchMutation(api.users.setPremiumByClerkId, {
    clerkId,
    isPremium: true,
    webhookSecret: KOFI_TOKEN,
  })

  return NextResponse.json({ ok: true })
}
