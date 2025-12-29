"use client"

import Link from "next/link"
import { Settings, LogOut, ChevronRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function AccountQuickLinks() {
  const handleSignOut = () => {
    // In a real app, this would call an auth provider's signOut method
    // For now, we'll show what this would do
    if (typeof window !== "undefined") {
      // Could clear auth tokens, redirect to login, etc.
      console.log("Sign out triggered")
    }
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Settings className="h-5 w-5 text-fey-cyan" />
          Quick Links
        </CardTitle>
        <CardDescription>Navigate to common destinations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link href="/settings" className="block">
          <Button
            variant="ghost"
            className="w-full justify-between h-auto py-3 px-4 hover:bg-muted/50"
          >
            <span className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium text-foreground">Settings</p>
                <p className="text-sm text-muted-foreground">
                  Appearance, campaigns, and data management
                </p>
              </div>
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Button>
        </Link>

        <div className="pt-2 border-t border-border">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-between h-auto py-3 px-4 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 group"
          >
            <span className="flex items-center gap-3">
              <LogOut className="h-5 w-5 group-hover:text-red-500" />
              <div className="text-left">
                <p className="font-medium text-foreground group-hover:text-red-500">
                  Sign Out
                </p>
                <p className="text-sm text-muted-foreground">
                  Log out of your account
                </p>
              </div>
            </span>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
