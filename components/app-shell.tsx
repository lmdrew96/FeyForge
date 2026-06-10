"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import {
  LayoutDashboard,
  Users,
  Sparkles,
  Swords,
  Bot,
  ScrollText,
  Dices,
  BookOpen,
  BookMarked,
  BookText,
  ChevronDown,
  ChevronRight,
  UserSquare2,
  Globe,
  Network,
  Shield,
  FlaskConical,
  Settings,
  Menu,
  X,
  Check,
  UserPlus,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { useCampaignStore } from "@/lib/campaign-store"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { SceneBackdrop } from "@/components/scene-backdrop"
import { DMAssistantPanel } from "@/components/dm-assistant/dm-assistant-widget"
import { NotificationBell } from "@/components/notification-bell"

type NavChild = { label: string; href: string; icon: React.ElementType }
type NavItem = {
  label: string
  href: string
  icon: React.ElementType
  children?: NavChild[]
}

// Full DM toolset — shown to DMs, and to anyone without an explicit player role
// in their active campaign (solo users, no active campaign, legacy member-less
// campaigns). Pages still gate their own writes; this is nav coherence only.
const DM_CHILDREN: NavChild[] = [
  { label: "Campaign Hub", href: "/hub", icon: BookText },
  { label: "NPCs", href: "/dm/npcs", icon: Users },
  { label: "Sessions", href: "/sessions", icon: ScrollText },
  { label: "Encounters", href: "/dm/encounters", icon: Swords },
  { label: "Story Web", href: "/dm/campaign-web", icon: Network },
  { label: "Assistant", href: "/dm/assistant", icon: Bot },
  { label: "Wiki", href: "/dm/wiki", icon: ScrollText },
  { label: "World Map", href: "/dm/world-map", icon: Globe },
]

// Players (explicit player role in the active campaign) see only the shared,
// DM-revealed surfaces plus their own Campaign Hub (journal + readable recaps).
const PLAYER_CHILDREN: NavChild[] = [
  { label: "Campaign Hub", href: "/hub", icon: BookText },
  { label: "Wiki", href: "/dm/wiki", icon: ScrollText },
  { label: "World Map", href: "/dm/world-map", icon: Globe },
]

function buildNavItems(isPlayer: boolean): NavItem[] {
  return [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Campaigns", href: "/campaigns", icon: BookMarked },
    { label: "Characters", href: "/characters", icon: UserSquare2 },
    { label: "Homebrew", href: "/homebrew", icon: FlaskConical },
    { label: "Live Session", href: "/session", icon: Sparkles },
    {
      label: isPlayer ? "Campaign" : "DM Tools",
      href: "/dm",
      icon: Swords,
      children: isPlayer ? PLAYER_CHILDREN : DM_CHILDREN,
    },
    { label: "Friends", href: "/friends", icon: UserPlus },
    { label: "Codex", href: "/codex", icon: BookOpen },
    { label: "Dice", href: "/dice", icon: Dices },
    { label: "Settings", href: "/settings", icon: Settings },
  ]
}

// Mobile bottom bar — 5 thumb targets max (mobile_layout: min-h-14 + safe-area).
// Role-aware like the sidebar: players don't run the table, so the DM tab is
// replaced by Dice (the most-used at-the-table feature, otherwise drawer-only).
// DMs keep DM — they reach Dice via the drawer, and the DM Assistant launcher
// already covers quick reference. Campaign/Wiki/World Map stay in the drawer for
// players (the role-aware "Campaign" group), so nothing is lost, just re-prioritized.
function buildBottomNavItems(isPlayer: boolean): { label: string; href: string; icon: React.ElementType }[] {
  return [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    { label: "Characters", href: "/characters", icon: UserSquare2 },
    { label: "Session", href: "/session", icon: Sparkles },
    isPlayer
      ? { label: "Dice", href: "/dice", icon: Dices }
      : { label: "DM", href: "/dm", icon: Swords },
    { label: "Codex", href: "/codex", icon: BookOpen },
  ]
}

// Clerk's <UserButton> renders nothing during SSR (Clerk isn't loaded server-side),
// so on the server the sibling /account link becomes the first child of its flex row —
// but on the client the button's <div data-clerk-component> mounts first, shifting the
// siblings and tripping a hydration mismatch. Render an identical fixed-size placeholder
// during SSR + first client paint (so server/client agree), then swap in the real button
// after mount. The placeholder reserves the avatar footprint → no layout shift.
function ClientUserButton() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted)
    return (
      <span
        className="inline-block h-7 w-7 shrink-0 rounded-full"
        style={{ background: "var(--scene-border)" }}
        aria-hidden
      />
    )
  return <UserButton appearance={{ elements: { avatarBox: "w-7 h-7" } }} />
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [dmOpen, setDmOpen] = useState(pathname.startsWith("/dm"))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const me = useQuery(api.users.getMe)
  const isAdmin = me?.role === "admin"
  // getMe folds admin into isPremium, so this is false only for genuine free
  // users — the ones we surface the Upgrade affordance to.
  const showUpgrade = me != null && me.isPremium !== true

  // Role in the active campaign drives whether the nav shows the full DM
  // toolset or the slimmed player "Campaign" section. Only an explicit player
  // role slims the nav — DM, no role, or no active campaign keep full tools.
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const role = useQuery(
    api.campaignMembers.getMyRole,
    activeCampaignId ? { campaignId: activeCampaignId as Id<"campaigns"> } : "skip",
  )
  const isPlayer = role === "player"
  const navItems = useMemo(() => buildNavItems(isPlayer), [isPlayer])
  const bottomNavItems = useMemo(() => buildBottomNavItems(isPlayer), [isPlayer])

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href)

  // ── DM Assistant launcher (docked into chrome) ──────────────────────────────
  // The launcher lives in the top bar (mobile) + sidebar (desktop) instead of a
  // floating FAB, so it can never occlude page content. Self-gates to the DM of
  // the active campaign; suppressed on the full /dm/assistant page (redundant
  // there). The panel itself (DMAssistantPanel) is unchanged.
  const [assistantOpen, setAssistantOpen] = useState(false)
  const isDmOfActive = role === "dm" && !!activeCampaignId
  const onFullAssistant = pathname === "/dm/assistant"
  const showAssistant = isDmOfActive && !onFullAssistant

  // Collapse if the gate stops holding (e.g. the DM switches to a campaign they
  // only play in, or navigates onto the full assistant page) so the panel can't
  // linger out of context.
  useEffect(() => {
    if (!showAssistant) setAssistantOpen(false)
  }, [showAssistant])

  // ⌘K / Ctrl-K toggles the assistant on desktop (Nae lives on the keyboard).
  useEffect(() => {
    if (!showAssistant) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setAssistantOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showAssistant])

  return (
    <div className="relative flex h-[100dvh] overflow-hidden" style={{ background: "var(--scene-bg)" }}>
      <SceneBackdrop />

      {/* Desktop sidebar */}
      <aside
        className="relative z-10 hidden md:flex flex-col w-56 shrink-0"
        style={{
          background: "var(--scene-surface)",
          borderRight: "1px solid var(--scene-border)",
        }}
      >
        {/* Wordmark */}
        <div
          className="px-5 py-5 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--scene-border)" }}
        >
          <Link href="/dashboard">
            <span
              className="text-lg font-bold tracking-widest uppercase"
              style={{ fontFamily: "var(--font-display)", color: "var(--scene-accent)" }}
            >
              FeyForge
            </span>
          </Link>
          <NotificationBell align="left" />
        </div>

        {/* Active campaign switcher */}
        <CampaignSwitcher />

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          {navItems.map((item) => {
            if (item.children) {
              return (
                <div key={item.href}>
                  <button
                    onClick={() => setDmOpen((o) => !o)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm",
                      "hover:bg-[var(--scene-bg)]"
                    )}
                    style={{
                      color: isActive(item.href)
                        ? "var(--scene-accent)"
                        : "var(--scene-text-muted)",
                    }}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {dmOpen ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {dmOpen && (
                    <div
                      className="ml-4 mt-0.5 space-y-0.5 pl-2"
                      style={{ borderLeft: "1px solid var(--scene-border)" }}
                    >
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm hover:bg-[var(--scene-bg)]"
                          style={{
                            color: isActive(child.href)
                              ? "var(--scene-accent)"
                              : "var(--scene-text-muted)",
                            background: isActive(child.href)
                              ? "var(--scene-bg)"
                              : undefined,
                          }}
                        >
                          <child.icon className="w-3.5 h-3.5 shrink-0" />
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-[var(--scene-bg)]"
                style={{
                  color: isActive(item.href)
                    ? "var(--scene-accent)"
                    : "var(--scene-text-muted)",
                  background: isActive(item.href) ? "var(--scene-bg)" : undefined,
                }}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}

          {isAdmin && (
            <Link
              href="/admin/review"
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-[var(--scene-bg)]"
              style={{
                color: isActive("/admin")
                  ? "var(--scene-accent)"
                  : "var(--scene-text-muted)",
                background: isActive("/admin") ? "var(--scene-bg)" : undefined,
              }}
            >
              <Shield className="w-4 h-4 shrink-0" />
              Admin
            </Link>
          )}
        </nav>

        {/* User area */}
        <div
          className="px-4 py-3 space-y-2"
          style={{ borderTop: "1px solid var(--scene-border)" }}
        >
          {showAssistant && (
            <button
              onClick={() => setAssistantOpen((o) => !o)}
              aria-label="Toggle DM Assistant"
              title="Ask FeyForge (⌘K)"
              className="flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-sm hover:bg-[var(--scene-bg)]"
              style={{
                color: assistantOpen ? "var(--scene-accent)" : "var(--scene-text-muted)",
                background: assistantOpen ? "var(--scene-bg)" : undefined,
              }}
            >
              <Bot className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">Ask FeyForge</span>
            </button>
          )}
          {showUpgrade && (
            <Link
              href="/account"
              className="flex items-center justify-center gap-1.5 w-full rounded-md px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90"
              style={{
                background: "color-mix(in srgb, var(--scene-accent) 16%, transparent)",
                color: "var(--scene-accent)",
                border: "1px solid color-mix(in srgb, var(--scene-accent) 38%, transparent)",
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Upgrade to Premium
            </Link>
          )}
          <ThemeToggle className="w-full justify-center" />
          <div className="flex items-center gap-3">
            <ClientUserButton />
            <Link
              href="/account"
              className="text-xs truncate hover:opacity-80 transition-opacity"
              style={{ color: "var(--scene-text-muted)" }}
            >
              Account
            </Link>
          </div>
          <Link
            href="/acknowledgments"
            className="block text-[10px] text-center pt-1 hover:opacity-80 transition-opacity"
            style={{ color: "var(--scene-text-muted)", opacity: 0.7 }}
          >
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-2 h-12"
        style={{
          background: "var(--scene-surface)",
          borderBottom: "1px solid var(--scene-border)",
        }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="p-2 rounded-md hover:bg-[var(--scene-bg)]"
            style={{ color: "var(--scene-text-muted)" }}
          >
            <Menu className="w-5 h-5" />
          </button>
          <span
            className="text-base font-bold tracking-widest uppercase"
            style={{ fontFamily: "var(--font-display)", color: "var(--scene-accent)" }}
          >
            FeyForge
          </span>
        </div>
        <div className="flex items-center gap-1">
          {showAssistant && (
            <button
              onClick={() => setAssistantOpen(true)}
              aria-label="Open DM Assistant"
              className="p-2 rounded-md hover:bg-[var(--scene-bg)]"
              style={{ color: assistantOpen ? "var(--scene-accent)" : "var(--scene-text-muted)" }}
            >
              <Bot className="w-5 h-5" />
            </button>
          )}
          <NotificationBell align="right" />
          <ClientUserButton />
        </div>
      </div>

      {/* Mobile nav drawer — full parity with the desktop sidebar */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-[60] transition-opacity duration-200",
          drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
      >
        <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 w-72 max-w-[82vw] flex flex-col transition-transform duration-200",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
          style={{ background: "var(--scene-surface)", borderRight: "1px solid var(--scene-border)" }}
        >
          <div className="flex items-center justify-between px-4 h-12 shrink-0" style={{ borderBottom: "1px solid var(--scene-border)" }}>
            <span className="text-base font-bold tracking-widest uppercase" style={{ fontFamily: "var(--font-display)", color: "var(--scene-accent)" }}>
              FeyForge
            </span>
            <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="p-2 rounded-md hover:bg-[var(--scene-bg)]" style={{ color: "var(--scene-text-muted)" }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active campaign switcher */}
          <CampaignSwitcher onSelect={() => setDrawerOpen(false)} />

          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
            {navItems.map((item) =>
              item.children ? (
                <div key={item.href} className="pt-2">
                  <div className="px-3 pb-1 text-xs uppercase tracking-widest" style={{ color: "var(--scene-text-muted)", opacity: 0.7 }}>
                    {item.label}
                  </div>
                  {item.children.map((child) => (
                    <DrawerLink key={child.href} href={child.href} icon={child.icon} label={child.label} active={isActive(child.href)} onNavigate={() => setDrawerOpen(false)} />
                  ))}
                </div>
              ) : (
                <DrawerLink key={item.href} href={item.href} icon={item.icon} label={item.label} active={isActive(item.href)} onNavigate={() => setDrawerOpen(false)} />
              ),
            )}
            {isAdmin && (
              <DrawerLink href="/admin/review" icon={Shield} label="Admin" active={isActive("/admin")} onNavigate={() => setDrawerOpen(false)} />
            )}
          </nav>

          <div className="px-4 py-3 shrink-0 space-y-2" style={{ borderTop: "1px solid var(--scene-border)" }}>
            {showUpgrade && (
              <Link
                href="/account"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-center gap-1.5 w-full rounded-md px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                style={{
                  background: "color-mix(in srgb, var(--scene-accent) 16%, transparent)",
                  color: "var(--scene-accent)",
                  border: "1px solid color-mix(in srgb, var(--scene-accent) 38%, transparent)",
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Upgrade to Premium
              </Link>
            )}
            <div className="flex items-center justify-between">
              <ThemeToggle />
              <Link href="/account" onClick={() => setDrawerOpen(false)} className="text-xs hover:opacity-80" style={{ color: "var(--scene-text-muted)" }}>
                Account
              </Link>
            </div>
            <Link
              href="/acknowledgments"
              onClick={() => setDrawerOpen(false)}
              className="block text-[10px] text-center hover:opacity-80"
              style={{ color: "var(--scene-text-muted)", opacity: 0.7 }}
            >
              v{process.env.NEXT_PUBLIC_APP_VERSION}
            </Link>
          </div>
        </aside>
      </div>

      {/* Main content */}
      <main className="relative z-10 flex-1 overflow-y-auto md:pt-0 pt-12 pb-[calc(3.5rem_+_env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around min-h-14 pb-[env(safe-area-inset-bottom)]"
        style={{
          background: "var(--scene-surface)",
          borderTop: "1px solid var(--scene-border)",
        }}
      >
        {bottomNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-0.5 px-2 py-1 text-xs"
            style={{
              color: isActive(item.href)
                ? "var(--scene-accent)"
                : "var(--scene-text-muted)",
            }}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Global DM Assistant panel — opened by the chrome launcher (top bar +
          sidebar above). Self-gates to the DM of the active campaign and hides
          on the full /dm/assistant page. */}
      {showAssistant && assistantOpen && activeCampaignId && (
        <DMAssistantPanel
          campaignId={activeCampaignId}
          onClose={() => setAssistantOpen(false)}
        />
      )}
    </div>
  )
}

// Active-campaign switcher for the nav. Lists every campaign the user belongs
// to (owned + joined) and flips the active one on select. Switching the active
// campaign also re-resolves the player/DM nav (via getMyRole), so this is how a
// user moves between a campaign they run and one they play in. The data-loader
// write-through persists the local selection to the server for cross-device.
function CampaignSwitcher({ onSelect }: { onSelect?: () => void }) {
  const campaigns = useQuery(api.campaignMembers.listMyCampaigns)
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId)
  const setActiveCampaign = useCampaignStore((s) => s.setActiveCampaign)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  // No campaigns yet — nothing to switch between. The Campaigns page handles
  // creation, so the switcher simply doesn't render.
  if (!campaigns || campaigns.length === 0) return null

  // activeCampaignId may be null on first load or point at a campaign no longer
  // in the list (deleted/left); fall back to a label rather than rendering blank.
  const active = campaigns.find((c) => c.campaignId === activeCampaignId) ?? null

  const handleSelect = (id: string) => {
    setActiveCampaign(id)
    setOpen(false)
    onSelect?.()
  }

  return (
    <div
      ref={ref}
      className="relative px-3 py-3"
      style={{ borderBottom: "1px solid var(--scene-border)" }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors hover:opacity-90"
        style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
      >
        <BookMarked className="w-4 h-4 shrink-0" style={{ color: "var(--scene-accent)" }} />
        <span className="flex-1 text-left truncate" style={{ color: "var(--scene-text-primary)" }}>
          {active ? active.name : "Select campaign"}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--scene-text-muted)" }} />
      </button>

      {open && (
        <div
          className="absolute left-3 right-3 mt-1 z-50 rounded-md overflow-y-auto max-h-72 shadow-lg"
          style={{ background: "var(--scene-surface)", border: "1px solid var(--scene-border)" }}
        >
          {campaigns.map((c) => {
            const isActive = c.campaignId === activeCampaignId
            return (
              <button
                key={c.campaignId}
                onClick={() => handleSelect(c.campaignId)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--scene-bg)]"
                style={{ background: isActive ? "var(--scene-bg)" : undefined }}
              >
                <span
                  className="flex-1 truncate"
                  style={{ color: isActive ? "var(--scene-accent)" : "var(--scene-text-primary)" }}
                >
                  {c.name}
                </span>
                <span
                  className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    background:
                      c.role === "dm"
                        ? "color-mix(in srgb, var(--scene-accent) 18%, transparent)"
                        : "var(--scene-border)",
                    color: c.role === "dm" ? "var(--scene-accent)" : "var(--scene-text-muted)",
                  }}
                >
                  {c.role === "dm" ? "DM" : "Player"}
                </span>
                {isActive && (
                  <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--scene-accent)" }} />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DrawerLink({
  href,
  icon: Icon,
  label,
  active,
  onNavigate,
}: {
  href: string
  icon: React.ElementType
  label: string
  active: boolean
  onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm hover:bg-[var(--scene-bg)]"
      style={{
        color: active ? "var(--scene-accent)" : "var(--scene-text-muted)",
        background: active ? "var(--scene-bg)" : undefined,
      }}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </Link>
  )
}
