"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Bell, LogOut } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { clearSession, getEmail } from "@/lib/api"

export function AppTopbar({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  const router = useRouter()
  const email = getEmail()

  function signOut() {
    clearSession()
    router.replace("/login")
  }

  return (
    <header className="flex flex-col gap-4 border-b border-border bg-background px-6 py-5 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <Button variant="outline" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          title="Sign out"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary text-sm font-medium text-primary-foreground">
            {email ? email[0].toUpperCase() : "AC"}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}