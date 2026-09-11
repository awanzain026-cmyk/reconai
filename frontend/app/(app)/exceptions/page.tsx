"use client"

import { useCallback, useEffect, useState } from "react"
import { FileDown, Loader2 } from "lucide-react"
import { AppTopbar } from "@/components/app/app-topbar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExceptionsPanel } from "@/components/exceptions/exceptions-panel"
import { api, ApiError, getErrorMessage } from "@/lib/api"
import type { Exception } from "@/lib/api"

export default function ExceptionsPage() {
  const [items, setItems] = useState<Exception[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await api.getExceptions())
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

  async function handleExport() {
    setExporting(true)
    try {
      await api.exportExceptions()
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
  }

  async function matchException(id: number, matchTransactionId: number) {
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, status: "resolved" } : e)))
    try {
      await api.matchException(id, matchTransactionId)
    } catch {
      await load()
      throw new Error("Failed to match")
    }
  }

  const openExceptions = items.filter((e) => e.status === "open")
  const mismatches = openExceptions.filter((e) => e.exception_type === "mismatch").length

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        title="Exceptions"
        description="Transactions flagged for review — unmatched or mismatched against the other list"
      />

      <div className="flex-1 space-y-6 px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading your review queue…" : `${items.length} exception${items.length === 1 ? "" : "s"} on file`}
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
              {loading ? "…" : openExceptions.length}
            </p>
          </Card>
          <Card className="gap-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Amount mismatches</p>
            <p className="font-mono text-2xl font-semibold text-foreground">
              {loading ? "…" : mismatches}
            </p>
          </Card>
          <Card className="gap-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Resolved</p>
            <p className="font-mono text-2xl font-semibold text-success">
              {loading ? "…" : items.length - openExceptions.length}
            </p>
          </Card>
        </div>

        {error ? (
          <Card className="gap-3 p-6">
            <p className="text-sm font-medium text-destructive">Could not load exceptions</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="w-fit font-medium"
              onClick={() => {
                setLoading(true)
                void load()
              }}
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
            onRetry={() => {
              setLoading(true)
              void load()
            }}
          />
        )}
      </div>
    </div>
  )
}