"use client"

import { Fragment, useMemo, useState } from "react"
import { Check, Loader2, RefreshCw, Sparkles, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api, ApiError } from "@/lib/api"
import type { Exception, Suggestion } from "@/lib/api"
import { ConfidenceIndicator } from "@/components/exceptions/confidence-indicator"
import { cn } from "@/lib/utils"

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })

function primaryTxn(e: Exception) {
  return e.bank_txn ?? e.internal_txn
}

export function ExceptionsPanel({
  items,
  onResolve,
  onMatch,
  initialFilter = "open",
  loading = false,
  error = null,
  onRetry,
  showAllLink = false,
}: {
  items: Exception[]
  onResolve: (id: number, status: "open" | "resolved") => Promise<void>
  onMatch: (id: number, matchTransactionId: number) => Promise<void>
  initialFilter?: "open" | "resolved"
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  showAllLink?: boolean
}) {
  const [filter, setFilter] = useState<"open" | "resolved">(initialFilter)
  const [resolving, setResolving] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<Record<number, Suggestion[]>>({})
  const [loadingSuggestions, setLoadingSuggestions] = useState<Set<number>>(new Set())
  const [suggestionErrors, setSuggestionErrors] = useState<Record<number, string>>({})
  const [matching, setMatching] = useState<{ exceptionId: number; txnId: number } | null>(null)

  const openCount = items.filter((e) => e.status === "open").length
  const resolvedCount = items.length - openCount
  const visible = useMemo(() => items.filter((e) => e.status === filter), [items, filter])

  async function handleResolve(id: number, status: "open" | "resolved") {
    setResolving(id)
    try {
      await onResolve(id, status)
    } finally {
      setResolving(null)
    }
  }

  async function loadSuggestions(id: number) {
    if (loadingSuggestions.has(id)) return
    setLoadingSuggestions((prev) => new Set(prev).add(id))
    setSuggestionErrors((prev) => ({ ...prev, [id]: "" }))
    try {
      const data = await api.getSuggestions(id)
      setSuggestions((prev) => ({ ...prev, [id]: data }))
    } catch (err) {
      setSuggestionErrors((prev) => ({
        ...prev,
        [id]: err instanceof ApiError ? err.message : "Could not load suggestions",
      }))
    } finally {
      setLoadingSuggestions((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (!suggestions[id]) void loadSuggestions(id)
  }

  async function handleMatch(exceptionId: number, txnId: number) {
    setMatching({ exceptionId, txnId })
    try {
      await onMatch(exceptionId, txnId)
    } finally {
      setMatching(null)
    }
  }

  return (
    <Card className="min-w-0 gap-4">
      <CardContent className="min-w-0 px-0">
        <div className="flex flex-col gap-4 px-6 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as "open" | "resolved")}>
            <TabsList>
              <TabsTrigger value="open" className="gap-1.5">
                Open
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                  {openCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="resolved" className="gap-1.5">
                Resolved
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                  {resolvedCount}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {showAllLink ? (
            <a
              href="/exceptions"
              className="text-sm font-medium text-accent hover:underline"
            >
              View all exceptions
            </a>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading exceptions…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <p className="text-sm font-medium text-destructive">Could not load exceptions</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            {onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry} className="font-medium">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Try again
              </Button>
            ) : null}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-success/10">
              <Check className="h-5 w-5 text-success" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">All caught up</p>
            <p className="text-sm text-muted-foreground">
              No {filter} exceptions right now.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Transaction</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden md:table-cell">Reason</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((exception) => {
                const txn = primaryTxn(exception)
                const side = txn?.source === "bank" ? "Bank" : "Internal"
                const isOpen = exception.status === "open"
                const isMismatch = exception.exception_type === "mismatch"
                const isExpanded = expandedId === exception.id
                return (
                  <Fragment key={exception.id}>
                    <TableRow>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            isMismatch
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-border bg-secondary/40 text-muted-foreground",
                          )}
                        >
                          {isMismatch ? "Mismatch" : "Unmatched"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium text-foreground">
                          {txn?.description ?? txn?.reference ?? `${side} transaction #${txn?.id}`}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {side} · {txn?.reference ?? "no reference"}
                        </p>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {txn ? dateFormatter.format(new Date(txn.date)) : "—"}
                      </TableCell>
                      <TableCell>
                        {isMismatch ? (
                          <p className="font-mono text-sm font-medium text-foreground">
                            {currency.format(exception.bank_txn?.amount ?? 0)}{" "}
                            <span className="text-muted-foreground">vs</span>{" "}
                            {currency.format(exception.internal_txn?.amount ?? 0)}
                          </p>
                        ) : (
                          <p
                            className={cn(
                              "font-mono text-sm font-medium",
                              txn && txn.amount < 0 ? "text-foreground" : "text-success",
                            )}
                          >
                            {txn ? currency.format(txn.amount) : "—"}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {exception.reason}
                      </TableCell>
                      <TableCell className="text-right">
                        {isOpen ? (
                          isMismatch ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="font-medium"
                              disabled={resolving === exception.id}
                              onClick={() => handleResolve(exception.id, "resolved")}
                            >
                              {resolving === exception.id ? "Saving…" : "Accept match"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="font-medium"
                              onClick={() => toggleExpand(exception.id)}
                            >
                              <Sparkles
                                className={cn("h-3.5 w-3.5", isExpanded && "text-accent")}
                                aria-hidden="true"
                              />
                              {isExpanded ? "Hide" : "Find match"}
                            </Button>
                          )
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="font-medium text-muted-foreground"
                            disabled={resolving === exception.id}
                            onClick={() => handleResolve(exception.id, "open")}
                          >
                            Reopen
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>

                    {isOpen && !isMismatch && isExpanded ? (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={6} className="px-6 py-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">
                                Smart suggestions
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-muted-foreground"
                                onClick={() => setExpandedId(null)}
                              >
                                <X className="h-4 w-4" aria-hidden="true" />
                                Close
                              </Button>
                            </div>

                            {loadingSuggestions.has(exception.id) ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                Finding potential matches…
                              </div>
                            ) : suggestionErrors[exception.id] ? (
                              <div className="flex flex-col items-start gap-2">
                                <p className="text-sm text-destructive">
                                  {suggestionErrors[exception.id]}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="font-medium"
                                  onClick={() => void loadSuggestions(exception.id)}
                                >
                                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                                  Try again
                                </Button>
                              </div>
                            ) : (suggestions[exception.id] ?? []).length === 0 ? (
                              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                                No strong matches found for this transaction yet.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {(suggestions[exception.id] ?? []).map((s) => {
                                  const pending =
                                    matching?.txnId === s.transaction_id &&
                                    matching?.exceptionId === exception.id
                                  return (
                                    <div
                                      key={s.transaction_id}
                                      className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <div className="min-w-0 space-y-1">
                                        <p className="text-sm font-medium text-foreground">
                                          {s.description ??
                                            s.reference ??
                                            `${s.source} #${s.transaction_id}`}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {currency.format(s.amount)} ·{" "}
                                          {dateFormatter.format(new Date(s.date))}
                                          {s.reference ? ` · ${s.reference}` : ""}
                                        </p>
                                        {s.reasons.length > 0 ? (
                                          <div className="flex flex-wrap gap-1 pt-0.5">
                                            {s.reasons.map((r) => (
                                              <Badge
                                                key={r}
                                                variant="secondary"
                                                className="text-[11px] font-normal"
                                              >
                                                {r}
                                              </Badge>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                                        <ConfidenceIndicator value={s.confidence} />
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="font-medium"
                                          disabled={pending || matching !== null}
                                          onClick={() =>
                                            handleMatch(exception.id, s.transaction_id)
                                          }
                                        >
                                          {pending ? "Matching…" : "Match"}
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            <div className="flex justify-end border-t pt-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="font-medium text-muted-foreground"
                                disabled={resolving === exception.id}
                                onClick={() => handleResolve(exception.id, "resolved")}
                              >
                                {resolving === exception.id ? "Saving…" : "Resolve without matching"}
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}