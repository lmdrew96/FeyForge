import { NextResponse } from "next/server"
import { db, isDatabaseConfigured } from "@/lib/db"
import { users, verificationTokens } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import crypto from "crypto"
import { sendPasswordResetEmail } from "@/lib/email"

// Generate a secure token
function generateToken() {
  return crypto.randomBytes(32).toString("hex")
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    if (!isDatabaseConfigured()) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      )
    }

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    // Always return success to prevent email enumeration
    // But only actually create token if user exists
    if (existingUser) {
      // Generate password reset token
      const token = generateToken()
      const expires = new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 hour

      // Store the token (using verification_tokens table with a prefix to distinguish)
      await db.insert(verificationTokens).values({
        identifier: `reset:${email.toLowerCase()}`,
        token,
        expires,
      })

      await sendPasswordResetEmail(email.toLowerCase(), token)
    }

    // Always return success to prevent email enumeration attacks
    return NextResponse.json({
      success: true,
      message:
        "If an account exists with this email, a password reset link has been sent.",
    })
  } catch (error) {
    console.error("[FeyForge] Password reset error:", error)
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    )
  }
}
