import { SiteHeader } from "@/components/marketing/site-header"
import { Hero } from "@/components/marketing/hero"
import { ProblemSolution } from "@/components/marketing/problem-solution"
import { FeatureHighlights } from "@/components/marketing/feature-highlights"
import { StatsStrip } from "@/components/marketing/stats-strip"
import { CtaSection } from "@/components/marketing/cta-section"
import { SiteFooter } from "@/components/marketing/site-footer"

export default function LandingPage() {
  return (
    <main>
      <SiteHeader />
      <Hero />
      <ProblemSolution />
      <FeatureHighlights />
      <StatsStrip />
      <CtaSection />
      <SiteFooter />
    </main>
  )
}
