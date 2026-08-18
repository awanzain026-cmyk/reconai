import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DemoButton } from "@/components/marketing/demo-button"

export function CtaSection() {
  return (
    <section id="security" className="bg-background">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col items-start justify-between gap-8 rounded-2xl border border-border bg-secondary/50 px-8 py-12 md:flex-row md:items-center">
          <div className="max-w-lg">
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              See ReconAI on your own client accounts.
            </h2>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
              Bank-grade encryption, read-only bank connections, and full audit trails on every match. Built
              to satisfy your firm&apos;s review standards, not just your workflow.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <DemoButton
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-medium"
            >
              View live demo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </DemoButton>
            <Button
              nativeButton={false}
              render={<Link href="/login?mode=signup" />}
              size="lg"
              variant="outline"
              className="font-medium"
            >
              Sign up free
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
