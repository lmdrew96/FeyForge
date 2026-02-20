"use client"

import { useEffect, useState } from "react"

function FloatingParticle({
  delay,
  size,
  x,
  y,
  color,
}: {
  delay: number
  size: number
  x: number
  y: number
  color: string
}) {
  return (
    <div
      className="particle absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        top: `${y}%`,
        background: color,
        boxShadow: `0 0 ${size * 2}px ${color}, 0 0 ${size * 4}px ${color}40`,
        animationDelay: `${delay}s`,
        animationDuration: `${6 + Math.random() * 6}s`,
      }}
    />
  )
}

function RuneSymbol({
  char,
  delay,
  x,
  y,
}: {
  char: string
  delay: number
  x: number
  y: number
}) {
  return (
    <div
      className="particle-slow absolute pointer-events-none text-fey-cyan/20 dark:text-fey-cyan/15 text-2xl md:text-4xl select-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        animationDelay: `${delay}s`,
      }}
    >
      {char}
    </div>
  )
}

const RUNES = [
  "\u16A0",
  "\u16A2",
  "\u16A6",
  "\u16B1",
  "\u16B7",
  "\u16C1",
  "\u16C7",
  "\u16D2",
  "\u16D6",
  "\u16DA",
]

export default function HomePage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Animated gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, var(--fey-forest) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, var(--fey-indigo) 0%, transparent 40%), radial-gradient(ellipse at 50% 80%, var(--fey-cyan) 0%, transparent 35%)",
          opacity: 0.08,
        }}
      />

      {/* Floating particles */}
      {mounted && (
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <FloatingParticle
              key={`p-${i}`}
              delay={i * 0.7}
              size={2 + Math.random() * 4}
              x={Math.random() * 100}
              y={Math.random() * 100}
              color={
                i % 3 === 0
                  ? "var(--fey-cyan)"
                  : i % 3 === 1
                    ? "var(--fey-gold)"
                    : "var(--fey-purple)"
              }
            />
          ))}

          {/* Floating runes */}
          {RUNES.map((rune, i) => (
            <RuneSymbol
              key={`r-${i}`}
              char={rune}
              delay={i * 1.3}
              x={5 + Math.random() * 90}
              y={5 + Math.random() * 90}
            />
          ))}
        </div>
      )}

      {/* Main glass card */}
      <div
        className={`relative z-10 mx-4 w-full max-w-2xl transition-all duration-1000 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      >
        {/* Outer glow ring */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-fey-cyan/30 via-fey-purple/20 to-fey-gold/30 blur-sm" />

        {/* Glass panel */}
        <div className="relative rounded-2xl border border-white/10 dark:border-white/[0.08] bg-white/30 dark:bg-white/[0.04] backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Inner gradient shimmer */}
          <div className="absolute inset-0 bg-gradient-to-br from-fey-cyan/5 via-transparent to-fey-gold/5 pointer-events-none" />

          <div className="relative px-8 py-12 md:px-16 md:py-20 text-center">
            {/* Anvil / Forge icon */}
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <div className="particle-glow absolute -inset-4 rounded-full bg-fey-cyan/10" />
                <svg
                  width="72"
                  height="72"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-fey-gold relative"
                >
                  {/* Hammer */}
                  <path d="M15 12l-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 010-3L12 9" />
                  <path d="M17.64 15L22 10.64" />
                  <path d="M20.91 11.7l-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 00-3.94-1.64H9l.92.82A6.18 6.18 0 0112 8.4v1.56l2 2h2.47l2.26 1.91" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="font-[family-name:var(--font-cinzel-decorative)] text-3xl md:text-5xl font-bold bg-gradient-to-r from-fey-gold via-fey-cyan to-fey-purple bg-clip-text text-transparent mb-4 leading-tight">
              The Forge Slumbers
            </h1>

            {/* Decorative divider */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-fey-cyan/50" />
              <div className="h-1.5 w-1.5 rotate-45 bg-fey-gold/60" />
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-fey-cyan/50" />
            </div>

            {/* Description */}
            <p className="font-sans text-base md:text-lg text-muted-foreground max-w-md mx-auto mb-4 leading-relaxed">
              Our enchanters are weaving new spells and forging powerful features
              within the Fey realm.
            </p>
            <p className="font-sans text-sm text-muted-foreground/70 mb-10">
              This area of the forge is not yet ready for adventurers.
              <br />
              Check back soon &mdash; great magic takes time.
            </p>

            {/* Progress / status indicator */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 dark:bg-white/[0.06] border border-white/10 dark:border-white/[0.06] backdrop-blur-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fey-cyan opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-fey-cyan" />
                </span>
                <span className="text-sm text-fey-cyan font-medium tracking-wide">
                  Enchantment in Progress
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom reflection */}
        <div className="absolute -bottom-4 left-[10%] right-[10%] h-8 rounded-full bg-fey-cyan/5 blur-2xl" />
      </div>
    </div>
  )
}
