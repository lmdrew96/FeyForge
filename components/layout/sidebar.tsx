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
  { name: "The Forge", href: "/", icon: Flame, color: "cyan" },
  { name: "Characters", href: "/characters", icon: Users, color: "lavender" },
  { name: "Dice Roller", href: "/dice", icon: Dices, color: "copper" },
  { name: "NPCs", href: "/npcs", icon: Sparkles, color: "teal" },
  { name: "Sessions", href: "/sessions", icon: Scroll, color: "cyan" },
  { name: "Combat", href: "/combat", icon: Swords, color: "copper" },
  { name: "Codex", href: "/codex", icon: BookOpen, color: "lavender" },
  { name: "World Map", href: "/world-map", icon: Map, color: "teal" },
  { name: "DM Assistant", href: "/dm-assistant", icon: Bot, color: "copper" },
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

  const getIconColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      cyan: "icon-forge",
      lavender: "icon-characters",
      copper: "icon-dice",
      teal: "icon-npcs",
    }
    return colorMap[color] || "icon-forge"
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-2.5 left-2.5 z-50 md:hidden rounded-2xl bg-card/80 backdrop-blur-sm border border-border"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {mobileOpen && isMobile && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border transition-all duration-300",
          "backdrop-blur-xl shadow-2xl",
          "rounded-r-3xl",
          isMobile ? (mobileOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full") : collapsed ? "w-20" : "w-64",
          "max-md:shadow-2xl",
        )}
        style={{
          background: "oklch(0.28 0.04 280 / 0.95)",
        }}
      >
        <div className="fairy-dust" />
        <div className="floating-orb cyan w-32 h-32 -top-10 -right-10 opacity-30" />
        <div
          className="floating-orb lavender w-24 h-24 -bottom-10 -left-10 opacity-25"
          style={{ animationDelay: "4s" }}
        />

        <div className="flex h-full flex-col relative z-10 overflow-hidden">
          <div className="flex h-20 md:h-20 items-center justify-between border-b border-sidebar-border/50 px-4 shrink-0">
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
          <nav className="flex-1 space-y-2 px-3 py-6 overflow-y-auto overflow-x-hidden">
            {navigation.map((item, index) => {
              const isActive = pathname === item.href
              const showFull = !collapsed || isMobile
              const iconColorClass = getIconColorClass(item.color)

              const linkContent = (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "stagger-item group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 nav-item-magic relative",
                    isActive
                      ? "bg-gradient-to-r from-accent/60 to-accent/30 text-foreground border border-primary/30 shadow-[0_0_25px_-5px_oklch(0.75_0.15_210_/_0.3)]"
                      : "text-muted-foreground hover:text-foreground border border-transparent",
                    !showFull && "justify-center px-3",
                  )}
                  style={{
                    animationDelay: `${index * 0.05}s`,
                    ["--nav-accent-color" as any]:
                      item.color === "cyan"
                        ? "#42e2ed"
                        : item.color === "lavender"
                          ? "#b7adc7"
                          : item.color === "copper"
                            ? "#a36424"
                            : "#347975",
                  }}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-all duration-200",
                      isActive ? "animate-ethereal-glow" : "",
                      iconColorClass,
                    )}
                  />
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
          </nav>

          {/* Bottom Navigation */}
          <div className="border-t border-sidebar-border/50 px-3 py-4 shrink-0">
            {bottomNav.map((item) => {
              const isActive = pathname === item.href
              const showFull = !collapsed || isMobile
              const linkContent = (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 nav-item-magic",
                    isActive ? "bg-accent/60 text-primary" : "text-muted-foreground hover:text-foreground",
                    !showFull && "justify-center px-3",
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
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
                  "mt-3 w-full text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-2xl",
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
