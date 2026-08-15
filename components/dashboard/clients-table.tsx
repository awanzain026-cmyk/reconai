import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { clientAccounts } from "@/lib/mock-data"

export function ClientsTable() {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Client accounts</CardTitle>
        <CardDescription>Sync status across every account you manage</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            className="text-sm font-medium"
            render={<Link href="/exceptions" />}
          >
            View exceptions
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead className="hidden md:table-cell">Account</TableHead>
              <TableHead className="hidden sm:table-cell">Last sync</TableHead>
              <TableHead>Match rate</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientAccounts.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
                        {client.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{client.name}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{client.accountType}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {client.accountType}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                  {client.lastSync}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={client.matchedPct} className="h-1.5 w-16" />
                    <span className="font-mono text-xs text-muted-foreground">{client.matchedPct}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <StatusBadge status={client.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
