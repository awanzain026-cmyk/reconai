"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { api, setSession } from "@/lib/api"

type DemoButtonProps = {
  className?: string
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
  children?: ReactNode
}

export function DemoButton({ className, size, variant, children }: DemoButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function startDemo() {
    setLoading(true)
    try {
      const res = await api.demoLogin()
      setSession(res.access_token, res.email)
      router.push("/dashboard")
    } catch {
      setLoading(false)
      router.push("/login?mode=signup")
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={loading}
      onClick={() => void startDemo()}
    >
      {loading ? "Loading demo…" : (children ?? "View live demo")}
    </Button>
  )
}