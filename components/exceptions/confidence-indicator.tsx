import { cn } from "@/lib/utils"

export function ConfidenceIndicator({ value }: { value: number }) {
  const tone = value >= 85 ? "high" : value >= 50 ? "medium" : "low"

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "high" && "bg-success",
            tone === "medium" && "bg-amber-500",
            tone === "low" && "bg-destructive",
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <span
        className={cn(
          "font-mono text-xs font-medium tabular-nums",
          tone === "high" && "text-success",
          tone === "medium" && "text-amber-600",
          tone === "low" && "text-destructive",
        )}
      >
        {value}%
      </span>
    </div>
  )
}
