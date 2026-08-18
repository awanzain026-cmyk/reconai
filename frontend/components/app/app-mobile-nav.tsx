"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, UploadCloud, TriangleAlert, Settings } from "lucide-react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Upload", href: "/upload", icon: UploadCloud },
  { label: "Exceptions", href: "/exceptions", icon: TriangleAlert },
  { label: "Settings", href: "/settings", icon: Settings },
]

export function AppMobileNav() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col border-b border-border bg-background md:hidden">
      <div className="flex h-14 items-center px-4">
        <Link href="/" aria-label="ReconAI home">
          <Logo className="gap-2" wordmarkClassName="text-base" />
        </Link>
      </div>
      <nav aria-label="Primary" className="flex items-center gap-1 overflow-x-auto border-t border-border px-3 py-2">
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium",
                active ? "bg-secondary text-foreground" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
