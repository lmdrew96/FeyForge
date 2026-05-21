import { redirect } from "next/navigation"
export default function LegacyCreateCharacter() {
  redirect("/characters/new")
}
