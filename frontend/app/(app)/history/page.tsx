"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { History as HistoryIcon, Loader2, Printer, RefreshCw } from "lucide-react"
import { AppTopbar } from "@/components/app/app-topbar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api, getErrorMessage } from "@/lib/api"
import type { AuditEvent, Run } from "@/lib/api"
import { useClients } from "@/lib/use-clients"
import { currency, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const EVENT_LABELS: Record<string, string> = {
  "import.uploaded": "Upload",
  "import.deleted": "Upload removed",
  "reconcile.run": "Reconciliation",
  "exception.resolved": "Exception resolved",
  "exception.reopened": "Exception reopened",
  "exception.matched": "Manual match",
  "client.created": "Client created",
  "client.updated": "Client updated",
  "client.deleted": "Client deleted",
  "client.seeded": "Sample data",
  "data.deleted": "Data cleared",
}

export default function HistoryPage() {
  const { activeId, activeClient, loading: clientsLoading, error: clientsError } = useClients()
  const [runs, setRuns] = useState<Run[]>([])
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (activeId === null) return
    setLoading(true)
    try {
      const [runList, auditList] = await Promise.all([
        api.getRuns(activeId, 100),
        api.getAudit(activeId, 100),
      ])
      setRuns(runList)
      setEvents(auditList)
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

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        title="History"
        description={
          activeClient
            ? `Saved runs and audit trail for ${activeClient.name}`
            : "Saved runs and audit trail"
        }
        actions={
          activeId !== null ? (
            <Button
              nativeButton={false}
              render={<Link href={`/workpaper?client_id=${activeId}`} />}
              variant="outline"
              className="font-medium"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Workpaper
            </Button>
          ) : null
        }
      />

      <div className="flex-1 space-y-6 px-6 py-6">
        {clientsLoading ? (
          <p className="text-sm text-muted-foreground">Loading workspace…</p>
        ) : clientsError ? (
          <Card className="gap-2 p-6">
            <p className="text-sm font-medium text-destructive">Could not load your clients</p>
            <p className="text-sm text-muted-foreground">{clientsError}</p>
          </Card>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading history…
          </div>
        ) : error ? (
          <Card className="gap-3 p-6">
            <p className="text-sm font-medium text-destructive">Could not load history</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="w-fit font-medium" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </Button>
          </Card>
        ) : (
          <>
            <Card className="min-w-0 gap-4">
              <div className="px-6 pt-1">
                <p className="text-sm font-semibold text-foreground">Reconciliation runs</p>
                <p className="text-xs text-muted-foreground">
                  Each run is a frozen snapshot — the numbers stay as they were, even after later
                  uploads.
                </p>
              </div>
              {runs.length === 0 ? (
                <div className="px-6 pb-6">
                  <p className="text-sm text-muted-foreground">
                    No runs yet. Upload a statement and run reconciliation to create the first
                    one.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run at</TableHead>
                      <TableHead>Match rate</TableHead>
                      <TableHead className="hidden sm:table-cell">Matched</TableHead>
                      <TableHead className="hidden sm:table-cell">Exceptions</TableHead>
                      <TableHead>At risk</TableHead>
                      <TableHead className="hidden md:table-cell">Run by</TableHead>
                      <TableHead className="text-right">Workpaper</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="text-sm text-foreground">
                          {formatDateTime(run.run_at)}
                        </TableCell>
                        <TableCell>
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
                            {run.match_rate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                          {run.matched} / {run.bank_total}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                          {run.open_exceptions}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-medium text-foreground">
                          {currency.format(run.amount_at_risk)}
                        </TableCell>
                        <TableCell className="hidden truncate text-xs text-muted-foreground md:table-cell">
                          {run.triggered_by}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/workpaper?client_id=${run.client_id}&run_id=${run.id}`}
                            className="text-sm font-medium text-accent hover:underline"
                          >
                            Open
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>

            <Card className="min-w-0 gap-4">
              <div className="px-6 pt-1">
                <p className="text-sm font-semibold text-foreground">Audit trail</p>
                <p className="text-xs text-muted-foreground">
                  Who did what, when. This is the evidence behind a signed workpaper.
                </p>
              </div>
              {events.length === 0 ? (
                <div className="px-6 pb-6">
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                </div>
              ) : (
                <ol className="space-y-0 px-6 pb-6">
                  {events.map((event, index) => (
                    <li key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                            event.event_type.startsWith("exception")
                              ? "bg-amber-500"
                              : event.event_type === "reconcile.run"
                                ? "bg-accent"
                                : "bg-border",
                          )}
                        />
                        {index < events.length - 1 ? (
                          <span className="my-0.5 w-px flex-1 bg-border" />
                        ) : null}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-[11px] font-normal">
                            {EVENT_LABELS[event.event_type] ?? event.event_type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(event.created_at)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-foreground">{event.message}</p>
                        <p className="text-xs text-muted-foreground">{event.actor}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
