"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  History,
  LayoutDashboard,
  Settings,
  TriangleAlert,
  UploadCloud,
} from "lucide-react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useClients } from "@/lib/use-clients"
import { WORKSPACE_CHANGED_EVENT } from "@/lib/workspace-events"

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Upload", href: "/upload", icon: UploadCloud },
  { label: "Exceptions", href: "/exceptions", icon: TriangleAlert },
  { label: "History", href: "/history", icon: History },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { activeId } = useClients()
  const [openExceptions, setOpenExceptions] = useState(0)

  useEffect(() => {
    if (activeId === null) return
    let cancelled = false
    const refresh = () => {
      api
        .getExceptions("open", undefined, activeId)
        .then((items) => {
          if (!cancelled) setOpenExceptions(items.length)
        })
        .catch(() => {
          /* badge is decorative; ignore errors */
        })
    }
    refresh()
    window.addEventListener(WORKSPACE_CHANGED_EVENT, refresh)
    return () => {
      cancelled = true
      window.removeEventListener(WORKSPACE_CHANGED_EVENT, refresh)
    }
  }, [pathname, activeId])

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
              {item.label === "Exceptions" && openExceptions > 0 ? (
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
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            pathname === "/settings"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70",
          )}
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
