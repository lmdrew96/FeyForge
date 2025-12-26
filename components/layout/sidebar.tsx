"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Dices,
  Users,
  Scroll,
  Swords,
  BookOpen,
  Sparkles,
  Map,
  Flame,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bot,
  Menu,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useState, useEffect } from "react"
import { FeyForgeLogo } from "@/components/ui/feyforge-logo"

const navigation = [
  { name: "The Forge", href: "/", icon: Flame, iconClass: "icon-forge" },
  { name: "Characters", href: "/characters", icon: Users, iconClass: "icon-characters" },
  { name: "Dice Roller", href: "/dice", icon: Dices, iconClass: "icon-dice" },
  { name: "NPCs", href: "/npcs", icon: Sparkles, iconClass: "icon-npcs" },
  { name: "Sessions", href: "/sessions", icon: Scroll, iconClass: "icon-sessions" },
  { name: "Combat", href: "/combat", icon: Swords, iconClass: "icon-combat" },
  { name: "Codex", href: "/codex", icon: BookOpen, iconClass: "icon-codex" },
  { name: "World Map", href: "/world-map", icon: Map, iconClass: "icon-world" },
  { name: "DM Assistant", href: "/dm-assistant", icon: Bot, iconClass: "icon-dm" },
]

const bottomNav = [{ name: "Settings", href: "/settings", icon: Settings }]

interface SidebarProps {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <TooltipProvider delayDuration={0}>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-2.5 left-2.5 z-50 md:hidden rounded-xl bg-card/90 backdrop-blur-sm border border-border shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {mobileOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r transition-all duration-300",
          "bg-card/95 backdrop-blur-md",
          isMobile ? (mobileOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full") : collapsed ? "w-20" : "w-64",
        )}
      >
        <div className="flex h-full flex-col overflow-hidden">
          {/* Logo */}
          <div className="flex h-20 items-center justify-between border-b border-border/50 px-4 shrink-0">
            {(!collapsed || isMobile) && (
              <Link href="/" className="flex items-center gap-3 group min-w-0">
                <FeyForgeLogo size="md" showText={true} />
              </Link>
            )}
            {collapsed && !isMobile && (
              <div className="mx-auto">
                <FeyForgeLogo size="md" showText={false} collapsed={true} />
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto overflow-x-hidden">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              const showFull = !collapsed || isMobile

              const linkContent = (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "nav-item-magic group flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive && "active",
                    !isActive && "text-muted-foreground hover:text-foreground",
                    !showFull && "justify-center px-3",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-all duration-200",
                      isActive ? "text-primary drop-shadow-[0_0_8px_var(--turquoise)]" : item.iconClass,
                      "group-hover:scale-110",
                    )}
                  />
                  {showFull && (
                    <span className={cn("truncate", isActive && "text-foreground font-semibold")}>{item.name}</span>
                  )}
                </Link>
              )

              if (!showFull) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="whimsy-tooltip">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return <div key={item.name}>{linkContent}</div>
            })}
          </nav>

          {/* Bottom Navigation */}
          <div className="border-t border-border/50 px-3 py-4 shrink-0">
            {bottomNav.map((item) => {
              const isActive = pathname === item.href
              const showFull = !collapsed || isMobile
              const linkContent = (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "nav-item-magic group flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive && "active",
                    !isActive && "text-muted-foreground hover:text-foreground",
                    !showFull && "justify-center px-3",
                  )}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                  {showFull && <span className="truncate">{item.name}</span>}
                </Link>
              )

              if (!showFull) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="whimsy-tooltip">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return <div key={item.name}>{linkContent}</div>
            })}

            {!isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCollapsedChange(!collapsed)}
                className={cn(
                  "mt-3 w-full text-muted-foreground hover:text-foreground hover:bg-primary/10 rounded-lg transition-colors",
                  collapsed && "px-3",
                )}
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Collapse
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
