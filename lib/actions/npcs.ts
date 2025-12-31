"use server"

import { db } from "@/lib/db"
import { npcs } from "@/lib/db/schema"
import { auth } from "@/auth"
import { eq, and, ilike, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export type NPC = typeof npcs.$inferSelect
export type NewNPC = Omit<typeof npcs.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Not authenticated")
  }
  return session.user.id
}

export async function fetchUserNPCs(): Promise<NPC[]> {
  const userId = await requireAuth()

  return db
    .select()
    .from(npcs)
    .where(eq(npcs.userId, userId))
    .orderBy(npcs.name)
}

export async function getNPCsByCampaign(campaignId: string): Promise<NPC[]> {
  const userId = await requireAuth()

  return db
    .select()
    .from(npcs)
    .where(and(eq(npcs.campaignId, campaignId), eq(npcs.userId, userId)))
    .orderBy(npcs.name)
}

export async function getNPC(id: string): Promise<NPC | undefined> {
  const userId = await requireAuth()

  const [npc] = await db
    .select()
    .from(npcs)
    .where(and(eq(npcs.id, id), eq(npcs.userId, userId)))
    .limit(1)

  return npc
}

export async function searchNPCs(query: string, campaignId?: string): Promise<NPC[]> {
  const userId = await requireAuth()

  const baseCondition = eq(npcs.userId, userId)
  const searchCondition = or(
    ilike(npcs.name, `%${query}%`),
    ilike(npcs.occupation, `%${query}%`),
    ilike(npcs.location, `%${query}%`)
  )

  if (campaignId) {
    return db
      .select()
      .from(npcs)
      .where(and(baseCondition, eq(npcs.campaignId, campaignId), searchCondition))
      .orderBy(npcs.name)
  }

  return db
    .select()
    .from(npcs)
    .where(and(baseCondition, searchCondition))
    .orderBy(npcs.name)
}

export async function createNPC(data: NewNPC): Promise<NPC> {
  const userId = await requireAuth()

  const [npc] = await db
    .insert(npcs)
    .values({
      ...data,
      userId,
    })
    .returning()

  revalidatePath("/npcs")
  return npc
}

export async function updateNPC(id: string, data: Partial<NewNPC>): Promise<NPC> {
  const userId = await requireAuth()

  const [npc] = await db
    .update(npcs)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(npcs.id, id), eq(npcs.userId, userId)))
    .returning()

  if (!npc) {
    throw new Error("NPC not found")
  }

  revalidatePath("/npcs")
  revalidatePath(`/npcs/${id}`)
  return npc
}

export async function deleteNPC(id: string): Promise<void> {
  const userId = await requireAuth()

  await db
    .delete(npcs)
    .where(and(eq(npcs.id, id), eq(npcs.userId, userId)))

  revalidatePath("/npcs")
}
