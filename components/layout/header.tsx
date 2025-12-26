"use client"

import Link from "next/link"
import { Bell, Search, User, Sparkles } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-3 pl-14 md:pl-6 sm:pr-6">
      <div className="min-w-0 flex-1">
        <h1 className="font-serif text-lg sm:text-2xl font-bold text-foreground truncate">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Search */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search spells, monsters, NPCs..."
            className="w-64 pl-9 bg-input border-border focus:border-primary"
          />
        </div>

        {/* AI Assistant Button */}
        <Button
          variant="outline"
          size="sm"
          className="border-primary/50 text-primary hover:bg-primary/10 hover:border-primary gap-1 sm:gap-2 bg-transparent text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
          asChild
        >
          <Link href="/dm-assistant">
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">AI Assistant</span>
          </Link>
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-8 w-8 sm:h-10 sm:w-10">
          <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          <Badge className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 p-0 flex items-center justify-center bg-primary text-primary-foreground text-[10px] sm:text-xs">
            3
          </Badge>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-10 sm:w-10">
              <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-accent flex items-center justify-center">
                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
            <DropdownMenuLabel className="text-foreground">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem className="text-foreground focus:bg-accent focus:text-accent-foreground">
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-foreground focus:bg-accent focus:text-accent-foreground">
              My Campaigns
            </DropdownMenuItem>
            <DropdownMenuItem className="text-foreground focus:bg-accent focus:text-accent-foreground" asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem className="text-destructive focus:bg-destructive/10">Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
