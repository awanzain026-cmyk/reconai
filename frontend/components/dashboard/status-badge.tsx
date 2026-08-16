import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const statusConfig = {
  matched: { label: "Reconciled", className: "bg-success/10 text-success border-success/20" },
  pending: { label: "Syncing", className: "bg-secondary text-muted-foreground border-border" },
  attention: { label: "Needs attention", className: "bg-amber-50 text-amber-700 border-amber-200" },
} as const

export function StatusBadge({ status }: { status: keyof typeof statusConfig }) {
  const config = statusConfig[status]
  return (
    <Badge variant="outline" className={cn("font-medium", config.className)}>
      {config.label}
    </Badge>
  )
}
