"use server"

import { db } from "@/lib/db"
import { characters, characterProperties } from "@/lib/db/schema"
import { auth } from "@/auth"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export type Character = typeof characters.$inferSelect
export type CharacterProperty = typeof characterProperties.$inferSelect
export type NewCharacter = Omit<typeof characters.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">
export type NewCharacterProperty = Omit<typeof characterProperties.$inferInsert, "id" | "createdAt" | "updatedAt">

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Not authenticated")
  }
  return session.user.id
}

// Returns null if not authenticated (for read operations)
async function getAuthUserId(): Promise<string | null> {
  const session = await auth()
  return session?.user?.id ?? null
}

// Character CRUD
export async function fetchUserCharacters(): Promise<Character[]> {
  const userId = await getAuthUserId()
  if (!userId) return []

  return db
    .select()
    .from(characters)
    .where(eq(characters.userId, userId))
    .orderBy(characters.updatedAt)
}

export async function getCharactersByCampaign(campaignId: string): Promise<Character[]> {
  const userId = await getAuthUserId()
  if (!userId) return []

  return db
    .select()
    .from(characters)
    .where(and(eq(characters.campaignId, campaignId), eq(characters.userId, userId)))
    .orderBy(characters.name)
}

export async function getCharacter(id: string): Promise<Character | undefined> {
  const userId = await getAuthUserId()
  if (!userId) return undefined

  const [character] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .limit(1)

  return character
}

export async function createCharacter(data: NewCharacter): Promise<Character> {
  const userId = await requireAuth()

  const [character] = await db
    .insert(characters)
    .values({
      ...data,
      userId,
    })
    .returning()

  revalidatePath("/characters")
  return character
}

export async function updateCharacter(id: string, data: Partial<NewCharacter>): Promise<Character> {
  const userId = await requireAuth()

  const [character] = await db
    .update(characters)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .returning()

  if (!character) {
    throw new Error("Character not found")
  }

  revalidatePath("/characters")
  revalidatePath(`/characters/${id}`)
  return character
}

export async function deleteCharacter(id: string): Promise<void> {
  const userId = await requireAuth()

  await db
    .delete(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))

  revalidatePath("/characters")
}

// Character Properties CRUD
export async function getCharacterProperties(characterId: string): Promise<CharacterProperty[]> {
  await requireAuth()

  return db
    .select()
    .from(characterProperties)
    .where(eq(characterProperties.characterId, characterId))
    .orderBy(characterProperties.orderIndex)
}

export async function addCharacterProperty(data: NewCharacterProperty): Promise<CharacterProperty> {
  await requireAuth()

  const [property] = await db
    .insert(characterProperties)
    .values(data)
    .returning()

  revalidatePath(`/characters/${data.characterId}`)
  return property
}

export async function updateCharacterProperty(
  id: string,
  data: Partial<NewCharacterProperty>
): Promise<CharacterProperty> {
  await requireAuth()

  const [property] = await db
    .update(characterProperties)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(characterProperties.id, id))
    .returning()

  if (!property) {
    throw new Error("Property not found")
  }

  revalidatePath(`/characters/${property.characterId}`)
  return property
}

export async function deleteCharacterProperty(id: string): Promise<void> {
  await requireAuth()

  const [property] = await db
    .select({ characterId: characterProperties.characterId })
    .from(characterProperties)
    .where(eq(characterProperties.id, id))
    .limit(1)

  await db
    .delete(characterProperties)
    .where(eq(characterProperties.id, id))

  if (property) {
    revalidatePath(`/characters/${property.characterId}`)
  }
}
