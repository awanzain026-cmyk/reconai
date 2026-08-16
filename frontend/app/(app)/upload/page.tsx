"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, CheckCircle2, Loader2, Sparkles, TriangleAlert } from "lucide-react"
import { AppTopbar } from "@/components/app/app-topbar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dropzone } from "@/components/upload/dropzone"
import { api, ApiError } from "@/lib/api"
import type { ImportResult, ReconcileSummary } from "@/lib/api"

type RunResult = {
  bank: ImportResult
  internal: ImportResult
  summary: ReconcileSummary
}

export default function UploadPage() {
  const router = useRouter()
  const [bankFile, setBankFile] = useState<File | null>(null)
  const [internalFile, setInternalFile] = useState<File | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)

  async function run() {
    if (!bankFile || !internalFile) {
      setError("Select both a bank statement and an internal ledger CSV before running.")
      return
    }
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const bank = await api.uploadCsv("bank", bankFile)
      const internal = await api.uploadCsv("internal", internalFile)
      const summary = await api.runReconcile()
      setResult({ bank, internal, summary })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed. Please try again.")
    } finally {
      setRunning(false)
    }
  }

  const ready = Boolean(bankFile && internalFile)

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        title="Upload statements"
        description="Import a bank statement and internal ledger, then run reconciliation"
      />

      <div className="flex-1 space-y-6 px-6 py-6">
        <div className="grid min-w-0 gap-6 lg:grid-cols-3">
          <Card className="min-w-0 gap-5 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold">New reconciliation run</CardTitle>
              <CardDescription>
                Files are matched automatically once both uploads are in, then exceptions are
                flagged for review.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <Dropzone
                  label="Bank statement"
                  description="Exported directly from the bank portal"
                  onFileChange={setBankFile}
                />
                <Dropzone
                  label="Internal records"
                  description="General ledger export from your accounting system"
                  onFileChange={setInternalFile}
                />
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
                  onClick={run}
                  disabled={!ready || running}
                  className="shrink-0 bg-accent font-medium text-accent-foreground hover:bg-accent/90"
                >
                  {running ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Reconciling…
                    </>
                  ) : (
                    "Run reconciliation"
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
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 p-4">
                <p className="text-sm font-medium text-muted-foreground">Open exceptions</p>
                <p className="mt-1 font-mono text-xl font-semibold text-amber-600">
                  {result.summary.open_exceptions}
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
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  )
}