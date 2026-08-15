import Link from "next/link"
import { UploadCloud } from "lucide-react"
import { AppTopbar } from "@/components/app/app-topbar"
import { Button } from "@/components/ui/button"
import { StatCards } from "@/components/dashboard/stat-cards"
import { MatchVolumeChart } from "@/components/dashboard/match-volume-chart"
import { ClientsTable } from "@/components/dashboard/clients-table"

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        title="Overview"
        description="Reconciliation status across your client book"
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/upload" />}
            className="bg-accent text-accent-foreground hover:bg-accent/90 font-medium"
          >
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            Upload statement
          </Button>
        }
      />
      <div className="flex-1 space-y-6 px-6 py-6">
        <StatCards />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ClientsTable />
          </div>
          <MatchVolumeChart />
        </div>
      </div>
    </div>
  )
}
