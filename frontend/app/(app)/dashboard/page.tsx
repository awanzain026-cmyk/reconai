"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FileUp, UploadCloud } from "lucide-react"
import { AppTopbar } from "@/components/app/app-topbar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { StatCards } from "@/components/dashboard/stat-cards"
import { ExceptionsPanel } from "@/components/exceptions/exceptions-panel"
import { api, ApiError, getErrorMessage } from "@/lib/api"
import type { Exception, ReconcileSummary } from "@/lib/api"

export default function DashboardPage() {
  const [summary, setSummary] = useState<ReconcileSummary | null>(null)
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [sum, open] = await Promise.all([api.getSummary(), api.getExceptions("open")])
      setSummary(sum)
      setExceptions(open)
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function resolve(id: number, status: "open" | "resolved") {
    // Optimistic: apply locally, then persist and re-sync KPIs.
    setExceptions((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)))
    try {
      await api.setExceptionStatus(id, status)
    } catch {
      await load() // revert to server truth on failure
      throw new Error("Failed to update")
    }
    await load()
  }

  async function matchException(id: number, matchTransactionId: number) {
    setExceptions((prev) => prev.map((e) => (e.id === id ? { ...e, status: "resolved" } : e)))
    try {
      await api.matchException(id, matchTransactionId)
    } catch {
      await load() // revert to server truth on failure
      throw new Error("Failed to match")
    }
    await load()
  }

  const noData = summary && summary.bank_total === 0 && summary.internal_total === 0
  const onlyOneSide =
    summary &&
    (summary.bank_total === 0 || summary.internal_total === 0)

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <AppTopbar
        title="Overview"
        description="Reconciliation status for this month's bank statement"
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/upload" />}
            className="bg-accent font-medium text-accent-foreground hover:bg-accent/90"
          >
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            Upload statements
          </Button>
        }
      />

      <div className="flex-1 space-y-6 px-6 py-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading your reconciliation…</p>
        ) : error ? (
          <Card className="gap-2 p-6">
            <p className="text-sm font-medium text-destructive">Could not load your dashboard</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-2 w-fit font-medium" onClick={() => {
              setLoading(true)
              void load()
            }}>
              Try again
            </Button>
          </Card>
        ) : noData ? (
          <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <FileUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-base font-semibold text-foreground">Start your first reconciliation</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Upload a bank statement and your internal ledger as CSVs, and ReconAI will match
              them and flag anything that doesn&apos;t line up.
            </p>
            <Button
              nativeButton={false}
              render={<Link href="/upload" />}
              className="mt-2 bg-accent font-medium text-accent-foreground hover:bg-accent/90"
            >
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              Upload statements
            </Button>
          </Card>
        ) : (
          <>
            <StatCards summary={summary!} />
            {onlyOneSide ? (
              <Card className="gap-2 p-6">
                <p className="text-sm font-medium text-foreground">
                  {summary!.bank_total === 0
                    ? "Bank statement not uploaded yet"
                    : "Internal ledger not uploaded yet"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Upload the missing list, then run reconciliation, for the numbers above to
                  mean anything.
                </p>
                <Button
                  nativeButton={false}
                  render={<Link href="/upload" />}
                  size="sm"
                  variant="outline"
                  className="mt-1 w-fit font-medium"
                >
                  Go to uploads
                </Button>
              </Card>
            ) : null}
            <ExceptionsPanel
              items={exceptions}
              onResolve={resolve}
              onMatch={matchException}
              initialFilter="open"
              showAllLink
            />
          </>
        )}
      </div>
    </div>
  )
}