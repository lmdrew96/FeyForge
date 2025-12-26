import type React from "react"
import type { Metadata, Viewport } from "next"

import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import {
  Inter,
  Cinzel,
  Acme as V0_Font_Acme,
  Source_Code_Pro as V0_Font_Source_Code_Pro,
  Abril_Fatface as V0_Font_Abril_Fatface,
} from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"

// Initialize fonts
const _acme = V0_Font_Acme({ subsets: ["latin"], weight: ["400"] })
const _sourceCodePro = V0_Font_Source_Code_Pro({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
})
const _abrilFatface = V0_Font_Abril_Fatface({ subsets: ["latin"], weight: ["400"] })

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
})

export const metadata: Metadata = {
  title: "FeyForge | Step into the Portal",
  description:
    "The ultimate D&D Campaign Management Suite with AI-powered DM assistance - forge your adventures with fey magic",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#0D1F1A",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${cinzel.variable} font-sans antialiased h-full`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
