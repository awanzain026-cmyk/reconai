// Formatting helpers shared by the dashboard, history and workpaper.

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export const currencyWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

/** API timestamps are stored as naive UTC, so add the Z before parsing. */
export function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value)
  return new Date(hasZone ? value : `${value}Z`)
}

/** Date-only values (transaction dates) must not shift across time zones. */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null
  return new Date(`${value}T00:00:00`)
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
})

export function formatDateTime(value: string | null | undefined): string {
  const date = parseTimestamp(value)
  return date ? dateTimeFormatter.format(date) : "—"
}

export function formatDate(value: string | null | undefined): string {
  const date = parseTimestamp(value)
  return date ? dateFormatter.format(date) : "—"
}

export function formatShortDate(value: string | null | undefined): string {
  const date = parseTimestamp(value)
  return date ? shortDateFormatter.format(date) : "—"
}

export function formatTxnDate(value: string | null | undefined): string {
  const date = parseDateOnly(value)
  return date ? dateFormatter.format(date) : "—"
}

export function relativeTime(value: string | null | undefined): string {
  const date = parseTimestamp(value)
  if (!date) return "—"
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`
  return dateFormatter.format(date)
}

/** "2026-08-01" .. "2026-08-28" -> "Aug 2026" (or a range when months differ). */
export function periodLabel(dates: (string | null | undefined)[]): string {
  const parsed = dates
    .map((d) => parseDateOnly(d))
    .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
  if (parsed.length === 0) return "—"

  const first = parsed[0]
  const last = parsed[parsed.length - 1]
  const month = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" })
  const firstLabel = month.format(first)
  const lastLabel = month.format(last)
  return firstLabel === lastLabel ? firstLabel : `${firstLabel} – ${lastLabel}`
}
