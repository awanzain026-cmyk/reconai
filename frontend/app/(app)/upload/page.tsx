"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  CheckCircle2,
  FileDown,
  Loader2,
  Printer,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { AppTopbar } from "@/components/app/app-topbar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dropzone } from "@/components/upload/dropzone"
import { api, getErrorMessage } from "@/lib/api"
import type { Import, ImportResult, ReconcileSummary, TransactionRow } from "@/lib/api"
import { useClients } from "@/lib/use-clients"
import { currency } from "@/lib/format"
import { notifyWorkspaceChanged } from "@/lib/workspace-events"
import { cn } from "@/lib/utils"

type RunResult = {
  bank: ImportResult
  internal: ImportResult
  summary: ReconcileSummary
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

function PreviewTable({
  title,
  result,
  rows = [],
  color,
}: {
  title: string
  result: ImportResult
  rows?: TransactionRow[]
  color: "sky" | "violet"
}) {
  const badgeColor = color === "sky" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700"
  const rejected = result.rejections.slice(0, 10)
  const preview = rows.slice(0, 10)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeColor}`}>
            {result.imported} imported
          </span>
          {result.rejected > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
              {result.rejected} rejected
            </span>
          )}
        </div>
      </div>

      {rejected.length > 0 ? (
        <div className="rounded-lg border border-border bg-destructive/5 p-3">
          <p className="text-xs font-medium text-destructive mb-2">
            Rejected rows (first 10):
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground max-h-48 overflow-y-auto">
            {rejected.map((r, i) => (
              <li key={i} className="font-mono">
                Row {r.row}: {r.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-secondary/60 text-left">
                <th className="px-3 py-2 font-medium text-muted-foreground">Date</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Description</th>
                <th className="hidden px-3 py-2 font-medium text-muted-foreground sm:table-cell">
                  Reference
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-3 py-1.5 text-foreground">
                    {dateFormatter.format(new Date(`${row.date}T00:00:00`))}
                  </td>
                  <td className="max-w-52 truncate px-3 py-1.5 text-foreground">
                    {row.description ?? "—"}
                  </td>
                  <td className="hidden px-3 py-1.5 font-mono text-muted-foreground sm:table-cell">
                    {row.reference ?? "—"}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-1.5 text-right font-mono",
                      row.amount < 0 ? "text-destructive" : "text-success",
                    )}
                  >
                    {currency.format(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.imported > preview.length ? (
            <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
              Showing the first {preview.length} of {result.imported} rows.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default function UploadPage() {
  const router = useRouter()
  const { activeId, activeClient, loading: clientsLoading, error: clientsError } = useClients()
  const [bankFile, setBankFile] = useState<File | null>(null)
  const [internalFile, setInternalFile] = useState<File | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)
  const [imports, setImports] = useState<Import[]>([])
  const [importsLoading, setImportsLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [downloadingTemplate, setDownloadingTemplate] = useState<"bank" | "internal" | null>(
    null,
  )
  const [preview, setPreview] = useState<{
    bank: ImportResult
    internal: ImportResult
    bankRows: TransactionRow[]
    internalRows: TransactionRow[]
  } | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const loadImports = useCallback(async () => {
    if (activeId === null) return
    try {
      setImports(await api.getImports(activeId))
      setHistoryError(null)
    } catch (err) {
      setHistoryError(getErrorMessage(err))
    } finally {
      setImportsLoading(false)
    }
  }, [activeId])

  useEffect(() => {
    void loadImports()
  }, [loadImports])

  async function handlePreview() {
    if (activeId === null) {
      setError("Choose a client in the top bar first.")
      return
    }
    if (!bankFile || !internalFile) {
      setError("Select both a bank statement and an internal ledger CSV first.")
      return
    }
    setPreviewing(true)
    setError(null)
    setPreview(null)
    try {
      const [bank, internal] = await Promise.all([
        api.uploadCsv("bank", bankFile, activeId),
        api.uploadCsv("internal", internalFile, activeId),
      ])
      // Show what was actually parsed, not just the row counts — this is the
      // moment a reviewer catches a wrong column mapping before running.
      const [bankRows, internalRows] = await Promise.all([
        api.getImportTransactions(bank.import_id),
        api.getImportTransactions(internal.import_id),
      ])
      setPreview({ bank, internal, bankRows, internalRows })
      void loadImports()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setPreviewing(false)
    }
  }

  async function run() {
    if (!preview) {
      setError("Preview the files first, then confirm to run reconciliation.")
      return
    }
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const summary = await api.runReconcile(activeId)
      setResult({ bank: preview.bank, internal: preview.internal, summary })
      void loadImports()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setRunning(false)
    }
  }

  function clearPreview() {
    setPreview(null)
    setResult(null)
    setError(null)
  }

  async function handleDelete(id: number) {
    setDeletingId(id)
    try {
      await api.deleteImport(id)
      setImports((prev) => prev.filter((i) => i.id !== id))
      setResult(null)
      setConfirmingDeleteId(null)
      notifyWorkspaceChanged()
    } catch (err) {
      setHistoryError(getErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDownloadTemplate(source: "bank" | "internal") {
    setDownloadingTemplate(source)
    try {
      await api.downloadTemplate(source)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setDownloadingTemplate(null)
    }
  }

  const ready = Boolean(bankFile && internalFile)

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        title="Upload statements"
        description={
          activeClient
            ? `Import a bank statement and internal ledger for ${activeClient.name}`
            : "Import a bank statement and internal ledger, then run reconciliation"
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
        ) : !activeClient ? (
          <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="text-base font-semibold text-foreground">Create a client first</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Every upload belongs to a client, so start by adding one in the Clients page.
            </p>
            <Button
              nativeButton={false}
              render={<a href="/clients" />}
              className="bg-accent font-medium text-accent-foreground hover:bg-accent/90"
            >
              Go to clients
            </Button>
          </Card>
        ) : (
          <>
        <div className="grid min-w-0 gap-6 lg:grid-cols-3">
          <Card className="min-w-0 gap-5 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                New reconciliation run — {activeClient.name}
              </CardTitle>
              <CardDescription>
                Files are matched automatically once both uploads are in, then exceptions are
                flagged for review. This run is scoped to this client only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Dropzone
                    label="Bank statement"
                    description="Exported directly from the bank portal"
                    onFileChange={setBankFile}
                  />
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate("bank")}
                    disabled={downloadingTemplate === "bank"}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {downloadingTemplate === "bank" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Download sample CSV
                  </button>
                </div>
                <div className="space-y-2">
                  <Dropzone
                    label="Internal records"
                    description="General ledger export from your accounting system"
                    onFileChange={setInternalFile}
                  />
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate("internal")}
                    disabled={downloadingTemplate === "internal"}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {downloadingTemplate === "internal" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Download sample CSV
                  </button>
                </div>
              </div>

              {error ? (
                <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              ) : null}

              <div className="flex flex-col gap-3 rounded-lg bg-secondary/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                  ReconAI will auto-match transactions and flag exceptions for review
                </p>
                <Button
                  onClick={handlePreview}
                  disabled={!ready || previewing}
                  className="shrink-0 bg-accent font-medium text-accent-foreground hover:bg-accent/90"
                >
                  {previewing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Previewing…
                    </>
                  ) : (
                    "Preview parsed data"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="text-base font-semibold">File requirements</CardTitle>
              <CardDescription>Keep imports clean for the highest match rate</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  CSV format with a header row — date, description, and amount columns required.
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  One statement period per file. Split multi-month exports before uploading.
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  Internal records should reflect the same date range as the bank statement.
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  Files are processed in a read-only environment and never modified.
                </li>
              </ul>
            </CardContent>
          </Card>

          {preview && (
            <Card className="min-w-0 gap-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Sparkles className="h-5 w-5 text-accent" aria-hidden="true" />
                  Preview parsed data
                </CardTitle>
                <CardDescription>
                  Verify the first 10 rows of each file. Check dates, amounts, and references look correct
                  before running reconciliation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <PreviewTable
                    title="Bank statement"
                    result={preview.bank}
                    rows={preview.bankRows}
                    color="sky"
                  />
                  <PreviewTable
                    title="Internal records"
                    result={preview.internal}
                    rows={preview.internalRows}
                    color="violet"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                  <Button variant="outline" size="sm" onClick={clearPreview}>
                    <ArrowRight className="h-4 w-4 mr-1" aria-hidden="true" />
                    Change files
                  </Button>
                  <Button
                    onClick={run}
                    disabled={running}
                    className="bg-accent font-medium text-accent-foreground hover:bg-accent/90"
                  >
                    {running ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Reconciling…
                      </>
                    ) : (
                      "Confirm & Run reconciliation"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {result ? (
          <Card className="min-w-0 gap-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
                Reconciliation complete
              </CardTitle>
              <CardDescription>
                {result.bank.filename} and {result.internal.filename} imported and matched.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-secondary/50 p-4">
                <p className="text-sm font-medium text-muted-foreground">Bank rows imported</p>
                <p className="mt-1 font-mono text-xl font-semibold text-foreground">
                  {result.bank.imported}
                  {result.bank.rejected > 0 ? (
                    <span className="ml-2 text-sm font-medium text-amber-600">
                      {result.bank.rejected} rejected
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-4">
                <p className="text-sm font-medium text-muted-foreground">Internal rows imported</p>
                <p className="mt-1 font-mono text-xl font-semibold text-foreground">
                  {result.internal.imported}
                  {result.internal.rejected > 0 ? (
                    <span className="ml-2 text-sm font-medium text-amber-600">
                      {result.internal.rejected} rejected
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="rounded-lg bg-success/10 p-4">
                <p className="text-sm font-medium text-muted-foreground">Matched</p>
                <p className="mt-1 font-mono text-xl font-semibold text-success">
                  {result.summary.matched}
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    of {result.summary.bank_total} bank rows
                    {result.summary.bank_total > 0
                      ? ` · ${Math.round((result.summary.matched / result.summary.bank_total) * 100)}%`
                      : ""}
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 p-4">
                <p className="text-sm font-medium text-muted-foreground">Amount at risk</p>
                <p className="mt-1 font-mono text-xl font-semibold text-amber-600">
                  {currency.format(result.summary.amount_at_risk)}
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    {result.summary.open_exceptions} open exception
                    {result.summary.open_exceptions === 1 ? "" : "s"}
                  </span>
                </p>
              </div>
            </CardContent>

            {result.bank.rejections.length > 0 || result.internal.rejections.length > 0 ? (
              <div className="px-6 pb-2">
                <p className="text-sm font-medium text-foreground">Rejected rows</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {[...result.bank.rejections, ...result.internal.rejections]
                    .slice(0, 5)
                    .map((r, i) => (
                      <li key={i}>
                        Row {r.row}: {r.reason}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 px-6 pb-6">
              <Button
                nativeButton={false}
                render={
                  <a href="/dashboard" />
                }
                className="bg-accent font-medium text-accent-foreground hover:bg-accent/90"
              >
                View dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                className="font-medium"
                onClick={() => router.push("/exceptions")}
              >
                Review {result.summary.open_exceptions} exceptions
              </Button>
              <Button
                nativeButton={false}
                render={<a href={`/workpaper?client_id=${result.summary.client_id}`} />}
                variant="outline"
                className="font-medium"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Workpaper
              </Button>
            </div>
          </Card>
        ) : null}

        <Card className="min-w-0 gap-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Upload history</CardTitle>
            <CardDescription>
              Remove a mis-uploaded file — its transactions, matches and exceptions are deleted and
              reconciliation re-runs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyError ? (
              <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {historyError}
              </p>
            ) : importsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading uploads…
              </div>
            ) : imports.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No uploads yet — files you import will appear here so you can remove mistakes.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {imports.map((imp) => (
                  <li key={imp.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={imp.source === "bank" ? "outline" : "secondary"}
                          className={cn(
                            imp.source === "bank" ? "text-sky-600" : "text-violet-600",
                          )}
                        >
                          {imp.source === "bank" ? "Bank" : "Internal"}
                        </Badge>
                        <p className="truncate text-sm font-medium text-foreground">
                          {imp.filename}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {imp.imported} imported
                        {imp.rejected > 0 ? ` · ${imp.rejected} rejected` : ""} ·{" "}
                        {dateFormatter.format(new Date(imp.created_at))}
                      </p>
                    </div>

                    {confirmingDeleteId === imp.id ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs font-medium text-destructive">
                          Delete this upload?
                        </span>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deletingId === imp.id}
                          onClick={() => handleDelete(imp.id)}
                        >
                          {deletingId === imp.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              Deleting…
                            </>
                          ) : (
                            "Confirm"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmingDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${imp.filename}`}
                        title="Delete upload"
                        onClick={() => setConfirmingDeleteId(imp.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
          </>
        )}
      </div>
    </div>
  )
}