const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
const TOKEN_KEY = "reconai_token"
const USER_KEY = "reconai_user"
const REQUEST_TIMEOUT_MS = 15_000
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 900

export type AuthResponse = {
  access_token: string
  token_type: string
  user_id: number
  email: string
}

export type Client = {
  id: number
  name: string
  code: string | null
  currency: string
  created_at: string
  bank_total: number
  internal_total: number
  matched: number
  open_exceptions: number
  amount_at_risk: number
  last_run_at: string | null
}

export type ImportResult = {
  import_id: number
  client_id: number | null
  source: "bank" | "internal"
  filename: string
  imported: number
  rejected: number
  created_at: string
  rejections: { row: string; reason: string }[]
}

export type Import = {
  id: number
  client_id: number | null
  source: "bank" | "internal"
  filename: string
  imported: number
  rejected: number
  created_at: string
}

export type TransactionRow = {
  id: number
  source: "bank" | "internal"
  date: string
  amount: number
  reference: string | null
  description: string | null
}

export type ReconcileSummary = {
  bank_total: number
  internal_total: number
  matched: number
  method_counts: Record<string, number>
  unmatched_bank: number
  unmatched_internal: number
  amount_mismatches: number
  open_exceptions: number
  amount_at_risk: number
  client_id: number | null
  client_name: string | null
  last_run_at: string | null
  period_start: string | null
  period_end: string | null
}

export type ExceptionTxn = {
  id: number
  source: "bank" | "internal"
  date: string
  amount: number
  reference: string | null
  description: string | null
}

export type Exception = {
  id: number
  exception_type: "unmatched" | "mismatch"
  reason: string
  status: "open" | "resolved"
  created_at: string
  resolved_at: string | null
  bank_txn: ExceptionTxn | null
  internal_txn: ExceptionTxn | null
}

export type Suggestion = {
  transaction_id: number
  source: "bank" | "internal"
  date: string
  amount: number
  reference: string | null
  description: string | null
  confidence: number
  reasons: string[]
}

export type Run = {
  id: number
  client_id: number
  client_name: string | null
  run_at: string
  bank_total: number
  internal_total: number
  matched: number
  unmatched_bank: number
  unmatched_internal: number
  amount_mismatches: number
  open_exceptions: number
  amount_at_risk: number
  match_rate: number
  method_counts: Record<string, number>
  triggered_by: string
}

export type AuditEvent = {
  id: number
  client_id: number | null
  client_name: string | null
  event_type: string
  message: string
  actor: string
  created_at: string
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NetworkError"
  }
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof NetworkError) return err.message
  if (err instanceof DOMException && err.name === "AbortError") {
    return "The server is taking longer than usual to wake up. Please try again in a moment."
  }
  return "Something went wrong. Please try again."
}

// ─── Session (localStorage) ───
export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function getEmail(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(USER_KEY)
}

export function setSession(token: string, email: string) {
  window.localStorage.setItem(TOKEN_KEY, token)
  window.localStorage.setItem(USER_KEY, email)
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function withClient(path: string, clientId?: number | null): string {
  if (clientId === undefined || clientId === null) return path
  return `${path}${path.includes("?") ? "&" : "?"}client_id=${clientId}`
}

// ─── Fetch helper with timeout + retry ───
// The backend sleeps when idle (FastAPI Cloud / serverless), so a first request
// can fail while the container boots. Retry a couple of times with a short
// delay and show a "waking up" message instead of a raw "Failed to fetch".
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!res.ok) {
        let detail = res.statusText
        try {
          const body = await res.json()
          if (typeof body.detail === "string") detail = body.detail
        } catch {
          /* non-JSON error body */
        }
        if (res.status === 401) {
          clearSession()
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            window.location.href = "/login"
          }
        }
        throw new ApiError(res.status, detail)
      }
      return res.json() as Promise<T>
    } catch (err) {
      clearTimeout(timer)
      lastError = err

      if (err instanceof ApiError) throw err

      const retryable =
        (err instanceof DOMException && err.name === "AbortError") ||
        err instanceof TypeError
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1))
        continue
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new NetworkError(
          "The server is still starting up. Please wait a moment and try again.",
        )
      }
      if (err instanceof TypeError) {
        throw new NetworkError(
          "Can't reach the server right now. It may be waking up — please try again.",
        )
      }
      throw err
    }
  }
  throw lastError
}

// Downloads a file from the API (blob -> browser download), so auth headers
// work and the page never navigates away.
async function downloadFile(url: string, filename: string) {
  const headers = new Headers()
  const token = getToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(url, { headers, signal: controller.signal })
    clearTimeout(timer)

    if (!res.ok) {
      let detail = res.statusText
      try {
        const body = await res.json()
        if (typeof body.detail === "string") detail = body.detail
      } catch {
        /* non-JSON error body */
      }
      if (res.status === 401) {
        clearSession()
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.href = "/login"
        }
      }
      throw new ApiError(res.status, detail)
    }

    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof ApiError) throw err
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new NetworkError("Download timed out. The server may be starting up — please try again.")
    }
    if (err instanceof TypeError) {
      throw new NetworkError("Cannot reach the server to download the file.")
    }
    throw err
  }
}

export const api = {
  /** Public liveness probe — no auth, so the login page can check the server
   *  without provoking a 401 in the console. */
  async health() {
    return request<{ app: string; docs: string }>("/")
  },

  async signup(email: string, password: string) {
    return request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  },

  async login(email: string, password: string) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  },

  async demoLogin() {
    return request<AuthResponse>("/auth/demo", { method: "POST" })
  },

  // ─── Clients ───
  async getClients() {
    return request<Client[]>("/clients")
  },

  async createClient(input: { name: string; code?: string; currency?: string }) {
    return request<Client>("/clients", {
      method: "POST",
      body: JSON.stringify(input),
    })
  },

  async updateClient(id: number, input: { name?: string; code?: string; currency?: string }) {
    return request<Client>(`/clients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    })
  },

  async deleteClient(id: number) {
    return request<{ ok: boolean; deleted_client_id: number }>(`/clients/${id}`, {
      method: "DELETE",
    })
  },

  // ─── Imports ───
  async uploadCsv(source: "bank" | "internal", file: File, clientId?: number | null) {
    const form = new FormData()
    form.append("source", source)
    form.append("file", file)
    if (clientId !== undefined && clientId !== null) {
      form.append("client_id", String(clientId))
    }
    return request<ImportResult>("/imports", { method: "POST", body: form })
  },

  async getImports(clientId?: number | null) {
    return request<Import[]>(withClient("/imports", clientId))
  },

  async getImportTransactions(importId: number) {
    return request<TransactionRow[]>(`/imports/${importId}/transactions`)
  },

  async deleteImport(importId: number) {
    return request<ReconcileSummary>(`/imports/${importId}`, { method: "DELETE" })
  },

  // ─── Reconciliation ───
  async runReconcile(clientId?: number | null) {
    return request<ReconcileSummary>(withClient("/reconcile", clientId), { method: "POST" })
  },

  async getSummary(clientId?: number | null) {
    return request<ReconcileSummary>(withClient("/reconcile", clientId))
  },

  async getRuns(clientId?: number | null, limit = 50) {
    const qs = `limit=${limit}`
    const path = clientId !== undefined && clientId !== null
      ? `/runs?client_id=${clientId}&${qs}`
      : `/runs?${qs}`
    return request<Run[]>(path)
  },

  async getAudit(clientId?: number | null, limit = 100) {
    const qs = `limit=${limit}`
    const path = clientId !== undefined && clientId !== null
      ? `/audit?client_id=${clientId}&${qs}`
      : `/audit?${qs}`
    return request<AuditEvent[]>(path)
  },

  // ─── Exceptions ───
  async getExceptions(
    status?: "open" | "resolved",
    type?: "unmatched" | "mismatch",
    clientId?: number | null,
  ) {
    const params = new URLSearchParams()
    if (status) params.set("status", status)
    if (type) params.set("type", type)
    if (clientId !== undefined && clientId !== null) params.set("client_id", String(clientId))
    const qs = params.toString()
    return request<Exception[]>(`/exceptions${qs ? `?${qs}` : ""}`)
  },

  async setExceptionStatus(id: number, status: "open" | "resolved") {
    return request<Exception>(`/exceptions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    })
  },

  async getSuggestions(exceptionId: number) {
    return request<Suggestion[]>(`/exceptions/${exceptionId}/suggestions`)
  },

  async matchException(exceptionId: number, matchTransactionId: number) {
    return request<Exception>(`/exceptions/${exceptionId}/match`, {
      method: "POST",
      body: JSON.stringify({ match_transaction_id: matchTransactionId }),
    })
  },

  // ─── Data management ───
  async deleteAllData(clientId?: number | null) {
    return request<ReconcileSummary>(withClient("/data", clientId), { method: "DELETE" })
  },

  async resetDemoData() {
    return request<Client[]>("/demo/reset", { method: "POST" })
  },

  async downloadTemplate(source: "bank" | "internal") {
    await downloadFile(`${API_URL}/templates/${source}`, `reconai-${source}-template.csv`)
  },

  async exportExceptions(clientId?: number | null) {
    const path = clientId !== undefined && clientId !== null
      ? `/exceptions/export?client_id=${clientId}`
      : "/exceptions/export"
    await downloadFile(`${API_URL}${path}`, "reconai-exceptions.csv")
  },
}
