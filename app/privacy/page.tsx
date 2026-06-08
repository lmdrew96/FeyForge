import Link from "next/link"
import { ArrowLeft, Shield } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
export default function PrivacyPage() {
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
              <div className="p-2 rounded-lg bg-fey-forest/10 border border-fey-forest/20">
                <Shield className="h-6 w-6 text-fey-forest" />
              </div>
              <div>
                <CardTitle className="text-2xl font-display">Privacy Policy</CardTitle>
                <p className="text-sm text-muted-foreground">Last updated: June 8, 2026</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="prose prose-invert max-w-none p-6 space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Information We Collect</h2>
              <p className="text-muted-foreground leading-relaxed">
                We collect information you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
                <li>Account information (email address, display name), handled through our authentication provider, Clerk</li>
                <li>Character, campaign, NPC, map, and session data you create</li>
                <li>Content you submit to AI features — the prompts and the surrounding character or campaign context used to generate a result</li>
                <li>Usage data and preferences, including AI generation counts used to enforce daily limits</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                We do not collect or store payment card details. Premium memberships are processed by Ko-fi, and
                your payment information is handled by Ko-fi under their own privacy policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process and complete transactions</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Data Storage</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your account and content data are stored in our database, hosted on Convex. Images you upload
                (such as character portraits) are stored on Cloudflare R2. Data is transmitted over encrypted
                connections (HTTPS) and protected by access controls. Character, campaign, and other content
                you create are accessible only to you and the campaigns you choose to share them with.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Data Sharing</h2>
              <p className="text-muted-foreground leading-relaxed">
                We do not sell, rent, or trade your personal information. We share data only with the service
                providers that operate FeyForge, and only as needed to run the service:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
                <li><strong className="text-foreground">Clerk</strong> — account authentication and sign-in</li>
                <li><strong className="text-foreground">Convex</strong> — database and real-time backend hosting</li>
                <li><strong className="text-foreground">Cloudflare R2</strong> — storage for images you upload</li>
                <li><strong className="text-foreground">Anthropic</strong> — powers our AI features; when you use an AI tool (such as the DM Assistant or NPC and encounter generation), the content you submit and its surrounding context are sent to Anthropic to generate a response</li>
                <li><strong className="text-foreground">Ko-fi</strong> — processes Premium membership payments</li>
                <li><strong className="text-foreground">Vercel</strong> — application hosting and delivery</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                We may also disclose information with your consent, to comply with legal obligations, or to
                protect our rights and prevent fraud.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Cookies and Tracking</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use essential cookies to keep you signed in and remember your preferences, including
                authentication cookies set by Clerk. We do not use third-party advertising or cross-site
                tracking cookies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed">
                You have the right to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data in a portable format</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your data for as long as your account is active or as needed to provide 
                you services. You can request deletion of your account and associated data at any 
                time through the Settings page.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational measures to protect your 
                personal data against unauthorized access, alteration, disclosure, or destruction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Children&apos;s Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                FeyForge is not intended for children under 13 years of age. We do not knowingly 
                collect personal information from children under 13.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">10. Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this privacy policy from time to time. We will notify you of any 
                changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">11. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy or want to exercise your data rights,
                contact us at{" "}
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
