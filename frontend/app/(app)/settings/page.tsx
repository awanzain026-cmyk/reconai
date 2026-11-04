"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles, TriangleAlert } from "lucide-react"
import { AppTopbar } from "@/components/app/app-topbar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { api, clearSession, getEmail, getErrorMessage } from "@/lib/api"
import { useClients } from "@/lib/use-clients"
import { setActiveClientId } from "@/lib/client-selection"
import { currency } from "@/lib/format"

export default function SettingsPage() {
  const router = useRouter()
  const email = getEmail()
  const { activeId, activeClient, reload } = useClients()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loadingSample, setLoadingSample] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function signOut() {
    clearSession()
    router.replace("/login")
  }

  async function handleDeleteAll() {
    setDeleting(true)
    setError(null)
    try {
      await api.deleteAllData(activeId)
      await reload()
      setNotice("All reconciliation data for this client was cleared.")
      setConfirming(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  async function handleLoadSample() {
    if (
      !window.confirm(
        "This replaces everything in your workspace with two sample clients (Northwind Trading and Cedar & Co.). Continue?",
      )
    ) {
      return
    }
    setLoadingSample(true)
    setError(null)
    setNotice(null)
    try {
      await api.resetDemoData()
      setActiveClientId(null)
      await reload()
      setNotice("Sample data loaded — two clients with a realistic month of transactions.")
      router.push("/dashboard")
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoadingSample(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar title="Settings" description="Your ReconAI account and workspace" />

      <div className="flex-1 space-y-6 px-6 py-6">
        <Card className="max-w-xl gap-4 p-6">
          <div>
            <p className="text-lg font-semibold text-foreground">Account</p>
            <p className="mt-1 text-sm text-muted-foreground">Signed in as {email ?? "…"}</p>
          </div>
          <div className="space-y-1 border-t border-border pt-4">
            <p className="text-sm font-medium text-muted-foreground">Email</p>
            <p className="font-medium text-foreground">{email ?? "—"}</p>
          </div>
          <div className="space-y-1 border-t border-border pt-4">
            <p className="text-sm font-medium text-muted-foreground">Active client</p>
            {activeClient ? (
              <p className="font-medium text-foreground">
                {activeClient.name}
                {activeClient.code ? ` · ${activeClient.code}` : ""}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {currency.format(activeClient.amount_at_risk)} at risk
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No client selected</p>
            )}
          </div>
          <Button variant="outline" className="w-fit font-medium" onClick={signOut}>
            Sign out
          </Button>
        </Card>

        <Card className="max-w-xl gap-4 p-6">
          <div>
            <p className="text-lg font-semibold text-foreground">Demo &amp; sample data</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Reset the workspace to two realistic sample clients. Useful before a demo — it
              wipes your current data and starts from a clean, convincing story.
            </p>
          </div>
          {notice ? (
            <p className="rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">{notice}</p>
          ) : null}
          <Button
            variant="outline"
            className="w-fit font-medium"
            disabled={loadingSample}
            onClick={handleLoadSample}
          >
            {loadingSample ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading sample data…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Load sample data
              </>
            )}
          </Button>
        </Card>

        <Card className="max-w-xl gap-4 p-6">
          <div>
            <p className="text-lg font-semibold text-destructive">Danger zone</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Delete every upload, match, exception and run for{" "}
              <span className="font-medium text-foreground">{activeClient?.name ?? "this client"}</span>.
              The client and your account stay — you can start a fresh reconciliation anytime.
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
                Delete all data for this client?
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
