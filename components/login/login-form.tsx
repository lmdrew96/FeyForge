"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Sparkles, Mail, Lock, Eye, EyeOff, Loader2, Wand2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type AuthMode = "password" | "magic-link"

interface FormState {
  email: string
  password: string
  magicLinkEmail: string
}

interface FormErrors {
  email?: string
  password?: string
  magicLinkEmail?: string
  general?: string
}

export function LoginForm() {
  const router = useRouter()
  const [authMode, setAuthMode] = useState<AuthMode>("password")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  
  const [formData, setFormData] = useState<FormState>({
    email: "",
    password: "",
    magicLinkEmail: "",
  })
  
  const [errors, setErrors] = useState<FormErrors>({})

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleInputChange = (field: keyof FormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const newErrors: FormErrors = {}
    
    if (!formData.email) {
      newErrors.email = "Email is required"
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }
    
    if (!formData.password) {
      newErrors.password = "Password is required"
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsLoading(true)
    setErrors({})
    
    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })
      
      if (result?.error) {
        setErrors({ general: "Invalid email or password. Please try again." })
      } else {
        router.push("/")
        router.refresh()
      }
    } catch {
      setErrors({ general: "Login failed. Please check your credentials and try again." })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    setErrors({})
    
    try {
      await signIn("google", { callbackUrl: "/" })
    } catch {
      setErrors({ general: "Google sign-in failed. Please try again." })
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const newErrors: FormErrors = {}
    
    if (!formData.magicLinkEmail) {
      newErrors.magicLinkEmail = "Email is required"
    } else if (!validateEmail(formData.magicLinkEmail)) {
      newErrors.magicLinkEmail = "Please enter a valid email address"
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsMagicLinkLoading(true)
    setErrors({})
    
    try {
      // Simulate magic link send - replace with actual logic
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setMagicLinkSent(true)
      
    } catch {
      setErrors({ general: "Failed to send magic link. Please try again." })
    } finally {
      setIsMagicLinkLoading(false)
    }
  }

  const resetMagicLink = () => {
    setMagicLinkSent(false)
    setFormData((prev) => ({ ...prev, magicLinkEmail: "" }))
  }

  return (
    <Card className="w-full max-w-md border-fey-sage/30 bg-card/80 backdrop-blur-sm shadow-lg">
      <CardHeader className="text-center space-y-4 pb-4">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-full bg-fey-gold/10 border border-fey-gold/20">
            <Sparkles className="h-8 w-8 text-fey-gold" />
          </div>
          <div>
            <CardTitle className="text-2xl font-display text-foreground">
              Welcome to FeyForge
            </CardTitle>
            <CardDescription className="mt-2 text-muted-foreground">
              Sign in to continue your adventure
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* General Error Message */}
        {errors.general && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {errors.general}
          </div>
        )}

        {/* Email & Password Form */}
        {authMode === "password" && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                disabled={isLoading}
                aria-invalid={!!errors.email}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  disabled={isLoading}
                  aria-invalid={!!errors.password}
                  className={`pr-10 ${errors.password ? "border-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-fey-cyan hover:text-fey-cyan/80 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>
        )}

        {/* Magic Link Form */}
        {authMode === "magic-link" && (
          <div className="space-y-4">
            {magicLinkSent ? (
              <div className="text-center space-y-4">
                <div className="p-4 rounded-lg bg-fey-cyan/10 border border-fey-cyan/20">
                  <Wand2 className="h-8 w-8 text-fey-cyan mx-auto mb-2" />
                  <p className="text-foreground font-medium">Magic link sent!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Check your email for a link to sign in
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={resetMagicLink}
                  className="w-full"
                >
                  Send another link
                </Button>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="magic-email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    id="magic-email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.magicLinkEmail}
                    onChange={(e) => handleInputChange("magicLinkEmail", e.target.value)}
                    disabled={isMagicLinkLoading}
                    aria-invalid={!!errors.magicLinkEmail}
                    className={errors.magicLinkEmail ? "border-destructive" : ""}
                  />
                  {errors.magicLinkEmail && (
                    <p className="text-sm text-destructive">{errors.magicLinkEmail}</p>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  We&apos;ll email you a magic link to sign in without a password
                </p>

                <Button
                  type="submit"
                  className="w-full"
                  variant="outline"
                  disabled={isMagicLinkLoading}
                >
                  {isMagicLinkLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending link...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Send Magic Link
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Google OAuth */}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </>
          )}
        </Button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Toggle Auth Mode */}
        <Button
          type="button"
          variant="ghost"
          className="w-full text-fey-cyan hover:text-fey-cyan/80 hover:bg-fey-cyan/10"
          onClick={() => {
            setAuthMode(authMode === "password" ? "magic-link" : "password")
            setErrors({})
          }}
        >
          {authMode === "password" ? (
            <>
              <Wand2 className="h-4 w-4" />
              Sign in with Magic Link
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Sign in with Password
            </>
          )}
        </Button>

        {/* Sign Up Link */}
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link
            href="/signup"
            className="text-fey-cyan hover:text-fey-cyan/80 font-medium transition-colors"
          >
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
