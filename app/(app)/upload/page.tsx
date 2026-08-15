"use client"

import { Sparkles } from "lucide-react"
import { AppTopbar } from "@/components/app/app-topbar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dropzone } from "@/components/upload/dropzone"
import { clientAccounts } from "@/lib/mock-data"

const recentUploads = [
  { client: "Solstice Marketing Partners", type: "Bank statement", file: "chase_aug_2026.csv", uploaded: "Today, 9:14 AM", status: "Matched" },
  { client: "Kestrel Logistics LLC", type: "Internal ledger", file: "kestrel_gl_aug.csv", uploaded: "Today, 8:52 AM", status: "Matched" },
  { client: "Northgate Property Mgmt", type: "Bank statement", file: "chase_trust_aug.csv", uploaded: "Yesterday, 4:30 PM", status: "3 exceptions" },
  { client: "Fernwood Veterinary Clinic", type: "Internal ledger", file: "fernwood_ledger_aug.csv", uploaded: "Yesterday, 2:05 PM", status: "Matched" },
]

export default function UploadPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppTopbar
        title="Upload statements"
        description="Import a bank statement and internal ledger to run reconciliation"
      />

      <div className="flex-1 space-y-6 px-6 py-6">
        <div className="grid min-w-0 gap-6 lg:grid-cols-3">
          <Card className="min-w-0 gap-5 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold">New reconciliation run</CardTitle>
              <CardDescription>
                Files are matched automatically once both uploads are in. You&apos;ll be notified when exceptions
                are ready for review.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="client-select" className="text-sm font-medium text-foreground">
                  Client account
                </Label>
                <Select defaultValue={clientAccounts[0].id}>
                  <SelectTrigger id="client-select" className="mt-2 w-full">
                    <SelectValue placeholder="Select a client account" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientAccounts.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} — {client.accountType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <Dropzone
                  label="Bank statement"
                  description="Exported directly from the bank portal"
                />
                <Dropzone
                  label="Internal records"
                  description="General ledger export from your accounting system"
                />
              </div>

              <div className="flex flex-col gap-3 rounded-lg bg-secondary/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                  ReconAI will auto-match transactions and flag exceptions for review
                </p>
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0 font-medium">
                  Run reconciliation
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="text-base font-semibold">File requirements</CardTitle>
              <CardDescription>Keep imports clean for the highest match rate</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  CSV format with a header row — date, description, and amount columns required.
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  One statement period per file. Split multi-month exports before uploading.
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  Internal records should reflect the same date range as the bank statement.
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  Files are processed in a read-only, encrypted environment and never modified.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="min-w-0 gap-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent uploads</CardTitle>
            <CardDescription>Latest statement and ledger imports across your client book</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden sm:table-cell">File</TableHead>
                  <TableHead className="hidden md:table-cell">Uploaded</TableHead>
                  <TableHead className="text-right">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentUploads.map((row) => (
                  <TableRow key={row.file}>
                    <TableCell className="text-sm font-medium text-foreground">{row.client}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.type}</TableCell>
                    <TableCell className="hidden font-mono text-sm text-muted-foreground sm:table-cell">
                      {row.file}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {row.uploaded}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium text-foreground">
                      {row.status}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
