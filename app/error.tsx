"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw, Home } from "lucide-react"
import Link from "next/link"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[FeyForge] Unhandled error:", error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--destructive)]/10">
          <AlertTriangle className="h-8 w-8 text-[var(--destructive)]" />
        </div>

        <div className="space-y-2">
          <h1
            className="text-2xl font-bold text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            Something went wrong
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            An unexpected error occurred. You can try again or return to the
            dashboard.
          </p>
          {error.digest && (
            <p className="text-xs text-[var(--muted-foreground)]">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
