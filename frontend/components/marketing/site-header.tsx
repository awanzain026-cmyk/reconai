import Link from "next/link"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { DemoButton } from "@/components/marketing/demo-button"

const navLinks = [
  { label: "Platform", href: "#platform" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Security", href: "#security" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" aria-label="ReconAI home">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            nativeButton={false}
            className="hidden text-sm font-medium sm:inline-flex"
            render={<Link href="/login" />}
          >
            Log in
          </Button>
          <DemoButton className="bg-accent text-accent-foreground hover:bg-accent/90 text-sm font-medium">
            View live demo
          </DemoButton>
        </div>
      </div>
    </header>
  )
}
