"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Shield, ShieldOff, Users } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { toast } from "sonner"

export default function AdminUsersPage() {
  const users = useQuery(api.users.listAllUsers)
  const setRole = useMutation(api.users.setRole)

  const handleSetRole = async (clerkUserId: string, role: "admin" | "user") => {
    try {
      await setRole({ targetClerkUserId: clerkUserId, role })
      toast.success(`Role updated to ${role}`)
    } catch {
      toast.error("Failed to update role")
    }
  }

  return (
    <AppShell>
      <div className="px-6 py-8 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] mb-1" style={{ color: "#7b68c8" }}>Admin</p>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-cinzel)", color: "#e8e0f8" }}>
            Users
          </h1>
          <p className="text-sm" style={{ color: "#5a5272" }}>
            Manage roles for FeyForge accounts
          </p>
        </div>

        {/* User list */}
        {users === undefined ? (
          <p className="text-sm" style={{ color: "#5a5272" }}>Loading…</p>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={32} className="mx-auto mb-3 opacity-20" style={{ color: "#5a5272" }} />
            <p className="text-sm" style={{ color: "#5a5272" }}>No users found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user._id}
                className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl"
                style={{ background: "#16131f", border: "1px solid #2a2438" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm truncate" style={{ color: "#e8e0f8" }}>
                      {user.clerkUserId}
                    </p>
                    {user.role === "admin" && (
                      <span
                        className="shrink-0 text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: "#3a2e5a", color: "#7b68c8" }}
                      >
                        admin
                      </span>
                    )}
                    {user.isPremium && (
                      <span
                        className="shrink-0 text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: "#2d3a1a", color: "#86efac" }}
                      >
                        premium
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {user.role === "admin" ? (
                    <button
                      onClick={() => handleSetRole(user.clerkUserId, "user")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
                      style={{ background: "#2a1818", border: "1px solid #5a2d2d", color: "#f87171" }}
                    >
                      <ShieldOff size={12} />
                      Remove Admin
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSetRole(user.clerkUserId, "admin")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
                      style={{ background: "#1e1a2e", border: "1px solid #3a2e5a", color: "#7b68c8" }}
                    >
                      <Shield size={12} />
                      Make Admin
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs" style={{ color: "#3a3350" }}>
          To grant yourself admin access initially, set <code className="text-[#5a5272]">role: &quot;admin&quot;</code> directly in the Convex dashboard.
        </p>
      </div>
    </AppShell>
  )
}
