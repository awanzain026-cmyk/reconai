"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfidenceIndicator } from "@/components/exceptions/confidence-indicator"
import { exceptions as initialExceptions, type Exception } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })

export function ExceptionsPanel() {
  const [items, setItems] = useState<Exception[]>(initialExceptions)
  const [filter, setFilter] = useState<"open" | "resolved">("open")

  const openCount = items.filter((e) => e.status === "open").length
  const resolvedCount = items.filter((e) => e.status === "resolved").length

  const visible = useMemo(() => items.filter((e) => e.status === filter), [items, filter])

  function resolve(id: string) {
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, status: "resolved" } : e)))
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
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-success/10">
              <Check className="h-5 w-5 text-success" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">All caught up</p>
            <p className="text-sm text-muted-foreground">No {filter} exceptions right now.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>Bank amount</TableHead>
                <TableHead className="hidden md:table-cell">Ledger amount</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((exception) => (
                <TableRow key={exception.id}>
                  <TableCell>
                    <p className="text-sm font-medium text-foreground">{exception.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {exception.client} · {exception.reason}
                    </p>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {dateFormatter.format(new Date(exception.date))}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-mono text-sm font-medium",
                      exception.bankAmount < 0 ? "text-foreground" : "text-success",
                    )}
                  >
                    {currency.format(exception.bankAmount)}
                  </TableCell>
                  <TableCell className="hidden font-mono text-sm md:table-cell">
                    {exception.ledgerAmount === null ? (
                      <span className="text-muted-foreground">No match</span>
                    ) : (
                      <span className="text-foreground">{currency.format(exception.ledgerAmount)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ConfidenceIndicator value={exception.confidence} />
                  </TableCell>
                  <TableCell className="text-right">
                    {exception.status === "open" ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-medium"
                          onClick={() => resolve(exception.id)}
                        >
                          Resolve
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button size="icon" variant="ghost" aria-label="More actions" />}
                          >
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => resolve(exception.id)}>
                              Mark as resolved
                            </DropdownMenuItem>
                            <DropdownMenuItem>Flag as duplicate</DropdownMenuItem>
                            <DropdownMenuItem>Assign to teammate</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ) : (
                      <Badge variant="outline" className="border-success/20 bg-success/10 text-success">
                        Resolved
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
