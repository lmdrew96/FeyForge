import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"

export async function DELETE() {
  try {
    const { userId, getToken } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const convexToken = await getToken({ template: "convex" })
    if (!convexToken) {
      return NextResponse.json({ error: "Could not get Convex token" }, { status: 500 })
    }

    const client = new ConvexHttpClient(
      (process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(/\/$/, "")
    )
    client.setAuth(convexToken)
    await client.mutation(api.admin.deleteAllUserData, {})

    const clerk = await clerkClient()
    await clerk.users.deleteUser(userId)

    return NextResponse.json({ success: true, message: "Account deleted successfully" })
  } catch (error) {
    console.error("[FeyForge] Account deletion error:", error)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}
