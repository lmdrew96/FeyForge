"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Sparkles, Mail, Lock, Eye, EyeOff, Loader2, User, Check, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

interface FormState {
  displayName: string
  email: string
  password: string
  confirmPassword: string
  agreeToTerms: boolean
}

interface FormErrors {
  displayName?: string
  email?: string
  password?: string
  confirmPassword?: string
  agreeToTerms?: string
  general?: string
}

interface PasswordRequirement {
  label: string
  check: (password: string) => boolean
}

const passwordRequirements: PasswordRequirement[] = [
  { label: "At least 8 characters", check: (pw) => pw.length >= 8 },
  { label: "Contains uppercase letter", check: (pw) => /[A-Z]/.test(pw) },
  { label: "Contains lowercase letter", check: (pw) => /[a-z]/.test(pw) },
  { label: "Contains a number", check: (pw) => /\d/.test(pw) },
]

export function SignupForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)
  
  const [formData, setFormData] = useState<FormState>({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
  })
  
  const [errors, setErrors] = useState<FormErrors>({})

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const passwordStrength = useMemo(() => {
    const metRequirements = passwordRequirements.filter((req) => 
      req.check(formData.password)
    ).length
    return metRequirements
  }, [formData.password])

  const passwordStrengthLabel = useMemo(() => {
    if (formData.password.length === 0) return ""
    if (passwordStrength <= 1) return "Weak"
    if (passwordStrength <= 2) return "Fair"
    if (passwordStrength <= 3) return "Good"
    return "Strong"
  }, [passwordStrength, formData.password.length])

  const passwordStrengthColor = useMemo(() => {
    if (passwordStrength <= 1) return "bg-destructive"
    if (passwordStrength <= 2) return "bg-amber-500"
    if (passwordStrength <= 3) return "bg-fey-cyan"
    return "bg-fey-forest"
  }, [passwordStrength])

  const handleInputChange = (field: keyof FormState, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}
    
    if (!formData.displayName.trim()) {
      newErrors.displayName = "Display name is required"
    } else if (formData.displayName.trim().length < 2) {
      newErrors.displayName = "Display name must be at least 2 characters"
    }
    
    if (!formData.email) {
      newErrors.email = "Email is required"
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }
    
    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (passwordStrength < 4) {
      newErrors.password = "Password does not meet all requirements"
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password"
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }
    
    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = "You must agree to the Terms of Service and Privacy Policy"
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return false
    }
    
    return true
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setIsLoading(true)
    setErrors({})
    
    try {
      // Simulate API call - replace with actual auth logic
      await new Promise((resolve) => setTimeout(resolve, 1500))
      
      // For demo purposes, show success state
      // In production, this would create account and redirect
      console.log("Signup attempted with:", {
        displayName: formData.displayName,
        email: formData.email,
      })
      
      setSignupSuccess(true)
      
    } catch {
      setErrors({ general: "Sign up failed. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true)
    setErrors({})
    
    try {
      // Simulate Google OAuth - replace with actual OAuth logic
      await new Promise((resolve) => setTimeout(resolve, 1500))
      console.log("Google signup initiated")
      
    } catch {
      setErrors({ general: "Google sign-up failed. Please try again." })
    } finally {
      setIsGoogleLoading(false)
    }
  }

  if (signupSuccess) {
    return (
      <Card className="w-full max-w-md border-fey-sage/30 bg-card/80 backdrop-blur-sm shadow-lg">
        <CardHeader className="text-center space-y-4 pb-4">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-fey-forest/10 border border-fey-forest/20">
              <Check className="h-8 w-8 text-fey-forest" />
            </div>
            <div>
              <CardTitle className="text-2xl font-display text-foreground">
                Account Created
              </CardTitle>
              <CardDescription className="mt-2 text-muted-foreground">
                Welcome to FeyForge, {formData.displayName}!
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg bg-fey-cyan/10 border border-fey-cyan/20 text-center">
            <p className="text-sm text-foreground">
              Check your email to verify your account before signing in.
            </p>
          </div>
          <Button asChild className="w-full bg-primary hover:bg-primary/90">
            <Link href="/login">
              Continue to Login
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
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
              Join FeyForge
            </CardTitle>
            <CardDescription className="mt-2 text-muted-foreground">
              Create your account and begin your adventure
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

        {/* Sign Up Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName" className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Display Name
            </Label>
            <Input
              id="displayName"
              type="text"
              placeholder="Enter your display name"
              value={formData.displayName}
              onChange={(e) => handleInputChange("displayName", e.target.value)}
              disabled={isLoading}
              aria-invalid={!!errors.displayName}
              className={errors.displayName ? "border-destructive" : ""}
            />
            {errors.displayName && (
              <p className="text-sm text-destructive">{errors.displayName}</p>
            )}
          </div>

          {/* Email */}
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

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
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
            
            {/* Password Strength Indicator */}
            {formData.password.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${passwordStrengthColor}`}
                      style={{ width: `${(passwordStrength / 4) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${
                    passwordStrength <= 1 ? "text-destructive" :
                    passwordStrength <= 2 ? "text-amber-500" :
                    passwordStrength <= 3 ? "text-fey-cyan" :
                    "text-fey-forest"
                  }`}>
                    {passwordStrengthLabel}
                  </span>
                </div>
                
                {/* Password Requirements Checklist */}
                <div className="grid grid-cols-2 gap-1">
                  {passwordRequirements.map((req, index) => {
                    const isMet = req.check(formData.password)
                    return (
                      <div 
                        key={index}
                        className={`flex items-center gap-1.5 text-xs ${
                          isMet ? "text-fey-forest" : "text-muted-foreground"
                        }`}
                      >
                        {isMet ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        <span>{req.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              Confirm Password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                disabled={isLoading}
                aria-invalid={!!errors.confirmPassword}
                className={`pr-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword}</p>
            )}
            {/* Password match indicator */}
            {formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword && (
              <p className="text-sm text-fey-forest flex items-center gap-1.5">
                <Check className="h-3 w-3" />
                Passwords match
              </p>
            )}
          </div>

          {/* Terms & Privacy Checkbox */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Checkbox
                id="agreeToTerms"
                checked={formData.agreeToTerms}
                onCheckedChange={(checked) => 
                  handleInputChange("agreeToTerms", checked === true)
                }
                disabled={isLoading}
                aria-invalid={!!errors.agreeToTerms}
                className={errors.agreeToTerms ? "border-destructive" : ""}
              />
              <Label 
                htmlFor="agreeToTerms" 
                className="text-sm leading-relaxed cursor-pointer"
              >
                I agree to the{" "}
                <Link 
                  href="/terms" 
                  className="text-fey-cyan hover:text-fey-cyan/80 transition-colors underline underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms of Service
                </Link>
                {" "}and{" "}
                <Link 
                  href="/privacy" 
                  className="text-fey-cyan hover:text-fey-cyan/80 transition-colors underline underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </Link>
              </Label>
            </div>
            {errors.agreeToTerms && (
              <p className="text-sm text-destructive">{errors.agreeToTerms}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

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
          onClick={handleGoogleSignup}
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

        {/* Login Link */}
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-fey-cyan hover:text-fey-cyan/80 font-medium transition-colors"
          >
            Login
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
