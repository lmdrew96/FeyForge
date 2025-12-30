"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail, Loader2, CheckCircle, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FloatingParticles } from "@/components/floating-particles"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email) {
      setError("Please enter your email address")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    setIsLoading(true)

    // Simulate API call - will be replaced with actual auth flow
    await new Promise((resolve) => setTimeout(resolve, 1500))

    setIsLoading(false)
    setIsSubmitted(true)
  }

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden flex items-center justify-center p-4">
      {/* Particles Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <FloatingParticles />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back to Login Link */}
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        <Card className="bg-card/80 backdrop-blur-sm border-border shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-fey-purple/10 border border-fey-purple/20">
                <Sparkles className="h-8 w-8 text-fey-gold" />
              </div>
            </div>
            <CardTitle className="text-2xl font-display">Reset Password</CardTitle>
            <CardDescription>
              {isSubmitted
                ? "Check your email for a reset link"
                : "Enter your email and we'll send you a reset link"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {isSubmitted ? (
              <div className="text-center space-y-4">
                <div className="p-4 rounded-lg bg-fey-forest/10 border border-fey-forest/20">
                  <CheckCircle className="h-8 w-8 text-fey-forest mx-auto mb-2" />
                  <p className="text-foreground font-medium">Email sent!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    If an account exists for <span className="font-medium">{email}</span>, 
                    you&apos;ll receive a password reset link shortly.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Didn&apos;t receive the email? Check your spam folder or{" "}
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="text-fey-cyan hover:underline"
                  >
                    try again
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className={error ? "border-destructive" : ""}
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>
            )}

            <p className="text-center text-sm text-muted-foreground pt-4 border-t border-border">
              Remember your password?{" "}
              <Link
                href="/login"
                className="text-fey-cyan hover:text-fey-cyan/80 font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
