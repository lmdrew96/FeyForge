import { NextResponse } from "next/server"
import { db, isDatabaseConfigured } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json(
        { error: "Database not configured. Please set DATABASE_URL." },
        { status: 503 }
      )
    }
    
    const body = await request.json()
    const { email, password, displayName } = body

    if (!email || !password || !displayName) {
      return NextResponse.json(
        { error: "Email, password, and display name are required" },
        { status: 400 }
      )
    }

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        displayName,
        name: displayName,
        hashedPassword,
        emailVerified: null,
      })
      .returning()

    return NextResponse.json(
      {
        user: {
          id: newUser.id,
          email: newUser.email,
          displayName: newUser.displayName,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json(
      { error: "An error occurred during signup" },
      { status: 500 }
    )
  }
}
