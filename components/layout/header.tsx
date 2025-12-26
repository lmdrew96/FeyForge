"use client"

import Link from "next/link"
import { Search, User, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/ui/theme-toggle"

interface HeaderProps {
  title?: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-12 sm:h-14 items-center justify-between border-b border-border/50 bg-card/90 backdrop-blur-md px-2 sm:px-3 pl-12 sm:pl-14 md:pl-6 pr-2 sm:pr-6 md:h-20">
      <div className="min-w-0 flex-1 mr-1 sm:mr-2">
        {title && (
          <h1 className="font-serif text-xs sm:text-sm md:text-lg lg:text-xl font-bold text-silver truncate">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground truncate hidden sm:block px-[7px]">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-3 shrink-0">
        {/* Search */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search spells, monsters, NPCs..."
            className="w-64 pl-9 bg-input/50 border-border focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="border-primary/50 text-primary hover:bg-primary/15 hover:border-primary gap-1 bg-primary/5 text-label-sm btn-height-sm px-1.5 sm:px-3 shadow-[0_0_15px_-3px_var(--primary)] hover:shadow-[0_0_25px_-3px_var(--primary)] transition-all"
          asChild
        >
          <Link href="/dm-assistant">
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-twinkle" />
            <span className="hidden sm:inline font-medium">AI</span>
          </Link>
        </Button>

        <ThemeToggle />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full container-xs hover:bg-primary/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <div className="icon-md rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 border border-primary/30 flex items-center justify-center">
                <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover/95 backdrop-blur-md border-border">
            <DropdownMenuLabel className="text-silver">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem className="text-foreground focus:bg-primary/10 focus:text-foreground cursor-pointer">
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-foreground focus:bg-primary/10 focus:text-foreground cursor-pointer">
              My Campaigns
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-foreground focus:bg-primary/10 focus:text-foreground cursor-pointer"
              asChild
            >
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 cursor-pointer">
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
