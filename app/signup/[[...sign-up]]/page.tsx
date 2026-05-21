import { SignUp } from "@clerk/nextjs"

export default function SignupPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--scene-bg)" }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1
            className="text-3xl font-bold tracking-widest uppercase"
            style={{ fontFamily: "var(--font-display)", color: "var(--scene-accent)" }}
          >
            FeyForge
          </h1>
        </div>
        <SignUp />
      </div>
    </div>
  )
}
