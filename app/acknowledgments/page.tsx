import Link from "next/link"
import { ArrowLeft, Heart } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Public credits page for the third-party tools, data, and people FeyForge is
// built on. Mirrors the standalone /privacy + /terms layout (no AppShell) so it's
// reachable by logged-out visitors from the landing footer. The SRD attribution
// here also satisfies the Creative Commons Attribution requirement.

type Credit = { name: string; href?: string; note: string }

function CreditList({ items }: { items: Credit[] }) {
  return (
    <ul className="space-y-3 mt-2">
      {items.map((c) => (
        <li key={c.name} className="text-muted-foreground leading-relaxed">
          {c.href ? (
            <a
              href={c.href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {c.name}
            </a>
          ) : (
            <span className="font-medium text-foreground">{c.name}</span>
          )}
          {" — "}
          {c.note}
        </li>
      ))}
    </ul>
  )
}

export default function AcknowledgmentsPage() {
  return (
    <div className="min-h-screen w-full bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <Card className="bg-card/80 backdrop-blur-sm border-border shadow-xl">
          <CardHeader className="border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-fey-forest/10 border border-fey-forest/20">
                <Heart className="h-6 w-6 text-fey-forest" />
              </div>
              <div>
                <CardTitle className="text-2xl font-display">Acknowledgments</CardTitle>
                <p className="text-sm text-muted-foreground">
                  FeyForge stands on the work of others. Thank you.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="prose prose-invert max-w-none p-6 space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Worlds &amp; Maps</h2>
              <CreditList
                items={[
                  {
                    name: "Azgaar's Fantasy Map Generator",
                    href: "https://azgaar.github.io/Fantasy-Map-Generator/",
                    note: "the procedural world maps, realms, cultures, and routes that power the World Map.",
                  },
                  {
                    name: "Watabou (Oleg Dolya)",
                    href: "https://watabou.itch.io/",
                    note: "the Medieval Fantasy City Generator and One Page Dungeon behind settlement and dungeon drill-downs.",
                  },
                ]}
              />
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Game Rules &amp; Data</h2>
              <CreditList
                items={[
                  {
                    name: "Dungeons & Dragons System Reference Document (SRD 5.2)",
                    href: "https://creativecommons.org/licenses/by/4.0/",
                    note: "monsters, spells, classes, and rules content.",
                  },
                  {
                    name: "Open5e",
                    href: "https://open5e.com",
                    note: "an open, community-maintained API for SRD content.",
                  },
                ]}
              />
              <p className="text-muted-foreground leading-relaxed mt-4 text-sm">
                This work includes material from the System Reference Document 5.2 (&ldquo;SRD
                5.2&rdquo;) by Wizards of the Coast LLC, available under the{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/legalcode"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Creative Commons Attribution 4.0 International License
                </a>
                . FeyForge is not affiliated with, endorsed, sponsored, or specifically approved
                by Wizards of the Coast LLC.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Built With</h2>
              <p className="text-muted-foreground leading-relaxed">
                Next.js, Convex, Clerk, Tailwind CSS, Radix UI, lucide icons, three.js (the 3D
                dice), and AssemblyAI (live captions). Premium support runs through Ko-fi.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Special Thanks</h2>
              <p className="text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">Ashley</span> — creative partner on
                FeyForge, who composes its music and helps craft its worlds. FeyForge sounds and
                looks the way it does because of them.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-3">
                And to the friends and players who tested, broke, and improved FeyForge one session
                at a time. The best tools are built at the table.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
