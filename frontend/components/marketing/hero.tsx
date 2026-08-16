import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductPreview } from "@/components/marketing/product-preview"

export function Hero() {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 py-20 md:grid-cols-2 md:items-center md:py-28 [&>*]:min-w-0">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            Built for accounting &amp; bookkeeping firms
          </div>
          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Reconciliation across every client account, without the spreadsheets.
          </h1>
          <p className="mt-5 max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground">
            Your team is still matching bank statements to the ledger line by line, client by client. ReconAI
            automates the matching, flags what actually needs a human, and gives you one clean view across
            every account you manage.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              nativeButton={false}
              render={<Link href="/dashboard" />}
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-medium"
            >
              Get a demo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/dashboard" />}
              size="lg"
              variant="outline"
              className="font-medium"
            >
              See a live dashboard
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            No card required. SOC 2 Type II report available on request.
          </p>
        </div>

        <ProductPreview />
      </div>
    </section>
  )
}
