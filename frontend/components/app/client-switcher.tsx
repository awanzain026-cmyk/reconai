"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Building2, ChevronsUpDown, Plus } from "lucide-react"
import { useClients } from "@/lib/use-clients"
import { setActiveClientId } from "@/lib/client-selection"

/**
 * The client switcher is the core firm workflow: pick the entity, and every
 * screen below (dashboard, upload, exceptions, history, workpaper) re-scopes.
 */
export function ClientSwitcher() {
  const { clients, activeId, loading } = useClients()
  const router = useRouter()

  if (loading) {
    return <div className="h-8 w-44 animate-pulse rounded-lg bg-secondary" aria-hidden="true" />
  }

  if (clients.length === 0) {
    return (
      <Link
        href="/clients"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add a client
      </Link>
    )
  }

  return (
    <label className="relative flex h-8 items-center gap-2 rounded-lg border border-border bg-background pl-2.5">
      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <select
        aria-label="Active client"
        className="max-w-[13rem] cursor-pointer appearance-none truncate bg-transparent pr-6 text-sm font-medium text-foreground outline-none"
        value={activeId ?? ""}
        onChange={(event) => {
          setActiveClientId(Number(event.target.value))
          router.refresh()
        }}
      >
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 text-muted-foreground"
        aria-hidden="true"
      />
    </label>
  )
}
