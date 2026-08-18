"use client"

import { useRouter } from "next/navigation"
import { AppTopbar } from "@/components/app/app-topbar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { clearSession, getEmail } from "@/lib/api"

export default function SettingsPage() {
  const router = useRouter()
  const email = getEmail()

  function signOut() {
    clearSession()
    router.replace("/login")
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar title="Settings" description="Your ReconAI account" />

      <div className="flex-1 space-y-6 px-6 py-6">
        <Card className="max-w-lg gap-4 p-6">
          <div>
            <p className="text-lg font-semibold text-foreground">Account</p>
            <p className="mt-1 text-sm text-muted-foreground">Signed in as {email ?? "…"}</p>
          </div>
          <div className="space-y-1 border-t border-border pt-4">
            <p className="text-sm font-medium text-muted-foreground">Email</p>
            <p className="font-medium text-foreground">{email ?? "—"}</p>
          </div>
          <Button variant="outline" className="w-fit font-medium" onClick={signOut}>
            Sign out
          </Button>
        </Card>
      </div>
    </div>
  )
}