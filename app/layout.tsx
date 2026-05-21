import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Cinzel, Cinzel_Decorative } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import { ClerkProvider } from "@clerk/nextjs"
import { ConvexClientProvider } from "@/components/providers/convex-client-provider"
import { DataLoader } from "@/components/providers/data-loader"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel" })
const cinzelDecorative = Cinzel_Decorative({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-cinzel-decorative",
})

export const metadata: Metadata = {
  title: "FeyForge",
  description: "A live D&D companion where the DM conducts the session.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} ${cinzel.variable} ${cinzelDecorative.variable} antialiased`}
        /* data-scene is set here — Phase 3 will drive this from Convex */
        data-scene=""
      >
        <ClerkProvider>
          <ConvexClientProvider>
            <DataLoader />
            {children}
            <Toaster richColors position="top-center" />
          </ConvexClientProvider>
        </ClerkProvider>
        <Analytics />
      </body>
    </html>
  )
}
