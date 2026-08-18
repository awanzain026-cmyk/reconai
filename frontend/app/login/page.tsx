"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, ApiError, setSession } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "signup") {
      setMode("signup")
    }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res =
        mode === "login" ? await api.login(email, password) : await api.signup(email, password)
      setSession(res.access_token, res.email)
      router.replace("/dashboard")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <Link href="/" aria-label="ReconAI home" className="mb-8">
        <Logo />
      </Link>

      <Card className="w-full max-w-sm gap-5">
        <CardHeader className="text-center">
          <CardTitle className="text-lg font-semibold">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Log in to review your reconciliation dashboard."
              : "Sign up to start reconciling bank statements."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
            <TabsList className="w-full">
              <TabsTrigger value="login" className="flex-1">
                Log in
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">
                Sign up
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@firm.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>

            {error ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-accent font-medium text-accent-foreground hover:bg-accent/90"
            >
              {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}