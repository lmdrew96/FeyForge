"use client"

import { FloatingParticles } from "@/components/floating-particles"
import { SignupForm } from "@/components/login/signup-form"
import { ThemeToggle } from "@/components/theme-toggle"

export default function SignupPage() {
  return (
    <div className="min-h-screen w-full bg-background relative overflow-x-hidden flex flex-col">
      {/* Particles in fixed layer behind everything */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <FloatingParticles />
      </div>

      {/* Theme Toggle - top right */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <SignupForm />
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-sm text-muted-foreground">
        <p>FeyForge - D&D Campaign Management</p>
      </footer>
    </div>
  )
}
