"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = useQuery(api.users.getMe)
  const router = useRouter()

  useEffect(() => {
    if (me === null) {
      router.replace("/dashboard")
      return
    }
    if (me !== undefined && me.role !== "admin") {
      router.replace("/dashboard")
    }
  }, [me, router])

  if (me === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d14" }}>
        <p className="text-sm" style={{ color: "#5a5272" }}>Loading…</p>
      </div>
    )
  }

  if (me?.role !== "admin") return null

  return <>{children}</>
}
