import { ArrowUpRight, CircleCheck, Landmark, ReceiptText, TriangleAlert } from "lucide-react"
import { Card } from "@/components/ui/card"
import { monthlyStats } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const stats = [
  {
    label: "Accounts synced",
    value: monthlyStats.accountsSynced.toString(),
    delta: monthlyStats.accountsSyncedDelta,
    icon: Landmark,
    tone: "neutral" as const,
  },
  {
    label: "Transactions matched",
    value: monthlyStats.transactionsMatched.toLocaleString(),
    delta: monthlyStats.transactionsMatchedDelta,
    icon: ReceiptText,
    tone: "positive" as const,
  },
  {
    label: "Match rate",
    value: `${monthlyStats.matchRate}%`,
    delta: "Auto-matched this month",
    icon: CircleCheck,
    tone: "positive" as const,
  },
  {
    label: "Pending exceptions",
    value: monthlyStats.pendingExceptions.toString(),
    delta: monthlyStats.pendingExceptionsDelta,
    icon: TriangleAlert,
    tone: "warning" as const,
  },
]

export function StatCards() {
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
          <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-foreground">{stat.value}</p>
          <p
            className={cn(
              "mt-1.5 flex items-center gap-1 text-xs font-medium",
              stat.tone === "positive" && "text-success",
              stat.tone === "warning" && "text-amber-600",
              stat.tone === "neutral" && "text-muted-foreground",
            )}
          >
            {stat.tone === "positive" ? <ArrowUpRight className="h-3 w-3" aria-hidden="true" /> : null}
            {stat.delta}
          </p>
        </Card>
      ))}
    </div>
  )
}
