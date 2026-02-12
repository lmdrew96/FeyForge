"use server"

import { db } from "@/lib/db"
import { dmConversations } from "@/lib/db/schema"
import { auth } from "@/auth"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"

type DMConversationRow = typeof dmConversations.$inferSelect

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

export async function fetchDMConversations(): Promise<DMConversationRow[]> {
  const userId = await getAuthUserId()
  if (!userId) return []

  return db
    .select()
    .from(dmConversations)
    .where(eq(dmConversations.userId, userId))
    .orderBy(dmConversations.updatedAt)
}

export async function createDMConversation(data: {
  campaignId: string
  title: string
}): Promise<DMConversationRow> {
  const userId = await requireAuth()

  const [conversation] = await db
    .insert(dmConversations)
    .values({
      userId,
      campaignId: data.campaignId,
      title: data.title,
      messages: [],
    })
    .returning()

  revalidatePath("/dm-assistant")
  return conversation
}

export async function updateDMConversation(
  id: string,
  data: {
    title?: string
    messages?: DMConversationRow["messages"]
  }
): Promise<void> {
  const userId = await requireAuth()

  await db
    .update(dmConversations)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(dmConversations.id, id), eq(dmConversations.userId, userId)))
}

export async function deleteDMConversation(id: string): Promise<void> {
  const userId = await requireAuth()

  await db
    .delete(dmConversations)
    .where(and(eq(dmConversations.id, id), eq(dmConversations.userId, userId)))

  revalidatePath("/dm-assistant")
}
