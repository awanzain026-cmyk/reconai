const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
const TOKEN_KEY = "reconai_token"
const USER_KEY = "reconai_user"

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

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
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

// ─── Fetch helper ───
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers })
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
}