"use server"

import { db } from "@/lib/db"
import { mapLocations } from "@/lib/db/schema"
import { auth } from "@/auth"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export type MapLocation = typeof mapLocations.$inferSelect
export type NewMapLocation = Omit<typeof mapLocations.$inferInsert, "id" | "userId" | "createdAt">

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Not authenticated")
  }
  return session.user.id
}

export async function fetchUserLocations(): Promise<MapLocation[]> {
  const userId = await requireAuth()

  return db
    .select()
    .from(mapLocations)
    .where(eq(mapLocations.userId, userId))
    .orderBy(mapLocations.name)
}

export async function getLocationsByCampaign(campaignId: string): Promise<MapLocation[]> {
  const userId = await requireAuth()

  return db
    .select()
    .from(mapLocations)
    .where(and(eq(mapLocations.campaignId, campaignId), eq(mapLocations.userId, userId)))
    .orderBy(mapLocations.name)
}

export async function getLocation(id: string): Promise<MapLocation | undefined> {
  const userId = await requireAuth()

  const [location] = await db
    .select()
    .from(mapLocations)
    .where(and(eq(mapLocations.id, id), eq(mapLocations.userId, userId)))
    .limit(1)

  return location
}

export async function createLocation(data: NewMapLocation): Promise<MapLocation> {
  const userId = await requireAuth()

  const [location] = await db
    .insert(mapLocations)
    .values({
      ...data,
      userId,
    })
    .returning()

  revalidatePath("/world-map")
  return location
}

export async function updateLocation(id: string, data: Partial<NewMapLocation>): Promise<MapLocation> {
  const userId = await requireAuth()

  const [location] = await db
    .update(mapLocations)
    .set(data)
    .where(and(eq(mapLocations.id, id), eq(mapLocations.userId, userId)))
    .returning()

  if (!location) {
    throw new Error("Location not found")
  }

  revalidatePath("/world-map")
  return location
}

export async function deleteLocation(id: string): Promise<void> {
  const userId = await requireAuth()

  await db
    .delete(mapLocations)
    .where(and(eq(mapLocations.id, id), eq(mapLocations.userId, userId)))

  revalidatePath("/world-map")
}

export async function toggleLocationVisited(id: string): Promise<MapLocation> {
  const userId = await requireAuth()

  const [current] = await db
    .select()
    .from(mapLocations)
    .where(and(eq(mapLocations.id, id), eq(mapLocations.userId, userId)))
    .limit(1)

  if (!current) {
    throw new Error("Location not found")
  }

  const [location] = await db
    .update(mapLocations)
    .set({ visited: !current.visited })
    .where(eq(mapLocations.id, id))
    .returning()

  revalidatePath("/world-map")
  return location
}
