// The "active client" is the workspace the firm is currently looking at.
// It is a UI preference, not security — every API call is still scoped and
// authorised server-side by the client_id sent with the request.

export const CLIENT_STORAGE_KEY = "reconai_active_client"
export const CLIENT_CHANGED_EVENT = "reconai:client-changed"

export function getActiveClientId(): number | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(CLIENT_STORAGE_KEY)
  if (!raw) return null
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function setActiveClientId(id: number | null) {
  if (typeof window === "undefined") return
  if (id === null) {
    window.localStorage.removeItem(CLIENT_STORAGE_KEY)
  } else {
    window.localStorage.setItem(CLIENT_STORAGE_KEY, String(id))
  }
  window.dispatchEvent(new CustomEvent(CLIENT_CHANGED_EVENT, { detail: id }))
}
