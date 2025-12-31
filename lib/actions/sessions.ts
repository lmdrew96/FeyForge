"use server"

import { db } from "@/lib/db"
import { gameSessions, sessionNotes, plotThreads } from "@/lib/db/schema"
import { auth } from "@/auth"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export type GameSession = typeof gameSessions.$inferSelect
export type SessionNote = typeof sessionNotes.$inferSelect
export type PlotThread = typeof plotThreads.$inferSelect
export type NewGameSession = Omit<typeof gameSessions.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">
export type NewSessionNote = Omit<typeof sessionNotes.$inferInsert, "id" | "timestamp">
export type NewPlotThread = Omit<typeof plotThreads.$inferInsert, "id" | "userId" | "createdAt">

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Not authenticated")
  }
  return session.user.id
}

// Game Sessions CRUD
export async function fetchUserSessions(): Promise<GameSession[]> {
  const userId = await requireAuth()

  return db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.userId, userId))
    .orderBy(gameSessions.number)
}

export async function getSessionsByCampaign(campaignId: string): Promise<GameSession[]> {
  const userId = await requireAuth()

  return db
    .select()
    .from(gameSessions)
    .where(and(eq(gameSessions.campaignId, campaignId), eq(gameSessions.userId, userId)))
    .orderBy(gameSessions.number)
}

export async function getSession(id: string): Promise<GameSession | undefined> {
  const userId = await requireAuth()

  const [session] = await db
    .select()
    .from(gameSessions)
    .where(and(eq(gameSessions.id, id), eq(gameSessions.userId, userId)))
    .limit(1)

  return session
}

export async function createSession(data: NewGameSession): Promise<GameSession> {
  const userId = await requireAuth()

  const [session] = await db
    .insert(gameSessions)
    .values({
      ...data,
      userId,
    })
    .returning()

  revalidatePath("/sessions")
  return session
}

export async function updateSession(id: string, data: Partial<NewGameSession>): Promise<GameSession> {
  const userId = await requireAuth()

  const [session] = await db
    .update(gameSessions)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(gameSessions.id, id), eq(gameSessions.userId, userId)))
    .returning()

  if (!session) {
    throw new Error("Session not found")
  }

  revalidatePath("/sessions")
  revalidatePath(`/sessions/${id}`)
  return session
}

export async function deleteSession(id: string): Promise<void> {
  const userId = await requireAuth()

  await db
    .delete(gameSessions)
    .where(and(eq(gameSessions.id, id), eq(gameSessions.userId, userId)))

  revalidatePath("/sessions")
}

// Session Notes CRUD
export async function getSessionNotes(sessionId: string): Promise<SessionNote[]> {
  await requireAuth()

  return db
    .select()
    .from(sessionNotes)
    .where(eq(sessionNotes.sessionId, sessionId))
    .orderBy(sessionNotes.timestamp)
}

export async function addSessionNote(data: NewSessionNote): Promise<SessionNote> {
  await requireAuth()

  const [note] = await db
    .insert(sessionNotes)
    .values(data)
    .returning()

  revalidatePath(`/sessions/${data.sessionId}`)
  return note
}

export async function deleteSessionNote(id: string): Promise<void> {
  await requireAuth()

  await db
    .delete(sessionNotes)
    .where(eq(sessionNotes.id, id))
}

// Plot Threads CRUD
export async function fetchUserPlotThreads(): Promise<PlotThread[]> {
  const userId = await requireAuth()

  return db
    .select()
    .from(plotThreads)
    .where(eq(plotThreads.userId, userId))
    .orderBy(plotThreads.createdAt)
}

export async function getPlotThreadsByCampaign(campaignId: string): Promise<PlotThread[]> {
  const userId = await requireAuth()

  return db
    .select()
    .from(plotThreads)
    .where(and(eq(plotThreads.campaignId, campaignId), eq(plotThreads.userId, userId)))
    .orderBy(plotThreads.createdAt)
}

export async function createPlotThread(data: NewPlotThread): Promise<PlotThread> {
  const userId = await requireAuth()

  const [thread] = await db
    .insert(plotThreads)
    .values({
      ...data,
      userId,
    })
    .returning()

  revalidatePath("/sessions")
  return thread
}

export async function updatePlotThread(id: string, data: Partial<NewPlotThread>): Promise<PlotThread> {
  const userId = await requireAuth()

  const [thread] = await db
    .update(plotThreads)
    .set(data)
    .where(and(eq(plotThreads.id, id), eq(plotThreads.userId, userId)))
    .returning()

  if (!thread) {
    throw new Error("Plot thread not found")
  }

  revalidatePath("/sessions")
  return thread
}

export async function deletePlotThread(id: string): Promise<void> {
  const userId = await requireAuth()

  await db
    .delete(plotThreads)
    .where(and(eq(plotThreads.id, id), eq(plotThreads.userId, userId)))

  revalidatePath("/sessions")
}
