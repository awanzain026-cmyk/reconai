"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, TriangleAlert } from "lucide-react"
import { AppTopbar } from "@/components/app/app-topbar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { api, ApiError, getErrorMessage, clearSession, getEmail } from "@/lib/api"

export default function SettingsPage() {
  const router = useRouter()
  const email = getEmail()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function signOut() {
    clearSession()
    router.replace("/login")
  }

  async function handleDeleteAll() {
    setDeleting(true)
    setError(null)
    try {
      await api.deleteAllData()
      router.replace("/dashboard")
    } catch (err) {
      setError(getErrorMessage(err))
      setDeleting(false)
      setConfirming(false)
    }
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

        <Card className="max-w-lg gap-4 p-6">
          <div>
            <p className="text-lg font-semibold text-destructive">Danger zone</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Delete every upload, match and exception for this account. Your account stays — you
              can start a fresh reconciliation anytime.
            </p>
          </div>
          {error ? (
            <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}
          {confirming ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-destructive">
                Delete ALL reconciliation data?
              </span>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={handleDeleteAll}
                className="font-medium"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Deleting…
                  </>
                ) : (
                  "Yes, delete everything"
                )}
              </Button>
              <Button
                variant="ghost"
                disabled={deleting}
                onClick={() => setConfirming(false)}
                className="font-medium"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="destructive"
              className="w-fit font-medium"
              onClick={() => setConfirming(true)}
            >
              Delete all data
            </Button>
          )}
        </Card>
      </div>
    </div>
  )
}