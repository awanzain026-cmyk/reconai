"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, UploadCloud, TriangleAlert, Settings, Users2 } from "lucide-react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"
import { exceptions } from "@/lib/mock-data"

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/dashboard", icon: Users2 },
  { label: "Upload", href: "/upload", icon: UploadCloud },
  { label: "Exceptions", href: "/exceptions", icon: TriangleAlert, badgeKey: "exceptions" as const },
]

export function AppSidebar() {
  const pathname = usePathname()
  const openExceptions = exceptions.filter((e) => e.status === "open").length

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Link href="/" aria-label="ReconAI home">
          <Logo
            className="text-sidebar-foreground"
            wordmarkClassName="text-sidebar-foreground"
          />
        </Link>
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-1 px-3 py-5">
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </span>
              {item.badgeKey === "exceptions" && openExceptions > 0 ? (
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                  {openExceptions}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
