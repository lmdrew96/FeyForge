"use client"

import { useEffect } from "react"
import { migrateExistingData } from "@/lib/campaign-store"

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Run migration after hydration is complete
    migrateExistingData()
  }, [])

  return <>{children}</>
}
