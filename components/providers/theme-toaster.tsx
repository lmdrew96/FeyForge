"use client"

import { useTheme } from "next-themes"
import { Toaster } from "sonner"

export function ThemeToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      richColors
      position="top-center"
      theme={resolvedTheme === "light" ? "light" : "dark"}
    />
  )
}
