export type ClientAccount = {
  id: string
  name: string
  initials: string
  accountType: string
  lastSync: string
  status: "matched" | "pending" | "attention"
  transactions: number
  matchedPct: number
}

export const clientAccounts: ClientAccount[] = [
  {
    id: "acc_001",
    name: "Harborview Dental Group",
    initials: "HD",
    accountType: "Operating — Chase Business",
    lastSync: "2 hours ago",
    status: "matched",
    transactions: 412,
    matchedPct: 99,
  },
  {
    id: "acc_002",
    name: "Solstice Marketing Partners",
    initials: "SM",
    accountType: "Operating — Bank of America",
    lastSync: "6 hours ago",
    status: "attention",
    transactions: 287,
    matchedPct: 91,
  },
  {
    id: "acc_003",
    name: "Kestrel Logistics LLC",
    initials: "KL",
    accountType: "Payroll — Wells Fargo",
    lastSync: "1 day ago",
    status: "pending",
    transactions: 156,
    matchedPct: 78,
  },
  {
    id: "acc_004",
    name: "Bramblewood Design Studio",
    initials: "BD",
    accountType: "Operating — Mercury",
    lastSync: "3 hours ago",
    status: "matched",
    transactions: 198,
    matchedPct: 100,
  },
  {
    id: "acc_005",
    name: "Northgate Property Mgmt",
    initials: "NP",
    accountType: "Trust — Chase Business",
    lastSync: "5 hours ago",
    status: "attention",
    transactions: 534,
    matchedPct: 88,
  },
  {
    id: "acc_006",
    name: "Vantage Point Consulting",
    initials: "VC",
    accountType: "Operating — Silicon Valley Bank",
    lastSync: "12 hours ago",
    status: "matched",
    transactions: 96,
    matchedPct: 100,
  },
  {
    id: "acc_007",
    name: "Fernwood Veterinary Clinic",
    initials: "FV",
    accountType: "Operating — US Bank",
    lastSync: "2 days ago",
    status: "pending",
    transactions: 221,
    matchedPct: 82,
  },
]

export type Exception = {
  id: string
  client: string
  description: string
  bankAmount: number
  ledgerAmount: number | null
  date: string
  confidence: number
  reason: string
  status: "open" | "resolved"
}

export const exceptions: Exception[] = [
  {
    id: "exc_1042",
    client: "Solstice Marketing Partners",
    description: "WIRE TRF OUTGOING — ADOBE SYSTEMS",
    bankAmount: -1249.0,
    ledgerAmount: -1200.0,
    date: "2026-08-11",
    confidence: 62,
    reason: "Amount mismatch",
    status: "open",
  },
  {
    id: "exc_1043",
    client: "Northgate Property Mgmt",
    description: "ACH DEPOSIT — TENANT RENT 4B",
    bankAmount: 2450.0,
    ledgerAmount: null,
    date: "2026-08-12",
    confidence: 24,
    reason: "No ledger match found",
    status: "open",
  },
  {
    id: "exc_1044",
    client: "Kestrel Logistics LLC",
    description: "PAYROLL TAX — EFTPS",
    bankAmount: -3812.44,
    ledgerAmount: -3812.44,
    date: "2026-08-10",
    confidence: 88,
    reason: "Date offset by 3 days",
    status: "open",
  },
  {
    id: "exc_1045",
    client: "Fernwood Veterinary Clinic",
    description: "CHECK #1182 — VETSOURCE SUPPLY",
    bankAmount: -864.2,
    ledgerAmount: -846.2,
    date: "2026-08-09",
    confidence: 71,
    reason: "Amount mismatch",
    status: "open",
  },
  {
    id: "exc_1046",
    client: "Northgate Property Mgmt",
    description: "DEBIT CARD — HOME DEPOT #0412",
    bankAmount: -212.87,
    ledgerAmount: -212.87,
    date: "2026-08-13",
    confidence: 94,
    reason: "Duplicate candidate — 2 possible ledger matches",
    status: "open",
  },
  {
    id: "exc_1047",
    client: "Solstice Marketing Partners",
    description: "REFUND — GOOGLE ADS",
    bankAmount: 340.0,
    ledgerAmount: null,
    date: "2026-08-08",
    confidence: 18,
    reason: "No ledger match found",
    status: "open",
  },
  {
    id: "exc_1039",
    client: "Kestrel Logistics LLC",
    description: "FUEL — SHELL FLEET SVC",
    bankAmount: -518.33,
    ledgerAmount: -518.33,
    date: "2026-08-05",
    confidence: 97,
    reason: "Date offset by 1 day",
    status: "resolved",
  },
]

export const monthlyStats = {
  accountsSynced: 47,
  accountsSyncedDelta: "+5 this month",
  transactionsMatched: 18420,
  transactionsMatchedDelta: "+2,180 vs last month",
  matchRate: 96.4,
  pendingExceptions: exceptions.filter((e) => e.status === "open").length,
  pendingExceptionsDelta: "3 need review today",
}

export const matchVolume = [
  { month: "Mar", matched: 12400, exceptions: 620 },
  { month: "Apr", matched: 13850, exceptions: 540 },
  { month: "May", matched: 14920, exceptions: 610 },
  { month: "Jun", matched: 16100, exceptions: 480 },
  { month: "Jul", matched: 17240, exceptions: 410 },
  { month: "Aug", matched: 18420, exceptions: 380 },
]
