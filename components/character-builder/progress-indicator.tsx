"use client"

import { cn } from "@/lib/utils"
import { Sparkles, User, Brain, Wrench, Package, ScrollText, Check } from "lucide-react"

interface ProgressIndicatorProps {
  currentStep: number
  totalSteps: number
}

const steps = [
  { label: "Basics", icon: User },
  { label: "Abilities", icon: Brain },
  { label: "Skills", icon: Wrench },
  { label: "Equipment", icon: Package },
  { label: "Details", icon: ScrollText },
]

export function ProgressIndicator({ currentStep, totalSteps }: ProgressIndicatorProps) {
  return (
    <div className="w-full px-4 py-6">
      {/* Mobile: Simple step indicator */}
      <div className="md:hidden flex items-center justify-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-fey-cyan" />
        <span className="text-sm font-medium text-foreground">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-foreground/50">•</span>
        <span className="text-sm text-fey-gold font-semibold">{steps[currentStep - 1]?.label}</span>
      </div>

      {/* Mobile: Progress bar */}
      <div className="md:hidden h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-fey-cyan via-fey-purple to-fey-gold transition-all duration-500 ease-out"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>

      {/* Desktop: Full step indicator */}
      <div className="hidden md:flex items-center justify-between relative">
        {/* Connection line */}
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-secondary" />
        <div
          className="absolute top-6 left-0 h-0.5 bg-gradient-to-r from-fey-cyan via-fey-purple to-fey-gold transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        />

        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep
          const Icon = step.icon

          return (
            <div key={step.label} className="flex flex-col items-center relative z-10">
              <div
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-2",
                  isCompleted && "bg-fey-cyan border-fey-cyan text-accent-foreground",
                  isCurrent && "bg-card border-fey-gold text-fey-gold shadow-lg shadow-fey-gold/20",
                  !isCompleted && !isCurrent && "bg-secondary border-secondary text-foreground/60",
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span
                className={cn(
                  "mt-2 text-sm font-medium transition-colors",
                  isCurrent && "text-fey-gold",
                  isCompleted && "text-fey-cyan",
                  !isCompleted && !isCurrent && "text-foreground/70",
                )}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
