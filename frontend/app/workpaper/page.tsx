"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Printer } from "lucide-react"
import { api, getEmail, getErrorMessage, getToken } from "@/lib/api"
import type { AuditEvent, Client, Exception, ReconcileSummary, Run } from "@/lib/api"
import { currency, formatDate, formatDateTime, formatTxnDate } from "@/lib/format"

function periodText(summary: ReconcileSummary | null): string {
  if (!summary?.period_start || !summary?.period_end) return "—"
  const start = new Date(`${summary.period_start}T00:00:00`)
  const end = new Date(`${summary.period_end}T00:00:00`)
  const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" })
  if (monthYear.format(start) === monthYear.format(end)) {
    return monthYear.format(start)
  }
  return `${formatDate(summary.period_start)} – ${formatDate(summary.period_end)}`
}

function WorkpaperInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientIdParam = Number(searchParams.get("client_id"))
  const runIdParam = Number(searchParams.get("run_id"))

  const [client, setClient] = useState<Client | null>(null)
  const [summary, setSummary] = useState<ReconcileSummary | null>(null)
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.getClients()
      const id =
        Number.isFinite(clientIdParam) && clientIdParam > 0
          ? clientIdParam
          : (list[0]?.id ?? null)
      if (id === null) {
        setLoading(false)
        return
      }
      setClient(list.find((c) => c.id === id) ?? null)

      const [sum, exc, aud, runs] = await Promise.all([
        api.getSummary(id),
        api.getExceptions(undefined, undefined, id),
        api.getAudit(id, 40),
        api.getRuns(id, 100),
      ])
      setSummary(sum)
      setExceptions(exc)
      setAudit(aud)
      setRun(
        Number.isFinite(runIdParam) && runIdParam > 0
          ? (runs.find((r) => r.id === runIdParam) ?? runs[0] ?? null)
          : (runs[0] ?? null),
      )
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [clientIdParam, runIdParam])

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login")
      return
    }
    void load()
  }, [load, router])

  const matchRate =
    summary && summary.bank_total > 0
      ? Math.round((summary.matched / summary.bank_total) * 100)
      : 0
  const preparedBy = getEmail() ?? "—"

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-secondary/40 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Preparing workpaper…
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-base font-semibold text-destructive">Could not build the workpaper</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link href="/dashboard" className="text-sm font-medium text-accent hover:underline">
          Back to dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary/40 print:bg-white">
      <div className="no-print sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[900px] items-center justify-between gap-3 px-6 py-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {summary?.client_name} · {periodText(summary)}
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent/90"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print / Save as PDF
            </button>
          </div>
        </div>
      </div>

      <article className="workpaper-sheet mx-auto my-8 max-w-[900px] bg-white p-10 text-[13px] leading-relaxed text-zinc-900 shadow-sm ring-1 ring-black/5 print:my-0 print:max-w-none print:p-0 print:shadow-none print:ring-0">
        {/* Letterhead */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-zinc-900 pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
              ReconAI · Reconciliation workpaper
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Bank Reconciliation
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {summary?.client_name ?? client?.name ?? "Client"} · {periodText(summary)}
            </p>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <p>Run #{run?.id ?? "—"}</p>
            <p>Generated {formatDateTime(new Date().toISOString())}</p>
            <p>Currency {client?.currency ?? "USD"}</p>
          </div>
        </header>

        {/* Headline numbers */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Bank transactions", value: String(summary?.bank_total ?? 0) },
            { label: "Internal transactions", value: String(summary?.internal_total ?? 0) },
            { label: "Match rate", value: `${matchRate}%` },
            { label: "Amount at risk", value: currency.format(summary?.amount_at_risk ?? 0) },
          ].map((item) => (
            <div key={item.label} className="rounded-md border border-zinc-200 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                {item.label}
              </p>
              <p className="mt-1 font-mono text-lg font-semibold">{item.value}</p>
            </div>
          ))}
        </section>

        {/* Summary table */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
            1. Reconciliation summary
          </h2>
          <table className="mt-3 w-full border-collapse text-[13px]">
            <tbody>
              {[
                ["Transactions matched", `${summary?.matched ?? 0}`],
                [
                  "Matched by reference",
                  `${summary?.method_counts.reference ?? 0}`,
                ],
                [
                  "Matched by amount + date",
                  `${summary?.method_counts.amount_date ?? 0}`,
                ],
                ["Matched manually", `${summary?.method_counts.manual ?? 0}`],
                ["Bank transactions unmatched", `${summary?.unmatched_bank ?? 0}`],
                ["Internal transactions unmatched", `${summary?.unmatched_internal ?? 0}`],
                ["Amount mismatches", `${summary?.amount_mismatches ?? 0}`],
                ["Open exceptions", `${summary?.open_exceptions ?? 0}`],
                ["Total amount at risk", currency.format(summary?.amount_at_risk ?? 0)],
                ["Last reconciliation run", formatDateTime(summary?.last_run_at)],
              ].map(([label, value], index) => (
                <tr key={label} className={index % 2 === 0 ? "bg-zinc-50" : ""}>
                  <td className="w-1/2 border border-zinc-200 px-3 py-1.5 text-zinc-600">
                    {label}
                  </td>
                  <td className="border border-zinc-200 px-3 py-1.5 font-mono font-medium">
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Exceptions */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
            2. Exceptions ({exceptions.length})
          </h2>
          {exceptions.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-zinc-300 px-3 py-6 text-center text-zinc-500">
              No exceptions — every bank transaction is accounted for.
            </p>
          ) : (
            <table className="mt-3 w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-zinc-100 text-left">
                  <th className="border border-zinc-200 px-2 py-1.5 font-semibold">Type</th>
                  <th className="border border-zinc-200 px-2 py-1.5 font-semibold">Date</th>
                  <th className="border border-zinc-200 px-2 py-1.5 font-semibold">Description</th>
                  <th className="border border-zinc-200 px-2 py-1.5 font-semibold">Reference</th>
                  <th className="border border-zinc-200 px-2 py-1.5 text-right font-semibold">Bank</th>
                  <th className="border border-zinc-200 px-2 py-1.5 text-right font-semibold">Internal</th>
                  <th className="border border-zinc-200 px-2 py-1.5 text-right font-semibold">Diff.</th>
                  <th className="border border-zinc-200 px-2 py-1.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((exception) => {
                  const txn = exception.bank_txn ?? exception.internal_txn
                  const bank = exception.bank_txn
                  const internal = exception.internal_txn
                  const diff =
                    bank && internal ? Math.abs(bank.amount - internal.amount) : null
                  return (
                    <tr key={exception.id} className="align-top">
                      <td className="border border-zinc-200 px-2 py-1.5 capitalize">
                        {exception.exception_type}
                      </td>
                      <td className="whitespace-nowrap border border-zinc-200 px-2 py-1.5">
                        {formatTxnDate(txn?.date)}
                      </td>
                      <td className="border border-zinc-200 px-2 py-1.5">
                        {txn?.description ?? "—"}
                      </td>
                      <td className="border border-zinc-200 px-2 py-1.5 font-mono">
                        {txn?.reference ?? "—"}
                      </td>
                      <td className="border border-zinc-200 px-2 py-1.5 text-right font-mono">
                        {bank ? currency.format(bank.amount) : "—"}
                      </td>
                      <td className="border border-zinc-200 px-2 py-1.5 text-right font-mono">
                        {internal ? currency.format(internal.amount) : "—"}
                      </td>
                      <td className="border border-zinc-200 px-2 py-1.5 text-right font-mono">
                        {diff !== null ? currency.format(diff) : "—"}
                      </td>
                      <td className="border border-zinc-200 px-2 py-1.5 capitalize">
                        {exception.status}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Audit trail */}
        <section className="mt-8 break-inside-avoid">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
            3. Audit trail
          </h2>
          {audit.length === 0 ? (
            <p className="mt-2 text-zinc-500">No activity recorded.</p>
          ) : (
            <ol className="mt-2 space-y-1 text-[12px] text-zinc-600">
              {audit.slice(0, 12).map((event) => (
                <li key={event.id} className="flex gap-2">
                  <span className="w-36 shrink-0 font-mono text-zinc-500">
                    {formatDateTime(event.created_at)}
                  </span>
                  <span className="flex-1">{event.message}</span>
                  <span className="hidden w-40 shrink-0 truncate text-right text-zinc-400 sm:block">
                    {event.actor}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Sign-off */}
        <section className="mt-10 grid gap-6 break-inside-avoid sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Prepared by
            </p>
            <p className="mt-6 border-b border-zinc-400 pb-1 text-sm">{preparedBy}</p>
            <p className="mt-1 text-xs text-zinc-500">Name / signature</p>
            <p className="mt-4 border-b border-zinc-400 pb-1 text-sm">&nbsp;</p>
            <p className="mt-1 text-xs text-zinc-500">Date</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Reviewed by
            </p>
            <p className="mt-6 border-b border-zinc-400 pb-1 text-sm">&nbsp;</p>
            <p className="mt-1 text-xs text-zinc-500">Name / signature</p>
            <p className="mt-4 border-b border-zinc-400 pb-1 text-sm">&nbsp;</p>
            <p className="mt-1 text-xs text-zinc-500">Date</p>
          </div>
        </section>

        <footer className="mt-10 border-t border-zinc-200 pt-3 text-[11px] text-zinc-400">
          Generated by ReconAI. Amounts are as recorded in the uploaded bank statement and
          internal ledger at the time of the run. Open exceptions are unresolved and require
          review before sign-off.
        </footer>
      </article>
    </div>
  )
}

export default function WorkpaperPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center gap-2 bg-secondary/40 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Preparing workpaper…
        </div>
      }
    >
      <WorkpaperInner />
    </Suspense>
  )
}
