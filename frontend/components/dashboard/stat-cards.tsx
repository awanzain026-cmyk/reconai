import { CircleCheck, Landmark, ReceiptText, TriangleAlert } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { ReconcileSummary } from "@/lib/api"
import { cn } from "@/lib/utils"

export function StatCards({ summary }: { summary: ReconcileSummary }) {
  const matchRate =
    summary.bank_total > 0 ? Math.round((summary.matched / summary.bank_total) * 100) : 0

  const stats: {
    label: string
    value: string
    icon: typeof CircleCheck
    tone: "positive" | "warning" | "neutral"
    note: string
  }[] = [
    {
      label: "Transactions matched",
      value: summary.matched.toLocaleString(),
      icon: CircleCheck,
      tone: "positive",
      note: `${matchRate}% of the bank list · ${summary.method_counts.reference ?? 0} by reference, ${summary.method_counts.amount_date ?? 0} by amount+date`,
    },
    {
      label: "Bank unmatched",
      value: summary.unmatched_bank.toLocaleString(),
      icon: Landmark,
      tone: summary.unmatched_bank > 0 ? "warning" : "neutral",
      note: `of ${summary.bank_total.toLocaleString()} bank transactions`,
    },
    {
      label: "Internal unmatched",
      value: summary.unmatched_internal.toLocaleString(),
      icon: ReceiptText,
      tone: summary.unmatched_internal > 0 ? "warning" : "neutral",
      note: `of ${summary.internal_total.toLocaleString()} internal transactions`,
    },
    {
      label: "Open exceptions",
      value: summary.open_exceptions.toLocaleString(),
      icon: TriangleAlert,
      tone: summary.open_exceptions > 0 ? "warning" : "neutral",
      note:
        summary.amount_mismatches > 0
          ? `${summary.amount_mismatches} with an amount mismatch`
          : "Nothing flagged for review",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="gap-0 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
              <stat.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-foreground">
            {stat.value}
          </p>
          <p
            className={cn(
              "mt-1.5 flex items-center gap-1 text-xs font-medium",
              stat.tone === "positive" && "text-success",
              stat.tone === "warning" && "text-amber-600",
              stat.tone === "neutral" && "text-muted-foreground",
            )}
          >
            {stat.note}
          </p>
        </Card>
      ))}
    </div>
  )
}