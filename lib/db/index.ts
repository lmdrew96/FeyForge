import { neon } from "@neondatabase/serverless"
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http"
import * as schema from "./schema"

// Create database connection only if DATABASE_URL is available
// This allows the app to build even without the env var set
function createDb(): NeonHttpDatabase<typeof schema> | null {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.warn(
      "DATABASE_URL is not set. Database features will not work. " +
      "Please set DATABASE_URL in your .env.local file."
    )
    return null
  }
  const sql = neon(url)
  return drizzle(sql, { schema })
}

const _db = createDb()

// Export the db, but it may be null if DATABASE_URL isn't configured
export const db = _db!

// Helper to check if database is configured
export function isDatabaseConfigured(): boolean {
  return _db !== null
}

export type Database = NeonHttpDatabase<typeof schema>
