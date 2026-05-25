"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Sun, Moon, Monitor } from "lucide-react"
import { cn } from "@/lib/utils"

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
] as const

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  return (
    <div
      className={cn("flex items-center rounded-md p-0.5 gap-0.5", className)}
      style={{ background: "var(--scene-bg)", border: "1px solid var(--scene-border)" }}
    >
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className="flex items-center justify-center w-7 h-6 rounded transition-colors"
          style={{
            background: theme === value ? "var(--scene-accent)" : "transparent",
            color: theme === value ? "var(--scene-bg)" : "var(--scene-text-muted)",
          }}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  )
}
