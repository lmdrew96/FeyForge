"use server"

import { db } from "@/lib/db"
import { campaigns } from "@/lib/db/schema"
import { requireAuth, getAuthUserId } from "@/lib/auth"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export type Campaign = typeof campaigns.$inferSelect
export type NewCampaign = Omit<
  typeof campaigns.$inferInsert,
  "id" | "userId" | "createdAt" | "updatedAt"
>



export async function fetchUserCampaigns(): Promise<Campaign[]> {
  const userId = await getAuthUserId()
  if (!userId) return []

  return db
    .select()
    .from(campaigns)
    .where(eq(campaigns.userId, userId))
    .orderBy(campaigns.updatedAt)
}

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  const userId = await getAuthUserId()
  if (!userId) return undefined

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))
    .limit(1)

  return campaign
}

export async function createCampaign(data: NewCampaign): Promise<Campaign> {
  const userId = await requireAuth()

  const [campaign] = await db
    .insert(campaigns)
    .values({
      ...data,
      userId,
    })
    .returning()

  revalidatePath("/")
  return campaign
}

export async function updateCampaign(
  id: string,
  data: Partial<NewCampaign>
): Promise<Campaign> {
  const userId = await requireAuth()

  const [campaign] = await db
    .update(campaigns)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))
    .returning()

  if (!campaign) {
    throw new Error("Campaign not found")
  }

  revalidatePath("/")
  return campaign
}

export async function deleteCampaign(id: string): Promise<void> {
  const userId = await requireAuth()

  await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))

  revalidatePath("/")
}
