"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sparkles,
  Menu,
  Users,
  Swords,
  Dice6,
  Bot,
  UserCircle,
  BookOpen,
  ScrollText,
  Map,
  Settings,
  User,
  Book,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { FloatingParticles } from "@/components/floating-particles"
import { ThemeToggle } from "@/components/theme-toggle"
import { CampaignSelector } from "@/components/dashboard/campaign-selector"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

const navItems = [
  { label: "Dashboard", href: "/", icon: Sparkles },
  { label: "Characters", href: "/characters", icon: Users },
  { label: "Combat Tracker", href: "/combat", icon: Swords },
  { label: "Dice Roller", href: "/dice", icon: Dice6 },
  { label: "DM Assistant", href: "/dm-assistant", icon: Bot },
  { label: "NPCs", href: "/npcs", icon: UserCircle },
  { label: "Campaign Wiki", href: "/wiki", icon: Book },
  { label: "Codex", href: "/codex", icon: BookOpen },
  { label: "Sessions", href: "/sessions", icon: ScrollText },
  { label: "World Map", href: "/world-map", icon: Map },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Account", href: "/account", icon: User },
]

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? "bg-fey-cyan/10 text-fey-cyan font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

interface AppShellProps {
  children: React.ReactNode
  pageTitle?: string
  headerActions?: React.ReactNode
  showSidebar?: boolean
}

export function AppShell({ children, pageTitle, headerActions, showSidebar = true }: AppShellProps) {
  return (
    <div className="min-h-screen w-full max-w-full bg-background relative overflow-x-hidden">
      {/* Skip to content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-fey-cyan focus:text-white focus:rounded-md focus:text-sm focus:font-medium focus:outline-none focus:ring-2 focus:ring-fey-cyan focus:ring-offset-2"
      >
        Skip to content
      </a>

      {/* Particles in fixed layer behind everything */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <FloatingParticles />
      </div>

      <div className="relative z-10 flex min-h-screen w-full max-w-full">
        {/* Desktop Sidebar - fixed position */}
        {showSidebar && (
          <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card/50 backdrop-blur-sm p-4 fixed top-0 left-0 h-screen">
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="h-7 w-7 text-fey-gold flex-shrink-0" />
              <h1 className="text-xl font-bold text-foreground truncate">FeyForge</h1>
            </div>
            <div className="mb-6">
              <CampaignSelector />
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar />
            </div>
          </aside>
        )}

        {/* Main Content Area - with left margin for fixed sidebar */}
        <div
          className={`flex-1 flex flex-col min-h-screen w-full max-w-full overflow-x-hidden ${showSidebar ? "lg:ml-64" : ""}`}
        >
          <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-md">
            <div className="px-3 sm:px-4 py-3 flex items-center justify-between gap-2 w-full max-w-full">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                {/* Mobile Menu */}
                {showSidebar && (
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="lg:hidden flex-shrink-0">
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-72 p-4">
                      <SheetHeader className="mb-6">
                        <SheetTitle className="flex items-center gap-3">
                          <Sparkles className="h-6 w-6 text-fey-gold" />
                          FeyForge
                        </SheetTitle>
                      </SheetHeader>
                      <div className="mb-6">
                        <CampaignSelector />
                      </div>
                      <Sidebar />
                    </SheetContent>
                  </Sheet>
                )}

                {/* Mobile Logo */}
                <Link href="/" className="flex items-center gap-2 lg:hidden flex-shrink-0">
                  <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-fey-gold" />
                  <span className="font-bold text-foreground text-sm sm:text-base">FeyForge</span>
                </Link>

                {/* Page Title - truncate on small screens */}
                {pageTitle && (
                  <h2 className="text-base sm:text-lg font-semibold text-foreground hidden sm:block truncate">
                    {pageTitle}
                  </h2>
                )}
              </div>

              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                {headerActions}
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main id="main-content" className="flex-1 w-full max-w-full overflow-x-hidden">{children}</main>
        </div>
      </div>
    </div>
  )
}
