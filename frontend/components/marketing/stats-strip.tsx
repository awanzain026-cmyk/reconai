const stats = [
  { value: "96.4%", label: "Average auto-match rate across client books" },
  { value: "40+ hrs", label: "Saved per month for a 50-client firm" },
  { value: "500+", label: "Client accounts reconciled monthly on ReconAI" },
  { value: "<24 hrs", label: "From statement import to exception review" },
]

export function StatsStrip() {
  return (
    <section id="how-it-works" className="border-b border-border bg-primary">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="font-mono text-3xl font-semibold text-accent">{stat.value}</p>
              <p className="mt-2 text-sm leading-relaxed text-primary-foreground/70">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
