import { AppTopbar } from "@/components/app/app-topbar"
import { Card } from "@/components/ui/card"
import { ExceptionsPanel } from "@/components/exceptions/exceptions-panel"
import { exceptions } from "@/lib/mock-data"

export default function ExceptionsPage() {
  const openExceptions = exceptions.filter((e) => e.status === "open")
  const lowConfidence = openExceptions.filter((e) => e.confidence < 50).length
  const avgConfidence = Math.round(
    openExceptions.reduce((sum, e) => sum + e.confidence, 0) / (openExceptions.length || 1),
  )

  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        title="Exceptions"
        description="Discrepancies flagged across every client account this period"
      />

      <div className="flex-1 space-y-6 px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="gap-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Open exceptions</p>
            <p className="font-mono text-2xl font-semibold text-foreground">{openExceptions.length}</p>
          </Card>
          <Card className="gap-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Average match confidence</p>
            <p className="font-mono text-2xl font-semibold text-foreground">{avgConfidence}%</p>
          </Card>
          <Card className="gap-1 p-5">
            <p className="text-sm font-medium text-muted-foreground">Needs immediate review</p>
            <p className="font-mono text-2xl font-semibold text-destructive">{lowConfidence}</p>
          </Card>
        </div>

        <ExceptionsPanel />
      </div>
    </div>
  )
}
