"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function LegacyReviewPage({ params }: { params: Promise<{ token: string }> }) {
  use(params)
  const router = useRouter()

  useEffect(() => {
    router.replace("/admin/review")
  }, [router])

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d14" }}>
      <p className="text-sm" style={{ color: "#5a5272" }}>Redirecting…</p>
    </main>
  )
}
