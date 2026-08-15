import type { ReactNode } from "react"
import { AppSidebar } from "@/components/app/app-sidebar"
import { AppMobileNav } from "@/components/app/app-mobile-nav"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppMobileNav />
        {children}
      </div>
    </div>
  )
}
