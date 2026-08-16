"use client"

import { useMemo, useState } from "react"
import { Check, Loader2, RefreshCw } from "lucide-react"
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
import type { Exception } from "@/lib/api"
import { cn } from "@/lib/utils"

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })

function primaryTxn(e: Exception) {
  return e.bank_txn ?? e.internal_txn
}

export function ExceptionsPanel({
  items,
  onResolve,
  initialFilter = "open",
  loading = false,
  error = null,
  onRetry,
  showAllLink = false,
}: {
  items: Exception[]
  onResolve: (id: number, status: "open" | "resolved") => Promise<void>
  initialFilter?: "open" | "resolved"
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  showAllLink?: boolean
}) {
  const [filter, setFilter] = useState<"open" | "resolved">(initialFilter)
  const [resolving, setResolving] = useState<number | null>(null)

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
                return (
                  <TableRow key={exception.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          exception.exception_type === "mismatch"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-border bg-secondary/40 text-muted-foreground",
                        )}
                      >
                        {exception.exception_type === "mismatch" ? "Mismatch" : "Unmatched"}
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
                      {exception.exception_type === "mismatch" ? (
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
                      {exception.status === "open" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-medium"
                          disabled={resolving === exception.id}
                          onClick={() => handleResolve(exception.id, "resolved")}
                        >
                          {resolving === exception.id ? "Saving…" : "Resolve"}
                        </Button>
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
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}