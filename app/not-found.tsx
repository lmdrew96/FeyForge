import { Compass, Home } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)]/10">
          <Compass className="h-8 w-8 text-[var(--fey-gold)]" />
        </div>

        <div className="space-y-2">
          <h1
            className="text-2xl font-bold text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            Page Not Found
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            The path you seek lies beyond the boundaries of this realm. Perhaps
            the page has been moved or never existed.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90"
        >
          <Home className="h-4 w-4" />
          Return to Dashboard
        </Link>
      </div>
    </div>
  )
}
