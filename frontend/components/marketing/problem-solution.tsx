import { Check, X } from "lucide-react"

const problems = [
  "Staff export CSVs from five different banks and reconcile each client by hand in a spreadsheet.",
  "Discrepancies get discovered days later, after month-end close — or during the client review call.",
  "There's no single view of reconciliation status across the client book. Managers ask, staff dig.",
]

const solutions = [
  "ReconAI pulls bank and ledger data automatically and matches transactions the moment they land.",
  "Every mismatch is flagged same-day with a confidence score, so review time goes to what matters.",
  "One dashboard shows sync status, match rate, and open exceptions across every client, live.",
]

export function ProblemSolution() {
  return (
    <section className="border-b border-border bg-secondary/40">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">The problem</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Manual reconciliation doesn&apos;t scale past a handful of clients.
          </h2>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold text-muted-foreground">Today, without ReconAI</h3>
            <ul className="mt-5 space-y-4">
              {problems.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-foreground">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-accent/30 bg-card p-6 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
            <h3 className="text-sm font-semibold text-accent">With ReconAI</h3>
            <ul className="mt-5 space-y-4">
              {solutions.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
