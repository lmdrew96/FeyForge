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
  ChevronDown,
  ChevronRight,
  UserSquare2,
  Globe,
  Network,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

type NavChild = { label: string; href: string; icon: React.ElementType }
type NavItem = {
  label: string
  href: string
  icon: React.ElementType
  children?: NavChild[]
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Characters", href: "/characters", icon: UserSquare2 },
  { label: "Live Session", href: "/session", icon: Sparkles },
  {
    label: "DM Tools",
    href: "/dm",
    icon: Swords,
    children: [
      { label: "NPCs", href: "/dm/npcs", icon: Users },
      { label: "Story Web", href: "/dm/campaign-web", icon: Network },
      { label: "Scenes", href: "/dm/scenes", icon: Map },
      { label: "Assistant", href: "/dm/assistant", icon: Bot },
      { label: "Wiki", href: "/dm/wiki", icon: ScrollText },
      { label: "World Map", href: "/dm/world-map", icon: Globe },
    ],
  },
  { label: "Codex", href: "/codex", icon: BookOpen },
  { label: "Dice", href: "/dice", icon: Dices },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [dmOpen, setDmOpen] = useState(pathname.startsWith("/dm"))

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--scene-bg)" }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-56 shrink-0"
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
        </nav>

        {/* User area */}
        <div
          className="px-4 py-3 flex items-center gap-3"
          style={{ borderTop: "1px solid var(--scene-border)" }}
        >
          <UserButton appearance={{ elements: { avatarBox: "w-7 h-7" } }} />
          <Link
            href="/account"
            className="text-xs truncate hover:opacity-80 transition-opacity"
            style={{ color: "var(--scene-text-muted)" }}
          >
            Account
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-12"
        style={{
          background: "var(--scene-surface)",
          borderBottom: "1px solid var(--scene-border)",
        }}
      >
        <span
          className="text-base font-bold tracking-widest uppercase"
          style={{ fontFamily: "var(--font-display)", color: "var(--scene-accent)" }}
        >
          FeyForge
        </span>
        <UserButton appearance={{ elements: { avatarBox: "w-7 h-7" } }} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-12 pb-14 md:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-14"
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
