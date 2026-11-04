import { Clock, ShieldAlert, Target, TriangleAlert } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { ReconcileSummary } from "@/lib/api"
import { currency, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export function StatCards({ summary }: { summary: ReconcileSummary }) {
  const matchRate =
    summary.bank_total > 0 ? Math.round((summary.matched / summary.bank_total) * 100) : 0
  const byReference = summary.method_counts.reference ?? 0
  const byAmountDate = summary.method_counts.amount_date ?? 0
  const byHand = summary.method_counts.manual ?? 0

  const stats: {
    label: string
    value: string
    icon: typeof Target
    tone: "positive" | "warning" | "danger" | "neutral"
    note: string
  }[] = [
    {
      label: "Match rate",
      value: `${matchRate}%`,
      icon: Target,
      tone: matchRate >= 95 ? "positive" : matchRate >= 80 ? "warning" : "danger",
      note: `${summary.matched} of ${summary.bank_total} bank transactions · ${byReference} by reference, ${byAmountDate} by amount+date${byHand > 0 ? `, ${byHand} by hand` : ""}`,
    },
    {
      label: "Amount at risk",
      value: currency.format(summary.amount_at_risk),
      icon: ShieldAlert,
      tone: summary.amount_at_risk > 0 ? "danger" : "positive",
      note:
        summary.amount_at_risk > 0
          ? `${summary.open_exceptions} open item${summary.open_exceptions === 1 ? "" : "s"} need a human decision`
          : "Nothing unresolved — books tie",
    },
    {
      label: "Open exceptions",
      value: summary.open_exceptions.toLocaleString(),
      icon: TriangleAlert,
      tone: summary.open_exceptions > 0 ? "warning" : "positive",
      note: `${summary.unmatched_bank} bank · ${summary.unmatched_internal} internal unmatched${summary.amount_mismatches > 0 ? ` · ${summary.amount_mismatches} amount mismatch${summary.amount_mismatches === 1 ? "" : "es"}` : ""}`,
    },
    {
      label: "Last reconciled",
      value: summary.last_run_at ? formatDateTime(summary.last_run_at) : "Not yet",
      icon: Clock,
      tone: "neutral",
      note: summary.client_name ? `Client: ${summary.client_name}` : "Run a reconciliation to start the trail",
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
              "mt-1.5 flex items-start gap-1 text-xs font-medium",
              stat.tone === "positive" && "text-success",
              stat.tone === "warning" && "text-amber-600",
              stat.tone === "danger" && "text-destructive",
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
