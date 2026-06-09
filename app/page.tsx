import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Drama, Music, Swords } from "lucide-react"

export default async function HomePage() {
  const { userId } = await auth()
  if (userId) redirect("/dashboard")

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: "#0d0d14", color: "#f0eef8" }}
    >
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5">
        <span
          className="text-xl font-bold tracking-wide"
          style={{ fontFamily: "var(--font-cinzel)", color: "#a89ec4" }}
        >
          FeyForge
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm transition-opacity hover:opacity-80"
            style={{ color: "#8a8299" }}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-sm px-4 py-2 rounded-md font-medium transition-opacity hover:opacity-80"
            style={{ background: "#7b68c8", color: "#0d0d14" }}
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 gap-8">
        <div className="space-y-4 max-w-3xl">
          <p
            className="text-xs uppercase tracking-[0.25em]"
            style={{ color: "#7b68c8" }}
          >
            Live Tabletop Companion
          </p>
          <h1
            className="text-5xl sm:text-7xl font-bold leading-tight"
            style={{ fontFamily: "var(--font-cinzel-decorative)", color: "#e8e0f8" }}
          >
            FeyForge
          </h1>
          <p
            className="text-lg sm:text-xl leading-relaxed max-w-xl mx-auto"
            style={{ color: "#8a8299" }}
          >
            The DM conducts. The scene shifts. The players feel it. A live session companion where sound, scene, and story move together.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/signup"
            className="px-8 py-3 rounded-lg font-semibold text-base transition-all hover:opacity-90 hover:scale-[1.02]"
            style={{ background: "#7b68c8", color: "#0d0d14" }}
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 rounded-lg font-semibold text-base transition-opacity hover:opacity-80"
            style={{ border: "1px solid #2e2a3e", color: "#a89ec4" }}
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Feature strip */}
      <section
        className="border-t px-8 py-16"
        style={{ borderColor: "#1e1a2e" }}
      >
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              icon: Music,
              title: "Scene-Synced Audio",
              body: "Ambience, explore, and combat tracks crossfade in real time as the intensity slider moves. Players hear exactly what the DM is hearing.",
            },
            {
              icon: Drama,
              title: "Live Scene Control",
              body: "Activate a scene and the whole table's UI shifts — palette, accent, borders. Visual atmosphere as a live instrument.",
            },
            {
              icon: Swords,
              title: "Party in Real Time",
              body: "Party members, conditions, HP, inventory, and DM broadcasts — all live, no refresh, no Discord coordination.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="space-y-3">
              <Icon className="h-8 w-8" strokeWidth={1.5} style={{ color: "#7b68c8" }} />
              <h3
                className="font-semibold text-base"
                style={{ fontFamily: "var(--font-cinzel)", color: "#e8e0f8" }}
              >
                {title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "#8a8299" }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        className="px-8 py-6 text-center border-t text-xs flex flex-col items-center gap-2"
        style={{ borderColor: "#1e1a2e", color: "#4a4560" }}
      >
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms of Service
          </Link>
          <span aria-hidden>·</span>
          <Link href="/acknowledgments" className="transition-colors hover:text-foreground">
            Acknowledgments
          </Link>
        </div>
        <span>© 2026 ADHDesigns — FeyForge</span>
      </footer>
    </main>
  )
}
