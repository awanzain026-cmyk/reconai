"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FileDown, Loader2, Printer } from "lucide-react"
import { AppTopbar } from "@/components/app/app-topbar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExceptionsPanel } from "@/components/exceptions/exceptions-panel"
import { api, getErrorMessage } from "@/lib/api"
import type { Exception } from "@/lib/api"
import { useClients } from "@/lib/use-clients"
import { currency } from "@/lib/format"
import { notifyWorkspaceChanged } from "@/lib/workspace-events"
import { cn } from "@/lib/utils"

function exceptionValue(exception: Exception): number {
  if (exception.exception_type === "mismatch") {
    const bank = exception.bank_txn?.amount ?? 0
    const internal = exception.internal_txn?.amount ?? 0
    return Math.abs(bank - internal)
  }
  const txn = exception.bank_txn ?? exception.internal_txn
  return txn ? Math.abs(txn.amount) : 0
}

export default function ExceptionsPage() {
  const { activeId, activeClient, loading: clientsLoading, error: clientsError } = useClients()
  const [items, setItems] = useState<Exception[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    if (activeId === null) return
    setLoading(true)
    try {
      setItems(await api.getExceptions(undefined, undefined, activeId))
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

  async function handleExport() {
    setExporting(true)
    try {
      await api.exportExceptions(activeId)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  async function resolve(id: number, status: "open" | "resolved") {
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)))
    try {
      await api.setExceptionStatus(id, status)
    } catch {
      await load()
      throw new Error("Failed to update")
    }
    notifyWorkspaceChanged()
  }

  async function matchException(id: number, matchTransactionId: number) {
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, status: "resolved" } : e)))
    try {
      await api.matchException(id, matchTransactionId)
    } catch {
      await load()
      throw new Error("Failed to match")
    }
    notifyWorkspaceChanged()
  }

  const openExceptions = items.filter((e) => e.status === "open")
  const mismatches = openExceptions.filter((e) => e.exception_type === "mismatch").length
  const atRisk = openExceptions.reduce((sum, e) => sum + exceptionValue(e), 0)

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        title="Exceptions"
        description={
          activeClient
            ? `Transactions flagged for ${activeClient.name} — unmatched or mismatched against the other list`
            : "Transactions flagged for review — unmatched or mismatched against the other list"
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {clientsLoading || loading
              ? "Loading your review queue…"
              : `${items.length} exception${items.length === 1 ? "" : "s"} on file`}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 font-medium"
            onClick={handleExport}
            disabled={exporting || items.length === 0}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileDown className="h-4 w-4" aria-hidden="true" />
            )}
            Export CSV
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="gap-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Open exceptions</p>
            <p className="font-mono text-2xl font-semibold text-foreground">
              {clientsLoading || loading ? "…" : openExceptions.length}
            </p>
          </Card>
          <Card className="gap-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Amount at risk</p>
            <p
              className={cn(
                "font-mono text-2xl font-semibold",
                atRisk > 0 ? "text-destructive" : "text-success",
              )}
            >
              {clientsLoading || loading ? "…" : currency.format(atRisk)}
            </p>
            <p className="text-xs text-muted-foreground">
              {mismatches} amount mismatch{mismatches === 1 ? "" : "es"}
            </p>
          </Card>
          <Card className="gap-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Resolved</p>
            <p className="font-mono text-2xl font-semibold text-success">
              {clientsLoading || loading ? "…" : items.length - openExceptions.length}
            </p>
          </Card>
        </div>

        {clientsError ? (
          <Card className="gap-3 p-6">
            <p className="text-sm font-medium text-destructive">Could not load your clients</p>
            <p className="text-sm text-muted-foreground">{clientsError}</p>
          </Card>
        ) : error ? (
          <Card className="gap-3 p-6">
            <p className="text-sm font-medium text-destructive">Could not load exceptions</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="w-fit font-medium"
              onClick={() => void load()}
            >
              Try again
            </Button>
          </Card>
        ) : (
          <ExceptionsPanel
            items={items}
            onResolve={resolve}
            onMatch={matchException}
            loading={loading}
            error={error}
            onRetry={() => void load()}
          />
        )}
      </div>
    </div>
  )
}
