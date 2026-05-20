"use client"

import { SignIn } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { useTheme } from "next-themes"

export function LoginForm() {
  const { resolvedTheme } = useTheme()

  return (
    <SignIn
      appearance={{
        baseTheme: resolvedTheme === "dark" ? dark : undefined,
        elements: {
          rootBox: "w-full max-w-md",
          card: "border border-fey-sage/30 bg-card/80 backdrop-blur-sm shadow-lg rounded-xl",
          headerTitle: "font-display text-foreground",
          headerSubtitle: "text-muted-foreground",
          formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground",
          footerActionLink: "text-fey-cyan hover:text-fey-cyan/80",
          formFieldInput: "bg-background border-input text-foreground",
          formFieldLabel: "text-foreground",
          identityPreviewText: "text-foreground",
          identityPreviewEditButton: "text-fey-cyan",
          socialButtonsIconButton: "border-border hover:bg-muted",
          dividerLine: "bg-border",
          dividerText: "text-muted-foreground",
        },
      }}
    />
  )
}
