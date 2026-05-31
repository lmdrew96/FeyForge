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
  Map,
  ScrollText,
  Dices,
  BookOpen,
  BookMarked,
  ChevronDown,
  ChevronRight,
  UserSquare2,
  Globe,
  Network,
  Music,
  Shield,
  Settings,
  Menu,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { useCampaignStore } from "@/lib/campaign-store"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { SceneBackdrop } from "@/components/scene-backdrop"

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
  { label: "NPCs", href: "/dm/npcs", icon: Users },
  { label: "Sessions", href: "/sessions", icon: ScrollText },
  { label: "Encounters", href: "/dm/encounters", icon: Swords },
  { label: "Story Web", href: "/dm/campaign-web", icon: Network },
  { label: "Scenes", href: "/dm/scenes", icon: Map },
  { label: "Audio Library", href: "/dm/library", icon: Music },
  { label: "Assistant", href: "/dm/assistant", icon: Bot },
  { label: "Wiki", href: "/dm/wiki", icon: ScrollText },
  { label: "World Map", href: "/dm/world-map", icon: Globe },
]

// Players (explicit player role in the active campaign) see only the shared,
// DM-revealed surfaces.
const PLAYER_CHILDREN: NavChild[] = [
  { label: "Wiki", href: "/dm/wiki", icon: ScrollText },
  { label: "World Map", href: "/dm/world-map", icon: Globe },
]

function buildNavItems(isPlayer: boolean): NavItem[] {
  return [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Campaigns", href: "/campaigns", icon: BookMarked },
    { label: "Characters", href: "/characters", icon: UserSquare2 },
    { label: "Live Session", href: "/session", icon: Sparkles },
    {
      label: isPlayer ? "Campaign" : "DM Tools",
      href: "/dm",
      icon: Swords,
      children: isPlayer ? PLAYER_CHILDREN : DM_CHILDREN,
    },
    { label: "Codex", href: "/codex", icon: BookOpen },
    { label: "Dice", href: "/dice", icon: Dices },
    { label: "Settings", href: "/settings", icon: Settings },
  ]
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [dmOpen, setDmOpen] = useState(pathname.startsWith("/dm"))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const me = useQuery(api.users.getMe)
  const isAdmin = me?.role === "admin"

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

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href)

  return (
    <div className="relative flex h-screen overflow-hidden" style={{ background: "var(--scene-bg)" }}>
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
          className="px-5 py-5"
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
        </div>

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
          <ThemeToggle className="w-full justify-center" />
          <div className="flex items-center gap-3">
            <UserButton appearance={{ elements: { avatarBox: "w-7 h-7" } }} />
            <Link
              href="/account"
              className="text-xs truncate hover:opacity-80 transition-opacity"
              style={{ color: "var(--scene-text-muted)" }}
            >
              Account
            </Link>
          </div>
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
        <UserButton appearance={{ elements: { avatarBox: "w-7 h-7" } }} />
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

          <div className="px-4 py-3 shrink-0 flex items-center justify-between" style={{ borderTop: "1px solid var(--scene-border)" }}>
            <ThemeToggle />
            <Link href="/account" onClick={() => setDrawerOpen(false)} className="text-xs hover:opacity-80" style={{ color: "var(--scene-text-muted)" }}>
              Account
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
        {[
          { label: "Home", href: "/dashboard", icon: LayoutDashboard },
          { label: "Characters", href: "/characters", icon: UserSquare2 },
          { label: "Session", href: "/session", icon: Sparkles },
          { label: "DM", href: "/dm", icon: Swords },
          { label: "Codex", href: "/codex", icon: BookOpen },
        ].map((item) => (
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
