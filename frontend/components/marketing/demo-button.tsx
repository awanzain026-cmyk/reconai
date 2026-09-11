"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { api, setSession, getErrorMessage } from "@/lib/api"

type DemoButtonProps = {
  className?: string
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
  children?: ReactNode
}

export function DemoButton({ className, size, variant, children }: DemoButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startDemo() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.demoLogin()
      setSession(res.access_token, res.email)
      router.push("/dashboard")
    } catch (err) {
      setLoading(false)
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={loading}
        onClick={() => void startDemo()}
      >
        {loading ? "Loading demo…" : (children ?? "View live demo")}
      </Button>
      {error ? (
        <p className="max-w-xs text-xs text-muted-foreground">{error}</p>
      ) : null}
    </div>
  )
}