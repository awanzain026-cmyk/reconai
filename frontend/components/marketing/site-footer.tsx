import { Logo } from "@/components/logo"

const columns = [
  {
    title: "Product",
    links: ["Auto-matching", "Exception review", "Multi-client dashboard", "Integrations"],
  },
  {
    title: "Firm",
    links: ["Security", "Compliance", "Status", "Support"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Contact"],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              AI-powered bank reconciliation built for accounting and bookkeeping firms managing multiple
              clients.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col-reverse items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">© 2026 ReconAI, Inc. All rights reserved.</p>
          <p className="text-xs text-muted-foreground">SOC 2 Type II · 256-bit encryption · Read-only bank access</p>
        </div>
      </div>
    </footer>
  )
}
