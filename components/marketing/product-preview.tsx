import { CheckCircle2, CircleAlert, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const rows = [
  {
    client: "Solstice Marketing Partners",
    desc: "WIRE TRF OUTGOING — ADOBE SYSTEMS",
    amount: "-$1,249.00",
    status: "review" as const,
    confidence: 62,
  },
  {
    client: "Bramblewood Design Studio",
    desc: "ACH DEPOSIT — CLIENT INVOICE #4471",
    amount: "+$4,800.00",
    status: "matched" as const,
    confidence: 99,
  },
  {
    client: "Kestrel Logistics LLC",
    desc: "PAYROLL TAX — EFTPS",
    amount: "-$3,812.44",
    status: "review" as const,
    confidence: 88,
  },
  {
    client: "Vantage Point Consulting",
    desc: "CHECK #2201 — OFFICE SUPPLY CO",
    amount: "-$212.87",
    status: "matched" as const,
    confidence: 100,
  },
]

export function ProductPreview() {
  return (
    <div className="rounded-xl border border-border bg-card shadow-[0_8px_30px_-8px_rgba(15,23,42,0.15)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Multi-client reconciliation
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">August statement — 47 accounts</p>
        </div>
        <Badge className="gap-1.5 border-accent/30 bg-accent/10 text-accent hover:bg-accent/10">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Auto-matching live
        </Badge>
      </div>

      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.desc} className="flex items-center gap-4 px-5 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary">
              {row.status === "matched" ? (
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
              ) : (
                <CircleAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{row.desc}</p>
              <p className="truncate text-xs text-muted-foreground">{row.client}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-medium text-foreground">{row.amount}</p>
              <p
                className={
                  row.status === "matched"
                    ? "text-xs font-medium text-success"
                    : "text-xs font-medium text-amber-600"
                }
              >
                {row.confidence}% match
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-b-xl bg-secondary/60 px-5 py-3">
        <p className="text-xs text-muted-foreground">2 exceptions need review</p>
        <p className="text-xs font-medium text-foreground">96.4% matched this period</p>
      </div>
    </div>
  )
}
