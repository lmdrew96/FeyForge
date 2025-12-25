"use client"

import { Anvil } from "lucide-react"

interface FeyForgeLogoProps {
  size?: "sm" | "md" | "lg"
  showText?: boolean
  collapsed?: boolean
}

export function FeyForgeLogo({ size = "md", showText = true, collapsed = false }: FeyForgeLogoProps) {
  const sizes = {
    sm: { icon: "h-5 w-5", container: "p-1.5", text: "text-lg" },
    md: { icon: "h-7 w-7", container: "p-2", text: "text-2xl" },
    lg: { icon: "h-10 w-10", container: "p-3", text: "text-4xl" },
  }

  return (
    <div className="flex items-center gap-3 group">
      {/* Magical Anvil Icon with ethereal glow and sparkles */}
      <div className="relative shrink-0">
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-magic-cyan/40 to-teal/20 blur-md group-hover:blur-lg transition-all duration-300" />

        {/* Main anvil container */}
        <div
          className={`${sizes[size].container} rounded-2xl bg-gradient-to-br from-magic-cyan/20 via-teal/15 to-deep-indigo/20 border border-magic-cyan/40 relative overflow-hidden`}
        >
          {/* Inner shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Anvil icon */}
          <Anvil
            className={`${sizes[size].icon} text-primary relative z-10 drop-shadow-[0_0_8px_#42e2ed88] group-hover:drop-shadow-[0_0_12px_#42e2edcc] transition-all duration-300`}
          />
        </div>

        {/* Floating sparkle particles */}
        <div
          className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-magic-cyan animate-sparkle"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 rounded-full bg-copper-bright animate-sparkle"
          style={{ animationDelay: "0.5s" }}
        />
        <div
          className="absolute top-1/2 -right-2 w-1 h-1 rounded-full bg-lavender animate-sparkle"
          style={{ animationDelay: "1s" }}
        />
      </div>

      {/* Text */}
      {showText && !collapsed && (
        <div className="flex flex-col min-w-0">
          <span className={`font-bold text-gold-gradient font-serif ${sizes[size].text} truncate tracking-wide`}>
            FeyForge
          </span>
        </div>
      )}
    </div>
  )
}
