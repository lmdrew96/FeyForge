import Link from "next/link"
import { ArrowLeft, ScrollText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
export default function TermsPage() {
  return (
    <div className="min-h-screen w-full bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Back Link */}
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
              <div className="p-2 rounded-lg bg-fey-purple/10 border border-fey-purple/20">
                <ScrollText className="h-6 w-6 text-fey-purple" />
              </div>
              <div>
                <CardTitle className="text-2xl font-display">Terms of Service</CardTitle>
                <p className="text-sm text-muted-foreground">Last updated: June 8, 2026</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="prose prose-invert max-w-none p-6 space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using FeyForge, you accept and agree to be bound by the terms and 
                provisions of this agreement. If you do not agree to abide by these terms, please 
                do not use this service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                FeyForge is a digital toolset for tabletop role-playing games. It provides character
                creation and management, campaign and world-building tools, interactive maps, a content
                reference (Codex), live session and combat tools for players and Dungeon Masters, dice
                rolling, and optional AI-assisted features. Some features require a Premium membership
                (see Section 4).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. User Accounts</h2>
              <p className="text-muted-foreground leading-relaxed">
                You are responsible for maintaining the confidentiality of your account and password. 
                You agree to accept responsibility for all activities that occur under your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Premium Memberships and Payments</h2>
              <p className="text-muted-foreground leading-relaxed">
                FeyForge offers an optional Premium membership that unlocks additional features and higher
                AI usage limits; a free tier remains available. Premium memberships are sold and billed
                through Ko-fi, and we do not process or store your payment details. Billing, renewals, and
                cancellation are handled through your Ko-fi account and are subject to Ko-fi&apos;s terms.
                Except where required by law, payments are non-refundable. We may change Premium features,
                limits, or pricing over time and will aim to give notice of material changes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. AI-Generated Content</h2>
              <p className="text-muted-foreground leading-relaxed">
                Some features generate content using third-party AI models (provided by Anthropic). AI
                output may be inaccurate, incomplete, or inappropriate, and does not represent official
                game rules or professional advice — review it and use your own judgment before relying on
                it. AI features are subject to daily usage limits that vary by membership tier. Do not
                submit other people&apos;s personal or sensitive information to AI tools. You are responsible
                for the content you generate and how you use it.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. User Content</h2>
              <p className="text-muted-foreground leading-relaxed">
                You retain ownership of any content you create using FeyForge, including characters,
                campaigns, and notes. By using our service, you grant us a limited license to store
                and display your content as necessary to provide the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Acceptable Use</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree not to use FeyForge for any unlawful purpose or in any way that could 
                damage, disable, or impair the service. You may not attempt to gain unauthorized 
                access to any part of the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                FeyForge&apos;s original content, features, and branding are owned by FeyForge / ADHDesigns
                and protected by applicable copyright, trademark, and other intellectual property laws.
                FeyForge uses game content from the System Reference Document 5.1 (&quot;SRD 5.1&quot;) by
                Wizards of the Coast, made available under the Creative Commons Attribution 4.0 International
                License (CC BY 4.0). FeyForge also integrates content and tools from third parties,
                including Open5e, Azgaar&apos;s Fantasy Map Generator, and Watabou&apos;s generators; these
                remain the property of their respective creators and are used under their respective
                licenses. Trademarks and game systems referenced remain the property of their owners.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                FeyForge shall not be liable for any indirect, incidental, special, consequential, 
                or punitive damages resulting from your use of or inability to use the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">10. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these terms at any time. We will notify users of 
                any significant changes via email or through the service itself.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">11. Contact</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms of Service, contact us at{" "}
                <a href="mailto:nae@adhdesigns.dev" className="text-foreground underline">
                  nae@adhdesigns.dev
                </a>
                .
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
