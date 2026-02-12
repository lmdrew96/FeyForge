import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM_EMAIL = process.env.EMAIL_FROM || "FeyForge <noreply@feyforge.adhdesigns.dev>"
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000"

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`

  if (!resend) {
    console.log(`[FeyForge Dev] Password reset link: ${resetUrl}`)
    return
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Reset your FeyForge password",
    html: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #1a2f1a; color: #e8e8e8; border-radius: 12px;">
        <h1 style="color: #ffd700; font-size: 24px; margin-bottom: 16px;">FeyForge</h1>
        <p>You requested a password reset for your FeyForge account.</p>
        <p>Click the link below to set a new password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetUrl}" style="display: inline-block; margin: 24px 0; padding: 12px 24px; background: #4a7c59; color: #e8e8e8; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Reset Password
        </a>
        <p style="font-size: 13px; color: #c0c0c0;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  })
}

export async function sendMagicLinkEmail(email: string, token: string) {
  const magicUrl = `${APP_URL}/api/auth/callback/email?token=${token}&email=${encodeURIComponent(email)}`

  if (!resend) {
    console.log(`[FeyForge Dev] Magic link: ${magicUrl}`)
    return
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Sign in to FeyForge",
    html: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #1a2f1a; color: #e8e8e8; border-radius: 12px;">
        <h1 style="color: #ffd700; font-size: 24px; margin-bottom: 16px;">FeyForge</h1>
        <p>Click the link below to sign in to your FeyForge account. This link expires in <strong>24 hours</strong>.</p>
        <a href="${magicUrl}" style="display: inline-block; margin: 24px 0; padding: 12px 24px; background: #4a7c59; color: #e8e8e8; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Sign In
        </a>
        <p style="font-size: 13px; color: #c0c0c0;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  })
}
