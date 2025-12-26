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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface HeaderProps {
  title?: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-border/50 bg-card/90 backdrop-blur-md px-3 pl-14 md:pl-6 sm:pr-6">
      <div className="min-w-0 flex-1 mr-2">
        {title && (
          <Tooltip>
            <TooltipTrigger asChild>
              <h1 className="font-serif text-sm sm:text-lg md:text-xl font-bold text-silver truncate">{title}</h1>
            </TooltipTrigger>
            <TooltipContent>
              <p>{title}</p>
            </TooltipContent>
          </Tooltip>
        )}
        {subtitle && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:block">{subtitle}</p>
            </TooltipTrigger>
            <TooltipContent>
              <p>{subtitle}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
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
          className="border-primary/50 text-primary hover:bg-primary/15 hover:border-primary gap-1 sm:gap-2 bg-primary/5 text-xs h-8 px-2 sm:px-3 shadow-[0_0_15px_-3px_var(--turquoise)] hover:shadow-[0_0_25px_-3px_var(--turquoise)] transition-all"
          asChild
        >
          <Link href="/dm-assistant">
            <Sparkles className="h-3.5 w-3.5 animate-twinkle" />
            <span className="hidden sm:inline font-medium">AI</span>
          </Link>
        </Button>

        <ThemeToggle />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-primary/10">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 border border-primary/30 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-foreground" />
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
