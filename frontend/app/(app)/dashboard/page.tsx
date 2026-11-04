"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, FileUp, Loader2, Printer, Sparkles, UploadCloud } from "lucide-react"
import { AppTopbar } from "@/components/app/app-topbar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatCards } from "@/components/dashboard/stat-cards"
import { ExceptionsPanel } from "@/components/exceptions/exceptions-panel"
import { api, getErrorMessage } from "@/lib/api"
import type { Exception, ReconcileSummary, Run } from "@/lib/api"
import { useClients } from "@/lib/use-clients"
import { setActiveClientId } from "@/lib/client-selection"
import { notifyWorkspaceChanged } from "@/lib/workspace-events"
import { currency, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  const { activeId, activeClient, loading: clientsLoading, error: clientsError, reload: reloadClients } =
    useClients()
  const [summary, setSummary] = useState<ReconcileSummary | null>(null)
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingSample, setLoadingSample] = useState(false)

  const load = useCallback(async () => {
    if (activeId === null) return
    setLoading(true)
    try {
      const [sum, open, recent] = await Promise.all([
        api.getSummary(activeId),
        api.getExceptions("open", undefined, activeId),
        api.getRuns(activeId, 4),
      ])
      setSummary(sum)
      setExceptions(open)
      setRuns(recent)
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [activeId])

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
    notifyWorkspaceChanged()
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
    notifyWorkspaceChanged()
    await load()
  }

  async function loadSampleData() {
    setLoadingSample(true)
    try {
      await api.resetDemoData()
      setActiveClientId(null)
      await reloadClients()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoadingSample(false)
    }
  }

  const noData = summary && summary.bank_total === 0 && summary.internal_total === 0
  const onlyOneSide = summary && (summary.bank_total === 0 || summary.internal_total === 0)

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <AppTopbar
        title="Overview"
        description={
          activeClient
            ? `Reconciliation status for ${activeClient.name}`
            : "Reconciliation status for this client"
        }
        actions={
          <>
            {activeId !== null && summary && !noData ? (
              <Button
                nativeButton={false}
                render={<Link href={`/workpaper?client_id=${activeId}`} />}
                variant="outline"
                className="font-medium"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Workpaper
              </Button>
            ) : null}
            <Button
              nativeButton={false}
              render={<Link href="/upload" />}
              className="bg-accent font-medium text-accent-foreground hover:bg-accent/90"
            >
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              Upload statements
            </Button>
          </>
        }
      />

      <div className="flex-1 space-y-6 px-6 py-6">
        {clientsLoading ? (
          <p className="text-sm text-muted-foreground">Loading your workspace…</p>
        ) : clientsError ? (
          <Card className="gap-2 p-6">
            <p className="text-sm font-medium text-destructive">Could not load your clients</p>
            <p className="text-sm text-muted-foreground">{clientsError}</p>
            <Button variant="outline" size="sm" className="mt-2 w-fit font-medium" onClick={() => void reloadClients()}>
              Try again
            </Button>
          </Card>
        ) : !activeClient ? (
          <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <FileUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-base font-semibold text-foreground">Create your first client</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Each client has its own statements, exceptions and history — so one firm can
              reconcile many entities without mixing them up.
            </p>
            <Button
              nativeButton={false}
              render={<Link href="/clients" />}
              className="mt-2 bg-accent font-medium text-accent-foreground hover:bg-accent/90"
            >
              Go to clients
            </Button>
          </Card>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading {activeClient.name}…</p>
        ) : error ? (
          <Card className="gap-2 p-6">
            <p className="text-sm font-medium text-destructive">Could not load your dashboard</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-fit font-medium"
              onClick={() => void load()}
            >
              Try again
            </Button>
          </Card>
        ) : noData ? (
          <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <FileUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-base font-semibold text-foreground">
              Start {activeClient.name}&apos;s first reconciliation
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Upload a bank statement and the internal ledger as CSVs, and ReconAI will match
              them and flag anything that doesn&apos;t line up. In a hurry? Load two sample
              clients and explore the whole workflow first.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <Button
                nativeButton={false}
                render={<Link href="/upload" />}
                className="bg-accent font-medium text-accent-foreground hover:bg-accent/90"
              >
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                Upload statements
              </Button>
              <Button
                variant="outline"
                className="font-medium"
                disabled={loadingSample}
                onClick={loadSampleData}
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
            </div>
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

            {runs.length > 0 ? (
              <Card className="gap-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Reconciliation history</p>
                    <p className="text-xs text-muted-foreground">
                      Every run is saved as a snapshot, so this month&apos;s workpaper can be
                      reproduced later.
                    </p>
                  </div>
                  <Link
                    href="/history"
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:underline"
                  >
                    Full history
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
                <ul className="divide-y divide-border">
                  {runs.map((run) => (
                    <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-mono",
                            run.match_rate >= 95
                              ? "border-success/30 text-success"
                              : run.match_rate >= 80
                                ? "border-amber-200 text-amber-700"
                                : "border-destructive/30 text-destructive",
                          )}
                        >
                          {run.match_rate}% matched
                        </Badge>
                        <p className="truncate text-sm text-muted-foreground">
                          {formatDateTime(run.run_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-muted-foreground">
                          {run.open_exceptions} exception{run.open_exceptions === 1 ? "" : "s"}
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {currency.format(run.amount_at_risk)} at risk
                        </span>
                        <Link
                          href={`/workpaper?client_id=${run.client_id}&run_id=${run.id}`}
                          className="font-medium text-accent hover:underline"
                        >
                          Workpaper
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
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
