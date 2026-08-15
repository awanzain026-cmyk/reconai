import { LayoutGrid, ScanSearch, Wand2 } from "lucide-react"

const features = [
  {
    icon: Wand2,
    title: "Auto-matching",
    description:
      "Bank feeds and ledger entries are matched automatically using amount, date, and description patterns learned from your firm's own history — not a generic model.",
  },
  {
    icon: ScanSearch,
    title: "Exception flagging",
    description:
      "Anything that doesn't match cleanly is surfaced with a confidence score and the likely reason, so your team reviews five transactions instead of five hundred.",
  },
  {
    icon: LayoutGrid,
    title: "Multi-client view",
    description:
      "See sync status, match rate, and open exceptions across your entire client book in one dashboard — no more switching logins between accounts.",
  },
]

export function FeatureHighlights() {
  return (
    <section id="platform" className="border-b border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">The platform</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Everything your reconciliation workflow needs, nothing it doesn&apos;t.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <feature.icon className="h-5 w-5 text-accent" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-base font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
