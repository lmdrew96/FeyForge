"use client"

import { AppShell } from "@/components/app-shell"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { KOFI_URL, PREMIUM_FEATURES, AI_CAP_PREMIUM } from "@/lib/premium"
import { Check, Sparkles, ExternalLink, ShieldCheck } from "lucide-react"

export default function AccountPage() {
  const me = useQuery(api.users.getMe)
  const usage = useQuery(api.aiUsage.getUsage)

  const loading = me === undefined
  const isAdmin = me?.role === "admin"
  const isPremium = me?.isPremium === true // getMe folds admin into isPremium

  return (
    <AppShell>
      <div className="p-6 max-w-3xl mx-auto space-y-8">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
        >
          Account
        </h1>

        {loading ? (
          <div
            className="rounded-lg p-8 text-center"
            style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
          >
            <p style={{ color: "var(--scene-text-muted)" }}>Loading…</p>
          </div>
        ) : (
          <>
            {/* Plan summary */}
            <section
              className="rounded-lg p-6 space-y-4"
              style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2
                    className="text-sm font-semibold uppercase tracking-wider"
                    style={{ color: "var(--scene-text-muted)" }}
                  >
                    Your plan
                  </h2>
                  <p
                    className="text-lg font-medium mt-1"
                    style={{ color: "var(--scene-text-primary)" }}
                  >
                    {isAdmin ? "Admin" : isPremium ? "Premium" : "Free"}
                  </p>
                </div>
                <PlanBadge isPremium={isPremium} isAdmin={isAdmin} />
              </div>

              {usage && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs" style={{ color: "var(--scene-text-muted)" }}>
                    <span>AI generations today</span>
                    <span>{usage.used} / {usage.cap} used</span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--scene-bg)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (usage.used / Math.max(1, usage.cap)) * 100)}%`,
                        background: "var(--scene-accent)",
                      }}
                    />
                  </div>
                  <p className="text-xs" style={{ color: "var(--scene-text-muted)" }}>
                    Resets daily.{" "}
                    {usage.remaining > 0
                      ? `${usage.remaining} left.`
                      : "You're out for today."}
                  </p>
                </div>
              )}
            </section>

            {/* Upgrade or thank-you */}
            {isAdmin ? (
              <section
                className="rounded-lg p-6 flex items-start gap-3"
                style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
              >
                <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--scene-accent)" }} />
                <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
                  Admins have full Premium access at no cost.
                </p>
              </section>
            ) : isPremium ? (
              <PremiumThanks premiumSince={me?.premiumSince} />
            ) : (
              <UpgradeCard />
            )}
          </>
        )}

        {/* Legal — logged-in users never see the landing-page footer */}
        <div
          className="flex items-center justify-center gap-4 pt-2 text-xs"
          style={{ color: "var(--scene-text-muted)" }}
        >
          <Link href="/privacy" className="transition-opacity hover:opacity-70">
            Privacy Policy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="transition-opacity hover:opacity-70">
            Terms of Service
          </Link>
          <span aria-hidden>·</span>
          <Link href="/acknowledgments" className="transition-opacity hover:opacity-70">
            Acknowledgments
          </Link>
        </div>
      </div>
    </AppShell>
  )
}

function PlanBadge({ isPremium, isAdmin }: { isPremium: boolean; isAdmin: boolean }) {
  const label = isAdmin ? "Admin" : isPremium ? "Premium" : "Free"
  const accent = isPremium // admin folds into isPremium
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0"
      style={{
        background: accent
          ? "color-mix(in srgb, var(--scene-accent) 16%, transparent)"
          : "var(--scene-bg)",
        color: accent ? "var(--scene-accent)" : "var(--scene-text-muted)",
        border: `1px solid ${accent ? "color-mix(in srgb, var(--scene-accent) 38%, transparent)" : "var(--scene-border)"}`,
      }}
    >
      {accent && <Sparkles className="w-3 h-3" />}
      {label}
    </span>
  )
}

function PremiumThanks({ premiumSince }: { premiumSince?: number }) {
  return (
    <section
      className="rounded-lg p-6 space-y-3"
      style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5" style={{ color: "var(--scene-accent)" }} />
        <h2 className="text-base font-semibold" style={{ color: "var(--scene-text-primary)" }}>
          You're Premium — thank you
        </h2>
      </div>
      <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
        Your support keeps FeyForge growing.
        {premiumSince
          ? ` Premium since ${new Date(premiumSince).toLocaleDateString()}.`
          : ""}
      </p>
      <a
        href={KOFI_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity"
        style={{ color: "var(--scene-accent)" }}
      >
        Manage your membership on Ko-fi
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </section>
  )
}

function UpgradeCard() {
  return (
    <section
      className="rounded-lg p-6 space-y-5"
      style={{
        background: "var(--scene-surface)",
        border: "1px solid color-mix(in srgb, var(--scene-accent) 30%, var(--scene-border))",
      }}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" style={{ color: "var(--scene-accent)" }} />
          <h2
            className="text-lg font-bold"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--scene-text-primary)" }}
          >
            Go Premium
          </h2>
        </div>
        <p className="text-sm" style={{ color: "var(--scene-text-muted)" }}>
          Support FeyForge with a Ko-fi membership and unlock the full toolkit for your table.
        </p>
      </div>

      <ul className="space-y-3">
        {PREMIUM_FEATURES.map((f) => (
          <li key={f.title} className="flex items-start gap-2.5">
            <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--scene-accent)" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--scene-text-primary)" }}>
                {f.title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--scene-text-muted)" }}>
                {f.desc}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <a
        href={KOFI_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-md px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ background: "var(--scene-accent)", color: "var(--scene-bg)" }}
      >
        <Sparkles className="w-4 h-4" />
        Subscribe on Ko-fi
        <ExternalLink className="w-3.5 h-3.5" />
      </a>

      <p
        className="text-xs rounded-md p-3"
        style={{
          color: "var(--scene-text-muted)",
          background: "var(--scene-bg)",
          border: "1px solid var(--scene-border)",
        }}
      >
        <strong style={{ color: "var(--scene-text-primary)" }}>One thing:</strong> subscribe on
        Ko-fi using the <strong style={{ color: "var(--scene-text-primary)" }}>same email</strong>{" "}
        you use to sign in here — that's how we unlock Premium on your account automatically. It can
        take a minute to take effect after you join.
      </p>
    </section>
  )
}
