import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const { userId } = await auth()
  redirect(userId ? "/dashboard" : "/login")
}
