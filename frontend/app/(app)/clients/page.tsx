"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowRight,
  Building2,
  Check,
  Loader2,
  Plus,
  Printer,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { AppTopbar } from "@/components/app/app-topbar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { api, getErrorMessage } from "@/lib/api"
import { useClients } from "@/lib/use-clients"
import { setActiveClientId } from "@/lib/client-selection"
import { currency, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export default function ClientsPage() {
  const router = useRouter()
  const { clients, activeId, loading, error, reload } = useClients()
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [creating, setCreating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const totalAtRisk = clients.reduce((sum, c) => sum + c.amount_at_risk, 0)
  const totalOpen = clients.reduce((sum, c) => sum + c.open_exceptions, 0)

  async function createClient(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setActionError(null)
    try {
      const client = await api.createClient({
        name: name.trim(),
        code: code.trim() || undefined,
      })
      setName("")
      setCode("")
      setActiveClientId(client.id)
      await reload()
      router.push("/dashboard")
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  async function openClient(id: number) {
    setActiveClientId(id)
    router.push("/dashboard")
  }

  async function deleteClient(id: number) {
    setDeleting(id)
    setActionError(null)
    try {
      await api.deleteClient(id)
      if (activeId === id) setActiveClientId(null)
      setConfirmingDelete(null)
      await reload()
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        title="Clients"
        description="Every entity in your workspace — each with its own books, exceptions and history"
      />

      <div className="flex-1 space-y-6 px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="gap-1 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Clients</p>
              <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="mt-2 font-mono text-2xl font-semibold text-foreground">
              {loading ? "…" : clients.length}
            </p>
            <p className="text-xs text-muted-foreground">Entities under reconciliation</p>
          </Card>
          <Card className="gap-1 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Open exceptions</p>
              <TriangleAlert className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="mt-2 font-mono text-2xl font-semibold text-foreground">
              {loading ? "…" : totalOpen}
            </p>
            <p className="text-xs text-muted-foreground">Across the whole firm</p>
          </Card>
          <Card className="gap-1 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Amount at risk</p>
              <ShieldAlert className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <p
              className={cn(
                "mt-2 font-mono text-2xl font-semibold",
                totalAtRisk > 0 ? "text-destructive" : "text-success",
              )}
            >
              {loading ? "…" : currency.format(totalAtRisk)}
            </p>
            <p className="text-xs text-muted-foreground">Unresolved value across all clients</p>
          </Card>
        </div>

        <Card className="gap-4 p-5">
          <div>
            <p className="text-sm font-semibold text-foreground">Add a client</p>
            <p className="text-xs text-muted-foreground">
              New client workspaces start empty — upload their statement and ledger next.
            </p>
          </div>
          <form onSubmit={createClient} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Client name, e.g. Northwind Trading Ltd"
              aria-label="Client name"
              className="sm:max-w-sm"
            />
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Code (optional)"
              aria-label="Client code"
              className="sm:max-w-40"
            />
            <Button
              type="submit"
              disabled={creating || !name.trim()}
              className="bg-accent font-medium text-accent-foreground hover:bg-accent/90"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add client
                </>
              )}
            </Button>
          </form>
          {actionError ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {actionError}
            </p>
          ) : null}
        </Card>

        {error ? (
          <Card className="gap-3 p-6">
            <p className="text-sm font-medium text-destructive">Could not load clients</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="w-fit font-medium" onClick={() => void reload()}>
              Try again
            </Button>
          </Card>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading clients…</p>
        ) : clients.length === 0 ? (
          <Card className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">No clients yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first client above to start reconciling.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {clients.map((client) => {
              const rate =
                client.bank_total > 0
                  ? Math.round((client.matched / client.bank_total) * 100)
                  : 0
              const isActive = client.id === activeId
              return (
                <Card
                  key={client.id}
                  className={cn("gap-4 p-5", isActive && "ring-2 ring-accent/40")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-foreground">
                          {client.name}
                        </p>
                        {client.code ? (
                          <Badge variant="secondary" className="font-mono text-[11px]">
                            {client.code}
                          </Badge>
                        ) : null}
                        {isActive ? (
                          <Badge className="gap-1 bg-accent text-accent-foreground">
                            <Check className="h-3 w-3" aria-hidden="true" />
                            Active
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {client.bank_total + client.internal_total === 0
                          ? "No statements uploaded yet"
                          : `${client.bank_total} bank · ${client.internal_total} internal transactions`}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 rounded-lg bg-secondary/50 p-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Match rate
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 font-mono text-lg font-semibold",
                          rate >= 95
                            ? "text-success"
                            : rate >= 80
                              ? "text-amber-600"
                              : "text-foreground",
                        )}
                      >
                        {client.bank_total > 0 ? `${rate}%` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Open items
                      </p>
                      <p className="mt-0.5 font-mono text-lg font-semibold text-foreground">
                        {client.open_exceptions}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        At risk
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 font-mono text-lg font-semibold",
                          client.amount_at_risk > 0 ? "text-destructive" : "text-success",
                        )}
                      >
                        {currency.format(client.amount_at_risk)}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Last reconciled: {formatDateTime(client.last_run_at)}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-accent font-medium text-accent-foreground hover:bg-accent/90"
                      onClick={() => void openClient(client.id)}
                    >
                      Open
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      nativeButton={false}
                      render={<Link href={`/workpaper?client_id=${client.id}`} />}
                      size="sm"
                      variant="outline"
                      className="font-medium"
                    >
                      <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                      Workpaper
                    </Button>

                    {confirmingDelete === client.id ? (
                      <span className="ml-auto flex items-center gap-2">
                        <span className="text-xs font-medium text-destructive">Delete client and all data?</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleting === client.id}
                          onClick={() => void deleteClient(client.id)}
                        >
                          {deleting === client.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              Deleting…
                            </>
                          ) : (
                            "Confirm"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmingDelete(null)}
                        >
                          Cancel
                        </Button>
                      </span>
                    ) : (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="ml-auto text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${client.name}`}
                        title="Delete client"
                        onClick={() => setConfirmingDelete(client.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
