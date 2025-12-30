import Link from "next/link"
import { ArrowLeft, ScrollText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FloatingParticles } from "@/components/floating-particles"

export default function TermsPage() {
  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      {/* Particles Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <FloatingParticles />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
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
                <p className="text-sm text-muted-foreground">Last updated: December 29, 2025</p>
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
                FeyForge is a digital toolset designed for tabletop role-playing game enthusiasts. 
                Our platform provides character management, campaign tracking, dice rolling, and 
                various utilities to enhance your gaming experience.
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
              <h2 className="text-xl font-semibold text-foreground mb-3">4. User Content</h2>
              <p className="text-muted-foreground leading-relaxed">
                You retain ownership of any content you create using FeyForge, including characters, 
                campaigns, and notes. By using our service, you grant us a limited license to store 
                and display your content as necessary to provide the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Acceptable Use</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree not to use FeyForge for any unlawful purpose or in any way that could 
                damage, disable, or impair the service. You may not attempt to gain unauthorized 
                access to any part of the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                FeyForge and its original content, features, and functionality are owned by FeyForge 
                and are protected by international copyright, trademark, and other intellectual 
                property laws. Game rules and content from third-party systems remain the property 
                of their respective owners.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                FeyForge shall not be liable for any indirect, incidental, special, consequential, 
                or punitive damages resulting from your use of or inability to use the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these terms at any time. We will notify users of 
                any significant changes via email or through the service itself.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Contact</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms of Service, please contact us through 
                our support channels.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
