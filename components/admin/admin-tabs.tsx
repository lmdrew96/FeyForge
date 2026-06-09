"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

// Slim sub-nav shared across the admin pages (each page owns its own AppShell, so
// this renders just inside the page content rather than in the admin layout).
const TABS = [
  { href: "/admin/review", label: "Audio Review" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/storage", label: "Storage" },
]

export function AdminTabs() {
  const pathname = usePathname()
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90"
            style={{
              background: active ? "#3a2e5a" : "#16131f",
              border: `1px solid ${active ? "#7b68c8" : "#2a2438"}`,
              color: active ? "#e8e0f8" : "#a99fc4",
            }}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
