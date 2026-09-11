const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
const TOKEN_KEY = "reconai_token"
const USER_KEY = "reconai_user"
const REQUEST_TIMEOUT_MS = 15_000
const MAX_RETRIES = 1

export type AuthResponse = {
  access_token: string
  token_type: string
  user_id: number
  email: string
}

export type ImportResult = {
  import_id: number
  source: "bank" | "internal"
  filename: string
  imported: number
  rejected: number
  created_at: string
  rejections: { row: string; reason: string }[]
}

export type Import = {
  id: number
  source: "bank" | "internal"
  filename: string
  imported: number
  rejected: number
  created_at: string
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
  if (err instanceof DOMException && err.name === "AbortError") return "Request timed out. The server may be starting up — try again in a moment."
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

// ─── Fetch helper with timeout + retry ───
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
        if (res.status === 401) clearSession()
        throw new ApiError(res.status, detail)
      }
      return res.json() as Promise<T>
    } catch (err) {
      clearTimeout(timer)
      lastError = err

      if (err instanceof ApiError) throw err
      if (err instanceof DOMException && err.name === "AbortError") {
        if (attempt < MAX_RETRIES) continue
        throw new NetworkError("Server is not responding. It may be starting up — please try again in a moment.")
      }
      if (err instanceof TypeError) {
        if (attempt < MAX_RETRIES) continue
        throw new NetworkError("Cannot reach the server. Please check your connection and try again.")
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
      if (res.status === 401) clearSession()
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

  async uploadCsv(source: "bank" | "internal", file: File) {
    const form = new FormData()
    form.append("source", source)
    form.append("file", file)
    return request<ImportResult>("/imports", { method: "POST", body: form })
  },

  async runReconcile() {
    return request<ReconcileSummary>("/reconcile", { method: "POST" })
  },

  async getSummary() {
    return request<ReconcileSummary>("/reconcile")
  },

  async getExceptions(status?: "open" | "resolved", type?: "unmatched" | "mismatch") {
    const params = new URLSearchParams()
    if (status) params.set("status", status)
    if (type) params.set("type", type)
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

  async getImports() {
    return request<Import[]>("/imports")
  },

  async deleteImport(importId: number) {
    return request<ReconcileSummary>(`/imports/${importId}`, { method: "DELETE" })
  },

  async deleteAllData() {
    return request<ReconcileSummary>("/data", { method: "DELETE" })
  },

  async downloadTemplate(source: "bank" | "internal") {
    await downloadFile(`${API_URL}/templates/${source}`, `reconai-${source}-template.csv`)
  },

  async exportExceptions() {
    await downloadFile(`${API_URL}/exceptions/export`, "reconai-exceptions.csv")
  },
}