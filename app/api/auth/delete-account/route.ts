import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { db, isDatabaseConfigured } from "@/lib/db"
import {
  characters,
  campaigns,
  npcs,
  mapLocations,
  gameSessions,
  wikiEntries,
} from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function DELETE() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    // Delete app data in FK order
    await db.delete(wikiEntries).where(eq(wikiEntries.userId, userId))
    await db.delete(gameSessions).where(eq(gameSessions.userId, userId))
    await db.delete(npcs).where(eq(npcs.userId, userId))
    await db.delete(mapLocations).where(eq(mapLocations.userId, userId))
    await db.delete(characters).where(eq(characters.userId, userId))
    await db.delete(campaigns).where(eq(campaigns.userId, userId))

    // Delete the Clerk user (handles auth/identity cleanup)
    const clerk = await clerkClient()
    await clerk.users.deleteUser(userId)

    return NextResponse.json({ success: true, message: "Account deleted successfully" })
  } catch (error) {
    console.error("[FeyForge] Account deletion error:", error)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}
