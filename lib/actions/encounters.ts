"use server"

import { db } from "@/lib/db"
import { savedEncounters } from "@/lib/db/schema"
import { auth } from "@/auth"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"

type SavedEncounterRow = typeof savedEncounters.$inferSelect

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Not authenticated")
  }
  return session.user.id
}

async function getAuthUserId(): Promise<string | null> {
  const session = await auth()
  return session?.user?.id ?? null
}

export async function fetchSavedEncounters(): Promise<SavedEncounterRow[]> {
  const userId = await getAuthUserId()
  if (!userId) return []

  return db
    .select()
    .from(savedEncounters)
    .where(eq(savedEncounters.userId, userId))
    .orderBy(savedEncounters.createdAt)
}

export async function createSavedEncounter(data: {
  name: string
  combatants: SavedEncounterRow["combatants"]
  round: number
  campaignId?: string | null
}): Promise<SavedEncounterRow> {
  const userId = await requireAuth()

  const [encounter] = await db
    .insert(savedEncounters)
    .values({
      userId,
      name: data.name,
      combatants: data.combatants,
      round: data.round,
      campaignId: data.campaignId ?? null,
    })
    .returning()

  revalidatePath("/combat")
  return encounter
}

export async function deleteSavedEncounter(id: string): Promise<void> {
  const userId = await requireAuth()

  await db
    .delete(savedEncounters)
    .where(and(eq(savedEncounters.id, id), eq(savedEncounters.userId, userId)))

  revalidatePath("/combat")
}
