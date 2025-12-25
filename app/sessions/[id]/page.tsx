"use client"

import { useParams } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { SessionEditor } from "@/components/sessions/session-editor"
import { useSessionStore } from "@/lib/session-store"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function SessionPage() {
  const { id } = useParams()
  const sessions = useSessionStore((state) => state.sessions)
  const session = sessions.find((s) => s.id === id)

  if (!session) {
    return (
      <AppShell title="Session Not Found" subtitle="This session doesn't exist">
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">The session you're looking for doesn't exist.</p>
            <Button asChild variant="outline" className="border-border bg-transparent">
              <Link href="/sessions">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sessions
              </Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    )
  }

  return (
    <AppShell title={`Session #${session.number}: ${session.title}`} subtitle={session.status}>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <Link href="/sessions">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sessions
          </Link>
        </Button>
      </div>
      <SessionEditor session={session} />
    </AppShell>
  )
}
