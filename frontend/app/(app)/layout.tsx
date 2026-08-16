"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app/app-sidebar"
import { AppMobileNav } from "@/components/app/app-mobile-nav"
import { getToken } from "@/lib/api"

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    setAuthed(Boolean(getToken()))
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready && !authed) router.replace("/login")
  }, [ready, authed, router])

  if (!ready || !authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading ReconAI…</p>
      </div>
    )
  }

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